# Step 28 — Schema cognitif V2

## Contexte

Tu travailles sur la plateforme MINND (Next.js 14+, Supabase, TypeScript strict, Tailwind + shadcn/ui).

Les steps 17, 18 et 19 sont terminées : le module cognitif existe avec 5 tests (PVT, Stroop, Simon, Digital Span, Questionnaire), les sessions, les trials, les presets (step 20) et le scoring de base.

Cette step enrichit le schéma existant pour supporter :
- La durée et l'intensité paramétrables par drill
- 8 nouveaux tests cognitifs seedés (prêts pour le frontend en step 30)
- Des seuils normatifs Elite/Average/Poor par drill et par métrique
- Les métriques RCS, Speed, SSRT dans le pipeline de scoring

**Ne pas toucher au frontend dans cette step** — c'est l'objet de la step 30.

---

## Fichiers à modifier ou créer

```
supabase/migrations/[timestamp]_cognitive_schema_v2.sql   ← migration principale
src/types/index.ts                                         ← types TypeScript à étendre
src/lib/cognitive/scoring.ts                               ← scoring à étendre
```

---

## 1. Migration SQL

Crée un fichier `supabase/migrations/[timestamp]_cognitive_schema_v2.sql`.

### 1.1 — Nouvelles colonnes sur `cognitive_test_definitions`

```sql
-- Phases où ce test peut être utilisé : 'pre', 'in', 'post'
ALTER TABLE cognitive_test_definitions
  ADD COLUMN IF NOT EXISTS phase_tags TEXT[] DEFAULT '{"in"}';

-- Catégorie cognitive principale
ALTER TABLE cognitive_test_definitions
  ADD COLUMN IF NOT EXISTS cognitive_category TEXT
  CHECK (cognitive_category IN ('attention', 'inhibition', 'memory', 'decision', 'wellbeing'));

-- Durées disponibles en secondes (le coach choisit parmi ces options)
ALTER TABLE cognitive_test_definitions
  ADD COLUMN IF NOT EXISTS configurable_durations INTEGER[] DEFAULT '{300}';

-- Durée par défaut en secondes
-- NOTE : la colonne existante `duration_minutes` reste pour compatibilité ascendante.
-- `default_duration_sec` est la source de vérité pour les nouveaux drills.
-- Pour les tests existants : default_duration_sec = duration_minutes * 60
ALTER TABLE cognitive_test_definitions
  ADD COLUMN IF NOT EXISTS default_duration_sec INTEGER DEFAULT 300;

-- true = le coach peut régler l'intensité (10–100%)
ALTER TABLE cognitive_test_definitions
  ADD COLUMN IF NOT EXISTS intensity_configurable BOOLEAN DEFAULT false;

-- Intensité par défaut (10–100)
ALTER TABLE cognitive_test_definitions
  ADD COLUMN IF NOT EXISTS default_intensity_percent INTEGER DEFAULT 100;

-- Décrit comment l'intensité affecte les paramètres du test
-- Ex: {"isi_range": [2000, 500]} → à 10% ISI=2000ms, à 100% ISI=500ms
ALTER TABLE cognitive_test_definitions
  ADD COLUMN IF NOT EXISTS intensity_params JSONB;

-- Charge cognitive de base du drill (1–10), avant ajustement durée/intensité
-- Utilisé par computeCognitiveLoad (step 29)
ALTER TABLE cognitive_test_definitions
  ADD COLUMN IF NOT EXISTS base_cognitive_load INTEGER DEFAULT 5;

-- Métriques produites par ce test : 'rt', 'accuracy', 'speed', 'variation', 'rcs', 'ssrt'
ALTER TABLE cognitive_test_definitions
  ADD COLUMN IF NOT EXISTS available_metrics TEXT[] DEFAULT '{"rt", "accuracy"}';
```

### 1.2 — Nouvelles colonnes sur `cognitive_sessions`

```sql
-- Durée choisie par le coach (override du default)
ALTER TABLE cognitive_sessions
  ADD COLUMN IF NOT EXISTS configured_duration_sec INTEGER;

-- Intensité choisie par le coach (10–100)
ALTER TABLE cognitive_sessions
  ADD COLUMN IF NOT EXISTS configured_intensity_percent INTEGER;

-- Phase dans laquelle ce test a été exécuté
ALTER TABLE cognitive_sessions
  ADD COLUMN IF NOT EXISTS phase_context TEXT
  CHECK (phase_context IN ('pre', 'in', 'post'));

-- Score de charge cognitive calculé (1–26), rempli par le scoring (step 29)
ALTER TABLE cognitive_sessions
  ADD COLUMN IF NOT EXISTS cognitive_load_score INTEGER;
```

### 1.3 — Nouvelles métriques dans `cognitive_sessions.computed_metrics` (JSONB)

