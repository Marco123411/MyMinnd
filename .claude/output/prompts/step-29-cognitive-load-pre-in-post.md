# Étape 29 — Cognitive Load Score + Pre/In/Post

## Contexte

Implémenter le calcul dynamique du Cognitive Load Score (CLS, 1–26) pour chaque session cognitive,
et intégrer la structure Pre/In/Post dans le module de programmation pour que le coach construise
des sessions cognitives structurées avec mesure de la charge.

## Prérequis

- Step 26 (Programmation & Planification) terminée — table `program_exercises` existante
- Step 28 (Schema cognitif V2) terminée — colonnes `base_cognitive_load`, `configured_duration_sec`,
  `configured_intensity_percent`, `cognitive_load_score`, `phase_context` existantes

---

## Ordre d'implémentation

1. `src/lib/cognitive/load.ts` — fonctions pures (math, zero dépendances)
2. `src/app/actions/cognitive.ts` — intégration dans `completeCognitiveSessionAction`
3. `src/app/api/cognitive/load-preview/route.ts` — Route Handler (calcul client-side via HTTP)
4. Migration SQL — enrichissement de `program_exercises`
5. Composants UI — `CognitiveLoadBadge`, `CognitiveLoadBar`, `SessionLoadSummary`, `PhaseColumnView`, `DrillConfigurator`, `PeriodizationChart`

---

## 1. `src/lib/cognitive/load.ts`

### 1.1 Formule de calcul

Le CLS est un entier 1–26 combinant charge de base, durée et intensité.

**Règle critique** : quand `intensity_configurable = false`, le test tourne à son régime standard →
`intensityFactor = 1.0` (la formule ci-dessous ne s'applique qu'aux tests configurables).

```typescript
// src/lib/cognitive/load.ts

export interface CognitiveLoadInput {
  baseCognitiveLoad: number     // 1–10, depuis cognitive_test_definitions
  durationSec: number           // durée configurée (ou default_duration_sec)
  intensityPercent: number      // 10–100 si configurable, 100 si non-configurable
  intensityConfigurable: boolean
}

export function computeCognitiveLoad(input: CognitiveLoadInput): number {
  const { baseCognitiveLoad, durationSec, intensityPercent, intensityConfigurable } = input

  // Facteur durée : 1.0 (1 min) → 2.0 (30 min), échelle log
  // Math.max(durationMinutes, 1) → les tests < 1 min sont traités comme 1 min
  const durationMinutes = durationSec / 60
  const durationFactor = 1 + Math.log10(Math.max(durationMinutes, 1)) / Math.log10(30)
  // 1 min → 1.0 │ 3 min → 1.32 │ 5 min → 1.47 │ 10 min → 1.68 │ 30 min → 2.0

  // Facteur intensité :
  //  - Non-configurable → 1.0 (régime standard, pas d'ajustement)
  //  - Configurable     → 0.5 (10%) … 1.3 (100%), linéaire
  const intensityFactor = intensityConfigurable
    ? 0.5 + (intensityPercent / 100) * 0.8
    : 1.0

  const rawScore = baseCognitiveLoad * durationFactor * intensityFactor
  return Math.round(Math.min(26, Math.max(1, rawScore)))
}

export function getCognitiveLoadZone(score: number): 'low' | 'moderate' | 'high' {
  if (score <= 7) return 'low'
  if (score <= 17) return 'moderate'
  return 'high'
}

export function getCognitiveLoadColor(zone: 'low' | 'moderate' | 'high'): string {
  switch (zone) {
    case 'low':      return '#20808D' // teal
    case 'moderate': return '#FFC553' // gold
    case 'high':     return '#944454' // mauve
  }
}
```

### 1.2 Charge cumulée de session

