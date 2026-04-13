# Refactor — Pré/In/Post : contenu par type d'étape + cognitif sans test obligatoire

## Contexte & problèmes à corriger

Deux problèmes identifiés dans le module de programmation coach :

**Problème 1** : Pour les étapes `cabinet`, `autonomie`, `recurrente`, les colonnes Pré/In/Post
affichent `AddDrillDialog` qui propose des **tests cognitifs**. Or ces séances doivent contenir
des **exercices de la bibliothèque** (table `exercises`), pas des tests cognitifs.

**Problème 2** : Le type d'étape `cognitif` force le coach à choisir **un test cognitif unique**
au moment de la création. L'architecture attendue : le coach donne un nom à la séance cognitive,
puis remplit lui-même les colonnes Pré/In/Post avec les drills cognitifs de son choix.

### Architecture cible

```
programme_etapes (type = 'cognitif')
  titre = "Séance focus — semaine 3"   ← nom libre, pas de test_id obligatoire
  ↓ 1:N via program_exercises (phase = pre/in/post)
  cognitive_test_id → Stroop, PVT, 2-Back, etc.

programme_etapes (type = 'cabinet' | 'autonomie' | 'recurrente')
  ↓ 1:N via program_exercises (phase = pre/in/post)
  exercise_id → exercices bibliothèque (visualisation, respiration, etc.)
```

---

## Stack technique

- **Next.js 14 App Router** — Server Components + Server Actions
- **Supabase** (PostgreSQL + RLS) — migrations dans `supabase/migrations/`
- **shadcn/ui** — tous les composants UI
- **Zod** — validation des inputs
- **Admin client** : `createAdminClient()` pour toutes les écritures

---

## Fichiers existants à lire AVANT de commencer

```
supabase/migrations/
  20260409000000_program_exercises_cognitive.sql   ← schéma program_exercises actuel
  20260412000000_programme_etapes_cognitif_type.sql ← contrainte programme_etapes_one_fk

src/
  types/index.ts                                   ← ProgramExercise, ProgrammeEtape, ProgrammeEtapeEnrichie
  app/actions/programmes.ts                        ← createAndAddEtapeAction, addDrillToEtapeAction,
                                                      enrichEtapes, RawEtapeRow, SELECT queries
  components/coach/
    AddEtapeDialog.tsx                             ← CognitifForm à modifier
    AddDrillDialog.tsx                             ← dialogue cognitif existant (conserver)
    ProgrammeEtapesList.tsx                        ← routing conditionnel Pré/In/Post
    PhaseColumnView.tsx                            ← SortableDrillCard à rendre générique
```

---

## Tâche 1 — Migration SQL

**Fichier :** `supabase/migrations/20260414000000_programme_pré_in_post_refactor.sql`