Les résultats sont dans `cognitive_sessions.computed_metrics` (JSONB) — pas de migration nécessaire.

Ajouter le support de ces nouvelles métriques dans le scoring TypeScript :

```
speed     = (accuracy_decimal * 100) / (mean_rt_ms / 1000)
            où accuracy est un décimal 0.0–1.0
            ex: accuracy=0.97, rt=650ms → speed = 97 / 0.65 ≈ 149

rcs       = 1 - (sd_rt / mean_rt)
            Reaction Consistency Score : 1.0 = parfaitement constant

variation = (sd_rt / mean_rt) * 100
            Coefficient de variation en %

ssrt      = mean_rt_go - mean_SSD
            Stop Signal Reaction Time (staircase method, Stop Signal uniquement)
            Plus bas = meilleur contrôle inhibiteur
```

### 1.4 — Nouvelle table `cognitive_benchmarks`

```sql
CREATE TABLE IF NOT EXISTS cognitive_benchmarks (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_definition_id UUID NOT NULL REFERENCES cognitive_test_definitions(id),
  metric             TEXT NOT NULL,
  -- 'rt', 'accuracy', 'speed', 'rcs', 'variation', 'ssrt'
  elite_max          NUMERIC,   -- borne supérieure Elite   (RT : plus bas = mieux)
  average_min        NUMERIC,   -- borne inférieure Average
  average_max        NUMERIC,   -- borne supérieure Average
  poor_min           NUMERIC,   -- borne inférieure Poor    (RT : plus haut = pire)
  unit               TEXT,      -- 'ms', '%', 'score', 'ratio'
  direction          TEXT NOT NULL CHECK (direction IN ('lower_is_better', 'higher_is_better')),
  source             TEXT,
  population         TEXT DEFAULT 'general_adult',
  -- 'general_adult', 'athlete', 'elite_athlete'
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT now(),
  UNIQUE(test_definition_id, metric, population)
);

CREATE INDEX IF NOT EXISTS idx_cognitive_benchmarks_test_def
  ON cognitive_benchmarks(test_definition_id);

ALTER TABLE cognitive_benchmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cognitive_benchmarks_authenticated_select"
  ON cognitive_benchmarks FOR SELECT
  TO authenticated
  USING (true);
```

---

## 2. Seed — Mise à jour des 5 tests existants

Utilise des `UPDATE ... WHERE slug = '...'` pour mettre à jour les tests existants.

### PVT

```sql
UPDATE cognitive_test_definitions SET
  phase_tags             = '{"pre","post"}',
  cognitive_category     = 'attention',
  configurable_durations = '{180,300,600}',
  default_duration_sec   = 300,
  intensity_configurable = false,
  base_cognitive_load    = 4,
  available_metrics      = '{"rt","accuracy","variation","rcs","speed"}'
WHERE slug = 'pvt';
```

### Stroop

```sql
UPDATE cognitive_test_definitions SET
  phase_tags             = '{"in","post"}',
  cognitive_category     = 'inhibition',
  configurable_durations = '{60,180,300,600}',
  default_duration_sec   = 300,
  intensity_configurable = true,
  default_intensity_percent = 70,
  intensity_params       = '{"congruent_ratio_range":[0.7,0.3],"isi_range":[2500,1000]}',
  base_cognitive_load    = 6,
  available_metrics      = '{"rt","accuracy","variation","rcs","speed"}'
WHERE slug = 'stroop';
```

Note `congruent_ratio_range` : à 10% d'intensité → 70% stimuli congruents (facile). À 100% → 30% (difficile).

### Simon

```sql
UPDATE cognitive_test_definitions SET
  phase_tags             = '{"in"}',
  cognitive_category     = 'inhibition',
  configurable_durations = '{180,300,600}',
  default_duration_sec   = 300,
  intensity_configurable = true,
  default_intensity_percent = 60,
  intensity_params       = '{"congruent_ratio_range":[0.7,0.3],"isi_range":[2000,800]}',
  base_cognitive_load    = 5,
  available_metrics      = '{"rt","accuracy","variation","rcs","speed"}'
WHERE slug = 'simon';
```

### Digital Span

```sql
UPDATE cognitive_test_definitions SET
  phase_tags             = '{"in","pre"}',
  cognitive_category     = 'memory',
  configurable_durations = '{180,300,600}',
  default_duration_sec   = 300,
  intensity_configurable = true,
  default_intensity_percent = 50,
  intensity_params       = '{"starting_span_range":[3,5],"display_time_range":[1200,600]}',
  base_cognitive_load    = 6,
  available_metrics      = '{"accuracy","variation","speed"}'
WHERE slug = 'digital_span';
```

### Questionnaire cognitif et attentionnel

