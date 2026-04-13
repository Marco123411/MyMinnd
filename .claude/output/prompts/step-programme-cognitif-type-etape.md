# Prompt d'implémentation — Type d'étape "Cognitif" dans le Programme

## Contexte & Problème

Actuellement, les tests cognitifs et le programme vivent dans deux silos :
- **Onglet Cognitif** : le coach envoie des tests ad-hoc, sans lien au programme
- **Module Programme** : le coach peut ajouter des drills cognitifs *dans* une étape, mais un test cognitif ne peut jamais ÊTRE une étape

Le coach pense "je veux que Pierre fasse un PVT lundi". Actuellement il doit : créer une étape cabinet → déplier → ajouter un drill. C'est 3 couches pour une intention simple.

**Objectif** : ajouter `cognitif` comme 4ème type d'étape de premier niveau dans le programme.

---

## Architecture cible

```
programme
  └─ programme_etapes (type: cabinet | autonomie | recurrente | cognitif ← NOUVEAU)
      ├─ (cabinet)    → cabinet_session_id
      ├─ (autonomie)  → autonomous_session_id
      ├─ (recurrente) → recurring_template_id
      └─ (cognitif)   → cognitive_session_id ← NOUVEAU
          └─ cognitive_sessions (status: pending → completed)
              └─ computed_metrics (résultats)
```

**Lien bidirectionnel :**
- `programme_etapes.cognitive_session_id` → `cognitive_sessions.id` (forward)
- `cognitive_sessions.programme_etape_id` → `programme_etapes.id` (back, pour le contexte dans CognitiveTab)

---

## Fichiers à modifier (dans l'ordre)

| # | Fichier | Type de changement |
|---|---------|-------------------|
| 1 | `supabase/migrations/20260412000000_programme_etapes_cognitif_type.sql` | NOUVEAU |
| 2 | `src/types/index.ts` | Modifier TypeSeance, ProgrammeEtape, ProgrammeEtapeEnrichie |
| 3 | `src/app/actions/programmes.ts` | Modifier enrichEtapes, addEtapeSchema, createAndAddEtapeAction, getClientProgrammesAction |
| 4 | `src/components/coach/AddEtapeDialog.tsx` | 4ème card + formulaire cognitif |
| 5 | `src/components/coach/ProgrammeEtapesList.tsx` | Afficher les étapes cognitives |
| 6 | `src/app/actions/cognitive-results.ts` | Ajouter programme_etape_id dans SELECT |
| 7 | `src/app/(dashboard)/coach/clients/[id]/CognitiveTab.tsx` | Colonne "Source" (programme vs ad-hoc) |

---

## 1. Migration SQL

Créer `supabase/migrations/20260412000000_programme_etapes_cognitif_type.sql` :

```sql
-- Étape 1 : Ajouter cognitive_session_id à programme_etapes
ALTER TABLE public.programme_etapes
  ADD COLUMN IF NOT EXISTS cognitive_session_id UUID
    REFERENCES public.cognitive_sessions(id) ON DELETE SET NULL;

-- Étape 2 : Ajouter programme_etape_id à cognitive_sessions (back-reference)
ALTER TABLE public.cognitive_sessions
  ADD COLUMN IF NOT EXISTS programme_etape_id UUID
    REFERENCES public.programme_etapes(id) ON DELETE SET NULL;

-- Étape 3 : Mettre à jour le CHECK sur type_seance
ALTER TABLE public.programme_etapes
  DROP CONSTRAINT IF EXISTS programme_etapes_type_seance_check;

ALTER TABLE public.programme_etapes
  ADD CONSTRAINT programme_etapes_type_seance_check
    CHECK (type_seance IN ('cabinet', 'autonomie', 'recurrente', 'cognitif'));

-- Étape 4 : Mettre à jour la contrainte one_fk pour accepter cognitif
ALTER TABLE public.programme_etapes
  DROP CONSTRAINT IF EXISTS programme_etapes_one_fk;

ALTER TABLE public.programme_etapes
  ADD CONSTRAINT programme_etapes_one_fk CHECK (
    (
      type_seance = 'cognitif'
      AND cognitive_session_id IS NOT NULL
      AND cabinet_session_id IS NULL
      AND autonomous_session_id IS NULL
      AND recurring_template_id IS NULL
    ) OR (
      type_seance != 'cognitif'
      AND cognitive_session_id IS NULL
      AND (
        (cabinet_session_id   IS NOT NULL)::int +
        (autonomous_session_id IS NOT NULL)::int +
        (recurring_template_id IS NOT NULL)::int
      ) = 1
    )
  );

-- Index pour les requêtes de back-reference
CREATE INDEX IF NOT EXISTS idx_cognitive_sessions_programme_etape_id
  ON public.cognitive_sessions(programme_etape_id)
  WHERE programme_etape_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_programme_etapes_cognitive_session_id
  ON public.programme_etapes(cognitive_session_id)
  WHERE cognitive_session_id IS NOT NULL;
```

