# Niveau 2 — Module Programme MVP

## Contexte & motivation

Ce niveau ajoute un conteneur **Programme** léger qui permet au coach de regrouper des
séances existantes (cabinet, autonomes, récurrentes) dans une séquence ordonnée avec
un nom et une description. Le client voit sa progression "Étape X/Y" dans un format
clair et encourageant.

**Ce n'est PAS un plan builder drag-and-drop** — c'est une liste ordonnée numérotée,
simple à créer et à utiliser. Les 3 types de séances peuvent être des étapes d'un programme.

**Prérequis :** Le Niveau 1 doit être en place (types TypeScript uniformes, timeline existante).

---

## Stack technique

- **Next.js 14 App Router** — Server Components + Server Actions
- **Supabase** (PostgreSQL + RLS) — migrations SQL dans `supabase/migrations/`
- **shadcn/ui** — tous les composants UI
- **Zod** — validation des inputs dans toutes les server actions
- **Admin client** : `createAdminClient()` pour toutes les écritures

---

## Fichiers existants à connaître

```
supabase/migrations/
  20260331000004_create_sessions.sql         ← définit cabinet_sessions, autonomous_sessions,
                                               recurring_templates (lecture seule ici)

src/
  types/index.ts                             ← ajouter Programme, ProgrammeEtape
  app/
    actions/
      sessions.ts                            ← pattern Server Action à suivre
      programmes.ts                          ← CRÉER
  app/(dashboard)/coach/
    clients/[id]/page.tsx                    ← intégrer le module programme (tab Séances)
    programmes/                              ← CRÉER (page liste programmes)
  app/(client)/client/
    programme/page.tsx                       ← CRÉER (vue programme côté client)
  components/coach/
    ProgrammeBuilder.tsx                     ← CRÉER (formulaire coach)
    ProgrammeEtapesList.tsx                  ← CRÉER (liste étapes coach)
  components/client/
    ProgrammeProgress.tsx                    ← CRÉER (vue progression client)
```

---

## Tâche 1 — Migration SQL : tables `programmes` et `programme_etapes`

**Fichier :** `supabase/migrations/20260407000002_create_programmes.sql`

```sql
-- Migration Niveau 2 : Module programme coach-client
-- Un programme regroupe des séances ordonnées (tous types) en parcours structuré

-- ============================================================
-- TABLE: programmes
-- Conteneur d'un programme coach pour un client
-- ============================================================
CREATE TABLE public.programmes (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    client_id   uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    nom         varchar(200) NOT NULL,
    description text,
    statut      varchar(20) NOT NULL DEFAULT 'actif'
                    CHECK (statut IN ('actif', 'archive')),
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_programmes_coach_id  ON public.programmes(coach_id);
CREATE INDEX idx_programmes_client_id ON public.programmes(client_id);
CREATE INDEX idx_programmes_statut    ON public.programmes(statut) WHERE statut = 'actif';

CREATE TRIGGER trg_programmes_updated_at
    BEFORE UPDATE ON public.programmes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.programmes ENABLE ROW LEVEL SECURITY;

-- Le coach voit ses propres programmes
CREATE POLICY "programmes_select_coach" ON public.programmes
    FOR SELECT TO authenticated USING (coach_id = auth.uid());

-- Le client voit les programmes qui lui sont assignés
CREATE POLICY "programmes_select_client" ON public.programmes
    FOR SELECT TO authenticated USING (client_id = auth.uid());

-- Admin voit tout
CREATE POLICY "programmes_select_admin" ON public.programmes
    FOR SELECT TO authenticated
    USING (public.get_my_role() = 'admin');

-- Seul le service_role (createAdminClient) peut écrire

-- ============================================================
-- TABLE: programme_etapes
-- Étapes ordonnées d'un programme — chaque étape référence une séance existante
-- ============================================================
CREATE TABLE public.programme_etapes (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    programme_id            uuid        NOT NULL REFERENCES public.programmes(id) ON DELETE CASCADE,
    ordre                   integer     NOT NULL,   -- 1-based, géré côté applicatif
    type_seance             varchar(20) NOT NULL
                                CHECK (type_seance IN ('cabinet', 'autonomie', 'recurrente')),
    -- Une seule FK est renseignée selon type_seance
    cabinet_session_id      uuid REFERENCES public.cabinet_sessions(id)      ON DELETE SET NULL,
    autonomous_session_id   uuid REFERENCES public.autonomous_sessions(id)   ON DELETE SET NULL,
    recurring_template_id   uuid REFERENCES public.recurring_templates(id)   ON DELETE SET NULL,
    -- Contrainte : exactement une FK est non-null
    CONSTRAINT programme_etapes_one_fk CHECK (
        (cabinet_session_id   IS NOT NULL)::int +
        (autonomous_session_id IS NOT NULL)::int +
        (recurring_template_id IS NOT NULL)::int = 1
    ),
    created_at              timestamptz NOT NULL DEFAULT now(),
    UNIQUE (programme_id, ordre)  -- pas deux étapes au même rang
);

CREATE INDEX idx_programme_etapes_programme_id ON public.programme_etapes(programme_id);
CREATE INDEX idx_programme_etapes_order        ON public.programme_etapes(programme_id, ordre);

ALTER TABLE public.programme_etapes ENABLE ROW LEVEL SECURITY;

-- Le coach voit les étapes de ses programmes
CREATE POLICY "programme_etapes_select_coach" ON public.programme_etapes
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.programmes p
            WHERE p.id = programme_etapes.programme_id
              AND p.coach_id = auth.uid()
        )
    );

-- Le client voit les étapes de ses programmes
CREATE POLICY "programme_etapes_select_client" ON public.programme_etapes
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.programmes p
            WHERE p.id = programme_etapes.programme_id
              AND p.client_id = auth.uid()
        )
    );

-- Admin voit tout
CREATE POLICY "programme_etapes_select_admin" ON public.programme_etapes
    FOR SELECT TO authenticated
    USING (public.get_my_role() = 'admin');

-- Seul service_role peut écrire
```