```sql
-- Refactor Pré/In/Post :
-- 1. Ajouter 'titre' à programme_etapes (nom libre pour les étapes cognitives)
-- 2. Ajouter 'exercise_id' à program_exercises (exercices bibliothèque)
-- 3. Mettre à jour les contraintes

-- ── 1. Titre libre sur programme_etapes ──────────────────────────────────────
ALTER TABLE public.programme_etapes
  ADD COLUMN IF NOT EXISTS titre TEXT;

-- ── 2. Lien vers la bibliothèque d'exercices dans program_exercises ──────────
ALTER TABLE public.program_exercises
  ADD COLUMN IF NOT EXISTS exercise_id UUID
    REFERENCES public.exercises(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_program_exercises_exercise_id
  ON public.program_exercises(exercise_id)
  WHERE exercise_id IS NOT NULL;

-- ── 3. Contrainte : exercise_id XOR cognitive_test_id (pas les deux) ─────────
-- Remplace la contrainte de phase obligatoire pour les deux types
ALTER TABLE public.program_exercises
  DROP CONSTRAINT IF EXISTS chk_pe_cognitive_requires_phase;

ALTER TABLE public.program_exercises
  ADD CONSTRAINT chk_pe_one_source CHECK (
    (cognitive_test_id IS NOT NULL AND exercise_id IS NULL)
    OR (cognitive_test_id IS NULL  AND exercise_id IS NOT NULL)
    OR (cognitive_test_id IS NULL  AND exercise_id IS NULL)
  );

-- Phase obligatoire dès qu'une source est définie
ALTER TABLE public.program_exercises
  ADD CONSTRAINT chk_pe_source_requires_phase CHECK (
    (cognitive_test_id IS NULL AND exercise_id IS NULL) OR phase IS NOT NULL
  );

-- ── 4. Assouplir programme_etapes_one_fk pour les étapes cognitives ──────────
-- Les étapes cognitives n'ont plus de cognitive_session_id obligatoire :
-- leurs drills sont dans program_exercises.
ALTER TABLE public.programme_etapes
  DROP CONSTRAINT IF EXISTS programme_etapes_one_fk;

ALTER TABLE public.programme_etapes
  ADD CONSTRAINT programme_etapes_one_fk CHECK (
    -- Étapes cognitives : aucune FK de séance requise (drills dans program_exercises)
    type_seance = 'cognitif'
    OR (
      -- Autres types : exactement 1 FK de séance
      (cabinet_session_id    IS NOT NULL)::int +
      (autonomous_session_id IS NOT NULL)::int +
      (recurring_template_id IS NOT NULL)::int = 1
    )
  );
```

---

## Tâche 2 — Types TypeScript

**Fichier :** `src/types/index.ts`

### 2a — `ProgrammeEtape` : ajouter `titre`

```typescript
export interface ProgrammeEtape {
  id: string
  programme_id: string
  ordre: number
  type_seance: TypeSeance
  titre: string | null                 // ← AJOUTER (nom libre pour type 'cognitif')
  cabinet_session_id: string | null
  autonomous_session_id: string | null
  recurring_template_id: string | null
  cognitive_session_id: string | null  // conservé pour rétrocompatibilité
  created_at: string
}
```

### 2b — `ProgramExercise` : ajouter `exercise_id` + jointure `exercises`

```typescript
export interface ProgramExercise {
  id: string
  programme_etape_id: string
  cognitive_test_id: string | null
  exercise_id: string | null           // ← AJOUTER
  phase: 'pre' | 'in' | 'post' | null
  configured_duration_sec: number | null
  configured_intensity_percent: number | null
  cognitive_load_score: number | null
  display_order: number
  created_at: string
  completed_at: string | null
  // Jointures optionnelles — une seule sera non-null
  cognitive_test_definitions?: CognitiveTestDefinition | null
  exercises?: {                        // ← AJOUTER
    id: string
    titre: string
    format: string
    description: string | null
  } | null
}
```

### 2c — `ProgrammeEtapeEnrichie` : retirer `cognitive_session` (plus utilisé pour le nouveau modèle)

> **Note** : garder `cognitive_session` dans l'interface pour la rétrocompatibilité des étapes
> créées avec l'ancien système (cognitif_session_id non-null). Ne pas supprimer le champ.

---

## Tâche 3 — `src/app/actions/programmes.ts`

### 3a — Schéma `createCognitifEtapeSchema` : retirer le test, ajouter le titre

```typescript
// AVANT :
const createCognitifEtapeSchema = z.object({
  programme_id:                 z.string().uuid(),
  cognitive_test_definition_id: z.string().uuid('Veuillez sélectionner un test'),
  phase:                        z.enum(['pre', 'in', 'post']).optional().default('in'),
})

// APRÈS :
const createCognitifEtapeSchema = z.object({
  programme_id: z.string().uuid(),
  titre:        z.string().min(1, 'Le titre est obligatoire').max(200),
})
```

### 3b — `RawEtapeRow` : ajouter `titre` + jointure `exercises` dans `program_exercises`

