# Étape 31 — Scoring cognitif V2 : Métriques enrichies + Baselines Pre/Post + Benchmarking

> **Fichier corrigé** — vérifié contre l'état actuel de l'app (2026-04-04).
> Toutes les divergences du prompt original ont été corrigées.

## Objectif

Enrichir le scoring cognitif existant avec les métriques dérivées manquantes, stocker les résultats de benchmark par session, implémenter le module Baselines Pre/Post, et afficher le benchmarking Elite/Average/Poor.

## Prérequis

- Step 19 (scoring cognitif V1) terminée ✅
- Step 28 (schema cognitif V2 + benchmarks) terminée ✅
- Step 29 (Cognitive Load + Pre/In/Post) terminée ✅
- Step 30 (frontend cognitif V2) terminée ✅

---

## État actuel de l'app (à NE PAS recréer)

Les éléments suivants EXISTENT déjà — ne pas les recréer :

### Fonctions de scoring existantes (`src/lib/cognitive/scoring.ts`)

```typescript
// ✅ EXISTENT — ne pas réimplémenter
export function computeRCS(rts: number[]): number
// Utilise std sample (n-1), retourne 0.0–1.0 (3 décimales)
// Signature : tableau de RT en ms

export function computeVariation(rts: number[]): number
// Coefficient de variation en %, 1 décimale
// Signature : tableau de RT en ms

export function computeSpeed(accuracy: number, meanRt: number): number
// ATTENTION : accuracy est un DÉCIMAL 0.0–1.0 (pas un pourcentage)
// meanRt en ms
// Ex: accuracy=0.97, rt=650ms → speed = 97 / 0.65 ≈ 149
```

### Métriques déjà calculées par test

| Test | Métriques dans `computed_metrics` |
|------|-----------------------------------|
| PVT | `mean_rt`, `median_rt`, `rcs`, `variation`, `speed`, `lapse_count`, `false_start_count`, `cv` |
| Stroop | `mean_rt`, `mean_rt_congruent`, `mean_rt_incongruent`, `stroop_effect_rt`, `accuracy_congruent`, `accuracy_incongruent`, `rcs`, `variation`, `speed` |
| Simon | `mean_rt`, `mean_rt_congruent`, `mean_rt_incongruent`, `simon_effect_rt`, `rcs`, `variation`, `speed` |
| Go/No-Go | `mean_rt`, `accuracy`, `commission_errors`, `omission_errors`, `rcs`, `variation`, `speed` |
| Stop Signal | `mean_rt`, `accuracy`, `ssrt`, `rcs`, `variation` |
| Flanker | `mean_rt`, `mean_rt_congruent`, `mean_rt_incongruent`, `flanker_effect_rt`, `accuracy`, `rcs`, `variation`, `speed` |
| N-Back | `mean_rt`, `accuracy`, `hit_rate`, `false_alarm_rate`, `rcs`, `variation`, `speed` |
| Mackworth | `mean_rt`, `accuracy`, `rcs`, `variation` |
| Digital Span | `span_forward`, `span_backward`, `total_span`, `global_accuracy` |
| Spatial Span | `max_span`, `global_accuracy` |
| Visual Choice | `mean_rt`, `accuracy`, `rcs`, `variation`, `speed` |
| Visual Search | `mean_rt`, `accuracy`, `variation`, `speed` |

### Types et tables existants

```typescript
// ✅ Déjà dans src/types/index.ts (ligne 692)
export interface CognitiveBenchmark {
  id: string
  test_definition_id: string
  metric: string
  elite_max: number | null      // borne sup elite (lower_is_better) ou borne inf elite (higher_is_better)
  average_min: number | null    // borne inf average (higher_is_better)
  average_max: number | null    // borne sup average (lower_is_better)
  poor_min: number | null
  unit: string | null
  direction: 'lower_is_better' | 'higher_is_better'
  source: string | null
  population: string
  notes: string | null
  created_at: string
}
```

Tables déjà existantes : `cognitive_benchmarks` (seeded step 28), `phase_context` sur `cognitive_sessions`.

---

## 1. Métriques manquantes à ajouter