---

## Tâche 2 — Types TypeScript

**Fichier :** `src/types/index.ts` — Ajouter à la fin du fichier.

```typescript
// ============================================================
// Module Programme
// ============================================================

export type ProgrammeStatut = 'actif' | 'archive'

export type TypeSeance = 'cabinet' | 'autonomie' | 'recurrente'

export interface Programme {
  id: string
  coach_id: string
  client_id: string
  nom: string
  description: string | null
  statut: ProgrammeStatut
  created_at: string
  updated_at: string
}

export interface ProgrammeEtape {
  id: string
  programme_id: string
  ordre: number
  type_seance: TypeSeance
  cabinet_session_id: string | null
  autonomous_session_id: string | null
  recurring_template_id: string | null
  created_at: string
}

// Programme enrichi avec ses étapes et les données brutes des séances
export interface ProgrammeAvecEtapes extends Programme {
  etapes: ProgrammeEtapeEnrichie[]
}

export interface ProgrammeEtapeEnrichie extends ProgrammeEtape {
  // Données dénormalisées pour affichage (une seule sera non-null selon type_seance)
  cabinet?: CabinetSession
  autonomous?: AutonomousSession
  template?: RecurringTemplate
  // Statut de complétion calculé
  est_complete: boolean
  titre_display: string  // titre de la séance pour affichage
}

// Statistiques d'avancement d'un programme
export interface ProgrammeStats {
  programme_id: string
  total_etapes: number
  etapes_completes: number
  taux_completion: number  // 0-100
}
```

---

## Tâche 3 — Server Actions : `src/app/actions/programmes.ts`

Créer le fichier complet :

