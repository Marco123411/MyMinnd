# Étape 20 — Presets de tests cognitifs configurables

## Contexte et décisions de conception

### Problème
Les tests cognitifs ont actuellement une configuration globale unique par type de test (`cognitive_test_definitions.config`). Un coach ne peut pas adapter la durée ou la difficulté d'un test selon le contexte client. Il n'existe pas non plus de trace de quelle config a été utilisée lors d'une session.

### Décisions prises (issues du brainstorm)

**1. Presets nommés — jamais de paramètres raw exposés**
Un coach voit "Court (5 min)" et "Standard (10 min)", jamais `isi_min_ms` ou `trials_per_condition`. Les valeurs techniques sont encapsulées dans des presets pré-définis, pas configurables manuellement.

**2. Validation scientifique obligatoire à afficher**
Seuls certains presets sont scientifiquement validés dans la littérature (ex : PVT 10 min = norme académique, PVT 5 min = validé par Basner 2011). Tout preset non validé doit afficher un avertissement clair dans l'UI coach ET dans l'espace client. Ne pas exposer un coach à des décisions basées sur des données non fiables sans l'avoir informé.

**3. Comparaison cross-preset : BLOQUÉE**
Deux sessions avec des presets différents ne sont pas comparables. Les graphiques d'évolution longitudinale n'affichent que les sessions ayant le même `preset_id`. Si un client a passé 2 sessions PVT Standard et 1 session PVT Court, les graphiques sont séparés et clairement étiquetés.

**4. Deux niveaux de presets**
- **Admin** : presets globaux, disponibles pour tous les coachs. Peut marquer un preset comme "scientifiquement validé" avec une référence bibliographique.
- **Coach** : presets personnels, disponibles uniquement pour lui. Non marqués "validés" par défaut.

**5. Config stockée dans chaque session (immuable)**
La config résolue est copiée dans `cognitive_sessions.config_used` au moment de la création de la session. Même si le preset est modifié ou supprimé plus tard, l'historique est intègre.

---

## Architecture de données

### Nouvelle table : `cognitive_test_presets`

```sql
CREATE TABLE public.cognitive_test_presets (
  id                    uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  cognitive_test_id     uuid         NOT NULL REFERENCES cognitive_test_definitions(id) ON DELETE CASCADE,
  slug                  varchar(100) NOT NULL,
  name                  varchar(200) NOT NULL,
  description           text,
  config                jsonb        NOT NULL,
  -- Validation scientifique
  is_validated          boolean      NOT NULL DEFAULT false,
  validation_reference  text,        -- ex : "Basner & Dinges, 2011, Sleep Medicine Reviews"
  -- Propriété
  coach_id              uuid         REFERENCES auth.users(id) ON DELETE CASCADE,
  -- NULL = preset global (admin), uuid = preset personnel du coach
  is_active             boolean      NOT NULL DEFAULT true,
  created_at            timestamptz  NOT NULL DEFAULT now(),
  updated_at            timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (cognitive_test_id, slug, coach_id)
);

-- Index pour les requêtes fréquentes
CREATE INDEX ON cognitive_test_presets (cognitive_test_id, is_active);
CREATE INDEX ON cognitive_test_presets (coach_id) WHERE coach_id IS NOT NULL;

-- RLS
ALTER TABLE cognitive_test_presets ENABLE ROW LEVEL SECURITY;

-- Lecture : presets globaux (coach_id IS NULL) ou presets du coach connecté
CREATE POLICY "coach_read_presets" ON cognitive_test_presets
  FOR SELECT USING (
    is_active = true AND (
      coach_id IS NULL
      OR coach_id = auth.uid()
    )
  );

-- Création : uniquement ses propres presets (coach_id = auth.uid())
CREATE POLICY "coach_create_own_presets" ON cognitive_test_presets
  FOR INSERT WITH CHECK (
    coach_id = auth.uid()
    AND is_validated = false  -- seul l'admin peut créer des presets validés
  );

-- Modification/suppression : uniquement ses propres presets
CREATE POLICY "coach_manage_own_presets" ON cognitive_test_presets
  FOR UPDATE USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid() AND is_validated = false);

CREATE POLICY "coach_delete_own_presets" ON cognitive_test_presets
  FOR DELETE USING (coach_id = auth.uid());

-- Admin : accès total via service_role (pas de politique restrictive)
```