---

## 2. Types TypeScript (`src/types/index.ts`)

```ts
// Ajouter 'cognitif' au type existant
export type TypeSeance = 'cabinet' | 'autonomie' | 'recurrente' | 'cognitif'

// Ajouter cognitive_session_id à ProgrammeEtape
export interface ProgrammeEtape {
  id: string
  programme_id: string
  ordre: number
  type_seance: TypeSeance
  cabinet_session_id: string | null
  autonomous_session_id: string | null
  recurring_template_id: string | null
  cognitive_session_id: string | null   // ← NOUVEAU
  created_at: string
}

// Ajouter cognitive_session à ProgrammeEtapeEnrichie
export interface ProgrammeEtapeEnrichie extends ProgrammeEtape {
  cabinet?: CabinetSession
  autonomous?: AutonomousSession
  template?: RecurringTemplate
  cognitive_session?: {                  // ← NOUVEAU
    id: string
    status: 'pending' | 'in_progress' | 'completed' | 'abandoned'
    completed_at: string | null
    computed_metrics: CognitiveTestResult | null
    test_name: string
    test_slug: string
  } | null
  est_complete: boolean
  titre_display: string
  program_exercises: ProgramExercise[]
}
```

---

## 3. Actions programmes (`src/app/actions/programmes.ts`)

### 3a. Mise à jour de `addEtapeSchema`

```ts
const addEtapeSchema = z.object({
  programme_id:          z.string().uuid(),
  type_seance:           z.enum(['cabinet', 'autonomie', 'recurrente', 'cognitif']),
  cabinet_session_id:    z.string().uuid().optional().nullable(),
  autonomous_session_id: z.string().uuid().optional().nullable(),
  recurring_template_id: z.string().uuid().optional().nullable(),
  cognitive_session_id:  z.string().uuid().optional().nullable(),  // ← NOUVEAU
})
```

### 3b. Mise à jour du `fkCount` dans `addEtapeAction`

```ts
const fkCount = [
  parsed.data.cabinet_session_id,
  parsed.data.autonomous_session_id,
  parsed.data.recurring_template_id,
  parsed.data.cognitive_session_id,   // ← AJOUTER
].filter(Boolean).length
```

### 3c. Mise à jour de `getClientProgrammesAction` — la requête Supabase

Ajouter `cognitive_sessions` dans le select des programme_etapes :

```ts
programme_etapes (
  *,
  cabinet_sessions (*),
  autonomous_sessions (*),
  recurring_templates (*),
  cognitive_sessions (
    id, status, completed_at, computed_metrics,
    cognitive_test_definitions ( name, slug )
  ),
  program_exercises (
    *,
    cognitive_test_definitions (*)
  )
)
```

### 3d. Mise à jour de `RawEtapeRow` et `enrichEtapes`

```ts
type RawEtapeRow = {
  // ... champs existants ...
  cognitive_session_id: string | null
  cognitive_sessions: {
    id: string
    status: string
    completed_at: string | null
    computed_metrics: unknown
    cognitive_test_definitions: { name: string; slug: string } | { name: string; slug: string }[] | null
  } | null
  // ... program_exercises existant ...
}
```

Dans `enrichEtapes`, ajouter le cas `cognitif` :