```typescript
type RawEtapeRow = {
  id: string
  programme_id: string
  ordre: number
  type_seance: TypeSeance
  titre: string | null                 // ← AJOUTER
  cabinet_session_id: string | null
  autonomous_session_id: string | null
  recurring_template_id: string | null
  cognitive_session_id: string | null
  created_at: string
  cabinet_sessions: CabinetSession | null
  autonomous_sessions: AutonomousSession | null
  recurring_templates: RecurringTemplate | null
  cognitive_sessions: { ... } | null   // conserver tel quel
  program_exercises?: ProgramExercise[]
}
```

### 3c — `enrichEtapes` : nouvelle branche cognitif (titre libre, pas de session obligatoire)

Dans la fonction `enrichEtapes`, remplacer la branche `else if (etape.type_seance === 'cognitif')` :

```typescript
} else if (etape.type_seance === 'cognitif') {
  // Nouveau modèle : titre libre, drills dans program_exercises
  // cognitive_session conservé pour rétrocompatibilité (ancien modèle : un test unique)
  if (etape.cognitive_session_id && etape.cognitive_sessions) {
    // Rétrocompatibilité : ancienne étape cognitif avec session unique
    const cs = etape.cognitive_sessions
    const def = Array.isArray(cs.cognitive_test_definitions)
      ? cs.cognitive_test_definitions[0]
      : cs.cognitive_test_definitions
    cognitive_session = {
      id:               cs.id,
      status:           cs.status,
      completed_at:     cs.completed_at,
      computed_metrics: cs.computed_metrics,
      test_name:        (def as { name: string } | null)?.name ?? 'Test cognitif',
      test_slug:        (def as { slug: string } | null)?.slug ?? '',
    }
    est_complete = cs.completed_at != null
    titre_display = etape.titre ?? cognitive_session.test_name
  } else {
    // Nouveau modèle : titre libre
    titre_display = etape.titre ?? 'Séance cognitive'
    // est_complete : true si tous les drills IN sont complétés (ou si aucun drill)
    const inDrills = (etape.program_exercises ?? []).filter(ex => ex.phase === 'in')
    est_complete = inDrills.length > 0 && inDrills.every(ex => ex.completed_at != null)
  }
}
```

**Aussi dans `enrichEtapes`**, mapper `titre` dans le return :

```typescript
return {
  id:                    etape.id,
  programme_id:          etape.programme_id,
  ordre:                 etape.ordre,
  type_seance:           etape.type_seance,
  titre:                 etape.titre ?? null,   // ← AJOUTER
  cabinet_session_id:    etape.cabinet_session_id,
  autonomous_session_id: etape.autonomous_session_id,
  recurring_template_id: etape.recurring_template_id,
  cognitive_session_id:  etape.cognitive_session_id,
  created_at:            etape.created_at,
  // ... reste inchangé
}
```

### 3d — SELECT dans `getClientProgrammesAction` et `getMyProgrammeAction`

Dans les deux fonctions, trouver la constante SELECT des program_exercises et ajouter `exercise_id` + jointure `exercises` :

```typescript
// AVANT (dans le SELECT des programme_etapes) :
program_exercises (
  id, programme_etape_id, cognitive_test_id, phase,
  configured_duration_sec, configured_intensity_percent,
  cognitive_load_score, display_order, created_at, completed_at,
  cognitive_test_definitions!cognitive_test_id (id, slug, name, ...)
)

// APRÈS — ajouter exercise_id et la jointure exercises :
program_exercises (
  id, programme_etape_id, cognitive_test_id, exercise_id, phase,
  configured_duration_sec, configured_intensity_percent,
  cognitive_load_score, display_order, created_at, completed_at,
  cognitive_test_definitions!cognitive_test_id (id, slug, name, base_cognitive_load,
    default_duration_sec, default_intensity_percent, intensity_configurable,
    configurable_durations, phase_tags, instructions_fr, cognitive_category),
  exercises!exercise_id (id, titre, format, description)
)
```