### Modifications de `cognitive_sessions`

```sql
ALTER TABLE public.cognitive_sessions
  ADD COLUMN preset_id   uuid  REFERENCES cognitive_test_presets(id),
  ADD COLUMN config_used jsonb;
-- preset_id peut être NULL (session créée sans preset = config globale par défaut)
-- config_used stocke la config résolue au moment de la création (immuable)
```

### Seed : presets globaux par défaut (admin)

À insérer après la création de la table, en référençant les IDs des test_definitions :

```sql
-- PVT — presets globaux (scientifiquement validés)
INSERT INTO cognitive_test_presets
  (cognitive_test_id, slug, name, description, config, is_validated, validation_reference, coach_id)
SELECT
  id,
  'pvt_standard',
  'Standard (10 min)',
  'Protocole standard — comparaison normative complète possible.',
  '{"duration_seconds":600,"isi_min_ms":2000,"isi_max_ms":10000,"lapse_threshold_ms":500,"anticipation_threshold_ms":100}',
  true,
  'Dinges & Powell (1985) ; Basner & Dinges (2011)',
  NULL
FROM cognitive_test_definitions WHERE slug = 'pvt';

INSERT INTO cognitive_test_presets
  (cognitive_test_id, slug, name, description, config, is_validated, validation_reference, coach_id)
SELECT
  id,
  'pvt_court',
  'Court (5 min)',
  'Version brève validée. Recommandée pour les contraintes de temps. Moins sensible aux lapses rares.',
  '{"duration_seconds":300,"isi_min_ms":2000,"isi_max_ms":10000,"lapse_threshold_ms":500,"anticipation_threshold_ms":100}',
  true,
  'Basner & Dinges (2011), Sleep Medicine Reviews',
  NULL
FROM cognitive_test_definitions WHERE slug = 'pvt';

-- Stroop — presets globaux
INSERT INTO cognitive_test_presets
  (cognitive_test_id, slug, name, description, config, is_validated, validation_reference, coach_id)
SELECT
  id,
  'stroop_standard',
  'Standard (24 essais/condition)',
  'Protocole standard — fiabilité test-retest suffisante pour le coaching.',
  '{"trials_per_condition":24,"fixation_ms":500,"max_response_ms":3000}',
  true,
  'MacLeod (1991), Psychological Bulletin',
  NULL
FROM cognitive_test_definitions WHERE slug = 'stroop';

INSERT INTO cognitive_test_presets
  (cognitive_test_id, slug, name, description, config, is_validated, validation_reference, coach_id)
SELECT
  id,
  'stroop_rapide',
  'Rapide (12 essais/condition)',
  'Screening initial uniquement. Non validé pour des décisions de suivi longitudinal.',
  '{"trials_per_condition":12,"fixation_ms":500,"max_response_ms":3000}',
  false,
  NULL,
  NULL
FROM cognitive_test_definitions WHERE slug = 'stroop';

-- Simon — presets globaux
INSERT INTO cognitive_test_presets
  (cognitive_test_id, slug, name, description, config, is_validated, validation_reference, coach_id)
SELECT
  id,
  'simon_standard',
  'Standard (30 essais/condition)',
  'Protocole standard.',
  '{"trials_per_condition":30,"fixation_ms":500,"max_response_ms":2000}',
  true,
  'Simon & Rudell (1967) ; Lu & Proctor (1995)',
  NULL
FROM cognitive_test_definitions WHERE slug = 'simon';

INSERT INTO cognitive_test_presets
  (cognitive_test_id, slug, name, description, config, is_validated, validation_reference, coach_id)
SELECT
  id,
  'simon_rapide',
  'Rapide (20 essais/condition)',
  'Screening initial uniquement. Non validé pour des décisions de suivi longitudinal.',
  '{"trials_per_condition":20,"fixation_ms":500,"max_response_ms":2000}',
  false,
  NULL,
  NULL
FROM cognitive_test_definitions WHERE slug = 'simon';

-- Digital Span — presets globaux
INSERT INTO cognitive_test_presets
  (cognitive_test_id, slug, name, description, config, is_validated, validation_reference, coach_id)
SELECT
  id,
  'span_standard',
  'Standard (empan max 12)',
  'Protocole standard — Wechsler Memory Scale.',
  '{"start_length":3,"max_length":12,"attempts_per_length":2,"digit_display_ms":1000,"inter_digit_ms":300}',
  true,
  'Wechsler (2009), WMS-IV',
  NULL
FROM cognitive_test_definitions WHERE slug = 'digital_span';

INSERT INTO cognitive_test_presets
  (cognitive_test_id, slug, name, description, config, is_validated, validation_reference, coach_id)
SELECT
  id,
  'span_etendu',
  'Étendu (empan max 16)',
  'Pour les populations à haute performance. Non validé hors contexte de recherche.',
  '{"start_length":3,"max_length":16,"attempts_per_length":3,"digit_display_ms":1000,"inter_digit_ms":300}',
  false,
  NULL,
  NULL
FROM cognitive_test_definitions WHERE slug = 'digital_span';
```