```ts
// Calcul de titre_display et est_complete pour 'cognitif'
if (etape.type_seance === 'cognitif') {
  const rawCogSession = etape.cognitive_sessions
  const cogSession = Array.isArray(rawCogSession) ? rawCogSession[0] : rawCogSession
  const def = cogSession
    ? (Array.isArray(cogSession.cognitive_test_definitions)
        ? cogSession.cognitive_test_definitions[0]
        : cogSession.cognitive_test_definitions)
    : null

  return {
    ...baseEtape,
    cognitive_session_id: etape.cognitive_session_id,
    cognitive_session: cogSession
      ? {
          id: cogSession.id,
          status: cogSession.status as 'pending' | 'in_progress' | 'completed' | 'abandoned',
          completed_at: cogSession.completed_at ?? null,
          computed_metrics: cogSession.computed_metrics as CognitiveTestResult | null,
          test_name: def?.name ?? 'Test cognitif',
          test_slug: def?.slug ?? '',
        }
      : null,
    est_complete: cogSession?.status === 'completed',
    titre_display: def?.name ?? 'Test cognitif',
    program_exercises: [],
  }
}
```

### 3e. Nouveau schéma + logique dans `createAndAddEtapeAction`

Ajouter le schéma pour le type cognitif :

```ts
const createCognitifEtapeSchema = z.object({
  programme_id: z.string().uuid(),
  test_slug:    z.string().min(1, 'Le test est requis'),
  preset_id:    z.string().uuid().optional().nullable(),
  date_cible:   z.string().optional().nullable(),
})
```

Ajouter la branche `'cognitif'` dans `createAndAddEtapeAction` :

```ts
} else if (type === 'cognitif') {
  const parsed = createCognitifEtapeSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  // Récupérer l'ID du test cognitif depuis le slug
  const { data: testDef, error: testError } = await admin
    .from('cognitive_test_definitions')
    .select('id, name')
    .eq('slug', parsed.data.test_slug)
    .eq('is_active', true)
    .single()

  if (testError || !testDef) return { error: 'Test cognitif introuvable' }

  // Créer la session pending (sans programme_etape_id pour l'instant)
  const { data: session, error } = await admin
    .from('cognitive_sessions')
    .insert({
      user_id:           clientUserId,
      coach_id:          user.id,
      cognitive_test_id: testDef.id,
      preset_id:         parsed.data.preset_id ?? null,
      status:            'pending',
    })
    .select('id')
    .single()

  if (error || !session) return { error: error?.message ?? 'Erreur création session cognitive' }
  newSessionId = session.id as string
  sessionTable = null  // pas de rollback table standard — voir rollback cognitif ci-dessous
}
```

**Rollback cognitif** : après l'insert dans `programme_etapes`, si succès → mettre à jour `cognitive_sessions.programme_etape_id = etape.id`. Si l'insert de l'étape échoue → supprimer la session. Remplacer la variable `sessionTable` par une gestion spécifique pour le cas cognitif :

```ts
// Insert étape
const { data: newEtape, error: etapeError } = await admin
  .from('programme_etapes')
  .insert({
    programme_id:          parsedProgrammeId.data,
    ordre:                 prochain_ordre,
    type_seance:           type,
    cabinet_session_id:    type === 'cabinet'    ? newSessionId : null,
    autonomous_session_id: type === 'autonomie'  ? newSessionId : null,
    recurring_template_id: type === 'recurrente' ? newSessionId : null,
    cognitive_session_id:  type === 'cognitif'   ? newSessionId : null,
  })
  .select('id')
  .single()

if (etapeError || !newEtape) {
  // Rollback
  if (type === 'cognitif') {
    await admin.from('cognitive_sessions').delete().eq('id', newSessionId)
  } else {
    await admin.from(sessionTable!).delete().eq('id', newSessionId)
  }
  return { error: etapeError?.message ?? 'Erreur ajout étape' }
}

// Back-link pour le type cognitif
if (type === 'cognitif') {
  await admin
    .from('cognitive_sessions')
    .update({ programme_etape_id: (newEtape as { id: string }).id })
    .eq('id', newSessionId)
}
```

⚠️ Modifier l'insert étape existant pour ajouter `cognitive_session_id` et retourner `.select('id').single()` au lieu de juste `{ error }`.

---

## 4. `AddEtapeDialog.tsx` — 4ème card + formulaire

### Props (inchangées par rapport à la version actuelle)