**Aussi** ajouter `titre` dans le SELECT de `programme_etapes` :

```typescript
// Dans le .select() des programme_etapes, ajouter 'titre' à la liste des colonnes
// Exemple : 'id, programme_id, ordre, type_seance, titre, cabinet_session_id, ...'
```

### 3e — `createAndAddEtapeAction` : nouvelle branche cognitif

Remplacer la branche `else if (type === 'cognitif')` **entièrement** :

```typescript
} else if (type === 'cognitif') {
  const parsed = createCognitifEtapeSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  // Calcul de l'ordre
  const { data: maxOrdreResult } = await admin
    .from('programme_etapes')
    .select('ordre')
    .eq('programme_id', parsedProgrammeId.data)
    .order('ordre', { ascending: false })
    .limit(1)
    .maybeSingle()

  const prochain_ordre = ((maxOrdreResult as { ordre: number } | null)?.ordre ?? 0) + 1

  // Insertion directe de l'étape — pas de session à créer
  const { error: etapeError } = await admin
    .from('programme_etapes')
    .insert({
      programme_id: parsedProgrammeId.data,
      ordre:        prochain_ordre,
      type_seance:  'cognitif',
      titre:        parsed.data.titre,
      // Toutes les FK de séance à NULL (conforme à la nouvelle contrainte)
      cabinet_session_id:    null,
      autonomous_session_id: null,
      recurring_template_id: null,
      cognitive_session_id:  null,
    })

  if (etapeError) return { error: etapeError.message ?? 'Erreur création étape cognitive' }

  revalidatePath(`/coach/clients/${clientUserId}`)
  return { error: null }

  // ← Supprimer tout le code après ce return pour le type 'cognitif'
  //   (plus de rollback, pas de sessionTable, pas de back-reference)
}
```

> **Important** : restructurer `createAndAddEtapeAction` pour que la branche `cognitif`
> retourne tôt (early return) et ne tombe pas dans le code commun d'insertion d'étape
> (qui attend un `newSessionId`).

### 3f — Nouvelle action `addExerciseToEtapeAction`

Ajouter à la suite de `addDrillToEtapeAction` dans le fichier :

```typescript
const addExerciseSchema = z.object({
  etape_id:   z.string().uuid(),
  exercise_id: z.string().uuid(),
  phase:      z.enum(['pre', 'in', 'post']),
})

// Ajoute un exercice bibliothèque à une étape non-cognitive (Pre/In/Post)
export async function addExerciseToEtapeAction(
  input: z.infer<typeof addExerciseSchema>
): Promise<{ data: ProgramExercise | null; error: string | null }> {
  const { user, error: authError } = await requireCoach()
  if (authError || !user) return { data: null, error: authError ?? 'Non authentifié' }

  const parsed = addExerciseSchema.safeParse(input)
  if (!parsed.success) return { data: null, error: parsed.error.issues[0].message }

  const admin = createAdminClient()

  // Vérifier ownership de l'étape
  const { data: etape } = await admin
    .from('programme_etapes')
    .select('id, programmes!inner(coach_id, client_id)')
    .eq('id', parsed.data.etape_id)
    .eq('programmes.coach_id', user.id)
    .single()

  if (!etape) return { data: null, error: 'Étape introuvable ou non autorisée' }

  // Vérifier que l'exercice existe et est accessible (propriétaire ou public)
  const { data: exercise } = await admin
    .from('exercises')
    .select('id')
    .eq('id', parsed.data.exercise_id)
    .or(`coach_id.eq.${user.id},is_public.eq.true`)
    .single()

  if (!exercise) return { data: null, error: 'Exercice introuvable ou non autorisé' }

  // Prochain display_order dans la phase
  const { count } = await admin
    .from('program_exercises')
    .select('id', { count: 'exact', head: true })
    .eq('programme_etape_id', parsed.data.etape_id)
    .eq('phase', parsed.data.phase)

  const { data, error } = await admin
    .from('program_exercises')
    .insert({
      programme_etape_id: parsed.data.etape_id,
      exercise_id:        parsed.data.exercise_id,
      cognitive_test_id:  null,
      phase:              parsed.data.phase,
      display_order:      count ?? 0,
    })
    .select('*, exercises!exercise_id(id, titre, format, description)')
    .single()

  if (error) return { data: null, error: error.message }

  const prog = (etape.programmes as unknown as { client_id: string }[] | { client_id: string })
  const clientId = Array.isArray(prog) ? prog[0]?.client_id : prog?.client_id
  if (clientId) revalidatePath(`/coach/clients/${clientId}`)

  return { data: data as unknown as ProgramExercise, error: null }
}
```