### 1.1 Trois métriques à compléter dans `src/lib/cognitive/scoring.ts`

#### `scoreStopSignal` — ajouter `mean_ssd`

`mean_ssd` est calculé en interne mais pas retourné. Ajouter au `return` :

```typescript
// Dans scoreStopSignal(), ajouter à l'objet retourné :
mean_ssd: Math.round(meanSSD),
```

#### `scoreNBack` — ajouter `d_prime`

Sensibilité signal/bruit (théorie de détection du signal). Ajouter après `false_alarm_rate` :

```typescript
// d' = z(hitRate) - z(faRate) (approximation rapide)
function approxNorminv(p: number): number {
  // Clamp pour éviter ±Infinity
  const pc = Math.max(0.001, Math.min(0.999, p))
  // Approximation Beasley-Springer-Moro
  const a = [0, -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239]
  const b = [0, -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1]
  const c = [0, -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
  const d = [0, 7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416]
  const pLow = 0.02425, pHigh = 1 - pLow
  let q: number
  if (pc < pLow) {
    q = Math.sqrt(-2 * Math.log(pc))
    return (((((c[1]*q+c[2])*q+c[3])*q+c[4])*q+c[5])*q+c[6]) / ((((d[1]*q+d[2])*q+d[3])*q+d[4])*q+1)
  } else if (pc <= pHigh) {
    q = pc - 0.5; const r = q*q
    return (((((a[1]*r+a[2])*r+a[3])*r+a[4])*r+a[5])*r+a[6])*q / (((((b[1]*r+b[2])*r+b[3])*r+b[4])*r+b[5])*r+1)
  } else {
    q = Math.sqrt(-2 * Math.log(1 - pc))
    return -(((((c[1]*q+c[2])*q+c[3])*q+c[4])*q+c[5])*q+c[6]) / ((((d[1]*q+d[2])*q+d[3])*q+d[4])*q+1)
  }
}

// Dans scoreNBack(), ajouter au return :
d_prime: parseFloat((approxNorminv(hitRate) - approxNorminv(faRate)).toFixed(2)),
```

> Note : `approxNorminv` peut être une fonction locale dans le fichier scoring.ts (non exportée).

#### `scoreMackworth` — ajouter `vigilance_decrement`

```typescript
// Dans scoreMackworth(), avant le return :
// Diviser les targets en 4 quartiles temporels (par index)
const q1Targets = targets.slice(0, Math.ceil(targets.length / 4))
const q4Targets = targets.slice(-Math.ceil(targets.length / 4))
const q1Acc = q1Targets.length > 0 ? q1Targets.filter(t => t.is_correct).length / q1Targets.length : 0
const q4Acc = q4Targets.length > 0 ? q4Targets.filter(t => t.is_correct).length / q4Targets.length : 0
const vigilanceDecrement = parseFloat(((q1Acc - q4Acc) * 100).toFixed(1))

// Ajouter au return :
vigilance_decrement: vigilanceDecrement,
```

### 1.2 Mise à jour du type `CognitiveTestResult` (`src/types/index.ts`)

Ajouter les nouvelles propriétés optionnelles à l'interface `CognitiveTestResult` (chercher la définition existante) :

```typescript
// Nouvelles métriques à ajouter
d_prime?: number             // N-Back : sensibilité signal/bruit
vigilance_decrement?: number // Mackworth : baisse de vigilance 1er vs dernier quart
mean_ssd?: number            // Stop Signal : délai de stop moyen
```

---

## 2. Benchmark par session

### 2.1 Migration `20260415000000_cognitive_scoring_v2_baselines.sql`