```sql
UPDATE cognitive_test_definitions SET
  phase_tags             = '{"pre"}',
  cognitive_category     = 'wellbeing',
  configurable_durations = '{600}',
  default_duration_sec   = 600,
  intensity_configurable = false,
  base_cognitive_load    = 2,
  available_metrics      = '{"accuracy"}'
WHERE slug = 'questionnaire_cognitif';
```

---

## 3. Seed — 8 nouveaux drills

Utilise des `INSERT INTO cognitive_test_definitions ... ON CONFLICT (slug) DO UPDATE` pour être idempotent.

### 3.1 ATTENTION

#### Go/No-Go Visuel

```sql
INSERT INTO cognitive_test_definitions
  (slug, name, description, duration_minutes, trial_based, metrics_config,
   phase_tags, cognitive_category, configurable_durations, default_duration_sec,
   intensity_configurable, default_intensity_percent, intensity_params,
   base_cognitive_load, available_metrics, config)
VALUES (
  'go-nogo-visual',
  'Go/No-Go Visuel',
  'Répondre rapidement aux stimuli Go (cercle vert) et inhiber la réponse sur les stimuli No-Go (cercle rouge). Mesure le contrôle attentionnel et la capacité d''inhibition de base.',
  3, true, '{}',
  '{"in","post"}', 'attention', '{60,180,300,600}', 180,
  true, 60,
  '{"nogo_ratio_range":[0.2,0.4],"isi_range":[1500,600]}',
  5, '{"rt","accuracy","variation","rcs","speed"}',
  '{
    "type": "go_nogo",
    "modality": "visual",
    "go_stimulus": {"shape": "circle", "color": "#22c55e"},
    "nogo_stimulus": {"shape": "circle", "color": "#ef4444"},
    "response_type": "tap",
    "feedback": true
  }'
)
ON CONFLICT (slug) DO UPDATE SET
  phase_tags = EXCLUDED.phase_tags,
  cognitive_category = EXCLUDED.cognitive_category,
  configurable_durations = EXCLUDED.configurable_durations,
  default_duration_sec = EXCLUDED.default_duration_sec,
  intensity_configurable = EXCLUDED.intensity_configurable,
  default_intensity_percent = EXCLUDED.default_intensity_percent,
  intensity_params = EXCLUDED.intensity_params,
  base_cognitive_load = EXCLUDED.base_cognitive_load,
  available_metrics = EXCLUDED.available_metrics,
  config = EXCLUDED.config;
```

#### Mackworth Clock

```sql
INSERT INTO cognitive_test_definitions
  (slug, name, description, duration_minutes, trial_based, metrics_config,
   phase_tags, cognitive_category, configurable_durations, default_duration_sec,
   intensity_configurable, default_intensity_percent, intensity_params,
   base_cognitive_load, available_metrics, config)
VALUES (
  'mackworth-clock',
  'Mackworth Clock',
  'Surveiller une horloge où un point se déplace régulièrement. Détecter les sauts doubles. Mesure l''attention soutenue et la vigilance sur longue durée.',
  10, true, '{}',
  '{"in"}', 'attention', '{300,600,1200}', 600,
  true, 50,
  '{"skip_frequency_range":[0.05,0.15],"tick_interval_range":[1500,800]}',
  7, '{"rt","accuracy","variation","rcs"}',
  '{
    "type": "mackworth",
    "positions": 24,
    "target_event": "double_skip",
    "feedback": false
  }'
)
ON CONFLICT (slug) DO UPDATE SET
  phase_tags = EXCLUDED.phase_tags,
  cognitive_category = EXCLUDED.cognitive_category,
  configurable_durations = EXCLUDED.configurable_durations,
  default_duration_sec = EXCLUDED.default_duration_sec,
  intensity_configurable = EXCLUDED.intensity_configurable,
  default_intensity_percent = EXCLUDED.default_intensity_percent,
  intensity_params = EXCLUDED.intensity_params,
  base_cognitive_load = EXCLUDED.base_cognitive_load,
  available_metrics = EXCLUDED.available_metrics,
  config = EXCLUDED.config;
```

### 3.2 INHIBITION

#### Flanker (Eriksen)