---

## Tâche 4 — `src/components/coach/AddEtapeDialog.tsx`

### 4a — Modifier `CognitifForm` : retirer le Select, ajouter un Input `titre`

```typescript
// AVANT :
function CognitifForm({ data, onChange, cognitiveTests }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="cognitive_test_definition_id">
        Test cognitif <span className="text-red-500">*</span>
      </Label>
      <Select value={data.cognitive_test_definition_id ?? ''} ...>
        ...
      </Select>
    </div>
  )
}

// APRÈS :
function CognitifForm({ data, onChange }: {
  data: Record<string, string>
  onChange: (k: string, v: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="titre-cognitif">
        Nom de la séance <span className="text-red-500">*</span>
      </Label>
      <Input
        id="titre-cognitif"
        value={data.titre ?? ''}
        onChange={(e) => onChange('titre', e.target.value)}
        placeholder="Ex : Séance focus — semaine 3"
        required
      />
      <p className="text-xs text-muted-foreground">
        Vous ajouterez les drills cognitifs (Pré/In/Post) après la création.
      </p>
    </div>
  )
}
```

### 4b — Retirer `cognitiveTests` de `CognitifForm` props

La fonction `CognitifForm` n'a plus besoin du prop `cognitiveTests`.

### 4c — Mettre à jour le bouton de soumission

```typescript
// AVANT :
disabled={isPending || (selectedType === 'cognitif' && !formData.cognitive_test_definition_id)}

// APRÈS :
disabled={isPending || (selectedType === 'cognitif' && !formData.titre?.trim())}
```

### 4d — Mettre à jour l'appel `CognitifForm` dans le JSX du dialog

```typescript
// AVANT :
{selectedType === 'cognitif' && (
  <CognitifForm data={formData} onChange={handleFieldChange} cognitiveTests={cognitiveTests} />
)}

// APRÈS :
{selectedType === 'cognitif' && (
  <CognitifForm data={formData} onChange={handleFieldChange} />
)}
```

> **Note** : le prop `cognitiveTests` du composant `AddEtapeDialog` lui-même peut être conservé
> car il est encore utilisé par `AddDrillDialog` dans `ProgrammeEtapesList`. Ne pas le retirer
> de l'interface `AddEtapeDialogProps`.

---

## Tâche 5 — Nouveau composant `src/components/coach/AddExerciseDialog.tsx`

Créer ce composant qui permet d'ajouter un exercice de la bibliothèque avec une phase Pré/In/Post.