```ts
interface AddEtapeDialogProps {
  programmeId: string
  cognitiveTests: CognitiveTestDefinition[]  // ← AJOUTER (passé depuis ProgrammeEtapesList)
  onAdded?: () => void
}
```

### Ajouter dans `TYPE_CARDS` :

```ts
{
  type: 'cognitif' as TypeSeance,
  label: 'Cognitif',
  sub: 'Test de performance',
  Icon: Brain,  // import depuis lucide-react
  color: '#20808D',
  borderClass: 'border-[#20808D]',
  bgClass: 'bg-[#E8F4F5]',
},
```

### Nouveau formulaire `CognitifForm` :

```tsx
function CognitifForm({
  data,
  onChange,
  cognitiveTests,
}: {
  data: Record<string, string>
  onChange: (k: string, v: string) => void
  cognitiveTests: CognitiveTestDefinition[]
}) {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="test_slug">
          Test cognitif <span className="text-red-500">*</span>
        </Label>
        <Select
          value={data.test_slug ?? ''}
          onValueChange={(v) => onChange('test_slug', v)}
        >
          <SelectTrigger id="test_slug">
            <SelectValue placeholder="Choisir un test..." />
          </SelectTrigger>
          <SelectContent>
            {cognitiveTests.map((t) => (
              <SelectItem key={t.slug} value={t.slug}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="date_cible">
          Date cible <span className="text-xs text-muted-foreground">(optionnel)</span>
        </Label>
        <Input
          id="date_cible"
          type="date"
          value={data.date_cible ?? ''}
          onChange={(e) => onChange('date_cible', e.target.value)}
        />
      </div>
    </>
  )
}
```

Ajouter `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` aux imports shadcn/ui.
Ajouter `Brain` aux imports lucide.

Dans le JSX du form (step 2), ajouter :
```tsx
{selectedType === 'cognitif' && (
  <CognitifForm
    data={formData}
    onChange={handleFieldChange}
    cognitiveTests={cognitiveTests}
  />
)}
```

---

## 5. `ProgrammeEtapesList.tsx` — Afficher les étapes cognitives

### Mise à jour des imports

```tsx
import { Brain } from 'lucide-react'
// Brain est peut-être déjà importé
```

### Mise à jour de `TypeBadge`

```tsx
function TypeBadge({ type }: { type: string }) {
  if (type === 'cabinet')    return <Badge variant="outline" className="text-[#7069F4] border-[#7069F4] text-xs gap-1"><UserCheck className="h-3 w-3" />Cabinet</Badge>
  if (type === 'autonomie')  return <Badge variant="outline" className="text-[#3C3CD6] border-[#3C3CD6] text-xs gap-1"><Clock className="h-3 w-3" />Autonome</Badge>
  if (type === 'recurrente') return <Badge variant="outline" className="text-amber-600 border-amber-400 text-xs gap-1"><RefreshCw className="h-3 w-3" />Routine</Badge>
  if (type === 'cognitif')   return <Badge variant="outline" className="text-[#20808D] border-[#20808D] text-xs gap-1"><Brain className="h-3 w-3" />Cognitif</Badge>
  return null
}
```

### Nouveau composant `CognitifEtapeStatus`

Afficher le statut + lien résultats si complété :

```tsx
function CognitifEtapeStatus({
  session,
}: {
  session: ProgrammeEtapeEnrichie['cognitive_session']
}) {
  if (!session) return null
  if (session.status === 'completed') {
    return (
      <div className="flex items-center gap-1.5 mt-1 text-xs text-[#20808D]">
        <CheckCircle2 className="h-3 w-3" />
        <span>Complété</span>
        {session.completed_at && (
          <span className="text-muted-foreground">
            — {new Date(session.completed_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>
    )
  }
  if (session.status === 'in_progress') {
    return (
      <div className="flex items-center gap-1.5 mt-1 text-xs text-amber-600">
        <Clock className="h-3 w-3" />
        <span>En cours</span>
      </div>
    )
  }
  // pending ou abandoned
  return (
    <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
      <Clock className="h-3 w-3" />
      <span>En attente du client</span>
    </div>
  )
}
```

### Dans la liste des étapes (`programme.etapes.map`)

