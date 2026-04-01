# Prompt d'implémentation — Flow post-test, annotations coach, publication des résultats

## Contexte

MINND est une plateforme SaaS de performance mentale (Next.js 14 App Router, Supabase, Tailwind, shadcn/ui).

Un coach assigne un test psychométrique à un client (athlète/professionnel). Le client passe le test. **Actuellement, les résultats s'affichent immédiatement après le test.** Ce comportement doit changer.

### Ce qui doit être implémenté

1. **Bloquer les résultats** après complétion — le client ne voit PAS ses scores immédiatement
2. **Notifier le coach** par email dès que le client complète le test
3. **Permettre au coach d'annoter** chaque compétence et sous-compétence avant publication
4. **Bouton "Publier les résultats"** côté coach — libère les résultats avec toutes ses annotations
5. **Page de confirmation client** post-test avec barre de progression à 3 étapes
6. **Notifier le client** par email quand le coach publie
7. **Afficher les annotations coach** sur la page résultats client (à côté des scores)

---

## Stack & Conventions

- Next.js 14 App Router + Server Actions (`'use server'`)
- Supabase (PostgreSQL + Auth + RLS) — client normal + `createAdminClient()` pour bypasser RLS
- TypeScript strict — **jamais de `any`**, **jamais de silent catch**
- Zod pour toute validation d'inputs
- shadcn/ui pour tous les composants UI
- Resend pour les emails (`@react-email/components`)
- Commentaires métier en **français**, code en **anglais**
- Tables BDD : `snake_case`
- Couleurs MINND : Teal `#20808D`, Mauve `#944454`, Gold `#FFC553`, Dark `#1A1A2E`, Light Teal `#E8F4F5`

---

## 1. Migrations Supabase

### Migration 1 — Champ `results_released_at` sur `tests`

Fichier : `supabase/migrations/20260402000002_add_results_released_at.sql`

```sql
-- Contrôle la visibilité des résultats côté client
-- NULL = résultats non publiés, valeur = date de publication par le coach
ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS results_released_at TIMESTAMPTZ DEFAULT NULL;

-- Index pour les requêtes "résultats non encore publiés" côté coach
CREATE INDEX IF NOT EXISTS idx_tests_results_released_at
  ON public.tests (results_released_at)
  WHERE results_released_at IS NULL;
```

### Migration 2 — Table `test_coach_notes`

Fichier : `supabase/migrations/20260402000003_create_test_coach_notes.sql`

```sql
-- Annotations du coach sur les compétences d'un test client
CREATE TABLE public.test_coach_notes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id           UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  coach_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  node_id           UUID NOT NULL REFERENCES public.competency_tree(id) ON DELETE CASCADE,
  note              TEXT NOT NULL CHECK (char_length(note) BETWEEN 1 AND 2000),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Une seule note par compétence par test
  UNIQUE (test_id, node_id)
);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_test_coach_notes_updated_at
  BEFORE UPDATE ON public.test_coach_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.test_coach_notes ENABLE ROW LEVEL SECURITY;

-- Le coach peut lire/écrire ses propres annotations
CREATE POLICY "coach_crud_own_notes"
  ON public.test_coach_notes
  FOR ALL
  USING ((SELECT auth.uid()) = coach_id)
  WITH CHECK ((SELECT auth.uid()) = coach_id);

-- Le client peut lire les annotations des tests PUBLIÉS qui lui appartiennent
-- (via tests.user_id = auth.uid() ET tests.results_released_at IS NOT NULL)
CREATE POLICY "client_read_released_notes"
  ON public.test_coach_notes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tests t
      WHERE t.id = test_id
        AND t.user_id = (SELECT auth.uid())
        AND t.results_released_at IS NOT NULL
    )
  );
```

---

## 2. Types TypeScript

Ajouter dans `src/types/index.ts` :

```typescript
export interface CoachNote {
  id: string
  test_id: string
  coach_id: string
  node_id: string
  note: string
  created_at: string
  updated_at: string
}

// Map node_id → note pour accès rapide côté composant
export type CoachNotesMap = Record<string, string>
```