```typescript
'use client'

import { useState, useTransition } from 'react'
import { Dumbbell, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { addExerciseToEtapeAction } from '@/app/actions/programmes'
import type { Exercise } from '@/types'  // ou définir le type inline si non exporté

const FORMAT_LABELS: Record<string, string> = {
  video:         'Vidéo',
  document:      'Document',
  audio:         'Audio',
  questionnaire: 'Questionnaire',
  interactive:   'Interactif',
}

const FORMAT_COLORS: Record<string, string> = {
  video:         'bg-blue-100 text-blue-700',
  document:      'bg-gray-100 text-gray-600',
  audio:         'bg-purple-100 text-purple-700',
  questionnaire: 'bg-amber-100 text-amber-700',
  interactive:   'bg-teal-100 text-teal-700',
}

interface AddExerciseDialogProps {
  etapeId: string
  filterPhase?: 'pre' | 'in' | 'post'
  exercises: Array<{ id: string; titre: string; format: string; description: string | null }>
  onAdded?: () => void
  // Mode contrôlé (depuis boutons "+" des colonnes)
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function AddExerciseDialog({
  etapeId,
  filterPhase,
  exercises,
  onAdded,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: AddExerciseDialogProps) {
  const isControlled = controlledOpen !== undefined
  const [internalOpen, setInternalOpen] = useState(false)
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? (controlledOnOpenChange ?? (() => {})) : setInternalOpen

  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSelect(exerciseId: string) {
    if (!filterPhase) return  // phase must be defined when selecting directly
    setError(null)
    startTransition(async () => {
      const result = await addExerciseToEtapeAction({
        etape_id:    etapeId,
        exercise_id: exerciseId,
        phase:       filterPhase,
      })
      if (result.error) {
        setError(result.error)
      } else {
        setOpen(false)
        onAdded?.()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-[#7069F4] border-[#7069F4]"
            disabled={isPending}
          >
            <Dumbbell className="h-3.5 w-3.5" />
            <Plus className="h-3 w-3" />
            Exercice
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Ajouter un exercice
            {filterPhase && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                — phase {filterPhase.toUpperCase()}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {exercises.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Aucun exercice disponible dans la bibliothèque.
          </p>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {exercises.map(ex => (
              <button
                key={ex.id}
                type="button"
                disabled={isPending}
                onClick={() => handleSelect(ex.id)}
                className="w-full rounded-lg border p-3 text-left hover:border-[#7069F4] hover:bg-[#F1F0FE]/50 transition-colors disabled:opacity-50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{ex.titre}</p>
                    {ex.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {ex.description}
                      </p>
                    )}
                  </div>
                  {ex.format && (
                    <Badge className={`shrink-0 text-xs ${FORMAT_COLORS[ex.format] ?? 'bg-gray-100 text-gray-600'}`}>
                      {FORMAT_LABELS[ex.format] ?? ex.format}
                    </Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </DialogContent>
    </Dialog>
  )
}
```

---

## Tâche 6 — `src/components/coach/PhaseColumnView.tsx`

### 6a — Rendre `SortableDrillCard` générique (exercice OU drill cognitif)

Dans `SortableDrillCard`, remplacer l'affichage du nom et des métadonnées :

```typescript
// AVANT :
const def = exercise.cognitive_test_definitions
const durationMin = exercise.configured_duration_sec
  ? exercise.configured_duration_sec / 60
  : null

// Dans le JSX :
<p className="text-sm font-medium truncate">{def?.name ?? 'Drill cognitif'}</p>

// APRÈS :
const isCognitive = exercise.cognitive_test_id !== null
const displayName = isCognitive
  ? (exercise.cognitive_test_definitions?.name ?? 'Drill cognitif')
  : (exercise.exercises?.titre ?? 'Exercice')
const durationMin = exercise.configured_duration_sec
  ? exercise.configured_duration_sec / 60
  : null

// Dans le JSX :
<p className="text-sm font-medium truncate">{displayName}</p>
```

### 6b — Affichage conditionnel des métadonnées CLS

```typescript
// Métadonnées : afficher CLS seulement pour les drills cognitifs
{isCognitive && durationMin !== null && (
  <span className="text-xs text-muted-foreground">{durationMin} min</span>
)}
{isCognitive && exercise.cognitive_load_score !== null && (
  <CognitiveLoadBadge score={exercise.cognitive_load_score} />
)}
{!isCognitive && exercise.exercises?.format && (
  <span className="text-xs text-muted-foreground capitalize">
    {exercise.exercises.format}
  </span>
)}
```