```typescript
// src/lib/cognitive/load.ts (suite)

export interface ExerciseWithLoad {
  cognitive_load_score: number | null
}

export interface SessionLoadSummaryData {
  total: number
  average: number
  zone: 'low' | 'moderate' | 'high'
  breakdown: { low: number; moderate: number; high: number }
}

export function computeSessionLoad(exercises: ExerciseWithLoad[]): SessionLoadSummaryData {
  const scored = exercises.filter((ex): ex is { cognitive_load_score: number } =>
    ex.cognitive_load_score !== null
  )
  if (scored.length === 0) {
    return { total: 0, average: 0, zone: 'low', breakdown: { low: 0, moderate: 0, high: 0 } }
  }

  const total = scored.reduce((sum, ex) => sum + ex.cognitive_load_score, 0)
  const average = total / scored.length
  const zone = getCognitiveLoadZone(Math.round(average))

  const breakdown = scored.reduce(
    (acc, ex) => {
      acc[getCognitiveLoadZone(ex.cognitive_load_score)]++
      return acc
    },
    { low: 0, moderate: 0, high: 0 }
  )

  return { total, average: Math.round(average * 10) / 10, zone, breakdown }
}
```

### 1.3 Tableau de référence (valeurs vérifiées)

> (-) = test non configurable → `intensityFactor = 1.0`

| Drill              | Durée  | Intensité | Base | CLS | Zone     |
|--------------------|--------|-----------|------|-----|----------|
| PVT                | 5 min  | (-)       | 4    | 6   | LOW      |
| PVT                | 10 min | (-)       | 4    | 7   | LOW      |
| Stroop             | 3 min  | 60 %      | 6    | 8   | MODERATE |
| Stroop             | 5 min  | 80 %      | 6    | 10  | MODERATE |
| Stroop             | 10 min | 100 %     | 6    | 13  | MODERATE |
| 2-Back             | 5 min  | 80 %      | 8    | 13  | MODERATE |
| 2-Back             | 10 min | 100 %     | 8    | 17  | MODERATE |
| Mackworth          | 20 min | 80 %      | 7    | 15  | MODERATE |
| Stop Signal        | 10 min | 100 %     | 7    | 15  | MODERATE |
| 2-Back             | 30 min | 100 %     | 8    | 21  | HIGH     |
| Questionnaire cog. | 10 min | (-)       | 2    | 3   | LOW      |

---

## 2. Intégration dans `src/app/actions/cognitive.ts`

### 2.1 Ajouter l'import

```typescript
import { computeCognitiveLoad } from '@/lib/cognitive/load'
```

### 2.2 Modifier `completeCognitiveSessionAction`

Dans la fonction `completeCognitiveSessionAction`, après le bloc try/catch du scoring,
ajouter le calcul et le stockage du CLS. Il faut récupérer les paramètres de configuration
**et** la définition du test pour avoir `base_cognitive_load` et `intensity_configurable`.

```typescript
// Remplacer la query existante :
//   const { data: defData } = await supabase
//     .from('cognitive_sessions')
//     .select('cognitive_test_definitions(slug)')
//     ...
// Par une query plus complète :

const { data: defData } = await supabase
  .from('cognitive_sessions')
  .select(`
    configured_duration_sec,
    configured_intensity_percent,
    cognitive_test_definitions (
      slug,
      base_cognitive_load,
      default_duration_sec,
      default_intensity_percent,
      intensity_configurable
    )
  `)
  .eq('id', parsed.data.sessionId)
  .single()

// ... (bloc scoring existant inchangé) ...

// Après le scoring — calculer et stocker le CLS
if (defData) {
  const def = Array.isArray(defData.cognitive_test_definitions)
    ? defData.cognitive_test_definitions[0]
    : defData.cognitive_test_definitions

  if (def?.base_cognitive_load) {
    const durationSec =
      defData.configured_duration_sec ??
      def.default_duration_sec ??
      300
    const intensityPercent =
      defData.configured_intensity_percent ??
      def.default_intensity_percent ??
      100

    const cls = computeCognitiveLoad({
      baseCognitiveLoad:    def.base_cognitive_load,
      durationSec,
      intensityPercent,
      intensityConfigurable: def.intensity_configurable ?? false,
    })

    // cognitive_load_score est protégé par REVOKE sur authenticated → adminClient requis
    const admin = createAdminClient()
    await admin
      .from('cognitive_sessions')
      .update({ cognitive_load_score: cls })
      .eq('id', parsed.data.sessionId)
  }
}
```