---

## Types TypeScript

À ajouter dans `src/types/index.ts` :

```typescript
// Preset d'un test cognitif (admin global ou coach personnel)
export interface CognitiveTestPreset {
  id: string
  cognitive_test_id: string
  slug: string
  name: string
  description: string | null
  config: Record<string, unknown>
  is_validated: boolean
  validation_reference: string | null
  coach_id: string | null  // null = preset global (admin)
  is_active: boolean
  created_at: string
}
```

Modifier `CognitiveSession` dans `src/types/index.ts` :

```typescript
export interface CognitiveSession {
  // ...champs existants...
  preset_id: string | null          // NOUVEAU
  config_used: Record<string, unknown> | null  // NOUVEAU
}
```

---

## Actions serveur

### `src/app/actions/presets.ts` (nouveau fichier)

```typescript
'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { CognitiveTestPreset } from '@/types'

const uuidSchema = z.string().uuid()

const presetCreateSchema = z.object({
  cognitive_test_id: z.string().uuid(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9_]+$/),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullable(),
  config: z.record(z.string(), z.unknown()),
})

// Récupère les presets disponibles pour un test (globaux + personnels du coach)
export async function getCognitivePresetsForTest(
  testId: string
): Promise<{ data: CognitiveTestPreset[]; error: string | null }> {
  const parsed = uuidSchema.safeParse(testId)
  if (!parsed.success) return { data: [], error: 'testId invalide' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [], error: 'Non authentifié' }

  const { data, error } = await supabase
    .from('cognitive_test_presets')
    .select('*')
    .eq('cognitive_test_id', parsed.data)
    .eq('is_active', true)
    .order('is_validated', { ascending: false })  // validés en premier
    .order('created_at')

  if (error) return { data: [], error: 'Impossible de charger les presets' }
  return { data: (data ?? []) as CognitiveTestPreset[], error: null }
}

// Récupère tous les presets pour tous les tests (pour l'UI d'invitation)
export async function getAllCognitivePresetsAction(): Promise<{
  data: Record<string, CognitiveTestPreset[]>  // clé = test slug
  error: string | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: {}, error: 'Non authentifié' }

  const { data, error } = await supabase
    .from('cognitive_test_presets')
    .select('*, cognitive_test_definitions(slug)')
    .eq('is_active', true)
    .order('is_validated', { ascending: false })
    .order('created_at')

  if (error) return { data: {}, error: 'Impossible de charger les presets' }

  const grouped: Record<string, CognitiveTestPreset[]> = {}
  for (const row of data ?? []) {
    const def = Array.isArray(row.cognitive_test_definitions)
      ? row.cognitive_test_definitions[0]
      : row.cognitive_test_definitions
    const slug = (def as { slug: string } | null)?.slug ?? ''
    if (!grouped[slug]) grouped[slug] = []
    grouped[slug].push(row as CognitiveTestPreset)
  }

  return { data: grouped, error: null }
}

// Crée un preset personnel pour le coach connecté
export async function createCoachPresetAction(input: {
  cognitive_test_id: string
  slug: string
  name: string
  description: string | null
  config: Record<string, unknown>
}): Promise<{ data: CognitiveTestPreset | null; error: string | null }> {
  const parsed = presetCreateSchema.safeParse(input)
  if (!parsed.success) return { data: null, error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Non authentifié' }

  const { data, error } = await supabase
    .from('cognitive_test_presets')
    .insert({
      ...parsed.data,
      coach_id: user.id,
      is_validated: false,  // les coachs ne peuvent pas auto-valider
    })
    .select()
    .single()

  if (error) return { data: null, error: 'Impossible de créer le preset' }
  revalidatePath('/coach')
  return { data: data as CognitiveTestPreset, error: null }
}

// Supprime un preset personnel du coach
export async function deleteCoachPresetAction(
  presetId: string
): Promise<{ error: string | null }> {
  const parsed = uuidSchema.safeParse(presetId)
  if (!parsed.success) return { error: 'presetId invalide' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  // Soft delete — ne pas supprimer les sessions qui référencent ce preset
  const { error } = await supabase
    .from('cognitive_test_presets')
    .update({ is_active: false })
    .eq('id', parsed.data)
    .eq('coach_id', user.id)  // le coach ne peut supprimer que les siens

  if (error) return { error: 'Impossible de supprimer le preset' }
  revalidatePath('/coach')
  return { error: null }
}
```

