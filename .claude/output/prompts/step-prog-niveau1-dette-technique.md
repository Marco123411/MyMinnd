# Niveau 1 — Dette technique + vue timeline enrichie

## Contexte & motivation

Le module de programmation coach-client s'appuie sur les tables de sessions existantes
(`cabinet_sessions`, `autonomous_sessions`, `recurring_templates`). Avant d'ajouter la
couche programme (Niveau 2), deux dettes techniques doivent être résolues et une vue
timeline unifiée doit être ajoutée sur la fiche client.

**Dettes identifiées :**

1. **`exercise_responses.session_id`** est un champ `text` libre — il n'a pas de FK vers
   les tables de sessions. Cela rend impossible de retrouver proprement quels exercices ont
   été réalisés dans quelle séance. Remplacé par deux colonnes UUID nullable avec FK typées.

2. **`cabinet_sessions.exercices_utilises`** est un `uuid[]` (tableau plat) alors que
   `autonomous_sessions.exercices` et `recurring_templates.exercices` utilisent `jsonb`
   (`ExerciceOrdonné[]`). La migration aligne la colonne sur le même format JSONB pour que
   toute la stack puisse traiter les exercices de la même façon.

3. **Pas de vue chronologique unifiée** sur la fiche client coach : les 3 types de séances
   (cabinet, autonomie, récurrentes) existent mais ne sont pas affichés dans un seul
   historique clair avec statuts visuels.

---

## Stack technique

- **Next.js 14 App Router** — Server Components + Server Actions
- **Supabase** (PostgreSQL + RLS) — migrations SQL dans `supabase/migrations/`
- **shadcn/ui** — tous les composants UI
- **Admin client** : `createAdminClient()` pour toutes les écritures

---

## Fichiers existants à connaître

```
supabase/migrations/
  20260331000001_create_exercises.sql        ← définit exercise_responses (session_id text)
  20260331000004_create_sessions.sql         ← définit les 3 tables de sessions

src/
  types/index.ts                             ← SessionHistoryItem, ExerciceOrdonné, etc.
  app/
    actions/
      sessions.ts                            ← toutes les server actions sessions
      exercises.ts                           ← saveExerciseResponseAction (écrit session_id)
  app/(dashboard)/coach/clients/[id]/
    page.tsx                                 ← fiche client avec tabs (Séances, etc.)
  components/coach/
    SessionTimeline.tsx                      ← timeline existante (si elle existe)
    sessions/                                ← modals de création de séances
```

---

## Tâche 1 — Migration : normaliser `exercise_responses`

**Fichier :** `supabase/migrations/20260407000000_fix_exercise_responses_session_fk.sql`

```sql
-- Migration Niveau 1 : Normalisation des FKs dans exercise_responses
-- Remplace session_id text par deux colonnes UUID typées

-- Ajout des colonnes FK typées (nullable car une seule sera renseignée)
ALTER TABLE public.exercise_responses
  ADD COLUMN autonomous_session_id  uuid REFERENCES public.autonomous_sessions(id)  ON DELETE SET NULL,
  ADD COLUMN recurring_execution_id uuid REFERENCES public.recurring_executions(id) ON DELETE SET NULL;

-- Index pour les jointures coach (retrouver les réponses d'une séance)
CREATE INDEX idx_exercise_responses_autonomous_session
  ON public.exercise_responses(autonomous_session_id)
  WHERE autonomous_session_id IS NOT NULL;

CREATE INDEX idx_exercise_responses_recurring_execution
  ON public.exercise_responses(recurring_execution_id)
  WHERE recurring_execution_id IS NOT NULL;

-- Migration des données existantes
-- session_type = 'autonomous' : session_id contient l'uuid d'une autonomous_session
UPDATE public.exercise_responses
SET autonomous_session_id = session_id::uuid
WHERE session_type = 'autonomous'
  AND session_id IS NOT NULL
  AND session_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- session_type = 'recurring' : session_id contient l'uuid d'une recurring_execution
UPDATE public.exercise_responses
SET recurring_execution_id = session_id::uuid
WHERE session_type = 'recurring'
  AND session_id IS NOT NULL
  AND session_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Déprécier session_id (gardé pour rétrocompatibilité, ne plus écrire dedans)
COMMENT ON COLUMN public.exercise_responses.session_id
  IS 'DEPRECATED — utiliser autonomous_session_id ou recurring_execution_id';
```