```typescript
'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import type {
  Programme,
  ProgrammeAvecEtapes,
  ProgrammeEtapeEnrichie,
  ProgrammeStats,
  TypeSeance,
  CabinetSession,
  AutonomousSession,
  RecurringTemplate,
} from '@/types'

// ============================================================
// Schémas de validation
// ============================================================

const createProgrammeSchema = z.object({
  client_id:   z.string().uuid(),
  nom:         z.string().min(1, 'Le nom est requis').max(200),
  description: z.string().optional().nullable(),
})

const addEtapeSchema = z.object({
  programme_id:          z.string().uuid(),
  type_seance:           z.enum(['cabinet', 'autonomie', 'recurrente']),
  cabinet_session_id:    z.string().uuid().optional().nullable(),
  autonomous_session_id: z.string().uuid().optional().nullable(),
  recurring_template_id: z.string().uuid().optional().nullable(),
})

const reorderEtapesSchema = z.object({
  programme_id: z.string().uuid(),
  // Tableau d'IDs dans le nouvel ordre voulu (index 0 = ordre 1)
  etape_ids:    z.array(z.string().uuid()),
})

// ============================================================
// Helper auth coach
// ============================================================

async function requireCoach() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, error: 'Non authentifié' }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'coach') return { user: null, error: 'Accès réservé aux coachs' }
  return { user, error: null }
}

// ============================================================
// Créer un programme
// ============================================================

export async function createProgrammeAction(
  input: z.infer<typeof createProgrammeSchema>
): Promise<{ data: Programme | null; error: string | null }> {
  const { user, error: authError } = await requireCoach()
  if (authError || !user) return { data: null, error: authError ?? 'Non authentifié' }

  const parsed = createProgrammeSchema.safeParse(input)
  if (!parsed.success) return { data: null, error: parsed.error.errors[0].message }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('programmes')
    .insert({
      coach_id:    user.id,
      client_id:   parsed.data.client_id,
      nom:         parsed.data.nom,
      description: parsed.data.description ?? null,
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  revalidatePath(`/coach/clients/${parsed.data.client_id}`)
  return { data: data as Programme, error: null }
}

// ============================================================
// Récupérer le(s) programme(s) actifs d'un client
// ============================================================

export async function getClientProgrammesAction(
  clientUserId: string
): Promise<{ data: ProgrammeAvecEtapes[] | null; error: string | null }> {
  const { user, error: authError } = await requireCoach()
  if (authError || !user) return { data: null, error: authError ?? 'Non authentifié' }

  const admin = createAdminClient()

  // Charger les programmes + leurs étapes + les séances liées
  const { data: programmes, error } = await admin
    .from('programmes')
    .select(`
      *,
      programme_etapes (
        *,
        cabinet_sessions (*),
        autonomous_sessions (*),
        recurring_templates (*)
      )
    `)
    .eq('coach_id', user.id)
    .eq('client_id', clientUserId)
    .eq('statut', 'actif')
    .order('created_at', { ascending: false })

  if (error) return { data: null, error: error.message }

  // Enrichir les étapes avec le statut de complétion et le titre display
  const enrichis: ProgrammeAvecEtapes[] = (programmes ?? []).map((prog) => {
    const etapesTriees = [...(prog.programme_etapes ?? [])].sort(
      (a: { ordre: number }, b: { ordre: number }) => a.ordre - b.ordre
    )

    const etapesEnrichies: ProgrammeEtapeEnrichie[] = etapesTriees.map((etape: {
      type_seance: TypeSeance
      cabinet_sessions: CabinetSession | null
      autonomous_sessions: AutonomousSession | null
      recurring_templates: RecurringTemplate | null
      [key: string]: unknown
    }) => {
      let est_complete = false
      let titre_display = 'Séance'
      let cabinet: CabinetSession | undefined
      let autonomous: AutonomousSession | undefined
      let template: RecurringTemplate | undefined

      if (etape.type_seance === 'cabinet' && etape.cabinet_sessions) {
        cabinet = etape.cabinet_sessions
        est_complete = cabinet.statut === 'realisee'
        titre_display = cabinet.objectif
      } else if (etape.type_seance === 'autonomie' && etape.autonomous_sessions) {
        autonomous = etape.autonomous_sessions
        est_complete = autonomous.statut === 'terminee'
        titre_display = autonomous.titre
      } else if (etape.type_seance === 'recurrente' && etape.recurring_templates) {
        template = etape.recurring_templates
        est_complete = false  // récurrents n'ont pas de statut global
        titre_display = template.titre
      }

      return {
        ...(etape as unknown as ProgrammeEtapeEnrichie),
        cabinet,
        autonomous,
        template,
        est_complete,
        titre_display,
      }
    })

    return {
      ...(prog as unknown as Programme),
      etapes: etapesEnrichies,
    }
  })

  return { data: enrichis, error: null }
}

// ============================================================
// Ajouter une étape à un programme existant
// ============================================================

export async function addEtapeAction(
  input: z.infer<typeof addEtapeSchema>
): Promise<{ error: string | null }> {
  const { user, error: authError } = await requireCoach()
  if (authError || !user) return { error: authError ?? 'Non authentifié' }

  const parsed = addEtapeSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  // Vérifier que exactement une FK est fournie
  const fkCount = [
    parsed.data.cabinet_session_id,
    parsed.data.autonomous_session_id,
    parsed.data.recurring_template_id,
  ].filter(Boolean).length

  if (fkCount !== 1) return { error: 'Une seule séance doit être liée à chaque étape' }

  const admin = createAdminClient()

  // Vérifier que le programme appartient bien à ce coach
  const { data: prog } = await admin
    .from('programmes')
    .select('id, client_id')
    .eq('id', parsed.data.programme_id)
    .eq('coach_id', user.id)
    .single()

  if (!prog) return { error: 'Programme introuvable' }

  // Calculer le prochain ordre
  const { count } = await admin
    .from('programme_etapes')
    .select('id', { count: 'exact', head: true })
    .eq('programme_id', parsed.data.programme_id)

  const prochain_ordre = (count ?? 0) + 1

  const { error } = await admin
    .from('programme_etapes')
    .insert({
      programme_id:          parsed.data.programme_id,
      ordre:                 prochain_ordre,
      type_seance:           parsed.data.type_seance,
      cabinet_session_id:    parsed.data.cabinet_session_id ?? null,
      autonomous_session_id: parsed.data.autonomous_session_id ?? null,
      recurring_template_id: parsed.data.recurring_template_id ?? null,
    })

  if (error) return { error: error.message }

  revalidatePath(`/coach/clients/${prog.client_id}`)
  return { error: null }
}

// ============================================================
// Supprimer une étape (et réordonner les suivantes)
// ============================================================

export async function removeEtapeAction(
  etapeId: string,
  programmeId: string
): Promise<{ error: string | null }> {
  const { user, error: authError } = await requireCoach()
  if (authError || !user) return { error: authError ?? 'Non authentifié' }

  const admin = createAdminClient()

  // Vérifier propriété du programme
  const { data: prog } = await admin
    .from('programmes')
    .select('id, client_id')
    .eq('id', programmeId)
    .eq('coach_id', user.id)
    .single()

  if (!prog) return { error: 'Programme introuvable' }

  // Supprimer l'étape
  const { data: deleted, error: delError } = await admin
    .from('programme_etapes')
    .delete()
    .eq('id', etapeId)
    .eq('programme_id', programmeId)
    .select('ordre')
    .single()

  if (delError) return { error: delError.message }

  // Réordonner les étapes suivantes (ordre -= 1)
  if (deleted) {
    await admin.rpc('reorder_programme_etapes_after_delete', {
      p_programme_id: programmeId,
      p_deleted_ordre: (deleted as { ordre: number }).ordre,
    })
  }

  revalidatePath(`/coach/clients/${prog.client_id}`)
  return { error: null }
}

// ============================================================
// Archiver un programme
// ============================================================

export async function archiveProgrammeAction(
  programmeId: string
): Promise<{ error: string | null }> {
  const { user, error: authError } = await requireCoach()
  if (authError || !user) return { error: authError ?? 'Non authentifié' }

  const admin = createAdminClient()

  const { data: prog, error } = await admin
    .from('programmes')
    .update({ statut: 'archive' })
    .eq('id', programmeId)
    .eq('coach_id', user.id)
    .select('client_id')
    .single()

  if (error) return { error: error.message }

  revalidatePath(`/coach/clients/${prog.client_id}`)
  return { error: null }
}

// ============================================================
// Calcul des stats d'un programme (pour le client)
// ============================================================

export function computeProgrammeStats(programme: ProgrammeAvecEtapes): ProgrammeStats {
  const total = programme.etapes.length
  const completes = programme.etapes.filter((e) => e.est_complete).length
  return {
    programme_id:    programme.id,
    total_etapes:    total,
    etapes_completes: completes,
    taux_completion:  total > 0 ? Math.round((completes / total) * 100) : 0,
  }
}

// ============================================================
// Vue client : programme actif du client connecté
// ============================================================

export async function getMyProgrammeAction(): Promise<{
  data: ProgrammeAvecEtapes | null
  error: string | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Non authentifié' }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('programmes')
    .select(`
      *,
      programme_etapes (
        *,
        cabinet_sessions (*),
        autonomous_sessions (*),
        recurring_templates (*)
      )
    `)
    .eq('client_id', user.id)
    .eq('statut', 'actif')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return { data: null, error: error.message }
  if (!data) return { data: null, error: null }

  // Même logique d'enrichissement que getClientProgrammesAction
  const etapesTriees = [...(data.programme_etapes ?? [])].sort(
    (a: { ordre: number }, b: { ordre: number }) => a.ordre - b.ordre
  )

  const etapesEnrichies: ProgrammeEtapeEnrichie[] = etapesTriees.map((etape: {
    type_seance: TypeSeance
    cabinet_sessions: CabinetSession | null
    autonomous_sessions: AutonomousSession | null
    recurring_templates: RecurringTemplate | null
    [key: string]: unknown
  }) => {
    let est_complete = false
    let titre_display = 'Séance'
    let cabinet: CabinetSession | undefined
    let autonomous: AutonomousSession | undefined
    let template: RecurringTemplate | undefined

    if (etape.type_seance === 'cabinet' && etape.cabinet_sessions) {
      cabinet = etape.cabinet_sessions
      est_complete = cabinet.statut === 'realisee'
      titre_display = cabinet.objectif
    } else if (etape.type_seance === 'autonomie' && etape.autonomous_sessions) {
      autonomous = etape.autonomous_sessions
      est_complete = autonomous.statut === 'terminee'
      titre_display = autonomous.titre
    } else if (etape.type_seance === 'recurrente' && etape.recurring_templates) {
      template = etape.recurring_templates
      est_complete = false
      titre_display = template.titre
    }

    return {
      ...(etape as unknown as ProgrammeEtapeEnrichie),
      cabinet, autonomous, template, est_complete, titre_display,
    }
  })

  return {
    data: { ...(data as unknown as Programme), etapes: etapesEnrichies },
    error: null,
  }
}
```