---

## 3. Route Handler `src/app/api/cognitive/load-preview/route.ts`

Utilisé par le `DrillConfigurator` pour afficher le CLS en temps réel pendant la configuration.
Calcul pur — pas d'accès BDD.

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { computeCognitiveLoad, getCognitiveLoadZone, getCognitiveLoadColor } from '@/lib/cognitive/load'
import { z } from 'zod'

const schema = z.object({
  duration:              z.coerce.number().int().positive(),
  intensity:             z.coerce.number().int().min(10).max(100),
  baseCognitiveLoad:     z.coerce.number().int().min(1).max(10),
  intensityConfigurable: z.enum(['true', 'false']).transform(v => v === 'true'),
})

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams)
  const parsed = schema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { duration, intensity, baseCognitiveLoad, intensityConfigurable } = parsed.data
  const cognitiveLoad = computeCognitiveLoad({
    baseCognitiveLoad,
    durationSec: duration,
    intensityPercent: intensity,
    intensityConfigurable,
  })
  const zone = getCognitiveLoadZone(cognitiveLoad)

  return NextResponse.json({ cognitiveLoad, zone, color: getCognitiveLoadColor(zone) })
}
```

Appelé par : `GET /api/cognitive/load-preview?duration=300&intensity=80&baseCognitiveLoad=6&intensityConfigurable=true`

---

## 4. Migration SQL

### 4.1 Enrichissement de `program_exercises`

Vérifier d'abord les colonnes existantes de `program_exercises` depuis la migration step-26.
Les colonnes ci-dessous doivent être ajoutées uniquement si elles n'existent pas.

```sql
-- supabase/migrations/20260409000000_program_exercises_cognitive.sql

-- Lien optionnel vers un drill cognitif (mutuellement exclusif avec tool_definition_id)
ALTER TABLE public.program_exercises
  ADD COLUMN IF NOT EXISTS cognitive_test_id UUID
    REFERENCES public.cognitive_test_definitions(id) ON DELETE SET NULL;

-- Phase dans la session structurée Pre/In/Post
ALTER TABLE public.program_exercises
  ADD COLUMN IF NOT EXISTS phase TEXT
    CHECK (phase IN ('pre', 'in', 'post'));
-- NULL pour les outils PM classiques (tool_definition_id renseigné)

-- Paramètres de configuration du drill (override du test_definition par défaut)
ALTER TABLE public.program_exercises
  ADD COLUMN IF NOT EXISTS configured_duration_sec INTEGER
    CHECK (configured_duration_sec IS NULL OR configured_duration_sec > 0);

ALTER TABLE public.program_exercises
  ADD COLUMN IF NOT EXISTS configured_intensity_percent INTEGER
    CHECK (configured_intensity_percent IS NULL OR (configured_intensity_percent >= 10 AND configured_intensity_percent <= 100));

-- CLS calculé via computeCognitiveLoad, stocké à la sauvegarde
ALTER TABLE public.program_exercises
  ADD COLUMN IF NOT EXISTS cognitive_load_score INTEGER
    CHECK (cognitive_load_score IS NULL OR (cognitive_load_score >= 1 AND cognitive_load_score <= 26));

-- Contrainte métier : un exercice est soit un outil PM, soit un drill cognitif
ALTER TABLE public.program_exercises
  ADD CONSTRAINT IF NOT EXISTS chk_pe_exclusive_type
    CHECK (
      (tool_definition_id IS NOT NULL AND cognitive_test_id IS NULL)
      OR
      (tool_definition_id IS NULL AND cognitive_test_id IS NOT NULL)
    );