```sql
INSERT INTO cognitive_test_definitions
  (slug, name, description, duration_minutes, trial_based, metrics_config,
   phase_tags, cognitive_category, configurable_durations, default_duration_sec,
   intensity_configurable, default_intensity_percent, intensity_params,
   base_cognitive_load, available_metrics, config)
VALUES (
  'flanker',
  'Flanker (Eriksen)',
  'Identifier la direction de la flèche centrale entourée de flèches distractrices congruentes ou incongruentes. Mesure le contrôle inhibiteur et la résistance à l''interférence visuelle.',
  5, true, '{}',
  '{"in","post"}', 'inhibition', '{60,180,300,600}', 300,
  true, 60,
  '{"incongruent_ratio_range":[0.3,0.7],"isi_range":[2000,800]}',
  6, '{"rt","accuracy","variation","rcs","speed"}',
  '{
    "type": "flanker",
    "stimuli": "arrows",
    "directions": ["left","right"],
    "flanker_count": 4,
    "response_keys": {"left": "ArrowLeft", "right": "ArrowRight"},
    "feedback": true
  }'
)
ON CONFLICT (slug) DO UPDATE SET
  phase_tags = EXCLUDED.phase_tags,
  cognitive_category = EXCLUDED.cognitive_category,
  configurable_durations = EXCLUDED.configurable_durations,
  default_duration_sec = EXCLUDED.default_duration_sec,
  intensity_configurable = EXCLUDED.intensity_configurable,
  default_intensity_percent = EXCLUDED.default_intensity_percent,
  intensity_params = EXCLUDED.intensity_params,
  base_cognitive_load = EXCLUDED.base_cognitive_load,
  available_metrics = EXCLUDED.available_metrics,
  config = EXCLUDED.config;
```

#### Stop Signal

```sql
INSERT INTO cognitive_test_definitions
  (slug, name, description, duration_minutes, trial_based, metrics_config,
   phase_tags, cognitive_category, configurable_durations, default_duration_sec,
   intensity_configurable, default_intensity_percent, intensity_params,
   base_cognitive_load, available_metrics, config)
VALUES (
  'stop-signal',
  'Stop Signal',
  'Répondre rapidement à un stimulus Go, mais inhiber la réponse quand un signal Stop apparaît après un délai variable (SSD). Mesure le SSRT (Stop Signal Reaction Time). Plus bas = meilleur contrôle inhibiteur.',
  5, true, '{}',
  '{"in"}', 'inhibition', '{180,300,600}', 300,
  true, 50,
  '{"stop_ratio_range":[0.2,0.35],"initial_ssd_range":[300,200]}',
  7, '{"rt","accuracy","variation","rcs","ssrt"}',
  '{
    "type": "stop_signal",
    "go_stimulus": {"shape": "arrow", "directions": ["left","right"]},
    "stop_signal": {"type": "audio", "sound": "beep"},
    "ssd_staircase": true,
    "ssd_step_ms": 50,
    "response_keys": {"left": "ArrowLeft", "right": "ArrowRight"},
    "feedback": false
  }'
)
ON CONFLICT (slug) DO UPDATE SET
  phase_tags = EXCLUDED.phase_tags,
  cognitive_category = EXCLUDED.cognitive_category,
  configurable_durations = EXCLUDED.configurable_durations,
  default_duration_sec = EXCLUDED.default_duration_sec,
  intensity_configurable = EXCLUDED.intensity_configurable,
  default_intensity_percent = EXCLUDED.default_intensity_percent,
  intensity_params = EXCLUDED.intensity_params,
  base_cognitive_load = EXCLUDED.base_cognitive_load,
  available_metrics = EXCLUDED.available_metrics,
  config = EXCLUDED.config;
```

### 3.3 MEMORY

#### Spatial Span

```sql
INSERT INTO cognitive_test_definitions
  (slug, name, description, duration_minutes, trial_based, metrics_config,
   phase_tags, cognitive_category, configurable_durations, default_duration_sec,
   intensity_configurable, default_intensity_percent, intensity_params,
   base_cognitive_load, available_metrics, config)
VALUES (
  'spatial-span',
  'Spatial Span',
  'Mémoriser et reproduire une séquence de positions spatiales sur une grille. La séquence s''allonge progressivement. Mesure la mémoire de travail visuo-spatiale.',
  5, true, '{}',
  '{"in","pre"}', 'memory', '{180,300,600}', 300,
  true, 50,
  '{"starting_span_range":[3,5],"display_time_per_item_range":[1000,500],"grid_size_range":[9,16]}',
  6, '{"accuracy","variation","speed"}',
  '{
    "type": "spatial_span",
    "grid_rows": 3,
    "grid_cols": 3,
    "starting_length": 3,
    "max_length": 9,
    "highlight_color": "#20808D",
    "response_type": "tap_sequence",
    "feedback": true
  }'
)
ON CONFLICT (slug) DO UPDATE SET
  phase_tags = EXCLUDED.phase_tags,
  cognitive_category = EXCLUDED.cognitive_category,
  configurable_durations = EXCLUDED.configurable_durations,
  default_duration_sec = EXCLUDED.default_duration_sec,
  intensity_configurable = EXCLUDED.intensity_configurable,
  default_intensity_percent = EXCLUDED.default_intensity_percent,
  intensity_params = EXCLUDED.intensity_params,
  base_cognitive_load = EXCLUDED.base_cognitive_load,
  available_metrics = EXCLUDED.available_metrics,
  config = EXCLUDED.config;
```