### 6c — Même correction dans `DragGhostCard`

```typescript
// AVANT :
const def = exercise.cognitive_test_definitions
<p className="text-sm font-medium truncate">{def?.name ?? 'Drill cognitif'}</p>

// APRÈS :
const displayName = exercise.cognitive_test_id !== null
  ? (exercise.cognitive_test_definitions?.name ?? 'Drill cognitif')
  : (exercise.exercises?.titre ?? 'Exercice')
<p className="text-sm font-medium truncate">{displayName}</p>
```

---

## Tâche 7 — `src/components/coach/ProgrammeEtapesList.tsx`

### 7a — Ajouter le prop `exercises` (bibliothèque)

```typescript
interface ProgrammeEtapesListProps {
  programme: ProgrammeAvecEtapes
  cognitiveTests: CognitiveTestDefinition[]
  exercises: Array<{ id: string; titre: string; format: string; description: string | null }>  // ← AJOUTER
  onUpdate?: () => void
}
```

### 7b — Importer `AddExerciseDialog`

```typescript
import { AddExerciseDialog } from '@/components/coach/AddExerciseDialog'
```

### 7c — Routing conditionnel dans la section Pré/In/Post

Dans la section `{isExpanded && ...}`, remplacer le rendu du dialog d'ajout :

```typescript
{isExpanded && (
  <div className="border-t px-3 pb-3 pt-3 space-y-3">
    <PhaseColumnView
      exercises={drills}
      onPhaseChange={(id, phase) => handlePhaseChange(id, phase)}
      onConfigureClick={(drill) => setConfiguringDrill(drill)}
      onDeleteClick={(id) => handleDeleteDrill(id)}
      onAddClick={(phase) => setAddingDrill({ etapeId: etape.id, phase })}
    />

    {/* Dialog contrôlé : cognitif → drills cognitifs, autres → exercices bibliothèque */}
    {etape.type_seance === 'cognitif' ? (
      <AddDrillDialog
        etapeId={etape.id}
        filterPhase={addingDrill?.etapeId === etape.id ? addingDrill.phase : undefined}
        cognitiveTests={cognitiveTests}
        onAdded={() => { setAddingDrill(null); onUpdate?.() }}
        open={addingDrill?.etapeId === etape.id}
        onOpenChange={(v) => { if (!v) setAddingDrill(null) }}
      />
    ) : (
      <AddExerciseDialog
        etapeId={etape.id}
        filterPhase={addingDrill?.etapeId === etape.id ? addingDrill.phase : undefined}
        exercises={exercises}
        onAdded={() => { setAddingDrill(null); onUpdate?.() }}
        open={addingDrill?.etapeId === etape.id}
        onOpenChange={(v) => { if (!v) setAddingDrill(null) }}
      />
    )}
  </div>
)}
```

### 7d — Supprimer `DrillConfigurator` pour les étapes non-cognitives

Le `DrillConfigurator` (slide-over de configuration durée/intensité/CLS) n'a de sens que
pour les drills cognitifs. Conditionner son rendu :

```typescript
{/* DrillConfigurator slide-over — uniquement pour les étapes cognitives */}
{configuringDrill?.cognitive_test_definitions && (
  <DrillConfigurator ... />
)}
```

> Ce code existe déjà avec `configuringDrill?.cognitive_test_definitions` comme guard.
> Si le drill est un exercice bibliothèque, `cognitive_test_definitions` sera null et
> le configurateur ne s'ouvrira pas. Aucun changement nécessaire ici.

---

## Tâche 8 — Fiche client coach : passer `exercises` à `ProgrammeEtapesList`

**Fichier :** `src/app/(dashboard)/coach/clients/[id]/page.tsx`

Le prop `exercises` est déjà fetché dans la page (`getExercisesAction()`).
Trouver l'appel à `ProgrammeEtapesList` et ajouter le prop :