-- Contrainte métier : un drill cognitif doit avoir une phase
ALTER TABLE public.program_exercises
  ADD CONSTRAINT IF NOT EXISTS chk_pe_cognitive_requires_phase
    CHECK (cognitive_test_id IS NULL OR phase IS NOT NULL);
```

> **Note** : Si la contrainte `chk_pe_exclusive_type` échoue sur des données existantes
> (lignes avec les deux NULL), adapter la contrainte ou migrer les données d'abord.

---

## 5. Composants UI

### 5.1 `CognitiveLoadBadge`

```typescript
// src/components/cognitive/CognitiveLoadBadge.tsx
// Props : score: number
// Affiche score + cercle coloré + tooltip zone (LOW/MODERATE/HIGH)
```

### 5.2 `CognitiveLoadBar`

```typescript
// src/components/cognitive/CognitiveLoadBar.tsx
// Props : score: number, max?: number (default 26)
// Barre horizontale avec gradient teal → gold → mauve
// Marqueur de position du score
```

### 5.3 `SessionLoadSummary`

```typescript
// src/components/cognitive/SessionLoadSummary.tsx
// Props : exercises: { cognitive_load_score: number | null }[]
// Appelle computeSessionLoad() côté client
// Affiche : charge totale, moyenne, zone, barre de répartition empilée (x LOW, y MOD, z HIGH)
```

### 5.4 `PhaseColumnView`

```typescript
// src/components/coach/PhaseColumnView.tsx
// Props : exercises: ProgramExercise[], onPhaseChange: (id, phase) => void
// Trie les exercices par phase et affiche en 3 colonnes (Pre / In / Post)
// Exercices PM classiques (sans phase) apparaissent dans une zone séparée en bas
// Bouton "+" par colonne — filtre le catalogue par phase_tags du test
// Drag & drop entre colonnes pour changer la phase d'un drill :
//   - Utiliser @dnd-kit/core + @dnd-kit/sortable (déjà dans l'écosystème shadcn/ui)
//   - onDragEnd : appeler onPhaseChange(id, nouvellePhase)
//   - Update optimiste côté client avant confirmation serveur
//   - Indicateur visuel de drop zone (bordure colorée par phase)
```

### 5.5 `DrillConfigurator`

Slide-over qui s'ouvre à la configuration d'un drill cognitif :

- Sélecteur de durée : boutons radio depuis `configurable_durations` du test
- Slider d'intensité : 10–100 % par pas de 10 (caché si `intensity_configurable = false`)
- Preview CLS en temps réel :
  - Si `intensity_configurable = false` : calcul pur côté client avec `computeCognitiveLoad`
  - Sinon : appel à `/api/cognitive/load-preview?...` avec debounce 200ms
- `CognitiveLoadBar` intégré
- Sélecteur de phase (Pre/In/Post) filtré par `phase_tags` du test
- Instructions du test (`instructions_fr`)

```typescript
// src/components/coach/DrillConfigurator.tsx
```

### 5.6 Vue Plan Builder (3 colonnes)

La vue 3 colonnes s'active automatiquement dès qu'un drill cognitif est présent dans le microcycle.
Si le microcycle ne contient que des outils PM classiques, la vue reste en slots simples (step 26).

```
┌──────────────────────────────────────────────────────┐
│  MICROCYCLE — MOIS 1                                 │
├────────────────┬───────────────┬─────────────────────┤
│      PRÉ       │      IN       │       POST          │
├────────────────┼───────────────┼─────────────────────┤
│ ▪ PVT 5min    │ ▪ Stroop      │ ▪ PVT 5min         │
│   CLS: 6 🟢   │   5min 80%    │   CLS: 6 🟢        │
│               │   CLS: 10 🟡  │                     │
│               │ ▪ 2-Back      │ ▪ Flanker           │
│               │   10min 60%   │   3min 50%          │
│               │   CLS: 11 🟡  │   CLS: 6 🟢        │
├───────────────┴───────────────┴─────────────────────┤
│  CHARGE TOTALE : 39  │  MOY : 7.8  │  ZONE : MOD   │
└──────────────────────────────────────────────────────┘
```

### 5.7 `PeriodizationChart`

```typescript
// src/components/coach/PeriodizationChart.tsx