#### 2-Back

```sql
INSERT INTO cognitive_test_definitions
  (slug, name, description, duration_minutes, trial_based, metrics_config,
   phase_tags, cognitive_category, configurable_durations, default_duration_sec,
   intensity_configurable, default_intensity_percent, intensity_params,
   base_cognitive_load, available_metrics, config)
VALUES (
  'n-back-2',
  '2-Back',
  'Indiquer si le stimulus actuel est identique à celui présenté 2 positions avant. Mesure la mémoire de travail et la mise à jour continue de l''information en mémoire.',
  5, true, '{}',
  '{"in"}', 'memory', '{180,300,600}', 300,
  true, 60,
  '{"target_ratio_range":[0.25,0.35],"isi_range":[3000,1500],"stimulus_display_range":[1500,500]}',
  8, '{"rt","accuracy","variation","rcs","speed"}',
  '{
    "type": "n_back",
    "n": 2,
    "stimuli_type": "letters",
    "stimuli_set": ["A","B","C","D","E","F","G","H","K","L"],
    "response_key": "Space",
    "feedback": true
  }'
)
ON CONFLICT (slug) DO UPDATE SET
  phase_tags = EXCLUDED.phase_tags,
  cognitive_category = EXCLUDED.cognitive_category,
  configurable_durations = EXCLUDED.configurable_durations,
  default_duration_sec = EXCLUDED.default_duration_sec,
  intensity_configurable = EXCLUDED.intensity_configurable,
  default_intensity_percent = EXCLUDED.default_intensity_percent,
  intensity_params = EXCLUDED.intensity_params,
  base_cognitive_load = EXCLUDED.base_cognitive_load,
  available_metrics = EXCLUDED.available_metrics,
  config = EXCLUDED.config;
```

### 3.4 DECISION

#### Choix Visuel 4 options

```sql
INSERT INTO cognitive_test_definitions
  (slug, name, description, duration_minutes, trial_based, metrics_config,
   phase_tags, cognitive_category, configurable_durations, default_duration_sec,
   intensity_configurable, default_intensity_percent, intensity_params,
   base_cognitive_load, available_metrics, config)
VALUES (
  'visual-choice-4',
  'Choix Visuel 4 options',
  'Associer un stimulus visuel (couleur/forme) à la bonne touche parmi 4 options. Mesure la vitesse de décision et la précision sous pression temporelle.',
  3, true, '{}',
  '{"in","post"}', 'decision', '{60,180,300,600}', 180,
  true, 60,
  '{"isi_range":[2000,600],"stimulus_similarity_range":[0.3,0.8]}',
  5, '{"rt","accuracy","variation","rcs","speed"}',
  '{
    "type": "choice_reaction",
    "choices": 4,
    "stimuli": [
      {"shape": "circle",   "color": "#ef4444", "key": "1"},
      {"shape": "square",   "color": "#22c55e", "key": "2"},
      {"shape": "triangle", "color": "#3b82f6", "key": "3"},
      {"shape": "diamond",  "color": "#FFC553", "key": "4"}
    ],
    "feedback": true
  }'
)
ON CONFLICT (slug) DO UPDATE SET
  phase_tags = EXCLUDED.phase_tags,
  cognitive_category = EXCLUDED.cognitive_category,
  configurable_durations = EXCLUDED.configurable_durations,
  default_duration_sec = EXCLUDED.default_duration_sec,
  intensity_configurable = EXCLUDED.intensity_configurable,
  default_intensity_percent = EXCLUDED.default_intensity_percent,
  intensity_params = EXCLUDED.intensity_params,
  base_cognitive_load = EXCLUDED.base_cognitive_load,
  available_metrics = EXCLUDED.available_metrics,
  config = EXCLUDED.config;
```

#### Recherche Visuelle

```sql
INSERT INTO cognitive_test_definitions
  (slug, name, description, duration_minutes, trial_based, metrics_config,
   phase_tags, cognitive_category, configurable_durations, default_duration_sec,
   intensity_configurable, default_intensity_percent, intensity_params,
   base_cognitive_load, available_metrics, config)
VALUES (
  'visual-search',
  'Recherche Visuelle',
  'Trouver une cible (T bleu) parmi des distracteurs (L bleus, T rouges). Le nombre de distracteurs augmente avec l''intensité. Mesure l''attention sélective et la vitesse de balayage visuel.',
  3, true, '{}',
  '{"in","post"}', 'decision', '{60,180,300}', 180,
  true, 50,
  '{"distractor_count_range":[8,24],"target_similarity_range":[0.3,0.8],"display_time_range":[5000,2000]}',
  5, '{"rt","accuracy","variation","speed"}',
  '{
    "type": "visual_search",
    "target": {"letter": "T", "color": "#3b82f6"},
    "distractors": [
      {"letter": "L", "color": "#3b82f6"},
      {"letter": "T", "color": "#ef4444"}
    ],
    "response_type": "tap_target",
    "feedback": true
  }'
)
ON CONFLICT (slug) DO UPDATE SET
  phase_tags = EXCLUDED.phase_tags,
  cognitive_category = EXCLUDED.cognitive_category,
  configurable_durations = EXCLUDED.configurable_durations,
  default_duration_sec = EXCLUDED.default_duration_sec,
  intensity_configurable = EXCLUDED.intensity_configurable,
  default_intensity_percent = EXCLUDED.default_intensity_percent,
  intensity_params = EXCLUDED.intensity_params,
  base_cognitive_load = EXCLUDED.base_cognitive_load,
  available_metrics = EXCLUDED.available_metrics,
  config = EXCLUDED.config;
```

