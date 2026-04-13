-- Étape 28 — Schema cognitif V2
-- Paramètres dynamiques (durée + intensité), 8 nouveaux drills, seuils normatifs Elite/Average/Poor
--
-- Prérequis : 20260331000003_create_cognitive_tests.sql (cognitive_test_definitions, cognitive_sessions)
--             20260403000000_create_cognitive_presets.sql (preset_id, config_used sur sessions)
--
-- Dépendances aval :
--   Step 29 — Cognitive Load Score (utilise base_cognitive_load, cognitive_load_score)
--   Step 30 — Frontend cognitif V2 (utilise test_config, phase_tags)
--   Step 31 — Scoring cognitif V2  (utilise available_metrics, ssrt, rcs, variation, speed)

-- ============================================================
-- 1. ENRICHISSEMENT DE cognitive_test_definitions
-- ============================================================

ALTER TABLE public.cognitive_test_definitions
  ADD COLUMN IF NOT EXISTS phase_tags TEXT[] DEFAULT '{"in"}';
-- Phases où ce test peut être utilisé : 'pre', 'in', 'post'
-- Un test peut avoir plusieurs tags (ex: PVT = {"pre","post"})

ALTER TABLE public.cognitive_test_definitions
  ADD COLUMN IF NOT EXISTS cognitive_category TEXT
    CHECK (cognitive_category IN ('attention', 'inhibition', 'memory', 'decision', 'wellbeing'));
-- Catégorie cognitive principale du drill

ALTER TABLE public.cognitive_test_definitions
  ADD COLUMN IF NOT EXISTS configurable_durations INTEGER[] DEFAULT '{300}';
-- Durées disponibles en secondes. Le coach choisit parmi ces options.
-- Ex: {60, 180, 300, 600, 1200}

ALTER TABLE public.cognitive_test_definitions
  ADD COLUMN IF NOT EXISTS default_duration_sec INTEGER DEFAULT 300;
-- Durée par défaut en secondes.
-- NOTE : la colonne existante `duration_minutes` reste pour compatibilité ascendante.
-- `default_duration_sec` est la source de vérité pour les nouveaux drills.
-- Pour les tests existants : default_duration_sec = duration_minutes * 60

ALTER TABLE public.cognitive_test_definitions
  ADD COLUMN IF NOT EXISTS intensity_configurable BOOLEAN DEFAULT false;
-- true = le coach peut régler l'intensité (10–100%)

ALTER TABLE public.cognitive_test_definitions
  ADD COLUMN IF NOT EXISTS default_intensity_percent INTEGER DEFAULT 100;
-- Intensité par défaut (10–100)

ALTER TABLE public.cognitive_test_definitions
  ADD COLUMN IF NOT EXISTS intensity_params JSONB;
-- Décrit comment l'intensité affecte les paramètres du test.
-- Ex: {"isi_range": [2000, 500]} → à 10% intensité ISI=2000ms, à 100% ISI=500ms

ALTER TABLE public.cognitive_test_definitions
  ADD COLUMN IF NOT EXISTS base_cognitive_load INTEGER DEFAULT 5;
-- Charge cognitive de base du drill (1–10), avant ajustement durée/intensité.
-- Utilisé par computeCognitiveLoad (step 29).

ALTER TABLE public.cognitive_test_definitions
  ADD COLUMN IF NOT EXISTS available_metrics TEXT[] DEFAULT '{"rt","accuracy"}';
-- Métriques produites par ce test : 'rt', 'accuracy', 'speed', 'variation', 'rcs', 'ssrt'
-- Utilisé pour filtrer les métriques dans le dashboard

-- ============================================================
-- 2. ENRICHISSEMENT DE cognitive_sessions
-- ============================================================

ALTER TABLE public.cognitive_sessions
  ADD COLUMN IF NOT EXISTS configured_duration_sec INTEGER;
-- Durée choisie par le coach (override du default)

ALTER TABLE public.cognitive_sessions
  ADD COLUMN IF NOT EXISTS configured_intensity_percent INTEGER;
-- Intensité choisie par le coach (10–100)

ALTER TABLE public.cognitive_sessions
  ADD COLUMN IF NOT EXISTS phase_context TEXT
    CHECK (phase_context IN ('pre', 'in', 'post'));
-- Phase dans laquelle ce test a été exécuté.
-- Rempli quand le test est lancé depuis un programme tagué.

ALTER TABLE public.cognitive_sessions
  ADD COLUMN IF NOT EXISTS cognitive_load_score INTEGER;
-- Score de charge cognitive calculé (1–26), rempli par le scoring (step 29)