---

## Tâche 4 — Fonction SQL helper pour réordonnancement

**Ajouter à la migration `20260407000002_create_programmes.sql`**, après la création des tables :

```sql
-- Fonction helper : réordonner les étapes après suppression d'une étape
CREATE OR REPLACE FUNCTION public.reorder_programme_etapes_after_delete(
  p_programme_id  uuid,
  p_deleted_ordre integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.programme_etapes
  SET ordre = ordre - 1
  WHERE programme_id = p_programme_id
    AND ordre > p_deleted_ordre;
END;
$$;
```

---

## Tâche 5 — Composant `ProgrammeEtapesList` (vue coach)

Créer `src/components/coach/ProgrammeEtapesList.tsx` :

```tsx
'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Trash2, CheckCircle2, Circle, UserCheck, Clock, RefreshCw } from 'lucide-react'
import { removeEtapeAction } from '@/app/actions/programmes'
import type { ProgrammeAvecEtapes } from '@/types'

interface ProgrammeEtapesListProps {
  programme: ProgrammeAvecEtapes
  onUpdate?: () => void
}

function TypeBadge({ type }: { type: string }) {
  if (type === 'cabinet')    return <Badge variant="outline" className="text-[#20808D] border-[#20808D] text-xs gap-1"><UserCheck className="h-3 w-3" />Cabinet</Badge>
  if (type === 'autonomie')  return <Badge variant="outline" className="text-[#944454] border-[#944454] text-xs gap-1"><Clock className="h-3 w-3" />Autonome</Badge>
  if (type === 'recurrente') return <Badge variant="outline" className="text-amber-600 border-amber-400 text-xs gap-1"><RefreshCw className="h-3 w-3" />Routine</Badge>
  return null
}

export function ProgrammeEtapesList({ programme, onUpdate }: ProgrammeEtapesListProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleRemove(etapeId: string) {
    setError(null)
    startTransition(async () => {
      const result = await removeEtapeAction(etapeId, programme.id)
      if (result.error) {
        setError(result.error)
      } else {
        onUpdate?.()
      }
    })
  }

  const stats = {
    total:    programme.etapes.length,
    completes: programme.etapes.filter((e) => e.est_complete).length,
  }

  return (
    <div className="space-y-3">
      {/* En-tête programme */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-[#1A1A2E]">{programme.nom}</h4>
          {programme.description && (
            <p className="text-sm text-muted-foreground">{programme.description}</p>
          )}
        </div>
        <span className="text-sm text-muted-foreground">
          {stats.completes}/{stats.total} étape{stats.total > 1 ? 's' : ''}
        </span>
      </div>

      {/* Barre de progression */}
      {stats.total > 0 && (
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-[#20808D] transition-all"
            style={{ width: `${Math.round((stats.completes / stats.total) * 100)}%` }}
          />
        </div>
      )}

      {/* Liste des étapes */}
      {programme.etapes.length === 0 ? (
        <p className="text-sm text-muted-foreground py-3 text-center">
          Aucune étape ajoutée. Créez des séances puis ajoutez-les au programme.
        </p>
      ) : (
        <ol className="space-y-2">
          {programme.etapes.map((etape) => (
            <li
              key={etape.id}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card"
            >
              {/* Numéro + icône complétion */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-mono text-muted-foreground w-5 text-right">
                  {etape.ordre}.
                </span>
                {etape.est_complete ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
              </div>

              {/* Titre + type */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{etape.titre_display}</p>
                <TypeBadge type={etape.type_seance} />
              </div>

              {/* Bouton supprimer */}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-red-500 shrink-0"
                onClick={() => handleRemove(etape.id)}
                disabled={isPending}
                aria-label="Supprimer cette étape"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ol>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
```