---

## Tâche 2 — Migration : uniformiser `exercices_utilises` dans `cabinet_sessions`

**Fichier :** `supabase/migrations/20260407000001_uniform_cabinet_exercices.sql`

```sql
-- Migration Niveau 1 : Aligner exercices_utilises sur le format ExerciceOrdonné[]
-- cabinet_sessions.exercices_utilises : uuid[] → jsonb

-- Ajouter la nouvelle colonne JSONB
ALTER TABLE public.cabinet_sessions
  ADD COLUMN exercices_utilises_v2 jsonb NOT NULL DEFAULT '[]';

-- Migrer les données : uuid[] → [{ exercise_id, ordre, consignes }]
UPDATE public.cabinet_sessions
SET exercices_utilises_v2 = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'exercise_id', e::text,
      'ordre',       idx - 1,
      'consignes',   ''
    ) ORDER BY idx
  )
  FROM unnest(exercices_utilises) WITH ORDINALITY AS t(e, idx)
)
WHERE array_length(exercices_utilises, 1) > 0;

-- Renommer les colonnes
ALTER TABLE public.cabinet_sessions
  RENAME COLUMN exercices_utilises    TO exercices_utilises_legacy;
ALTER TABLE public.cabinet_sessions
  RENAME COLUMN exercices_utilises_v2 TO exercices_utilises;

-- Supprimer l'ancienne colonne (array)
ALTER TABLE public.cabinet_sessions
  DROP COLUMN exercices_utilises_legacy;
```

---

## Tâche 3 — Mettre à jour les types TypeScript

**Fichier :** `src/types/index.ts`

### 3a — Interface `ExerciseResponse`

Trouver l'interface `ExerciseResponse` (ou la créer si absente) et ajouter les nouveaux champs :

```typescript
export interface ExerciseResponse {
  id: string
  exercise_id: string
  user_id: string
  // Champs legacy (ne plus utiliser pour les nouveaux writes)
  session_id: string | null
  session_type: 'autonomous' | 'recurring' | null
  // Nouveaux champs typés
  autonomous_session_id: string | null
  recurring_execution_id: string | null
  responses: Record<string, unknown>
  completed_at: string
}
```

### 3b — Interface `CabinetSession`

Trouver l'interface `CabinetSession` et changer le champ `exercices_utilises` :

```typescript
// AVANT :
exercices_utilises: string[]  // uuid[]

// APRÈS :
exercices_utilises: ExerciceOrdonné[]  // jsonb unifié
```

---

## Tâche 4 — Mettre à jour `saveExerciseResponseAction`

**Fichier :** `src/app/actions/exercises.ts`

Trouver `saveExerciseResponseAction` (ou la fonction équivalente qui écrit dans `exercise_responses`) et modifier les champs écrits :

```typescript
// AVANT — écriture dans le champ text deprecated :
const payload = {
  exercise_id,
  user_id: user.id,
  session_id: sessionId,        // text non typé
  session_type: sessionType,
  responses,
}

// APRÈS — écriture dans les colonnes FK typées :
const payload = {
  exercise_id,
  user_id: user.id,
  // Ne plus écrire session_id
  autonomous_session_id:  sessionType === 'autonomous' ? sessionId : null,
  recurring_execution_id: sessionType === 'recurring'  ? sessionId : null,
  session_type: sessionType,  // garder pour compatibilité lecture legacy
  responses,
}
```

---

## Tâche 5 — Ajouter une server action `getClientSessionTimeline`

**Fichier :** `src/app/actions/sessions.ts` — ajouter à la fin du fichier.

Cette action retourne toutes les séances d'un client (3 types) dans l'ordre chronologique,
enrichies avec le compte d'exercices complétés vs total.