Pour les étapes cognitives, masquer le bouton "drills" (toggle expand) car les étapes cognitives sont leur propre drill :

```tsx
const isCognitif = etape.type_seance === 'cognitif'

// Masquer le toggle et AddDrillDialog si cognitif
{!isCognitif && (
  <Button variant="ghost" size="icon" /* toggle drills */ />
)}
```

Et dans le contenu de l'étape, afficher le statut :

```tsx
{isCognitif && etape.cognitive_session && (
  <CognitifEtapeStatus session={etape.cognitive_session} />
)}
```

### Passer `cognitiveTests` à `AddEtapeDialog`

```tsx
<AddEtapeDialog
  programmeId={programme.id}
  cognitiveTests={cognitiveTests}   // ← AJOUTER (déjà disponible dans les props)
  onAdded={onUpdate}
/>
```

---

## 6. `getCognitiveSessionsForClient` — Ajouter le contexte programme

Dans `src/app/actions/cognitive-results.ts`, mettre à jour `SESSION_SELECT` pour inclure `programme_etape_id` :

```ts
const SESSION_SELECT = 'id, completed_at, cognitive_test_id, computed_metrics, preset_id, programme_etape_id, cognitive_test_definitions(slug, name), cognitive_test_presets(slug, name, is_validated)'
```

Mettre à jour `CognitiveSessionWithDefinition` et `mapRowToSession` pour exposer `programme_etape_id` :

```ts
export interface CognitiveSessionWithDefinition {
  // ... champs existants ...
  programme_etape_id: string | null   // ← NOUVEAU
}

// Dans mapRowToSession :
programme_etape_id: s.programme_etape_id ?? null,
```

Et le type du paramètre `s` dans `mapRowToSession` :
```ts
programme_etape_id: string | null    // ← AJOUTER dans le type du param
```

---

## 7. `CognitiveTab.tsx` — Colonne "Source"

Dans le tableau des sessions complétées, ajouter une colonne "Source" :

```tsx
// Dans les headers du tableau
<th>Source</th>

// Dans chaque ligne
<td>
  {session.programme_etape_id ? (
    <Badge variant="outline" className="text-[#20808D] border-[#20808D] text-xs gap-1">
      <Layout className="h-3 w-3" />
      Programme
    </Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground text-xs">
      Ad-hoc
    </Badge>
  )}
</td>
```

Importer `Layout` depuis lucide-react.

---

## Contraintes techniques

- **TypeScript strict** — pas de `any`. Le type `RawEtapeRow` doit être mis à jour avec `cognitive_sessions`.
- **Rollback** : si insert de l'étape échoue → supprimer la `cognitive_session` créée.
- **Back-link best-effort** : si l'update `cognitive_sessions.programme_etape_id` échoue (pas critique), ne pas bloquer — log et continuer.
- **shadcn/ui uniquement** — le `Select` pour les tests cognitifs utilise `@/components/ui/select`.
- **`Brain` est déjà importé** dans `ProgrammeEtapesList` — vérifier avant d'ajouter l'import.
- **Couleurs MINND** : cognitif = `#20808D` (teal primaire), `bg-[#E8F4F5]` (light teal).
- **La migration doit être appliquée** sur Supabase avant de tester (ou en local avec `supabase db reset`).

---

## Fichiers à NE PAS toucher

- `DrillConfigurator.tsx` — les drills PRE/IN/POST d'étapes existantes sont inchangés
- `AddDrillDialog.tsx` — inchangé (les drills restent disponibles dans étapes cabinet/autonome)
- `PhaseColumnView.tsx` — inchangé
- Les modals `PlanCabinetSessionModal`, `AssignAutonomousSessionModal`, `CreateRecurringTemplateModal` — restent pour l'historique hors-programme

---

## Critère d'acceptation

> Un coach avec un programme actif peut cliquer "Ajouter une étape" → choisir "Cognitif" → sélectionner "PVT" → cliquer "Créer et ajouter".
>
> L'étape apparaît dans le programme avec le badge "Cognitif", le statut "En attente du client", et le test est visible dans l'onglet Cognitif avec la source "Programme".
>
> Quand le client complète le test, l'étape passe à "Complété" avec la date.