---

## Tâche 6 — Composant `CreateProgrammeDialog` (coach)

Créer `src/components/coach/CreateProgrammeDialog.tsx` :

```tsx
'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Plus } from 'lucide-react'
import { createProgrammeAction } from '@/app/actions/programmes'

interface CreateProgrammeDialogProps {
  clientId: string  // auth user_id du client
  onCreated?: () => void
}

export function CreateProgrammeDialog({ clientId, onCreated }: CreateProgrammeDialogProps) {
  const [open, setOpen] = useState(false)
  const [nom, setNom] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await createProgrammeAction({ client_id: clientId, nom, description: description || null })
      if (result.error) {
        setError(result.error)
      } else {
        setOpen(false)
        setNom('')
        setDescription('')
        onCreated?.()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-[#20808D] hover:bg-[#1a6b77] text-white gap-2">
          <Plus className="h-4 w-4" />
          Nouveau programme
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Créer un programme</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="prog-nom">Nom du programme</Label>
            <Input
              id="prog-nom"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Ex : Confiance en compétition — 6 semaines"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prog-desc">Description (optionnel)</Label>
            <Textarea
              id="prog-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Objectifs du programme, contexte..."
              rows={3}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isPending} className="bg-[#20808D] hover:bg-[#1a6b77] text-white">
              {isPending ? 'Création…' : 'Créer le programme'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

---

## Tâche 7 — Composant `AddEtapeDialog` (coach)

Créer `src/components/coach/AddEtapeDialog.tsx` :

Ce dialog permet au coach de sélectionner une séance existante (parmi les 3 types) et
de l'ajouter comme étape du programme.

```tsx
'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus } from 'lucide-react'
import { addEtapeAction } from '@/app/actions/programmes'
import type { CabinetSession, AutonomousSession, RecurringTemplate, TypeSeance } from '@/types'