```sql
-- Colonne pour stocker les résultats de benchmark calculés
ALTER TABLE cognitive_sessions
  ADD COLUMN IF NOT EXISTS benchmark_results JSONB;

-- Table Baselines Pre/Post
CREATE TABLE IF NOT EXISTS cognitive_baselines (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id   UUID NOT NULL REFERENCES programmes(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  pre_date       DATE NOT NULL,
  post_date      DATE NOT NULL,
  pre_session_ids  UUID[],  -- sessions spécifiques (optionnel)
  post_session_ids UUID[],  -- sessions spécifiques (optionnel)
  results        JSONB,     -- cache des comparaisons calculées
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_cognitive_baselines_programme_id
  ON cognitive_baselines(programme_id);

-- RLS
ALTER TABLE cognitive_baselines ENABLE ROW LEVEL SECURITY;

-- Coach du programme peut CRUD
CREATE POLICY "Coach CRUD baselines"
  ON cognitive_baselines
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM programmes p
      WHERE p.id = cognitive_baselines.programme_id
        AND p.coach_id = auth.uid()
    )
  );

-- Client peut lire ses propres baselines
CREATE POLICY "Client SELECT baselines"
  ON cognitive_baselines
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM programmes p
      WHERE p.id = cognitive_baselines.programme_id
        AND p.client_id = auth.uid()
    )
  );
```

### 2.2 Fonction `evaluateBenchmark` (`src/lib/cognitive/scoring.ts`)

Utilise les colonnes réelles de `CognitiveBenchmark` :

```typescript
export function evaluateBenchmark(
  value: number,
  benchmark: CognitiveBenchmark
): 'elite' | 'average' | 'poor' {
  if (benchmark.direction === 'lower_is_better') {
    // elite_max = plafond de la zone elite
    if (benchmark.elite_max !== null && value <= benchmark.elite_max) return 'elite'
    // average_max = plafond de la zone average
    if (benchmark.average_max !== null && value <= benchmark.average_max) return 'average'
    return 'poor'
  } else {
    // higher_is_better : elite_max = plancher de la zone elite
    if (benchmark.elite_max !== null && value >= benchmark.elite_max) return 'elite'
    // average_min = plancher de la zone average
    if (benchmark.average_min !== null && value >= benchmark.average_min) return 'average'
    return 'poor'
  }
}
```

> Importer `CognitiveBenchmark` depuis `@/types`.

### 2.3 Stockage des benchmarks dans `completeCognitiveSessionAction`

Dans `src/app/actions/cognitive.ts`, après le calcul de `metrics`, charger les benchmarks du test et évaluer chaque métrique :

```typescript
// Charger les benchmarks du test (après scoring)
let benchmarkResults: Array<{
  metric: string
  value: number
  zone: 'elite' | 'average' | 'poor'
}> | null = null

if (metrics && def?.id) {
  try {
    const { data: benchmarks } = await supabase
      .from('cognitive_benchmarks')
      .select('*')
      .eq('test_definition_id', def.id)

    if (benchmarks && benchmarks.length > 0) {
      benchmarkResults = benchmarks
        .filter(b => metrics[b.metric] !== undefined)
        .map(b => ({
          metric: b.metric,
          value: metrics[b.metric] as number,
          zone: evaluateBenchmark(metrics[b.metric] as number, b as CognitiveBenchmark),
        }))
    }
  } catch (err) {
    console.error('[cognitive] benchmark evaluation failed:', err)
  }
}

// Ajouter benchmark_results à l'update admin
if (benchmarkResults !== null) updates.benchmark_results = benchmarkResults
```

> L'`id` de la définition est accessible via le `defData` déjà récupéré — ajouter `id` au select :
> ```
> cognitive_test_definitions (id, slug, base_cognitive_load, ...)
> ```

### 2.4 Mise à jour du type `CognitiveSession` (`src/types/index.ts`)

```typescript
// Ajouter à CognitiveSession :
benchmark_results?: Array<{
  metric: string
  value: number
  zone: 'elite' | 'average' | 'poor'
}> | null
```

---

## 3. API Baselines Pre/Post

### 3.1 Route create (`src/app/api/programmes/[programId]/baselines/route.ts`)

> Note : utiliser `programmes` (français) correspondant au nom de la table DB.

```typescript
// POST /api/programmes/[programId]/baselines
// Body: { pre_date: string, post_date: string, name: string }
```

La logique de matching Pre/Post (pour chaque test cognitif du programme) :
1. Chercher les sessions `phase_context = 'pre'` dont la date est la plus proche de `pre_date` (fenêtre ±7 jours)
2. Chercher les sessions `phase_context = 'post'` dont la date est la plus proche de `post_date` (fenêtre ±7 jours)
3. Pour chaque paire trouvée, calculer les deltas sur chaque métrique commune de `computed_metrics`
4. Stocker le résultat dans `results JSONB` de la baseline