### Modifier `src/app/actions/cognitive-results.ts`

Changer la signature de `createCognitiveInvitationAction` :

```typescript
export async function createCognitiveInvitationAction(
  clientId: string,
  testSlug: string,
  presetId?: string  // NOUVEAU — optionnel
): Promise<{ data: { inviteUrl: string; testSlug: string } | null; error: string | null }>
```

À l'intérieur, avant l'INSERT de la session :

```typescript
// Résoudre le preset si fourni
let resolvedConfig: Record<string, unknown> | null = null
let resolvedPresetId: string | null = null

if (presetId) {
  const parsedPresetId = uuidSchema.safeParse(presetId)
  if (!parsedPresetId.success) return { data: null, error: 'presetId invalide' }

  const { data: preset } = await supabase
    .from('cognitive_test_presets')
    .select('id, config, coach_id, is_active')
    .eq('id', parsedPresetId.data)
    .eq('is_active', true)
    .or(`coach_id.is.null,coach_id.eq.${user.id}`)  // global ou personnel du coach
    .single()

  if (!preset) return { data: null, error: 'Preset introuvable' }
  resolvedConfig = preset.config as Record<string, unknown>
  resolvedPresetId = preset.id
}

// INSERT avec preset_id et config_used
await admin.from('cognitive_sessions').insert({
  user_id: clientData.user_id,
  cognitive_test_id: testDef.id,
  coach_id: user.id,
  status: 'pending',
  preset_id: resolvedPresetId,        // NOUVEAU
  config_used: resolvedConfig,        // NOUVEAU — null = utilise config globale
})
```

### Modifier `src/app/actions/cognitive.ts` — `completeCognitiveSessionAction`