---

## 4. Seed — Seuils normatifs (`cognitive_benchmarks`)

Insère les benchmarks pour `population = 'general_adult'` (adultes sains 18–45 ans).
Utilise `ON CONFLICT (test_definition_id, metric, population) DO UPDATE` pour être idempotent.

> Les seuils `athlete` seront affinés avec les données MINND quand N > 100 par drill.

### PVT (Basner & Dinges, 2011)
| Métrique | Elite | Average | Poor | Direction |
|----------|-------|---------|------|-----------|
| RT | 0–250 ms | 251–350 ms | 351+ ms | lower_is_better |
| Accuracy | 95–100% | 85–94% | 0–84% | higher_is_better |
| RCS | 0.85–1.0 | 0.65–0.84 | 0–0.64 | higher_is_better |
| Variation | 0–12% | 13–22% | 23%+ | lower_is_better |

### Stroop (Scarpina & Tagini, 2017)
| Métrique | Elite | Average | Poor | Direction |
|----------|-------|---------|------|-----------|
| RT | 0–650 ms | 651–900 ms | 901+ ms | lower_is_better |
| Accuracy | 95–100% | 80–94% | 0–79% | higher_is_better |
| RCS | 0.80–1.0 | 0.60–0.79 | 0–0.59 | higher_is_better |
| Speed | 130+ | 90–129 | 0–89 | higher_is_better |

### Simon (Lu & Proctor, 1995)
| Métrique | Elite | Average | Poor | Direction |
|----------|-------|---------|------|-----------|
| RT | 0–400 ms | 401–550 ms | 551+ ms | lower_is_better |
| Accuracy | 95–100% | 85–94% | 0–84% | higher_is_better |
| RCS | 0.82–1.0 | 0.62–0.81 | 0–0.61 | higher_is_better |

### Digital Span (Wechsler, 2008)
| Métrique | Elite | Average | Poor | Direction |
|----------|-------|---------|------|-----------|
| Accuracy (max span) | 8+ | 6–7 | 0–5 | higher_is_better |
| Speed | 120+ | 80–119 | 0–79 | higher_is_better |

### Go/No-Go Visuel (Bezdjian et al., 2009)
| Métrique | Elite | Average | Poor | Direction |
|----------|-------|---------|------|-----------|
| RT | 0–320 ms | 321–450 ms | 451+ ms | lower_is_better |
| Accuracy | 95–100% | 80–94% | 0–79% | higher_is_better |

### Flanker (Eriksen & Eriksen, 1974)
| Métrique | Elite | Average | Poor | Direction |
|----------|-------|---------|------|-----------|
| RT | 0–450 ms | 451–600 ms | 601+ ms | lower_is_better |
| Accuracy | 95–100% | 82–94% | 0–81% | higher_is_better |

### Stop Signal (Verbruggen & Logan, 2008)
| Métrique | Elite | Average | Poor | Direction |
|----------|-------|---------|------|-----------|
| RT (Go trials) | 0–400 ms | 401–550 ms | 551+ ms | lower_is_better |
| Accuracy | 90–100% | 75–89% | 0–74% | higher_is_better |
| SSRT | 0–180 ms | 181–260 ms | 261+ ms | lower_is_better |

### Mackworth Clock (Warm et al., 2008)
| Métrique | Elite | Average | Poor | Direction |
|----------|-------|---------|------|-----------|
| RT | 0–500 ms | 501–750 ms | 751+ ms | lower_is_better |
| Accuracy | 90–100% | 70–89% | 0–69% | higher_is_better |

### Spatial Span (Kessels et al., 2000)
| Métrique | Elite | Average | Poor | Direction |
|----------|-------|---------|------|-----------|
| Accuracy (max span) | 7+ | 5–6 | 0–4 | higher_is_better |