```typescript
// ============================================================
// Type union pour la timeline unifiée — inclut les 3 types
// ============================================================

export interface ProgrammeTimelineItem {
  id: string
  type: 'cabinet' | 'autonomie' | 'recurrente'
  titre: string
  date: string         // ISO string — pour tri chronologique
  statut: string       // statut propre à chaque type
  objectif: string | null
  // Complétion exercices (si applicable)
  exercices_total: number
  exercices_completes: number
  // Payload brut selon le type
  cabinet?: CabinetSession
  autonomous?: AutonomousSession
  template?: RecurringTemplate
}

/**
 * Retourne la timeline unifiée de toutes les séances d'un client,
 * triées par date décroissante (plus récent en premier).
 * Utilisée par le coach sur la fiche client.
 */
export async function getClientSessionTimelineAction(
  clientUserId: string  // auth user_id du client (pas le CRM id)
): Promise<{ data: ProgrammeTimelineItem[] | null; error: string | null }> {
  const { user, error: authError } = await requireCoach()
  if (authError || !user) return { data: null, error: authError ?? 'Non authentifié' }

  // Appeler la fonction de mise à jour des statuts overdue avant lecture
  const admin = createAdminClient()
  await admin.rpc('update_overdue_autonomous_sessions')

  // Requêtes parallèles sur les 3 types
  const [cabinetRes, autonomousRes, templatesRes] = await Promise.all([
    admin
      .from('cabinet_sessions')
      .select('*')
      .eq('coach_id', user.id)
      .eq('client_id', clientUserId)
      .order('date_seance', { ascending: false }),

    admin
      .from('autonomous_sessions')
      .select('*')
      .eq('coach_id', user.id)
      .eq('client_id', clientUserId)
      .order('created_at', { ascending: false }),

    admin
      .from('recurring_templates')
      .select('*, recurring_executions(*)')
      .eq('coach_id', user.id)
      .eq('client_id', clientUserId)
      .eq('is_active', true)
      .order('created_at', { ascending: false }),
  ])

  if (cabinetRes.error)   return { data: null, error: cabinetRes.error.message }
  if (autonomousRes.error) return { data: null, error: autonomousRes.error.message }
  if (templatesRes.error) return { data: null, error: templatesRes.error.message }

  // Mapper cabinet_sessions
  const cabinetItems: ProgrammeTimelineItem[] = (cabinetRes.data ?? []).map((s) => ({
    id:                  s.id,
    type:                'cabinet',
    titre:               s.objectif,
    date:                s.date_seance,
    statut:              s.statut,
    objectif:            s.objectif,
    exercices_total:     (s.exercices_utilises as ExerciceOrdonné[]).length,
    exercices_completes: (s.exercices_utilises as ExerciceOrdonné[]).length, // cabinet = tous faits en séance
    cabinet:             s as CabinetSession,
  }))

  // Mapper autonomous_sessions
  const autonomousItems: ProgrammeTimelineItem[] = (autonomousRes.data ?? []).map((s) => {
    const exercices = (s.exercices as ExerciceOrdonné[]) ?? []
    return {
      id:                  s.id,
      type:                'autonomie',
      titre:               s.titre,
      date:                s.date_cible ?? s.created_at,
      statut:              s.statut,
      objectif:            s.objectif,
      exercices_total:     exercices.length,
      exercices_completes: s.statut === 'terminee' ? exercices.length : 0,
      autonomous:          s as AutonomousSession,
    }
  })

  // Mapper recurring_templates (une ligne par template actif — pas par exécution)
  const recurringItems: ProgrammeTimelineItem[] = (templatesRes.data ?? []).map((t) => {
    const executions = (t.recurring_executions ?? []) as RecurringExecution[]
    const lastExecution = executions.sort(
      (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
    )[0]
    const exercices = (t.exercices as ExerciceOrdonné[]) ?? []
    return {
      id:                  t.id,
      type:                'recurrente',
      titre:               t.titre,
      date:                lastExecution?.started_at ?? t.created_at,
      statut:              lastExecution?.completed ? 'completee' : 'active',
      objectif:            t.description ?? null,
      exercices_total:     exercices.length,
      exercices_completes: executions.filter((e) => e.completed).length,
      template:            t as RecurringTemplate,
    }
  })

  // Fusionner et trier par date décroissante
  const timeline = [...cabinetItems, ...autonomousItems, ...recurringItems].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  return { data: timeline, error: null }
}
```