Le scoring utilise les trials (is_lapse, is_anticipation calculés par le runner avec la bonne config). Rien à changer dans le scoring lui-même.

---

## Modifications du test runner

Dans `src/app/(test)/test/cognitive/[slug]/[sessionId]/page.tsx` :

```typescript
// Avant
const dbConfig = (definition.config ?? {}) as Record<string, unknown>

// Après — la session stocke la config résolue au moment de l'invitation
const dbConfig = (session.config_used ?? definition.config ?? {}) as Record<string, unknown>
```

C'est **la seule modification** dans le test runner. Tout le reste fonctionne tel quel.

---

## Composant : `PresetSelector` (nouveau)

`src/components/cognitive/PresetSelector.tsx`

```typescript
'use client'

import type { CognitiveTestPreset } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'

interface PresetSelectorProps {
  presets: CognitiveTestPreset[]
  value: string
  onChange: (presetId: string) => void
}

export function PresetSelector({ presets, value, onChange }: PresetSelectorProps) {
  const selected = presets.find((p) => p.id === value)

  return (
    <div className="space-y-2">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Choisir une version…" />
        </SelectTrigger>
        <SelectContent>
          {presets.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              <div className="flex items-center gap-2">
                {p.is_validated ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                )}
                <span>{p.name}</span>
                {p.coach_id && (
                  <Badge variant="outline" className="text-xs ml-auto">Personnel</Badge>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Message selon le preset sélectionné */}
      {selected && !selected.is_validated && (
        <p className="text-xs text-amber-600 flex items-start gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          Ce preset n&apos;est pas validé scientifiquement pour le suivi longitudinal.
          Résultats à interpréter avec précaution.
        </p>
      )}
      {selected?.is_validated && selected.validation_reference && (
        <p className="text-xs text-muted-foreground">
          Référence : {selected.validation_reference}
        </p>
      )}
    </div>
  )
}
```

---

## Modifications : `CognitiveTab.tsx` (coach CRM)

### 1. Mise à jour de `createCognitiveInvitationAction` appelée dans le dialog

La modal "Envoyer un test" doit afficher en 2 étapes :
1. Sélection du test (slug) — inchangé
2. Sélection du preset pour ce test — nouveau, avec `PresetSelector`

Ajouter state :
```typescript
const [selectedPresetId, setSelectedPresetId] = useState<string>('')
const [presetsForTest, setPresetsForTest] = useState<CognitiveTestPreset[]>([])
const [presetsLoading, setPresetsLoading] = useState(false)
```

Quand `selectedSlug` change, charger les presets :
```typescript
useEffect(() => {
  if (!selectedSlug) { setPresetsForTest([]); return }
  setPresetsLoading(true)
  // Appel à getCognitivePresetsForTest via l'action (ou passer les presets en props)
  getAllCognitivePresetsAction().then(({ data }) => {
    setPresetsForTest(data[selectedSlug] ?? [])
    setPresetsLoading(false)
  })
}, [selectedSlug])
```

Modifier `handleSend` :
```typescript
const result = await createCognitiveInvitationAction(clientId, selectedSlug, selectedPresetId || undefined)
```

### 2. Afficher le preset dans le tableau récapitulatif

Ajouter un badge dans la colonne "Test" :
```tsx
<TableCell className="font-medium">
  {session.test_name}
  {session.preset_slug && (
    <Badge variant="outline" className="ml-2 text-xs font-normal">
      {session.preset_name ?? session.preset_slug}
    </Badge>
  )}
  {session.is_preset_validated === false && (
    <AlertTriangle className="inline h-3 w-3 text-amber-500 ml-1" />
  )}
</TableCell>
```

### 3. Bloquer les comparaisons cross-preset dans `CognitiveEvolutionChart`

Dans `CognitiveTab`, avant de passer les sessions au chart :