```typescript
interface BaselineComparison {
  test_slug: string
  test_name: string
  metrics: Record<string, {
    pre: number
    post: number
    delta: number
    delta_percent: number
    improved: boolean
  }>
  pre_benchmark: Record<string, 'elite' | 'average' | 'poor'>
  post_benchmark: Record<string, 'elite' | 'average' | 'poor'>
}

interface BaselineSummary {
  tests_compared: number
  metrics_improved: number
  metrics_regressed: number
  metrics_stable: number
  overall_trend: 'improving' | 'stable' | 'declining'
}
```

### 3.2 Route list (`GET /api/programmes/[programId]/baselines/route.ts`)

Retourne la liste des baselines avec nom, dates, résumé (sans les détails complets).

### 3.3 Route detail (`src/app/api/programmes/[programId]/baselines/[baselineId]/route.ts`)

`GET` — retourne la baseline avec les `results` complets.
`DELETE` — supprime la baseline (coach uniquement).

---

## 4. Affichage Dashboard Coach

### 4.1 Page Baselines

Route : `/coach/clients/[id]/cognitive/baselines`
Fichier : `src/app/(dashboard)/coach/clients/[id]/cognitive/baselines/page.tsx`

- Liste des baselines existantes (cards avec nom, dates Pre/Post, résumé)
- Bouton "Nouvelle baseline" → formulaire (date Pre, date Post, nom)
- Clic sur une baseline → vue détaillée

### 4.2 Composant `BenchmarkBadge` (`src/components/cognitive/BenchmarkBadge.tsx`)

```typescript
interface BenchmarkBadgeProps {
  zone: 'elite' | 'average' | 'poor'
  size?: 'sm' | 'md'
  // Contexte optionnel pour adapter le label
  context?: 'sport' | 'corporate' | 'wellbeing'
}
```

Labels adaptés au contexte :

| Zone | sport | corporate | wellbeing |
|------|-------|-----------|-----------|
| Elite | Élite | Optimal | Excellent |
| Average | Moyen | Standard | Normal |
| Poor | À développer | À améliorer | À renforcer |

Couleurs :
- Elite : badge teal `#20808D` avec icône étoile
- Average : badge gold `#FFC553`
- Poor : badge mauve `#944454` avec icône flèche bas

### 4.3 Composant `CognitiveTrendChart` (`src/components/cognitive/CognitiveTrendChart.tsx`)

> Note : `CognitiveEvolutionChart` existe déjà (`src/components/cognitive/CognitiveEvolutionChart.tsx`) mais affiche uniquement une métrique sans zones de benchmark. Le nouveau composant est distinct et plus riche.

```typescript
interface CognitiveTrendChartProps {
  sessions: CognitiveSession[]             // sessions triées par date décroissante
  metric: 'mean_rt' | 'speed' | 'accuracy' | 'rcs' | 'variation'
  benchmark: CognitiveBenchmark | null     // null si pas de benchmark pour cette métrique
  timeFilter?: '1m' | '3m' | '6m' | '1y' | 'all'
}
```

Recharts `AreaChart` avec :
- Zones Elite/Average/Poor en arrière-plan (3 `ReferenceArea`)
- `Line` + dots pour les valeurs de l'athlète
- Tooltip avec date, valeur, zone
- Sélecteur de métrique (5 boutons) + filtre temporel

### 4.4 Composant `BenchmarkDonut` (`src/components/cognitive/BenchmarkDonut.tsx`)

```typescript
interface BenchmarkDonutProps {
  metric: string
  distribution: { elite: number; average: number; poor: number } // en %
}
```

Recharts `PieChart` avec 3 segments : teal / gold / mauve.

### 4.5 Composant `BaselineComparisonTable` (`src/components/cognitive/BaselineComparisonTable.tsx`)

```typescript
interface BaselineComparisonRow {
  testName: string
  testSlug: string
  metric: string
  preValue: number
  postValue: number
  delta: number
  deltaPercent: number
  improved: boolean
  preBenchmark: 'elite' | 'average' | 'poor'
  postBenchmark: 'elite' | 'average' | 'poor'
}
```