---

## Tâche 6 — Composant `ClientSessionTimeline`

Créer `src/components/coach/ClientSessionTimeline.tsx` :

```tsx
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { CalendarDays, UserCheck, RefreshCw, CheckCircle2, Clock, AlertTriangle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProgrammeTimelineItem } from '@/app/actions/sessions'

interface ClientSessionTimelineProps {
  items: ProgrammeTimelineItem[]
}

// Mapping statuts → badge visuel
function StatutBadge({ type, statut }: { type: ProgrammeTimelineItem['type']; statut: string }) {
  // Séances cabinet
  if (type === 'cabinet') {
    if (statut === 'planifiee')  return <Badge variant="outline" className="text-blue-600 border-blue-300">Planifiée</Badge>
    if (statut === 'realisee')   return <Badge className="bg-green-100 text-green-700">Réalisée</Badge>
    if (statut === 'annulee')    return <Badge variant="outline" className="text-gray-400">Annulée</Badge>
  }
  // Séances autonomes
  if (type === 'autonomie') {
    if (statut === 'a_faire')    return <Badge variant="outline" className="text-blue-600 border-blue-300">À faire</Badge>
    if (statut === 'en_cours')   return <Badge variant="outline" className="text-amber-600 border-amber-300">En cours</Badge>
    if (statut === 'terminee')   return <Badge className="bg-green-100 text-green-700">Terminée</Badge>
    if (statut === 'en_retard')  return <Badge variant="outline" className="text-orange-600 border-orange-300"><AlertTriangle className="h-3 w-3 mr-1" />En retard</Badge>
    if (statut === 'manquee')    return <Badge variant="outline" className="text-red-500 border-red-300"><XCircle className="h-3 w-3 mr-1" />Manquée</Badge>
  }
  // Templates récurrents
  if (type === 'recurrente') {
    if (statut === 'completee')  return <Badge className="bg-green-100 text-green-700">Exécutée</Badge>
    return <Badge variant="outline" className="text-teal-600 border-teal-300">Active</Badge>
  }
  return null
}

function TypeIcon({ type }: { type: ProgrammeTimelineItem['type'] }) {
  if (type === 'cabinet')    return <UserCheck className="h-4 w-4 text-[#20808D]" />
  if (type === 'autonomie')  return <Clock className="h-4 w-4 text-[#944454]" />
  if (type === 'recurrente') return <RefreshCw className="h-4 w-4 text-[#FFC553]" />
  return <CalendarDays className="h-4 w-4 text-muted-foreground" />
}

function TypeLabel({ type }: { type: ProgrammeTimelineItem['type'] }) {
  if (type === 'cabinet')    return 'Séance cabinet'
  if (type === 'autonomie')  return 'Séance autonome'
  if (type === 'recurrente') return 'Routine'
  return ''
}

export function ClientSessionTimeline({ items }: ClientSessionTimelineProps) {
  if (items.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Aucune séance planifiée pour ce client.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Card key={`${item.type}-${item.id}`} className="border border-border">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start justify-between gap-3">
              {/* Icône + type */}
              <div className="flex items-center gap-2 min-w-0">
                <TypeIcon type={item.type} />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground mb-0.5">
                    {TypeLabel({ type: item.type })}
                  </p>
                  <p className="font-medium text-sm text-[#1A1A2E] truncate">{item.titre}</p>
                  {item.objectif && item.objectif !== item.titre && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{item.objectif}</p>
                  )}
                </div>
              </div>
              {/* Statut + date */}
              <div className="flex flex-col items-end gap-1 shrink-0">
                <StatutBadge type={item.type} statut={item.statut} />
                <p className="text-xs text-muted-foreground">
                  {new Date(item.date).toLocaleDateString('fr-FR', {
                    day: 'numeric', month: 'short', year: 'numeric'
                  })}
                </p>
              </div>
            </div>

            {/* Barre de progression exercices (si applicable) */}
            {item.exercices_total > 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {item.exercices_completes}/{item.exercices_total} exercice{item.exercices_total > 1 ? 's' : ''}
                  </span>
                  <span>{Math.round((item.exercices_completes / item.exercices_total) * 100)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      item.exercices_completes === item.exercices_total
                        ? 'bg-green-500'
                        : 'bg-[#20808D]'
                    )}
                    style={{ width: `${(item.exercices_completes / item.exercices_total) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

---

## Tâche 7 — Intégration dans la fiche client coach

**Fichier :** `src/app/(dashboard)/coach/clients/[id]/page.tsx`

### 7a — Ajouter le fetch dans le Server Component

Dans la section fetch de données du composant (là où sont les autres `await`), ajouter :

```typescript
import { getClientSessionTimelineAction } from '@/app/actions/sessions'
import { ClientSessionTimeline } from '@/components/coach/ClientSessionTimeline'

// Dans la fonction page() ou getClientData(), après avoir résolu clientUserId :
const { data: timeline } = await getClientSessionTimelineAction(client.user_id)
```

**Important :** `client.user_id` est l'auth UUID du client (pas le CRM `id`). Vérifier que
le champ est disponible et non-null avant d'appeler l'action.

### 7b — Dans le tab "Séances"

Remplacer ou augmenter le contenu actuel du tab Séances par :

```tsx
<TabsContent value="seances" className="space-y-4">
  {/* En-tête + boutons d'action existants — conserver */}
  {/* ... boutons PlanCabinetSession, AssignAutonomousSession, CreateRecurringTemplate ... */}

  {/* Nouvelle timeline unifiée */}
  <div>
    <h3 className="text-sm font-semibold text-[#1A1A2E] mb-3">
      Historique des séances
    </h3>
    <ClientSessionTimeline items={timeline ?? []} />
  </div>
</TabsContent>
```

---

## Résumé des fichiers à créer / modifier

| Fichier | Action |
|---------|--------|
| `supabase/migrations/20260407000000_fix_exercise_responses_session_fk.sql` | CRÉER |
| `supabase/migrations/20260407000001_uniform_cabinet_exercices.sql` | CRÉER |
| `src/types/index.ts` | MODIFIER (`ExerciseResponse`, `CabinetSession.exercices_utilises`) |
| `src/app/actions/exercises.ts` | MODIFIER (`saveExerciseResponseAction`) |
| `src/app/actions/sessions.ts` | MODIFIER (ajouter `getClientSessionTimelineAction` + `ProgrammeTimelineItem`) |
| `src/components/coach/ClientSessionTimeline.tsx` | CRÉER |
| `src/app/(dashboard)/coach/clients/[id]/page.tsx` | MODIFIER (fetch + intégration timeline) |

---

## Critères d'acceptation

- [ ] `exercise_responses` : les nouvelles lignes écrivent `autonomous_session_id` ou
      `recurring_execution_id` (UUID) plutôt que `session_id` (text)
- [ ] `cabinet_sessions.exercices_utilises` est du JSONB compatible `ExerciceOrdonné[]`
- [ ] Sur la fiche client coach (onglet Séances), les 3 types de séances s'affichent
      dans la même liste chronologique
- [ ] Chaque item montre : type, titre, date, statut avec badge coloré
- [ ] Si la séance a des exercices, une barre de progression s'affiche
- [ ] Les séances autonomes en retard/manquées ont des badges visuels distincts (orange/rouge)
- [ ] Si le client n'a pas de compte (`user_id = null`), afficher un message placeholder
      plutôt que d'appeler `getClientSessionTimelineAction` avec null
- [ ] Pas de `any` TypeScript
- [ ] shadcn/ui uniquement pour les composants

---

## Contraintes globales (CLAUDE.md)

- `NEVER` utiliser `any` en TypeScript
- `NEVER` silent catch — toujours gérer les erreurs explicitement
- Valider les inputs avec Zod dans les server actions
- shadcn/ui pour tous les composants UI
- Commentaires logique métier en **français**, code technique en **anglais**
- Vérifier les noms de tables dans `supabase/migrations/` avant d'écrire les requêtes
- `NEVER` mélanger Prisma et Supabase dans un même module