interface PeriodizationPoint {
  sessionIndex: number
  sessionName: string
  totalDurationMin: number
  averageCLS: number
  zone: 'low' | 'moderate' | 'high'
}
```

- Recharts `ComposedChart` : Line (durée totale, bleu) + Line (CLS moyen, violet)
- Zones de fond colorées : LOW (teal clair), MODERATE (gold clair), HIGH (mauve clair)
- Accessible via bouton "Périodisation" en haut du Plan Builder

---

## 6. Filtrage intelligent dans le sélecteur de drills

Quand le coach clique "+" dans une colonne :

- Colonne **Pré** → `phase_tags` contient `'pre'` : PVT, Digital Span, Spatial Span, Questionnaire cognitif
- Colonne **In** → `phase_tags` contient `'in'` : Stroop, Simon, Flanker, Stop Signal, 2-Back, Mackworth, Go/No-Go, N-Back
- Colonne **Post** → `phase_tags` contient `'post'` : PVT, Stroop, Flanker, Go/No-Go, Visual Choice, Visual Search

Le coach peut forcer l'ajout dans une phase non recommandée (bouton "Forcer", avec warning).

---

## 7. Critères d'acceptation

### Cognitive Load Score
- [ ] `computeCognitiveLoad` produit les valeurs du tableau de référence (§1.3)
- [ ] Tests non-configurables → `intensityFactor = 1.0` (PVT 5min → CLS=6)
- [ ] Le CLS est calculé et stocké dans `cognitive_sessions.cognitive_load_score` via adminClient à la fin de `completeCognitiveSessionAction`
- [ ] Le CLS est affiché sur chaque ExerciseCard cognitif (badge coloré)
- [ ] La charge cumulée est affichée par microcycle via `SessionLoadSummary`
- [ ] Le Route Handler `/api/cognitive/load-preview` répond en < 50ms

### Pre/In/Post
- [ ] Migration `program_exercises` : colonnes `cognitive_test_id`, `phase`, `configured_duration_sec`, `configured_intensity_percent`, `cognitive_load_score` ajoutées
- [ ] Contraintes d'exclusion mutuelle et phase obligatoire respectées
- [ ] La vue 3 colonnes s'active automatiquement en présence d'un drill cognitif dans le microcycle
- [ ] Le filtrage par `phase_tags` fonctionne dans le sélecteur de drills
- [ ] Un microcycle peut mixer outils PM (sans phase) et drills cognitifs (avec phase)
- [ ] `DrillConfigurator` : preview CLS en temps réel, sélecteur de phase filtré
- [ ] Drag & drop entre colonnes Pre/In/Post change la phase du drill (update optimiste + confirmation serveur)

### Périodisation
- [ ] `PeriodizationChart` : durée totale + CLS moyen par session
- [ ] Zones LOW/MODERATE/HIGH visibles en fond
- [ ] Tooltip avec détail de chaque session

### Technique
- [ ] `computeCognitiveLoad` et `computeSessionLoad` exportées depuis `src/lib/cognitive/load.ts`
- [ ] Validation Zod sur le Route Handler (durée > 0, intensité 10–100, base 1–10)
- [ ] TypeScript strict — aucun `any`
- [ ] `cognitive_load_score` mis à jour via `createAdminClient()` uniquement (REVOKE sur authenticated)
- [ ] Aucune régression sur `npm run build`