- Flèche verte ↑ si amélioration, rouge ↓ si régression
- Badge si changement de zone (ex: "Average → Élite")
- Tri par |delta %| décroissant par défaut

---

## 5. Vue Client enrichie

### 5.1 Page résultats après un test

Route existante : `/test/cognitive/[slug]/results/[sessionId]/page.tsx`

Enrichir la page existante :
1. Afficher `speed`, `rcs`, `variation` si présents dans `computed_metrics`
2. Pour chaque métrique affichée, si `benchmark_results` existe sur la session, afficher un `BenchmarkBadge`
3. Comparer avec la session précédente du même test (delta et flèche)

### 5.2 Page cognitive client

Route existante : `/client/cognitive` (`src/app/(client)/client/cognitive/page.tsx`)

Enrichir la page existante (ne pas créer une nouvelle route) :
- Ajouter un sélecteur de test (en plus des 4 tests actuels PVT/Stroop/Simon/DigitalSpan)
- Ajouter `CognitiveTrendChart` en remplacement ou complément de `CognitiveEvolutionChart` (avec zones benchmark)
- Afficher les badges `BenchmarkBadge` sur les valeurs clés

---

## 6. Critères d'acceptation

### Métriques manquantes
- [ ] `mean_ssd` retourné par `scoreStopSignal()`
- [ ] `d_prime` retourné par `scoreNBack()` (via approximation norminv)
- [ ] `vigilance_decrement` retourné par `scoreMackworth()`
- [ ] `CognitiveTestResult` type mis à jour avec les 3 nouvelles propriétés

### Benchmarking
- [ ] `evaluateBenchmark()` implémentée avec les colonnes réelles (`elite_max`, `average_min`, `average_max`)
- [ ] `benchmark_results` stockés dans `cognitive_sessions` lors du `completeCognitiveSessionAction`
- [ ] Un seul appel DB pour charger tous les benchmarks du test (pas de N+1)
- [ ] `BenchmarkBadge` affiché sur la page résultats post-test
- [ ] `BenchmarkBadge` affiché sur la fiche client cognitif (`/client/cognitive`)

### Baselines Pre/Post
- [ ] Table `cognitive_baselines` créée avec RLS
- [ ] API POST crée une baseline et calcule les comparaisons Pre/Post
- [ ] Le matching de sessions utilise `phase_context` (colonne existante) et fenêtre ±7 jours
- [ ] API GET retourne la liste des baselines du programme
- [ ] Page `/coach/clients/[id]/cognitive/baselines` affiche la liste + formulaire création
- [ ] `BaselineComparisonTable` affiche deltas absolus et %

### Tendances
- [ ] `CognitiveTrendChart` supporte 5 métriques + filtre temporel
- [ ] Zones Elite/Average/Poor visibles en arrière-plan si benchmark disponible

### Technique
- [ ] Migration SQL appliquée proprement (idempotent avec `IF NOT EXISTS`)
- [ ] TypeScript strict, pas de `any`
- [ ] Recharts pour tous les composants graphiques (cohérent avec `CognitiveEvolutionChart` existant)
- [ ] Les benchmarks sont chargés en une seule requête (`.in('test_definition_id', [...ids])` si plusieurs tests)

---

## 7. Ordre d'implémentation suggéré

1. **Migration SQL** (`20260415000000_cognitive_scoring_v2_baselines.sql`)
2. **Scoring** — ajouter `mean_ssd`, `d_prime`, `vigilance_decrement` dans `scoring.ts`
3. **Types** — mettre à jour `CognitiveTestResult` et `CognitiveSession`
4. **evaluateBenchmark + stockage** — dans `cognitive.ts` et `api/cognitive/[sessionId]/score/route.ts`
5. **Composants UI** — `BenchmarkBadge`, `CognitiveTrendChart`, `BenchmarkDonut`, `BaselineComparisonTable`
6. **API Baselines** — routes `api/programmes/[programId]/baselines`
7. **Pages** — baselines dashboard coach + enrichissement page client