-- ============================================================
-- 2b. CONTRAINTES CHECK ET SÉCURITÉ
-- IF NOT EXISTS rend la migration idempotente
-- ============================================================

-- cognitive_test_definitions
DO $$ BEGIN
  ALTER TABLE public.cognitive_test_definitions
    ADD CONSTRAINT chk_ctd_default_duration_sec
    CHECK (default_duration_sec IS NULL OR default_duration_sec > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.cognitive_test_definitions
    ADD CONSTRAINT chk_ctd_default_intensity_percent
    CHECK (default_intensity_percent IS NULL OR (default_intensity_percent >= 10 AND default_intensity_percent <= 100));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.cognitive_test_definitions
    ADD CONSTRAINT chk_ctd_base_cognitive_load
    CHECK (base_cognitive_load IS NULL OR (base_cognitive_load >= 1 AND base_cognitive_load <= 10));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.cognitive_test_definitions
    ADD CONSTRAINT chk_ctd_phase_tags
    CHECK (phase_tags IS NULL OR phase_tags <@ ARRAY['pre','in','post']::TEXT[]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- cognitive_sessions
DO $$ BEGIN
  ALTER TABLE public.cognitive_sessions
    ADD CONSTRAINT chk_cs_configured_duration_sec
    CHECK (configured_duration_sec IS NULL OR configured_duration_sec > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.cognitive_sessions
    ADD CONSTRAINT chk_cs_configured_intensity_percent
    CHECK (configured_intensity_percent IS NULL OR (configured_intensity_percent >= 10 AND configured_intensity_percent <= 100));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.cognitive_sessions
    ADD CONSTRAINT chk_cs_cognitive_load_score
    CHECK (cognitive_load_score IS NULL OR (cognitive_load_score >= 1 AND cognitive_load_score <= 26));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Empêcher les clients de falsifier le score calculé côté serveur
REVOKE UPDATE (cognitive_load_score) ON public.cognitive_sessions FROM authenticated;

-- ============================================================
-- 3. NOUVELLE TABLE cognitive_benchmarks
-- Seuils normatifs Elite/Average/Poor par drill et par métrique
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cognitive_benchmarks (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  test_definition_id UUID        NOT NULL REFERENCES public.cognitive_test_definitions(id) ON DELETE CASCADE,
  metric             TEXT        NOT NULL,
  -- 'rt', 'accuracy', 'speed', 'rcs', 'variation', 'ssrt'
  elite_max          NUMERIC,    -- borne supérieure Elite    (pour RT : plus bas = mieux)
  average_min        NUMERIC,    -- borne inférieure Average
  average_max        NUMERIC,    -- borne supérieure Average
  poor_min           NUMERIC,    -- borne inférieure Poor     (pour RT : plus haut = pire)
  unit               TEXT,       -- 'ms', '%', 'score', 'ratio', 'digits'
  direction          TEXT        NOT NULL CHECK (direction IN ('lower_is_better', 'higher_is_better')),
  -- 'lower_is_better' pour RT, Variation, SSRT
  -- 'higher_is_better' pour Accuracy, Speed, RCS, span
  source             TEXT,       -- référence bibliographique
  population         TEXT        DEFAULT 'general_adult',
  -- 'general_adult', 'athlete', 'elite_athlete'
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT now(),
  UNIQUE(test_definition_id, metric, population)
);

-- Contrainte sur les valeurs de métrique autorisées (ajoutée séparément pour idempotence)
DO $$ BEGIN
  ALTER TABLE public.cognitive_benchmarks
    ADD CONSTRAINT chk_cb_metric
    CHECK (metric IN ('rt', 'accuracy', 'speed', 'rcs', 'variation', 'ssrt'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_cognitive_benchmarks_test_def
  ON public.cognitive_benchmarks(test_definition_id);

ALTER TABLE public.cognitive_benchmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cognitive_benchmarks_authenticated_select" ON public.cognitive_benchmarks;
CREATE POLICY "cognitive_benchmarks_authenticated_select"
  ON public.cognitive_benchmarks FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- 4. MISE À JOUR DES 5 TESTS EXISTANTS
-- Slugs exacts confirmés depuis le seed initial :
--   pvt, stroop, simon, digital_span, questionnaire_cognitif
-- ============================================================

UPDATE public.cognitive_test_definitions SET
  phase_tags              = '{"pre","post"}',
  cognitive_category      = 'attention',
  configurable_durations  = '{180,300,600}',
  default_duration_sec    = 300,
  intensity_configurable  = false,
  default_intensity_percent = 100,
  base_cognitive_load     = 4,
  available_metrics       = '{"rt","accuracy","variation","rcs","speed"}'
WHERE slug = 'pvt';

UPDATE public.cognitive_test_definitions SET
  phase_tags              = '{"in","post"}',
  cognitive_category      = 'inhibition',
  configurable_durations  = '{60,180,300,600}',
  default_duration_sec    = 300,
  intensity_configurable  = true,
  default_intensity_percent = 70,
  intensity_params        = '{"congruent_ratio_range":[0.7,0.3],"isi_range":[2500,1000]}',
  base_cognitive_load     = 6,
  available_metrics       = '{"rt","accuracy","variation","rcs","speed"}'
WHERE slug = 'stroop';
-- congruent_ratio_range : à 10% intensité → 70% stimuli congruents (facile). À 100% → 30% (difficile).

UPDATE public.cognitive_test_definitions SET
  phase_tags              = '{"in"}',
  cognitive_category      = 'inhibition',
  configurable_durations  = '{180,300,600}',
  default_duration_sec    = 300,
  intensity_configurable  = true,
  default_intensity_percent = 60,
  intensity_params        = '{"congruent_ratio_range":[0.7,0.3],"isi_range":[2000,800]}',
  base_cognitive_load     = 5,
  available_metrics       = '{"rt","accuracy","variation","rcs","speed"}'
WHERE slug = 'simon';

UPDATE public.cognitive_test_definitions SET
  phase_tags              = '{"in","pre"}',
  cognitive_category      = 'memory',
  configurable_durations  = '{180,300,600}',
  default_duration_sec    = 300,
  intensity_configurable  = true,
  default_intensity_percent = 50,
  intensity_params        = '{"starting_span_range":[3,5],"display_time_range":[1200,600]}',
  base_cognitive_load     = 6,
  available_metrics       = '{"accuracy","variation"}'
WHERE slug = 'digital_span';

UPDATE public.cognitive_test_definitions SET
  phase_tags              = '{"pre"}',
  cognitive_category      = 'wellbeing',
  configurable_durations  = '{600}',
  default_duration_sec    = 600,
  intensity_configurable  = false,
  default_intensity_percent = 100,
  base_cognitive_load     = 2,
  available_metrics       = '{"accuracy"}'
WHERE slug = 'questionnaire_cognitif';

-- ============================================================
-- 5. SEED — 8 NOUVEAUX DRILLS
-- ON CONFLICT DO UPDATE pour être idempotent
-- ============================================================

-- 5.1 ATTENTION

INSERT INTO public.cognitive_test_definitions
  (slug, name, description, duration_minutes, trial_based, normative_n, price_cents,
   instructions_fr, config, metrics_config,
   phase_tags, cognitive_category, configurable_durations, default_duration_sec,
   intensity_configurable, default_intensity_percent, intensity_params,
   base_cognitive_load, available_metrics)
VALUES (
  'go-nogo-visual',
  'Go/No-Go Visuel',
  'Répondre rapidement aux stimuli Go (cercle vert) et inhiber la réponse sur les stimuli No-Go (cercle rouge). Mesure le contrôle attentionnel et la capacité d''inhibition de base.',
  3, true, 0, 0,
  'Un cercle va apparaître. Appuyez si le cercle est VERT. N''appuyez pas si le cercle est ROUGE. Répondez le plus vite possible.',
  '{"type":"go_nogo","modality":"visual","go_stimulus":{"shape":"circle","color":"#22c55e"},"nogo_stimulus":{"shape":"circle","color":"#ef4444"},"response_type":"tap","feedback":true}',
  '[{"key":"mean_rt","label":"RT Moyen (Go)","unit":"ms"},{"key":"accuracy","label":"Précision","unit":"%"},{"key":"rcs","label":"Consistance","unit":"score"},{"key":"variation","label":"Variation","unit":"%"},{"key":"speed","label":"Speed Score","unit":"score"}]',
  '{"in","post"}', 'attention', '{60,180,300,600}', 180,
  true, 60,
  '{"nogo_ratio_range":[0.2,0.4],"isi_range":[1500,600]}',
  5, '{"rt","accuracy","variation","rcs","speed"}'
)
ON CONFLICT (slug) DO UPDATE SET
  phase_tags              = EXCLUDED.phase_tags,
  cognitive_category      = EXCLUDED.cognitive_category,
  configurable_durations  = EXCLUDED.configurable_durations,
  default_duration_sec    = EXCLUDED.default_duration_sec,
  intensity_configurable  = EXCLUDED.intensity_configurable,
  default_intensity_percent = EXCLUDED.default_intensity_percent,
  intensity_params        = EXCLUDED.intensity_params,
  base_cognitive_load     = EXCLUDED.base_cognitive_load,
  available_metrics       = EXCLUDED.available_metrics,
  config                  = EXCLUDED.config,
  metrics_config          = EXCLUDED.metrics_config;

INSERT INTO public.cognitive_test_definitions
  (slug, name, description, duration_minutes, trial_based, normative_n, price_cents,
   instructions_fr, config, metrics_config,
   phase_tags, cognitive_category, configurable_durations, default_duration_sec,
   intensity_configurable, default_intensity_percent, intensity_params,
   base_cognitive_load, available_metrics)
VALUES (
  'mackworth-clock',
  'Mackworth Clock',
  'Surveiller une horloge où un point se déplace régulièrement. Détecter les sauts doubles. Mesure l''attention soutenue et la vigilance sur longue durée.',
  10, true, 0, 0,
  'Un point se déplace sur une horloge. Appuyez dès que le point SAUTE une position (double-saut). Restez concentré sur toute la durée du test.',
  '{"type":"mackworth","positions":24,"target_event":"double_skip","feedback":false}',
  '[{"key":"mean_rt","label":"RT Détection","unit":"ms"},{"key":"accuracy","label":"Taux de détection","unit":"%"},{"key":"rcs","label":"Consistance","unit":"score"},{"key":"variation","label":"Variation","unit":"%"}]',
  '{"in"}', 'attention', '{300,600,1200}', 600,
  true, 50,
  '{"skip_frequency_range":[0.05,0.15],"tick_interval_range":[1500,800]}',
  7, '{"rt","accuracy","variation","rcs"}'
)
ON CONFLICT (slug) DO UPDATE SET
  phase_tags              = EXCLUDED.phase_tags,
  cognitive_category      = EXCLUDED.cognitive_category,
  configurable_durations  = EXCLUDED.configurable_durations,
  default_duration_sec    = EXCLUDED.default_duration_sec,
  intensity_configurable  = EXCLUDED.intensity_configurable,
  default_intensity_percent = EXCLUDED.default_intensity_percent,
  intensity_params        = EXCLUDED.intensity_params,
  base_cognitive_load     = EXCLUDED.base_cognitive_load,
  available_metrics       = EXCLUDED.available_metrics,
  config                  = EXCLUDED.config,
  metrics_config          = EXCLUDED.metrics_config;

-- 5.2 INHIBITION

INSERT INTO public.cognitive_test_definitions
  (slug, name, description, duration_minutes, trial_based, normative_n, price_cents,
   instructions_fr, config, metrics_config,
   phase_tags, cognitive_category, configurable_durations, default_duration_sec,
   intensity_configurable, default_intensity_percent, intensity_params,
   base_cognitive_load, available_metrics)
VALUES (
  'flanker',
  'Flanker (Eriksen)',
  'Identifier la direction de la flèche centrale entourée de flèches distractrices congruentes ou incongruentes. Mesure le contrôle inhibiteur et la résistance à l''interférence visuelle.',
  5, true, 0, 0,
  'Une flèche centrale apparaît entourée d''autres flèches. Indiquez la direction de la flèche du MILIEU uniquement. Ignorez les flèches autour.',
  '{"type":"flanker","stimuli":"arrows","directions":["left","right"],"flanker_count":4,"response_keys":{"left":"ArrowLeft","right":"ArrowRight"},"feedback":true}',
  '[{"key":"mean_rt_congruent","label":"RT Congruent","unit":"ms"},{"key":"mean_rt_incongruent","label":"RT Incongruent","unit":"ms"},{"key":"flanker_effect_rt","label":"Effet Flanker","unit":"ms"},{"key":"accuracy","label":"Précision","unit":"%"},{"key":"speed","label":"Speed Score","unit":"score"}]',
  '{"in","post"}', 'inhibition', '{60,180,300,600}', 300,
  true, 60,
  '{"incongruent_ratio_range":[0.3,0.7],"isi_range":[2000,800]}',
  6, '{"rt","accuracy","variation","rcs","speed"}'
)
ON CONFLICT (slug) DO UPDATE SET
  phase_tags              = EXCLUDED.phase_tags,
  cognitive_category      = EXCLUDED.cognitive_category,
  configurable_durations  = EXCLUDED.configurable_durations,
  default_duration_sec    = EXCLUDED.default_duration_sec,
  intensity_configurable  = EXCLUDED.intensity_configurable,
  default_intensity_percent = EXCLUDED.default_intensity_percent,
  intensity_params        = EXCLUDED.intensity_params,
  base_cognitive_load     = EXCLUDED.base_cognitive_load,
  available_metrics       = EXCLUDED.available_metrics,
  config                  = EXCLUDED.config,
  metrics_config          = EXCLUDED.metrics_config;

INSERT INTO public.cognitive_test_definitions
  (slug, name, description, duration_minutes, trial_based, normative_n, price_cents,
   instructions_fr, config, metrics_config,
   phase_tags, cognitive_category, configurable_durations, default_duration_sec,
   intensity_configurable, default_intensity_percent, intensity_params,
   base_cognitive_load, available_metrics)
VALUES (
  'stop-signal',
  'Stop Signal',
  'Répondre rapidement à un stimulus Go, mais inhiber la réponse quand un signal Stop (bip audio) apparaît après un délai variable. Mesure le SSRT (Stop Signal Reaction Time). Plus le SSRT est bas, meilleur est le contrôle inhibiteur.',
  5, true, 0, 0,
  'Une flèche va apparaître. Répondez vite avec la bonne touche. Mais si vous entendez un BIP, inhibez votre réponse immédiatement. Le délai du bip change automatiquement.',
  '{"type":"stop_signal","go_stimulus":{"shape":"arrow","directions":["left","right"]},"stop_signal":{"type":"audio","sound":"beep"},"ssd_staircase":true,"ssd_step_ms":50,"response_keys":{"left":"ArrowLeft","right":"ArrowRight"},"feedback":false}',
  '[{"key":"mean_rt","label":"RT Go Moyen","unit":"ms"},{"key":"accuracy","label":"Précision Go","unit":"%"},{"key":"ssrt","label":"SSRT","unit":"ms","description":"Stop Signal Reaction Time — plus bas = meilleur contrôle inhibiteur"}]',
  '{"in"}', 'inhibition', '{180,300,600}', 300,
  true, 50,
  '{"stop_ratio_range":[0.2,0.35],"initial_ssd_range":[300,200]}',
  7, '{"rt","accuracy","variation","rcs","ssrt"}'
)
ON CONFLICT (slug) DO UPDATE SET
  phase_tags              = EXCLUDED.phase_tags,
  cognitive_category      = EXCLUDED.cognitive_category,
  configurable_durations  = EXCLUDED.configurable_durations,
  default_duration_sec    = EXCLUDED.default_duration_sec,
  intensity_configurable  = EXCLUDED.intensity_configurable,
  default_intensity_percent = EXCLUDED.default_intensity_percent,
  intensity_params        = EXCLUDED.intensity_params,
  base_cognitive_load     = EXCLUDED.base_cognitive_load,
  available_metrics       = EXCLUDED.available_metrics,
  config                  = EXCLUDED.config,
  metrics_config          = EXCLUDED.metrics_config;

-- 5.3 MEMORY

INSERT INTO public.cognitive_test_definitions
  (slug, name, description, duration_minutes, trial_based, normative_n, price_cents,
   instructions_fr, config, metrics_config,
   phase_tags, cognitive_category, configurable_durations, default_duration_sec,
   intensity_configurable, default_intensity_percent, intensity_params,
   base_cognitive_load, available_metrics)
VALUES (
  'spatial-span',
  'Spatial Span',
  'Mémoriser et reproduire une séquence de positions spatiales sur une grille. La séquence s''allonge progressivement. Mesure la mémoire de travail visuo-spatiale.',
  5, true, 0, 0,
  'Des cases vont s''illuminer une par une sur une grille. Mémorisez l''ordre et reproduisez la séquence en appuyant dans le même ordre. La séquence s''allonge à chaque réussite.',
  '{"type":"spatial_span","grid_rows":3,"grid_cols":3,"starting_length":3,"max_length":9,"highlight_color":"#20808D","response_type":"tap_sequence","feedback":true}',
  '[{"key":"max_span","label":"Span Maximum","unit":"positions"},{"key":"global_accuracy","label":"Précision globale","unit":"%"}]',
  '{"in","pre"}', 'memory', '{180,300,600}', 300,
  true, 50,
  '{"starting_span_range":[3,5],"display_time_per_item_range":[1000,500],"grid_size_range":[9,16]}',
  6, '{"accuracy","variation"}'
)
ON CONFLICT (slug) DO UPDATE SET
  phase_tags              = EXCLUDED.phase_tags,
  cognitive_category      = EXCLUDED.cognitive_category,
  configurable_durations  = EXCLUDED.configurable_durations,
  default_duration_sec    = EXCLUDED.default_duration_sec,
  intensity_configurable  = EXCLUDED.intensity_configurable,
  default_intensity_percent = EXCLUDED.default_intensity_percent,
  intensity_params        = EXCLUDED.intensity_params,
  base_cognitive_load     = EXCLUDED.base_cognitive_load,
  available_metrics       = EXCLUDED.available_metrics,
  config                  = EXCLUDED.config,
  metrics_config          = EXCLUDED.metrics_config;

INSERT INTO public.cognitive_test_definitions
  (slug, name, description, duration_minutes, trial_based, normative_n, price_cents,
   instructions_fr, config, metrics_config,
   phase_tags, cognitive_category, configurable_durations, default_duration_sec,
   intensity_configurable, default_intensity_percent, intensity_params,
   base_cognitive_load, available_metrics)
VALUES (
  'n-back-2',
  '2-Back',
  'Indiquer si le stimulus actuel est identique à celui présenté 2 positions avant. Mesure la mémoire de travail et la mise à jour continue de l''information en mémoire.',
  5, true, 0, 0,
  'Des lettres vont apparaître une par une. Appuyez sur ESPACE si la lettre actuelle est la MÊME que celle d''il y a 2 lettres. Sinon, ne faites rien.',
  '{"type":"n_back","n":2,"stimuli_type":"letters","stimuli_set":["A","B","C","D","E","F","G","H","K","L"],"response_key":"Space","feedback":true}',
  '[{"key":"mean_rt","label":"RT Moyen","unit":"ms"},{"key":"accuracy","label":"Précision (hits - FA)","unit":"%"},{"key":"rcs","label":"Consistance","unit":"score"},{"key":"speed","label":"Speed Score","unit":"score"}]',
  '{"in"}', 'memory', '{180,300,600}', 300,
  true, 60,
  '{"target_ratio_range":[0.25,0.35],"isi_range":[3000,1500],"stimulus_display_range":[1500,500]}',
  8, '{"rt","accuracy","variation","rcs","speed"}'
)
ON CONFLICT (slug) DO UPDATE SET
  phase_tags              = EXCLUDED.phase_tags,
  cognitive_category      = EXCLUDED.cognitive_category,
  configurable_durations  = EXCLUDED.configurable_durations,
  default_duration_sec    = EXCLUDED.default_duration_sec,
  intensity_configurable  = EXCLUDED.intensity_configurable,
  default_intensity_percent = EXCLUDED.default_intensity_percent,
  intensity_params        = EXCLUDED.intensity_params,
  base_cognitive_load     = EXCLUDED.base_cognitive_load,
  available_metrics       = EXCLUDED.available_metrics,
  config                  = EXCLUDED.config,
  metrics_config          = EXCLUDED.metrics_config;

-- 5.4 DECISION

INSERT INTO public.cognitive_test_definitions
  (slug, name, description, duration_minutes, trial_based, normative_n, price_cents,
   instructions_fr, config, metrics_config,
   phase_tags, cognitive_category, configurable_durations, default_duration_sec,
   intensity_configurable, default_intensity_percent, intensity_params,
   base_cognitive_load, available_metrics)
VALUES (
  'visual-choice-4',
  'Choix Visuel 4 options',
  'Associer un stimulus visuel (couleur et forme) à la bonne touche parmi 4 options. Mesure la vitesse de décision et la précision sous pression temporelle.',
  3, true, 0, 0,
  'Une forme colorée va apparaître. Appuyez sur la touche correspondante : 1=cercle rouge, 2=carré vert, 3=triangle bleu, 4=losange or. Répondez le plus vite possible.',
  '{"type":"choice_reaction","choices":4,"stimuli":[{"shape":"circle","color":"#ef4444","key":"1"},{"shape":"square","color":"#22c55e","key":"2"},{"shape":"triangle","color":"#3b82f6","key":"3"},{"shape":"diamond","color":"#FFC553","key":"4"}],"feedback":true}',
  '[{"key":"mean_rt","label":"RT Moyen","unit":"ms"},{"key":"accuracy","label":"Précision","unit":"%"},{"key":"rcs","label":"Consistance","unit":"score"},{"key":"speed","label":"Speed Score","unit":"score"}]',
  '{"in","post"}', 'decision', '{60,180,300,600}', 180,
  true, 60,
  '{"isi_range":[2000,600],"stimulus_similarity_range":[0.3,0.8]}',
  5, '{"rt","accuracy","variation","rcs","speed"}'
)
ON CONFLICT (slug) DO UPDATE SET
  phase_tags              = EXCLUDED.phase_tags,
  cognitive_category      = EXCLUDED.cognitive_category,
  configurable_durations  = EXCLUDED.configurable_durations,
  default_duration_sec    = EXCLUDED.default_duration_sec,
  intensity_configurable  = EXCLUDED.intensity_configurable,
  default_intensity_percent = EXCLUDED.default_intensity_percent,
  intensity_params        = EXCLUDED.intensity_params,
  base_cognitive_load     = EXCLUDED.base_cognitive_load,
  available_metrics       = EXCLUDED.available_metrics,
  config                  = EXCLUDED.config,
  metrics_config          = EXCLUDED.metrics_config;

INSERT INTO public.cognitive_test_definitions
  (slug, name, description, duration_minutes, trial_based, normative_n, price_cents,
   instructions_fr, config, metrics_config,
   phase_tags, cognitive_category, configurable_durations, default_duration_sec,
   intensity_configurable, default_intensity_percent, intensity_params,
   base_cognitive_load, available_metrics)
VALUES (
  'visual-search',
  'Recherche Visuelle',
  'Trouver une cible (T bleu) parmi des distracteurs (L bleus, T rouges) le plus vite possible. Le nombre de distracteurs augmente avec l''intensité. Mesure l''attention sélective et la vitesse de balayage visuel.',
  3, true, 0, 0,
  'Trouvez le T BLEU parmi les distracteurs. Appuyez dessus (ou sur sa position) le plus vite possible. Ignorez les autres formes.',
  '{"type":"visual_search","target":{"letter":"T","color":"#3b82f6"},"distractors":[{"letter":"L","color":"#3b82f6"},{"letter":"T","color":"#ef4444"}],"response_type":"tap_target","feedback":true}',
  '[{"key":"mean_rt","label":"RT Recherche","unit":"ms"},{"key":"accuracy","label":"Précision","unit":"%"},{"key":"variation","label":"Variation","unit":"%"},{"key":"speed","label":"Speed Score","unit":"score"}]',
  '{"in","post"}', 'decision', '{60,180,300}', 180,
  true, 50,
  '{"distractor_count_range":[8,24],"target_similarity_range":[0.3,0.8],"display_time_range":[5000,2000]}',
  5, '{"rt","accuracy","variation","speed"}'
)
ON CONFLICT (slug) DO UPDATE SET
  phase_tags              = EXCLUDED.phase_tags,
  cognitive_category      = EXCLUDED.cognitive_category,
  configurable_durations  = EXCLUDED.configurable_durations,
  default_duration_sec    = EXCLUDED.default_duration_sec,
  intensity_configurable  = EXCLUDED.intensity_configurable,
  default_intensity_percent = EXCLUDED.default_intensity_percent,
  intensity_params        = EXCLUDED.intensity_params,
  base_cognitive_load     = EXCLUDED.base_cognitive_load,
  available_metrics       = EXCLUDED.available_metrics,
  config                  = EXCLUDED.config,
  metrics_config          = EXCLUDED.metrics_config;

-- ============================================================
-- 6. SEED — SEUILS NORMATIFS (cognitive_benchmarks)
-- Population : 'general_adult' (adultes sains 18–45 ans)
-- Sources : littérature peer-reviewed
-- ON CONFLICT DO UPDATE pour être idempotent
-- ============================================================

-- Helper : résoudre les IDs par slug dans un CTE
WITH test_ids AS (
  SELECT slug, id FROM public.cognitive_test_definitions
  WHERE slug IN (
    'pvt','stroop','simon','digital_span','questionnaire_cognitif',
    'go-nogo-visual','mackworth-clock','flanker','stop-signal',
    'spatial-span','n-back-2','visual-choice-4','visual-search'
  )
)

INSERT INTO public.cognitive_benchmarks
  (test_definition_id, metric, elite_max, average_min, average_max, poor_min, unit, direction, source, population)
SELECT t.id, b.metric, b.elite_max, b.average_min, b.average_max, b.poor_min, b.unit, b.direction, b.source, 'general_adult'
FROM test_ids t
JOIN (VALUES

  -- PVT (Basner & Dinges, 2011)
  ('pvt', 'rt',        250,   251,   350,   351,  'ms',     'lower_is_better',    'Basner & Dinges (2011)'),
  ('pvt', 'accuracy',  NULL,   85,    94,    NULL, '%',      'higher_is_better',   'Basner & Dinges (2011)'),
  ('pvt', 'rcs',       NULL,  0.65,  0.84,  NULL, 'score',  'higher_is_better',   'Estimé'),
  ('pvt', 'variation', 12,    13,    22,    23,   '%',      'lower_is_better',    'Estimé'),

  -- Stroop (Scarpina & Tagini, 2017)
  ('stroop', 'rt',        650,   651,   900,   901,  'ms',     'lower_is_better',    'Scarpina & Tagini (2017)'),
  ('stroop', 'accuracy',  NULL,   80,    94,    NULL, '%',      'higher_is_better',   'Scarpina & Tagini (2017)'),
  ('stroop', 'rcs',       NULL,  0.60,  0.79,  NULL, 'score',  'higher_is_better',   'Estimé'),
  ('stroop', 'speed',     NULL,   90,   129,   NULL, 'score',  'higher_is_better',   'Calculé'),

  -- Simon (Lu & Proctor, 1995)
  ('simon', 'rt',        400,   401,   550,   551,  'ms',     'lower_is_better',    'Lu & Proctor (1995)'),
  ('simon', 'accuracy',  NULL,   85,    94,    NULL, '%',      'higher_is_better',   'Lu & Proctor (1995)'),
  ('simon', 'rcs',       NULL,  0.62,  0.81,  NULL, 'score',  'higher_is_better',   'Estimé'),

  -- Digital Span (Wechsler, 2008)
  ('digital_span', 'accuracy', NULL, 6, 7, NULL, 'digits',  'higher_is_better',  'Wechsler (2008)'),
  ('digital_span', 'speed',    NULL, 80, 119, NULL, 'score', 'higher_is_better',  'Calculé'),

  -- Go/No-Go Visual (Bezdjian et al., 2009)
  ('go-nogo-visual', 'rt',       320,   321,   450,   451,  'ms',  'lower_is_better',   'Bezdjian et al. (2009)'),
  ('go-nogo-visual', 'accuracy', NULL,   80,    94,    NULL, '%',   'higher_is_better',  'Bezdjian et al. (2009)'),

  -- Flanker (Eriksen & Eriksen, 1974)
  ('flanker', 'rt',       450,   451,   600,   601,  'ms',  'lower_is_better',   'Eriksen & Eriksen (1974)'),
  ('flanker', 'accuracy', NULL,   82,    94,    NULL, '%',   'higher_is_better',  'Estimé'),

  -- Stop Signal (Verbruggen & Logan, 2008)
  ('stop-signal', 'rt',       400,   401,   550,   551,  'ms',  'lower_is_better',   'Verbruggen & Logan (2008)'),
  ('stop-signal', 'accuracy', NULL,   75,    89,    NULL, '%',   'higher_is_better',  'Verbruggen & Logan (2008)'),
  ('stop-signal', 'ssrt',     180,   181,   260,   261,  'ms',  'lower_is_better',   'Verbruggen & Logan (2008)'),

  -- Mackworth Clock (Warm et al., 2008)
  ('mackworth-clock', 'rt',       500,   501,   750,   751,  'ms',  'lower_is_better',   'Warm et al. (2008)'),
  ('mackworth-clock', 'accuracy', NULL,   70,    89,    NULL, '%',   'higher_is_better',  'Warm et al. (2008)'),

  -- Spatial Span (Kessels et al., 2000)
  ('spatial-span', 'accuracy', NULL, 5, 6, NULL, 'positions', 'higher_is_better', 'Kessels et al. (2000)'),

  -- 2-Back (Owen et al., 2005)
  ('n-back-2', 'rt',       450,   451,   650,   651,  'ms',  'lower_is_better',   'Owen et al. (2005)'),
  ('n-back-2', 'accuracy', NULL,   70,    89,    NULL, '%',   'higher_is_better',  'Owen et al. (2005)'),

  -- Visual Choice 4 (Hick, 1952)
  ('visual-choice-4', 'rt',       400,   401,   600,   601,  'ms',  'lower_is_better',   'Hick (1952)'),
  ('visual-choice-4', 'accuracy', NULL,   85,    94,    NULL, '%',   'higher_is_better',  'Estimé'),

  -- Visual Search (Wolfe, 1998)
  ('visual-search', 'rt',       800,    801,  1500,  1501,  'ms',  'lower_is_better',   'Wolfe (1998)'),
  ('visual-search', 'accuracy', NULL,    80,    94,   NULL,  '%',   'higher_is_better',  'Wolfe (1998)')

) AS b(slug, metric, elite_max, average_min, average_max, poor_min, unit, direction, source)
ON t.slug = b.slug

ON CONFLICT (test_definition_id, metric, population) DO UPDATE SET
  elite_max    = EXCLUDED.elite_max,
  average_min  = EXCLUDED.average_min,
  average_max  = EXCLUDED.average_max,
  poor_min     = EXCLUDED.poor_min,
  unit         = EXCLUDED.unit,
  direction    = EXCLUDED.direction,
  source       = EXCLUDED.source;

-- ============================================================
-- 7. VALIDATION POST-SEED
-- Avertissement si moins de 13 tests ont des benchmarks
-- ============================================================
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT count(DISTINCT test_definition_id)
  INTO v_count
  FROM public.cognitive_benchmarks
  WHERE population = 'general_adult';

  IF v_count < 13 THEN
    RAISE WARNING '[step-28] Seulement % tests ont des benchmarks general_adult (attendu : 13). Vérifier les slugs dans la migration.', v_count;
  ELSE
    RAISE NOTICE '[step-28] OK — % tests avec benchmarks general_adult.', v_count;
  END IF;
END $$;