### 2-Back (Owen et al., 2005)
| Métrique | Elite | Average | Poor | Direction |
|----------|-------|---------|------|-----------|
| RT | 0–450 ms | 451–650 ms | 651+ ms | lower_is_better |
| Accuracy | 90–100% | 70–89% | 0–69% | higher_is_better |

### Visual Choice 4 (Hick, 1952)
| Métrique | Elite | Average | Poor | Direction |
|----------|-------|---------|------|-----------|
| RT | 0–400 ms | 401–600 ms | 601+ ms | lower_is_better |
| Accuracy | 95–100% | 85–94% | 0–84% | higher_is_better |

### Visual Search (Wolfe, 1998)
| Métrique | Elite | Average | Poor | Direction |
|----------|-------|---------|------|-----------|
| RT | 0–800 ms | 801–1500 ms | 1501+ ms | lower_is_better |
| Accuracy | 95–100% | 80–94% | 0–79% | higher_is_better |

---

## 5. TypeScript — Extensions de types (`src/types/index.ts`)

Étends l'interface `CognitiveTestDefinition` avec les nouveaux champs :

```typescript
export interface CognitiveTestDefinition {
  // ... champs existants ...
  phase_tags: ('pre' | 'in' | 'post')[]
  cognitive_category: 'attention' | 'inhibition' | 'memory' | 'decision' | 'wellbeing' | null
  configurable_durations: number[]
  default_duration_sec: number
  intensity_configurable: boolean
  default_intensity_percent: number
  intensity_params: Record<string, unknown> | null
  base_cognitive_load: number
  available_metrics: ('rt' | 'accuracy' | 'speed' | 'variation' | 'rcs' | 'ssrt')[]
}
```

Étends `CognitiveSession` :

```typescript
export interface CognitiveSession {
  // ... champs existants ...
  configured_duration_sec: number | null
  configured_intensity_percent: number | null
  phase_context: 'pre' | 'in' | 'post' | null
  cognitive_load_score: number | null
}
```

Étends `CognitiveTestResult` avec les nouvelles métriques :

```typescript
export interface CognitiveTestResult {
  // ... métriques existantes ...
  speed?: number
  rcs?: number
  variation?: number
  ssrt?: number
}
```

Ajoute le type `CognitiveBenchmark` :

```typescript
export interface CognitiveBenchmark {
  id: string
  test_definition_id: string
  metric: string
  elite_max: number | null
  average_min: number | null
  average_max: number | null
  poor_min: number | null
  unit: string | null
  direction: 'lower_is_better' | 'higher_is_better'
  source: string | null
  population: string
  notes: string | null
  created_at: string
}
```

---

## 6. Scoring — Extensions (`src/lib/cognitive/scoring.ts`)

### 6.1 Ajouter les helpers de métriques communes

Dans les fonctions de scoring existantes (PVT, Stroop, Simon), calcule et retourne aussi `rcs`, `variation` et `speed` quand les données le permettent.

```typescript
// Reaction Consistency Score : 1.0 = parfaitement constant
function computeRCS(rts: number[]): number {
  const mean = avg(rts)
  const sd = std(rts)
  return mean > 0 ? Math.max(0, 1 - sd / mean) : 0
}

// Coefficient de variation en %
function computeVariation(rts: number[]): number {
  const mean = avg(rts)
  return mean > 0 ? (std(rts) / mean) * 100 : 0
}

// Score composite vitesse-précision
// accuracy = décimal 0.0–1.0, meanRt en ms
function computeSpeed(accuracy: number, meanRt: number): number {
  return meanRt > 0 ? (accuracy * 100) / (meanRt / 1000) : 0
}
```

### 6.2 Ajouter le scoring Stop Signal

```typescript
function scoreStopSignal(trials: TrialRecord[]): Record<string, number> {
  const goTrials = trials.filter(t => t.stimulus_type === 'go' && t.reaction_time_ms !== null)
  const stopTrials = trials.filter(t => t.stimulus_type === 'stop')

  const meanRtGo = avg(goTrials.map(t => t.reaction_time_ms!))
  const correctStop = stopTrials.filter(t => t.is_correct).length
  const accuracy = trials.length > 0 ? (goTrials.filter(t => t.is_correct).length + correctStop) / trials.length : 0

  // SSRT par méthode staircase : mean_rt_go - mean_SSD
  // mean_SSD est dans stimulus_data.ssd de chaque trial stop
  const ssds = stopTrials
    .map(t => (t.stimulus_data as { ssd?: number }).ssd)
    .filter((ssd): ssd is number => ssd !== undefined)
  const meanSSD = ssds.length > 0 ? avg(ssds) : 0
  const ssrt = Math.max(0, meanRtGo - meanSSD)

  const rts = goTrials.map(t => t.reaction_time_ms!)

  return {
    mean_rt: Math.round(meanRtGo),
    accuracy: Math.round(accuracy * 100),
    ssrt: Math.round(ssrt),
    rcs: parseFloat(computeRCS(rts).toFixed(3)),
    variation: parseFloat(computeVariation(rts).toFixed(1)),
  }
}
```