---

## 3. Server Actions

### 3a. Modifier `completeTestAction()` dans `src/app/actions/test.ts`

Après le calcul des scores et la mise à jour en base, **avant le return** :

1. Récupérer l'email du coach (via `tests.coach_id → users.email`)
2. Récupérer le nom du client et le nom du test
3. Envoyer `TestCompletedCoachEmail` via Resend si `RESEND_API_KEY` est défini
4. **Ne plus retourner l'URL de résultats** — retourner uniquement `{ testId, slug }` pour rediriger vers la page merci

La logique de redirection après `completeTestAction()` dans `TestEngine.tsx` doit pointer vers `/test/${slug}/merci/${testId}` au lieu de `/test/${slug}/results/${testId}`.

### 3b. Nouveau fichier `src/app/actions/coach-notes.ts`

```typescript
'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { Resend } from 'resend'
import { TestResultsReadyEmail } from '@/emails/TestResultsReadyEmail'

const upsertNoteSchema = z.object({
  testId: z.string().uuid(),
  nodeId: z.string().uuid(),
  note: z.string().min(1).max(2000),
})

/** Sauvegarde ou met à jour une annotation de coach sur une compétence */
export async function upsertCoachNoteAction(
  testId: string,
  nodeId: string,
  note: string
): Promise<{ error: string | null }> {
  const parsed = upsertNoteSchema.safeParse({ testId, nodeId, note })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  // Vérifie rôle coach
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'coach') return { error: 'Accès réservé aux coachs' }

  // Vérifie que ce test appartient bien au coach
  const { data: test } = await supabase
    .from('tests')
    .select('id, coach_id')
    .eq('id', parsed.data.testId)
    .single()
  if (!test || test.coach_id !== user.id) return { error: 'Test introuvable' }

  const { error } = await supabase
    .from('test_coach_notes')
    .upsert(
      {
        test_id: parsed.data.testId,
        coach_id: user.id,
        node_id: parsed.data.nodeId,
        note: parsed.data.note.trim(),
      },
      { onConflict: 'test_id,node_id' }
    )

  if (error) return { error: error.message }
  return { error: null }
}

/** Supprime une annotation de coach */
export async function deleteCoachNoteAction(
  testId: string,
  nodeId: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { error } = await supabase
    .from('test_coach_notes')
    .delete()
    .eq('test_id', testId)
    .eq('node_id', nodeId)
    .eq('coach_id', user.id)

  if (error) return { error: error.message }
  return { error: null }
}

/** Récupère toutes les annotations d'un test pour le coach (vue édition) */
export async function getCoachNotesForTestAction(
  testId: string
): Promise<{ data: Record<string, string> | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Non authentifié' }

  const { data, error } = await supabase
    .from('test_coach_notes')
    .select('node_id, note')
    .eq('test_id', testId)
    .eq('coach_id', user.id)

  if (error) return { data: null, error: error.message }

  const notesMap: Record<string, string> = {}
  for (const row of data ?? []) {
    notesMap[row.node_id] = row.note
  }

  return { data: notesMap, error: null }
}

/** Publie les résultats du test + notifie le client par email */
export async function publishTestResultsAction(
  testId: string
): Promise<{ error: string | null }> {
  const uuidParsed = z.string().uuid().safeParse(testId)
  if (!uuidParsed.success) return { error: 'ID test invalide' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const admin = createAdminClient()

  // Récupère le test avec infos client + test_definition
  const { data: test, error: fetchError } = await admin
    .from('tests')
    .select(`
      id,
      coach_id,
      results_released_at,
      status,
      test_definitions ( name ),
      users!tests_user_id_fkey ( email, nom, prenom )
    `)
    .eq('id', testId)
    .single()

  if (fetchError || !test) return { error: 'Test introuvable' }
  if (test.coach_id !== user.id) return { error: 'Accès refusé' }
  if (test.status !== 'completed') return { error: 'Le test n\'est pas encore complété' }
  if (test.results_released_at) return { error: 'Les résultats ont déjà été publiés' }

  // Publie les résultats
  const { error: updateError } = await admin
    .from('tests')
    .update({ results_released_at: new Date().toISOString() })
    .eq('id', testId)

  if (updateError) return { error: updateError.message }

  // Récupère le nom du coach pour l'email
  const { data: coachData } = await admin
    .from('users')
    .select('nom, prenom')
    .eq('id', user.id)
    .single()

  // Envoie email au client si email disponible et Resend configuré
  type UserInfo = { email: string | null; nom: string; prenom: string | null }
  const clientUser = Array.isArray(test.users) ? test.users[0] : test.users as UserInfo | null
  const defRecord = Array.isArray(test.test_definitions) ? test.test_definitions[0] : test.test_definitions as { name: string } | null

  if (clientUser?.email && process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const coachName = coachData
      ? [coachData.prenom, coachData.nom].filter(Boolean).join(' ')
      : 'Votre coach'
    const clientName = clientUser.prenom ?? clientUser.nom
    const testName = defRecord?.name ?? 'Test MINND'
    const resultsUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/client/results/${testId}`

    const { error: emailError } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'MINND <noreply@myminnd.com>',
      to: [clientUser.email],
      subject: `Vos résultats "${testName}" sont disponibles sur MINND`,
      react: TestResultsReadyEmail({
        clientName,
        coachName,
        testName,
        resultsUrl,
      }),
    })

    if (emailError) {
      console.error('[publishTestResultsAction] Erreur envoi email client:', emailError.message)
    }
  }

  return { error: null }
}
```

---

## 4. Emails à créer

### `src/emails/TestCompletedCoachEmail.tsx`

Email envoyé **au coach** quand un client complète un test.

Props :
```typescript
interface TestCompletedCoachEmailProps {
  coachName: string      // Prénom du coach
  clientName: string     // Prénom + Nom du client
  testName: string       // Nom du test (ex: "Profil Mental Athlète")
  levelSlug: string      // 'discovery' | 'complete' | 'expert'
  globalScore: number    // Score global 0-10
  annotateUrl: string    // URL vers la page d'annotation coach: /coach/tests/{testId}/results
}
```

Contenu :
- Objet : `[clientName] a complété son test [testName]`
- Corps : "Bonjour [coachName], votre client [clientName] vient de compléter le [testName] avec un score de [globalScore]/10. Annotez les résultats et publiez-les pour qu'il puisse les consulter."
- CTA principal : "Voir et annoter les résultats" → `annotateUrl`
- Design : couleurs MINND, `@react-email/components`

### `src/emails/TestResultsReadyEmail.tsx`

Email envoyé **au client** quand le coach publie ses résultats.

Props :
```typescript
interface TestResultsReadyEmailProps {
  clientName: string     // Prénom du client
  coachName: string      // Prénom + Nom du coach
  testName: string       // Nom du test
  resultsUrl: string     // URL résultats client: /client/results/{testId}
}
```

Contenu :
- Objet : `Vos résultats "${testName}" sont disponibles sur MINND`
- Corps : "Bonjour [clientName], votre coach [coachName] a préparé votre restitution personnalisée pour le [testName]. Vos résultats sont maintenant disponibles."
- CTA principal : "Voir mes résultats" → `resultsUrl`

---

## 5. Pages à créer / modifier

### 5a. NOUVELLE page — Confirmation post-test

**Fichier :** `src/app/(test)/test/[slug]/merci/[testId]/page.tsx`

**Route :** `/test/pma/merci/[testId]` (remplace la redirection vers `/results/`)

**Ce que cette page affiche :**

```
┌──────────────────────────────────────────────────┐
│      ✅  Merci ! Votre test a bien été enregistré  │
│                                                  │
│  Votre coach [Prénom Coach] a été notifié         │
│  et prépare votre restitution personnalisée.      │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │ ●────────●────────○                      │    │
│  │ Test     Coach    Résultats              │    │
│  │ complété notifié  en préparation         │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  Vous recevrez un email dès que vos résultats    │
│  seront disponibles.                             │
│                                                  │
│  [ Retour à mon espace ]                         │
└──────────────────────────────────────────────────┘
```

**Logique :**
- Fetcher le test via `testId` — vérifier `user_id = auth.uid() AND status = 'completed'`
- Fetcher le nom du coach via `tests.coach_id → users.nom`
- Si `results_released_at IS NOT NULL` → afficher un 4e état "Résultats disponibles" + CTA vers `/client/results/{testId}`
- Le stepper a 3 étapes : "Test complété" (✅), "Coach notifié" (✅), "Résultats en préparation" (🔒 → ✅ si released)
- Implémentation du stepper avec shadcn/ui ou composant custom simple (3 cercles + lignes)

**Polling optionnel (Sprint 2) :** Vérifier toutes les 30s si `results_released_at` est set (fetch Server Action), et si oui → passer le stepper à l'étape 3 + afficher le CTA résultats.

### 5b. MODIFIER `TestEngine.tsx` — Redirection post-complétion

**Fichier :** `src/components/test/TestEngine.tsx`

Changer la ligne qui redirige vers les résultats :
- **Avant :** `router.push(`/test/${testSlug}/results/${testId}`)`
- **Après :** `router.push(`/test/${testSlug}/merci/${testId}`)`

### 5c. MODIFIER la page résultats test flow — Guard résultats

**Fichier :** `src/app/(test)/test/[slug]/results/[testId]/page.tsx`

Ajouter après la récupération du test :
```typescript
// Si les résultats ne sont pas encore publiés, rediriger vers la page d'attente
if (!testRow.results_released_at) {
  redirect(`/test/${slug}/merci/${testId}`)
}
```

Sélectionner aussi `results_released_at` dans la requête initiale.

### 5d. MODIFIER la page résultats client — Guard + affichage notes

**Fichier :** `src/app/(client)/client/results/[testId]/page.tsx`

1. Modifier `getClientTestDetail()` dans `src/app/actions/client-data.ts` :
   - Ajouter `results_released_at` dans le SELECT
   - Si `results_released_at IS NULL` → retourner `null` (le `notFound()` existant s'en chargera)
   - Récupérer aussi les annotations coach : `test_coach_notes(node_id, note)` dans la même requête

2. Dans la page, afficher les notes sous chaque compétence :
   ```tsx
   {/* Note du coach sous chaque domaine et sous chaque SubcompetenceBar */}
   {coachNotesMap[domain.id] && (
     <div className="mt-2 rounded-md bg-[#E8F4F5] px-3 py-2">
       <p className="text-xs font-semibold text-[#20808D] mb-0.5">Note de votre coach</p>
       <p className="text-sm text-[#1A1A2E]">{coachNotesMap[domain.id]}</p>
     </div>
   )}
   ```

### 5e. MODIFIER la page résultats coach — Annotations + bouton Publier

**Fichier :** `src/app/(dashboard)/coach/tests/[testId]/results/page.tsx`

Cette page devient la **page d'annotation et publication**. Ajouter :

1. Sélectionner aussi `results_released_at, client_id` dans la requête test
2. Charger les annotations existantes : `getCoachNotesForTestAction(testId)`
3. Afficher un composant `CoachAnnotationPanel` (Client Component) pour chaque domaine et sous-compétence
4. Ajouter un bandeau en haut : "Annotez les compétences ci-dessous, puis publiez les résultats pour que votre client puisse les consulter."
5. Si `results_released_at IS NOT NULL` : afficher "Résultats publiés le [date]" en badge vert + désactiver les annotations

**Structure visuelle pour chaque domaine :**
```
┌─────────────────────────────────────────────────────┐
│ DOMAINE : Gestion du stress et des émotions  7.3/10  │
│                                                     │
│ 📝 Note du coach :                                   │
│ ┌─────────────────────────────────────────────────┐ │
│ │ [textarea — auto-save]                          │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│   ├─ Régulation émotionnelle ........... 7.8/10     │
│   │  📝 [textarea note sous-compétence]             │
│   ├─ Gestion du stress ................. 6.9/10     │
│   │  📝 [textarea note sous-compétence]             │
└─────────────────────────────────────────────────────┘
```

6. Bouton "Publier les résultats" en bas de page (sticky ou flottant) :
   - Appelle `publishTestResultsAction(testId)`
   - Confirmation avec `AlertDialog` shadcn : "Une fois publiés, votre client pourra voir ses résultats et vos annotations. Cette action est irréversible."
   - Après succès : recharger la page (ou `router.refresh()`)

---

## 6. Composant `CoachAnnotationPanel` (Client Component)

**Fichier :** `src/components/coach/CoachAnnotationPanel.tsx`

```typescript
'use client'