```typescript
// AVANT :
<ProgrammeEtapesList
  programme={prog}
  cognitiveTests={cognitiveTests ?? []}
/>

// APRÈS :
<ProgrammeEtapesList
  programme={prog}
  cognitiveTests={cognitiveTests ?? []}
  exercises={(exercises ?? []).map(ex => ({
    id:          ex.id,
    titre:       ex.titre,
    format:      ex.format,
    description: ex.description ?? null,
  }))}
/>
```

> Vérifier le type retourné par `getExercisesAction()` pour mapper correctement les champs.

---

## Résumé des fichiers à créer / modifier

| Fichier | Action |
|---------|--------|
| `supabase/migrations/20260414000000_programme_pré_in_post_refactor.sql` | CRÉER |
| `src/types/index.ts` | MODIFIER (`ProgrammeEtape.titre`, `ProgramExercise.exercise_id` + jointure) |
| `src/app/actions/programmes.ts` | MODIFIER (schéma cognitif, branche cognitif, enrichEtapes, SELECT, + `addExerciseToEtapeAction`) |
| `src/components/coach/AddEtapeDialog.tsx` | MODIFIER (`CognitifForm` : retirer test, ajouter titre) |
| `src/components/coach/AddExerciseDialog.tsx` | CRÉER |
| `src/components/coach/PhaseColumnView.tsx` | MODIFIER (`SortableDrillCard` générique) |
| `src/components/coach/ProgrammeEtapesList.tsx` | MODIFIER (prop `exercises`, routing conditionnel) |
| `src/app/(dashboard)/coach/clients/[id]/page.tsx` | MODIFIER (passer `exercises` à `ProgrammeEtapesList`) |

---

## Critères d'acceptation

### Type Cognitif
- [ ] `AddEtapeDialog` — type Cognitif : champ "Nom de la séance" (pas de select test)
- [ ] Créer une étape cognitif insère dans `programme_etapes` avec `titre` et toutes FK à NULL
- [ ] Étapes cognitives existantes (avec `cognitive_session_id`) restent affichées correctement (rétrocompatibilité)
- [ ] `titre_display` d'une étape cognitif = `titre` (nouveau) ou `test_name` (ancien)
- [ ] Complétion d'une étape cognitif = tous les drills IN terminés (ou 0 drill → non complété)

### Pré/In/Post contenu
- [ ] Étape type `cognitif` : cliquer "+" dans une colonne → `AddDrillDialog` (tests cognitifs)
- [ ] Étapes `cabinet` / `autonomie` / `recurrente` : cliquer "+" → `AddExerciseDialog` (bibliothèque)
- [ ] `AddExerciseDialog` : liste les exercices du coach + exercices publics
- [ ] `AddExerciseDialog` : l'exercice ajouté apparaît dans la bonne colonne
- [ ] `PhaseColumnView` affiche le nom de l'exercice bibliothèque (`exercises.titre`)
- [ ] Le badge CLS n'apparaît pas pour les exercices bibliothèque

### Technique
- [ ] Migration : contrainte `programme_etapes_one_fk` assouplie pour type `cognitif`
- [ ] Migration : contrainte `chk_pe_one_source` + `chk_pe_source_requires_phase` correctes
- [ ] `npm run build` sans erreur TypeScript
- [ ] Aucun `any` TypeScript
- [ ] Validation Zod sur `addExerciseToEtapeAction`

---

## Contraintes globales (CLAUDE.md)

- `NEVER` utiliser `any` en TypeScript
- `NEVER` silent catch — toujours gérer les erreurs explicitement
- Valider les inputs avec Zod dans les server actions
- shadcn/ui pour tous les composants UI
- Commentaires logique métier en **français**, code technique en **anglais**
- Admin client (`createAdminClient()`) pour toutes les écritures en base
- Vérifier les noms de colonnes dans les migrations avant d'écrire les requêtes SELECT