### 6.3 Ajouter le scoring pour les 7 autres nouveaux drills

Implémente des fonctions de scoring minimales pour :
- `go-nogo-visual` → mean_rt (Go trials), accuracy (commission errors = false alarms), rcs, variation, speed
- `flanker` → mean_rt_congruent, mean_rt_incongruent, flanker_effect_rt, accuracy, rcs, speed
- `mackworth-clock` → mean_rt (détections), accuracy (hits / total targets), variation, rcs
- `spatial-span` → max_span (plus longue séquence correcte), global_accuracy, speed
- `n-back-2` → mean_rt, accuracy, rcs, variation, speed
- `visual-choice-4` → mean_rt, accuracy, rcs, variation, speed
- `visual-search` → mean_rt, accuracy, variation, speed

### 6.4 Mettre à jour le dispatcher

```typescript
export function scoreSession(slug: string, trials: TrialRecord[]): Record<string, number> {
  switch (slug) {
    case 'pvt':           return scorePVT(trials)
    case 'stroop':        return scoreStroop(trials)
    case 'simon-task':    return scoreSimon(trials)
    case 'digital-span':  return scoreDigitalSpan(trials)
    case 'stop-signal':   return scoreStopSignal(trials)
    case 'go-nogo-visual':    return scoreGoNoGo(trials)
    case 'flanker':           return scoreFlanker(trials)
    case 'mackworth-clock':   return scoreMackworth(trials)
    case 'spatial-span':      return scoreSpatialSpan(trials)
    case 'n-back-2':          return scoreNBack(trials)
    case 'visual-choice-4':   return scoreVisualChoice(trials)
    case 'visual-search':     return scoreVisualSearch(trials)
    default:
      throw new Error(`Scoring non défini pour le slug : ${slug}`)
  }
}
```

---

## 7. Récapitulatif des 13 tests après cette step

| # | Slug | Catégorie | Phases | Intensité | Statut |
|---|------|-----------|--------|-----------|--------|
| 1 | pvt | Attention | Pre, Post | Non | Existant, mis à jour |
| 2 | stroop | Inhibition | In, Post | Oui | Existant, mis à jour |
| 3 | simon-task | Inhibition | In | Oui | Existant, mis à jour |
| 4 | digital-span | Memory | In, Pre | Oui | Existant, mis à jour |
| 5 | cognitive-questionnaire | Wellbeing | Pre | Non | Existant, mis à jour |
| 6 | go-nogo-visual | Attention | In, Post | Oui | **Nouveau** |
| 7 | mackworth-clock | Attention | In | Oui | **Nouveau** |
| 8 | flanker | Inhibition | In, Post | Oui | **Nouveau** |
| 9 | stop-signal | Inhibition | In | Oui | **Nouveau** |
| 10 | spatial-span | Memory | In, Pre | Oui | **Nouveau** |
| 11 | n-back-2 | Memory | In | Oui | **Nouveau** |
| 12 | visual-choice-4 | Decision | In, Post | Oui | **Nouveau** |
| 13 | visual-search | Decision | In, Post | Oui | **Nouveau** |

Couverture des 5 catégories : Attention (3), Inhibition (4), Memory (3), Decision (2), Wellbeing (1).
Couverture des 3 phases : Pre (4), In (12), Post (7).

---

## 8. Critères d'acceptation

- [ ] Les 9 nouvelles colonnes sont ajoutées à `cognitive_test_definitions` (IF NOT EXISTS)
- [ ] Les 4 nouvelles colonnes sont ajoutées à `cognitive_sessions` (IF NOT EXISTS)
- [ ] La table `cognitive_benchmarks` est créée avec RLS + index
- [ ] Les 5 tests existants sont mis à jour avec les nouveaux champs (UPDATE par slug)
- [ ] Les 8 nouveaux tests sont seedés avec `test_config` complet (ON CONFLICT DO UPDATE)
- [ ] Les seuils normatifs sont seedés pour les 13 tests dans `cognitive_benchmarks`
- [ ] `CognitiveTestDefinition`, `CognitiveSession`, `CognitiveTestResult` sont mis à jour
- [ ] Le type `CognitiveBenchmark` est ajouté
- [ ] `scoreSession()` supporte les 12 tests (nouveau dispatcher + 8 fonctions ajoutées)
- [ ] `scoreStopSignal()` calcule le SSRT (mean_rt_go - mean_SSD)
- [ ] `computeRCS()`, `computeVariation()`, `computeSpeed()` sont helpers partagés
- [ ] `npm run build` compile sans erreur TypeScript