interface AddEtapeDialogProps {
  programmeId: string
  // Séances existantes du client (passées depuis la fiche client)
  cabinetSessions: CabinetSession[]
  autonomousSessions: AutonomousSession[]
  recurringTemplates: RecurringTemplate[]
  onAdded?: () => void
}

export function AddEtapeDialog({
  programmeId,
  cabinetSessions,
  autonomousSessions,
  recurringTemplates,
  onAdded,
}: AddEtapeDialogProps) {
  const [open, setOpen] = useState(false)
  const [typeSeance, setTypeSeance] = useState<TypeSeance | ''>('')
  const [selectedId, setSelectedId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!typeSeance || !selectedId) return
    setError(null)

    startTransition(async () => {
      const result = await addEtapeAction({
        programme_id:          programmeId,
        type_seance:           typeSeance,
        cabinet_session_id:    typeSeance === 'cabinet'    ? selectedId : null,
        autonomous_session_id: typeSeance === 'autonomie'  ? selectedId : null,
        recurring_template_id: typeSeance === 'recurrente' ? selectedId : null,
      })

      if (result.error) {
        setError(result.error)
      } else {
        setOpen(false)
        setTypeSeance('')
        setSelectedId('')
        onAdded?.()
      }
    })
  }

  // Options de séances selon le type sélectionné
  const options = typeSeance === 'cabinet'
    ? cabinetSessions.map((s) => ({ id: s.id, label: `${s.objectif} — ${new Date(s.date_seance).toLocaleDateString('fr-FR')}` }))
    : typeSeance === 'autonomie'
    ? autonomousSessions.map((s) => ({ id: s.id, label: s.titre }))
    : typeSeance === 'recurrente'
    ? recurringTemplates.map((t) => ({ id: t.id, label: t.titre }))
    : []

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-[#20808D] border-[#20808D]">
          <Plus className="h-3.5 w-3.5" />
          Ajouter une étape
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter une étape au programme</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Type de séance</Label>
            <Select value={typeSeance} onValueChange={(v) => { setTypeSeance(v as TypeSeance); setSelectedId('') }}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un type…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cabinet">Séance cabinet</SelectItem>
                <SelectItem value="autonomie">Séance autonome</SelectItem>
                <SelectItem value="recurrente">Routine récurrente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {typeSeance && (
            <div className="space-y-1.5">
              <Label>Séance à ajouter</Label>
              {options.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucune séance de ce type disponible pour ce client.
                </p>
              ) : (
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une séance…" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button
              type="submit"
              disabled={isPending || !typeSeance || !selectedId}
              className="bg-[#20808D] hover:bg-[#1a6b77] text-white"
            >
              {isPending ? 'Ajout…' : 'Ajouter l\'étape'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

---

## Tâche 8 — Composant `ProgrammeProgress` (vue client mobile)

Créer `src/components/client/ProgrammeProgress.tsx` :

```tsx
import { CheckCircle2, Circle, Lock, UserCheck, Clock, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ProgrammeAvecEtapes } from '@/types'
import { computeProgrammeStats } from '@/app/actions/programmes'

interface ProgrammeProgressProps {
  programme: ProgrammeAvecEtapes
}

function EtapeIcon({ type, estComplete, ordre, totalCompletes }: {
  type: string
  estComplete: boolean
  ordre: number
  totalCompletes: number
}) {
  const estAccessible = ordre <= totalCompletes + 1  // accessible si toutes les précédentes sont faites
  if (estComplete)     return <CheckCircle2 className="h-5 w-5 text-green-500" />
  if (estAccessible)   return <Circle className="h-5 w-5 text-[#20808D]" />
  return <Lock className="h-5 w-5 text-muted-foreground opacity-40" />
}

export function ProgrammeProgress({ programme }: ProgrammeProgressProps) {
  const stats = computeProgrammeStats(programme)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-semibold text-[#1A1A2E]">
            {programme.nom}
          </CardTitle>
          <span className="text-sm font-medium text-[#20808D] shrink-0">
            {stats.etapes_completes}/{stats.total_etapes}
          </span>
        </div>
        {programme.description && (
          <p className="text-sm text-muted-foreground">{programme.description}</p>
        )}
        {/* Barre de progression globale */}
        <div className="mt-2">
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-[#20808D] transition-all duration-500"
              style={{ width: `${stats.taux_completion}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1 text-right">
            {stats.taux_completion}% complété
          </p>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <ol className="space-y-3">
          {programme.etapes.map((etape) => {
            const estAccessible = etape.ordre <= stats.etapes_completes + 1
            return (
              <li
                key={etape.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  etape.est_complete
                    ? 'border-green-200 bg-green-50'
                    : estAccessible
                    ? 'border-[#20808D]/30 bg-[#E8F4F5]'
                    : 'border-border bg-muted/30 opacity-60'
                }`}
              >
                {/* Icône état */}
                <EtapeIcon
                  type={etape.type_seance}
                  estComplete={etape.est_complete}
                  ordre={etape.ordre}
                  totalCompletes={stats.etapes_completes}
                />

                {/* Contenu */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs text-muted-foreground">Étape {etape.ordre}</span>
                    {etape.type_seance === 'cabinet' && <UserCheck className="h-3 w-3 text-muted-foreground" />}
                    {etape.type_seance === 'autonomie' && <Clock className="h-3 w-3 text-muted-foreground" />}
                    {etape.type_seance === 'recurrente' && <RefreshCw className="h-3 w-3 text-muted-foreground" />}
                  </div>
                  <p className="text-sm font-medium text-[#1A1A2E] truncate">{etape.titre_display}</p>
                </div>

                {/* Badge complétion */}
                {etape.est_complete && (
                  <Badge className="bg-green-100 text-green-700 text-xs shrink-0">✓ Fait</Badge>
                )}
              </li>
            )
          })}
        </ol>
      </CardContent>
    </Card>
  )
}
```

---

## Tâche 9 — Page client `/client/programme`

Créer `src/app/(client)/client/programme/page.tsx` :

```tsx
import { getMyProgrammeAction } from '@/app/actions/programmes'
import { ProgrammeProgress } from '@/components/client/ProgrammeProgress'
import { Card, CardContent } from '@/components/ui/card'
import { Layers } from 'lucide-react'

export default async function ClientProgrammePage() {
  const { data: programme, error } = await getMyProgrammeAction()

  if (error) {
    return <p className="text-sm text-red-600 p-4">{error}</p>
  }

  if (!programme) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="pt-6 pb-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Layers className="h-7 w-7 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-bold text-[#1A1A2E]">Pas encore de programme</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Votre coach vous assignera bientôt un programme personnalisé.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold text-[#1A1A2E]">Mon programme</h1>
      <ProgrammeProgress programme={programme} />
    </div>
  )
}
```

---

## Tâche 10 — Intégration sur la fiche client coach

**Fichier :** `src/app/(dashboard)/coach/clients/[id]/page.tsx`

Dans le tab "Séances", ajouter la section programme **au-dessus** de la timeline existante :

```tsx
// Imports à ajouter
import { getClientProgrammesAction } from '@/app/actions/programmes'
import { ProgrammeEtapesList } from '@/components/coach/ProgrammeEtapesList'
import { CreateProgrammeDialog } from '@/components/coach/CreateProgrammeDialog'
import { AddEtapeDialog } from '@/components/coach/AddEtapeDialog'

// Dans le fetch du Server Component, après resolution du clientUserId :
const { data: programmes } = await getClientProgrammesAction(client.user_id)

// Dans le tab "Séances" :
<TabsContent value="seances" className="space-y-6">

  {/* Section Programme */}
  <section>
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-sm font-semibold text-[#1A1A2E]">Programme actif</h3>
      {/* Bouton créer programme seulement si aucun actif */}
      {(!programmes || programmes.length === 0) && (
        <CreateProgrammeDialog clientId={client.user_id} />
      )}
    </div>

    {programmes && programmes.length > 0 ? (
      <div className="space-y-4">
        {programmes.map((prog) => (
          <div key={prog.id} className="border rounded-lg p-4 space-y-3">
            <ProgrammeEtapesList programme={prog} />
            <AddEtapeDialog
              programmeId={prog.id}
              cabinetSessions={cabinetSessions ?? []}
              autonomousSessions={autonomousSessions ?? []}
              recurringTemplates={recurringTemplates ?? []}
            />
          </div>
        ))}
      </div>
    ) : (
      <p className="text-sm text-muted-foreground">
        Aucun programme actif. Créez un programme pour structurer le parcours de ce client.
      </p>
    )}
  </section>

  {/* Séparateur */}
  <div className="border-t" />

  {/* Timeline unifiée existante (Niveau 1) */}
  <section>
    <h3 className="text-sm font-semibold text-[#1A1A2E] mb-3">Historique des séances</h3>
    <ClientSessionTimeline items={timeline ?? []} />
  </section>

</TabsContent>
```

**Note :** `cabinetSessions`, `autonomousSessions`, `recurringTemplates` doivent être
chargés séparément depuis les actions existantes pour alimenter `AddEtapeDialog`. Les
données sont déjà disponibles si `getClientSessionTimelineAction` (Niveau 1) est en place.

---

## Tâche 11 — Ajouter l'onglet Programme dans la nav client

**Fichier :** `src/app/actions/client-data.ts` → `getClientNavVisibility`

Ajouter `hasProgramme: boolean` à l'interface `ClientNavVisibility` et à la requête :

```typescript
// Ajouter à la requête parallèle :
supabase
  .from('programmes')
  .select('id', { count: 'exact', head: true })
  .eq('client_id', user.id)
  .eq('statut', 'actif')
  .limit(1),
```

**Fichier :** `src/components/client/ClientNav.tsx` — Ajouter l'item Programme :

```typescript
{ href: '/client/programme', label: 'Programme', icon: Layers, exact: false, show: visibility.hasProgramme },
```

---

## Résumé des fichiers à créer / modifier

| Fichier | Action |
|---------|--------|
| `supabase/migrations/20260407000002_create_programmes.sql` | CRÉER |
| `src/types/index.ts` | MODIFIER (Programme, ProgrammeEtape, etc.) |
| `src/app/actions/programmes.ts` | CRÉER |
| `src/components/coach/ProgrammeEtapesList.tsx` | CRÉER |
| `src/components/coach/CreateProgrammeDialog.tsx` | CRÉER |
| `src/components/coach/AddEtapeDialog.tsx` | CRÉER |
| `src/components/client/ProgrammeProgress.tsx` | CRÉER |
| `src/app/(client)/client/programme/page.tsx` | CRÉER |
| `src/app/(dashboard)/coach/clients/[id]/page.tsx` | MODIFIER |
| `src/app/actions/client-data.ts` | MODIFIER (hasProgramme) |
| `src/components/client/ClientNav.tsx` | MODIFIER (onglet Programme) |

---

## Critères d'acceptation

- [ ] Le coach peut créer un programme nommé pour un client
- [ ] Le coach peut ajouter des étapes au programme depuis les 3 types de séances
- [ ] Le coach peut supprimer une étape (les ordres se réajustent)
- [ ] La liste des étapes affiche l'état de complétion en temps réel (via statut de la séance)
- [ ] Le client voit son programme dans `/client/programme` avec progression X/Y
- [ ] Les étapes futures sont visuellement verrouillées côté client
- [ ] L'onglet "Programme" apparaît dans la nav client seulement si un programme actif existe
- [ ] Un seul programme actif par client est affiché (le plus récent)
- [ ] La contrainte DB `programme_etapes_one_fk` est respectée (une seule FK par étape)
- [ ] Pas de `any` TypeScript
- [ ] shadcn/ui uniquement pour les composants

---

## Contraintes globales (CLAUDE.md)

- `NEVER` utiliser `any` en TypeScript
- `NEVER` silent catch — toujours gérer les erreurs explicitement
- Valider tous les inputs avec Zod dans les server actions
- shadcn/ui pour tous les composants UI
- Commentaires logique métier en **français**, code technique en **anglais**
- Tables BDD : `snake_case`
- `NEVER` mélanger Prisma et Supabase dans un même module