// Props
interface CoachAnnotationPanelProps {
  testId: string
  nodeId: string
  nodeName: string
  initialNote: string        // note existante ou ''
  disabled: boolean          // true si results_released_at IS NOT NULL
}
```

**Comportement :**
- Textarea avec `defaultValue={initialNote}`
- Auto-save avec debounce 800ms sur `onChange` → appelle `upsertCoachNoteAction()`
- Si note vide après blur → appelle `deleteCoachNoteAction()`
- Indicateur visuel : "Enregistré ✓" / "Enregistrement..." / erreur
- `disabled` : textarea en lecture seule avec fond grisé

---

## 7. Modification `completeTestAction()` — Email coach

Dans `src/app/actions/test.ts`, après `locked` confirmé (ligne ~100), ajouter avant le return :

```typescript
// Notification email au coach si Resend configuré
if (process.env.RESEND_API_KEY) {
  const admin = createAdminClient()
  const [{ data: coachData }, { data: defData }, { data: clientData }] = await Promise.all([
    admin.from('users').select('nom, prenom, email').eq('id', testData.coach_id).single(),
    admin.from('test_definitions').select('name').eq('id', testData.test_definition_id).single(),
    admin.from('users').select('nom, prenom').eq('id', user.id).single(),
  ])

  if (coachData?.email) {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const coachFirstName = coachData.prenom ?? coachData.nom
    const clientFullName = [clientData?.prenom, clientData?.nom].filter(Boolean).join(' ')
    const testName = defData?.name ?? 'Test MINND'
    const annotateUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/coach/tests/${testId}/results`

    const { error: emailError } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'MINND <noreply@myminnd.com>',
      to: [coachData.email],
      subject: `${clientFullName} a complété son test ${testName}`,
      react: TestCompletedCoachEmail({
        coachName: coachFirstName,
        clientName: clientFullName,
        testName,
        levelSlug: testData.level_slug,
        globalScore: scoring.globalScore,
        annotateUrl,
      }),
    })

    if (emailError) {
      console.error('[completeTestAction] Erreur envoi email coach:', emailError.message)
    }
  }
}
```

Importer `TestCompletedCoachEmail` en haut du fichier.

---

## 8. Dashboard coach — Badge "résultats à publier"

### Dans `src/components/layout/Sidebar.tsx`

Ajouter un badge rouge sur le lien "Rapports" ou "Clients" indiquant le nombre de tests complétés non publiés.

Server-side (dans le layout coach) :
```typescript
const { count } = await supabase
  .from('tests')
  .select('id', { count: 'exact', head: true })
  .eq('coach_id', user.id)
  .eq('status', 'completed')
  .is('results_released_at', null)
```

### Dans `src/app/(dashboard)/coach/rapports/RapportsPageClient.tsx`

Ajouter une section "À publier" avec la liste des tests complétés non publiés :
- Colonnes : Client, Test, Niveau, Score, Date complétion, Jours depuis complétion, Actions
- Action : "Annoter & Publier" → lien vers `/coach/tests/{testId}/results`

---

## 9. Vérification RLS

S'assurer que la RLS de `test_coach_notes` permet :
- **Coach** : CRUD sur ses propres notes (coach_id = auth.uid())
- **Client** : SELECT sur les notes des tests où `user_id = auth.uid() AND results_released_at IS NOT NULL`
- Personne d'autre n'a accès

S'assurer que `tests.results_released_at` :
- **Coach** : peut le lire et le setter via `publishTestResultsAction` (admin client)
- **Client** : peut le lire pour ses propres tests (`user_id = auth.uid()`)

---

## 10. Ordre d'implémentation recommandé

### Sprint 1 — Fonctionnel de base (priorité haute)

1. **Migration** `results_released_at` + migration `test_coach_notes`
2. **`completeTestAction()`** : rediriger vers `/merci/` + email coach
3. **Page `/test/[slug]/merci/[testId]`** : confirmation simple (stepper statique)
4. **Guard résultats** : dans `/test/[slug]/results/` ET `/client/results/`
5. **`upsertCoachNoteAction` + `publishTestResultsAction`** (actions BDD)
6. **Page coach résultats** : ajout des textareas + bouton Publier
7. **`TestResultsReadyEmail`** : email client à la publication

### Sprint 2 — Expérience (semaine suivante)

8. **`CoachAnnotationPanel`** : auto-save + indicateur visuel
9. **Affichage notes côté client** : sous chaque compétence/sous-compétence
10. **Badge sidebar** : compteur résultats à publier
11. **Section "À publier"** dans le dashboard rapports
12. **Polling `/merci/`** : détecter publication + afficher CTA dynamique

---

## 11. UX Textes clés (copie française)

| Contexte | Texte |
|----------|-------|
| Page merci — titre | "Merci ! Votre test a bien été enregistré." |
| Page merci — sous-titre | "Votre coach [Prénom] a été notifié et prépare votre restitution personnalisée." |
| Page merci — note bas | "Vous recevrez un email dès que vos résultats seront disponibles." |
| Étape 1 stepper | "Test complété" |
| Étape 2 stepper | "Coach notifié" |
| Étape 3 stepper (attente) | "Résultats en préparation" |
| Étape 3 stepper (disponible) | "Résultats disponibles !" |
| Page coach — bannière | "Annotez les compétences ci-dessous, puis publiez les résultats pour que votre client puisse les consulter." |
| Note textarea placeholder domaine | "Ajoutez un commentaire sur ce domaine…" |
| Note textarea placeholder sous-compétence | "Ajoutez un commentaire sur cette compétence…" |
| Bouton publier | "Publier les résultats" |
| Dialog confirmation | "Une fois publiés, votre client pourra consulter ses résultats et vos annotations. Cette action est irréversible." |
| Après publication | "Résultats publiés le [date]. Votre client a été notifié par email." |
| Email coach — sujet | "[Prénom Client Nom] a complété son test [Nom Test]" |
| Email client — sujet | `Vos résultats "[Nom Test]" sont disponibles sur MINND` |

---

## 12. Fichiers à créer / modifier — Récapitulatif

| Action | Fichier |
|--------|---------|
| CRÉER migration | `supabase/migrations/20260402000002_add_results_released_at.sql` |
| CRÉER migration | `supabase/migrations/20260402000003_create_test_coach_notes.sql` |
| MODIFIER | `src/app/actions/test.ts` — `completeTestAction()` |
| CRÉER | `src/app/actions/coach-notes.ts` |
| MODIFIER | `src/app/actions/client-data.ts` — `getClientTestDetail()` |
| CRÉER email | `src/emails/TestCompletedCoachEmail.tsx` |
| CRÉER email | `src/emails/TestResultsReadyEmail.tsx` |
| CRÉER page | `src/app/(test)/test/[slug]/merci/[testId]/page.tsx` |
| MODIFIER | `src/components/test/TestEngine.tsx` — redirection |
| MODIFIER | `src/app/(test)/test/[slug]/results/[testId]/page.tsx` — guard |
| MODIFIER | `src/app/(client)/client/results/[testId]/page.tsx` — guard + notes |
| MODIFIER | `src/app/(dashboard)/coach/tests/[testId]/results/page.tsx` — annotations + publish |
| CRÉER composant | `src/components/coach/CoachAnnotationPanel.tsx` |
| MODIFIER | `src/app/(dashboard)/coach/rapports/RapportsPageClient.tsx` — section à publier |
| MODIFIER (optionnel) | `src/components/layout/Sidebar.tsx` — badge compteur |
| MODIFIER | `src/types/index.ts` — CoachNote, CoachNotesMap |