```typescript
// Grouper par (slug + preset_id) pour éviter les comparaisons cross-preset
const sessionsBySlugAndPreset = sessions.reduce<
  Record<string, CognitiveSessionWithDefinition[]>
>((acc, s) => {
  const key = `${s.test_slug}__${s.preset_id ?? 'default'}`
  if (!acc[key]) acc[key] = []
  acc[key].push(s)
  return acc
}, {})
```

Le chart ne reçoit que les sessions du même preset group. Si plusieurs groupes existent pour le même test, afficher un sélecteur de groupe ou le premier avec une note.

---

## Modifications : `CognitiveEvolutionChart.tsx`

Ajouter une prop `isValidated` et afficher un avertissement si false :

```typescript
interface CognitiveEvolutionChartProps {
  sessions: Session[]
  metricKey: keyof CognitiveTestResult
  metricLabel: string
  unit?: string
  lowerIsBetter?: boolean
  isValidated?: boolean          // NOUVEAU
  presetName?: string            // NOUVEAU — pour l'étiquette du chart
}
```

Dans le rendu, au-dessus du chart :
```tsx
{!isValidated && (
  <p className="text-xs text-amber-600 flex items-center gap-1">
    <AlertTriangle className="h-3 w-3" />
    Preset non validé — évolution indicative uniquement
  </p>
)}
{presetName && (
  <Badge variant="outline" className="text-xs">{presetName}</Badge>
)}
```

---

## Page admin : gestion des presets globaux

`src/app/(admin)/admin/cognitive-presets/page.tsx` (nouveau)

Fonctionnalités :
- Liste tous les presets groupés par test
- Crée / modifie / désactive des presets globaux (admin seulement)
- Peut marquer un preset comme `is_validated = true` avec une référence bibliographique
- Utilise `createAdminClient()` pour contourner les RLS

Actions admin (dans `src/app/actions/presets.ts` à ajouter) :

```typescript
// Admin : créer un preset global (is_validated possible)
export async function adminCreatePresetAction(input: {
  cognitive_test_id: string
  slug: string
  name: string
  description: string | null
  config: Record<string, unknown>
  is_validated: boolean
  validation_reference: string | null
}): Promise<{ data: CognitiveTestPreset | null; error: string | null }>

// Admin : modifier un preset existant
export async function adminUpdatePresetAction(
  presetId: string,
  updates: Partial<Omit<CognitiveTestPreset, 'id' | 'created_at'>>
): Promise<{ error: string | null }>
```

Les actions admin vérifient le rôle via `user.app_metadata.role === 'admin'`.

---

## Affichage côté client : `src/app/(client)/client/cognitive/page.tsx`

Ajouter sur chaque card de résultat un indicateur du preset utilisé :

```tsx
{/* Badge preset sur chaque card */}
{lastSession.preset_name && (
  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
    {lastSession.is_preset_validated ? (
      <CheckCircle2 className="h-3 w-3 text-green-600" />
    ) : (
      <AlertTriangle className="h-3 w-3 text-amber-500" />
    )}
    Version : {lastSession.preset_name}
    {!lastSession.is_preset_validated && (
      <span className="text-amber-600">
        (non validé scientifiquement)
      </span>
    )}
  </div>
)}
```

---

## `CognitiveSessionWithDefinition` — enrichir le type

Dans `src/app/actions/cognitive-results.ts`, enrichir l'interface :

```typescript
export interface CognitiveSessionWithDefinition {
  id: string
  completed_at: string
  cognitive_test_id: string
  test_slug: string
  test_name: string
  computed_metrics: CognitiveTestResult | null
  preset_id: string | null          // NOUVEAU
  preset_slug: string | null        // NOUVEAU
  preset_name: string | null        // NOUVEAU
  is_preset_validated: boolean | null  // NOUVEAU
}
```

Adapter les requêtes pour faire un join sur `cognitive_test_presets` :

```typescript
.select(`
  id, completed_at, cognitive_test_id, computed_metrics, preset_id,
  cognitive_test_definitions(slug, name),
  cognitive_test_presets(slug, name, is_validated)
`)
```

---

## Règles de comparabilité — résumé

| Situation | Comportement attendu |
|-----------|---------------------|
| 2 sessions, même preset | Graphique d'évolution affiché normalement |
| 2 sessions, presets différents | Graphiques séparés par preset, étiquetés |
| 1 seule session | Message "Passez le test à nouveau pour voir votre évolution" |
| Preset non validé | Avertissement visible sur le graphique et les cards |
| Preset validé + référence | Référence bibliographique affichée au survol/détail |

---

## Contraintes et règles métier

- **NEVER** exposer les valeurs numériques de config (ms, seuils) dans l'UI coach ou client
- **ALWAYS** afficher l'avertissement "non validé" sur les presets `is_validated = false`
- **NEVER** comparer dans un même graphique des sessions avec des `preset_id` différents
- Un coach **NE PEUT PAS** créer un preset avec `is_validated = true` — c'est réservé à l'admin
- Un preset supprimé (soft delete) reste référencé dans les sessions existantes — l'historique est préservé
- La colonne `config_used` est **immuable** après création de la session (ne jamais la mettre à jour)
- Si `config_used` est NULL, le test runner utilise `definition.config` (comportement legacy)

---

## Plan d'implémentation recommandé

### Sprint 1 — Fondations (zéro UI)
1. Migration SQL : nouvelle table `cognitive_test_presets` + colonnes `preset_id` / `config_used` dans `cognitive_sessions`
2. Seed des presets globaux (PVT standard + court, Stroop standard, Simon standard, Span standard)
3. Modifier `createCognitiveInvitationAction` pour accepter `presetId` optionnel
4. Modifier le test runner pour lire `session.config_used`
5. TypeScript : mettre à jour types + `CognitiveSessionWithDefinition`

### Sprint 2 — UI d'invitation
6. Composant `PresetSelector` avec badges validé/non-validé
7. Intégrer dans la modal d'envoi de test du `CognitiveTab`
8. Charger les presets via `getAllCognitivePresetsAction`

### Sprint 3 — Comparabilité et affichage
9. Grouper les sessions par (test_slug + preset_id) dans `CognitiveTab`
10. Bloquer les comparaisons cross-preset dans `CognitiveEvolutionChart`
11. Afficher badges preset + avertissement côté client
12. Afficher preset + icône validation dans le tableau récapitulatif coach

### Sprint 4 — Admin + presets personnels coachs
13. Page admin `/admin/cognitive-presets`
14. Actions admin `adminCreatePresetAction` / `adminUpdatePresetAction`
15. Formulaire création de preset personnel dans le dashboard coach
16. Gestion (liste + suppression) des presets personnels

---

## Fichiers à créer / modifier

### Nouveaux
- `supabase/migrations/YYYYMMDD_create_cognitive_presets.sql`
- `src/app/actions/presets.ts`
- `src/components/cognitive/PresetSelector.tsx`
- `src/app/(admin)/admin/cognitive-presets/page.tsx`

### À modifier
- `src/types/index.ts` — `CognitiveTestPreset`, `CognitiveSession` (preset_id, config_used)
- `src/app/actions/cognitive-results.ts` — `createCognitiveInvitationAction` (presetId), enrichir `CognitiveSessionWithDefinition`
- `src/app/(test)/test/cognitive/[slug]/[sessionId]/page.tsx` — lire `session.config_used`
- `src/app/(dashboard)/coach/clients/[id]/CognitiveTab.tsx` — sélecteur preset, grouping, badges
- `src/components/cognitive/CognitiveEvolutionChart.tsx` — prop `isValidated`, prop `presetName`
- `src/app/(client)/client/cognitive/page.tsx` — badges preset + avertissements
