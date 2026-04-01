-- Étape 17 : Module cognitif — Schema BDD + Seed 5 tests cognitifs
--
-- Tables :
--   cognitive_test_definitions  : définitions des tests (config JSON, métriques)
--   cognitive_sessions          : sessions par utilisateur (statut, métriques calculées)
--   cognitive_trials            : données brutes par trial (RT en millisecondes)
--   cognitive_normative_stats   : base normative par métrique (pour les futurs percentiles)

-- ============================================================
-- 1. TABLE cognitive_test_definitions
-- Catalogue des tests cognitifs disponibles (config = source de vérité)
-- ============================================================

CREATE TABLE public.cognitive_test_definitions (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  slug             varchar(50)  NOT NULL UNIQUE,
  name             varchar(200) NOT NULL,
  description      text,
  duration_minutes integer      NOT NULL,
  trial_based      boolean      NOT NULL,
  metrics_config   jsonb        NOT NULL,
  -- normative_n indique la taille cible de la base normative.
  -- La base normative réelle est dans cognitive_normative_stats.
  -- normative_n = 0 signifie qu'aucune donnée normative n'est encore disponible.
  normative_n      integer      DEFAULT 0,
  is_active        boolean      DEFAULT true,
  price_cents      integer      DEFAULT 0,
  instructions_fr  text,
  config           jsonb,
  created_at       timestamptz  DEFAULT now()
);

ALTER TABLE public.cognitive_test_definitions ENABLE ROW LEVEL SECURITY;

-- Lecture publique pour tous les utilisateurs authentifiés (catalogue)
-- Écriture réservée au service_role uniquement (seed + admin ops)
CREATE POLICY "cognitive_test_definitions_authenticated_select"
  ON public.cognitive_test_definitions FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- 2. TABLE cognitive_sessions
-- Une session = une passation d'un test cognitif par un utilisateur
-- ============================================================

CREATE TABLE public.cognitive_sessions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cognitive_test_id uuid        NOT NULL REFERENCES public.cognitive_test_definitions(id),
  -- coach_id est assigné uniquement côté serveur (service_role) — jamais par le client
  coach_id          uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  -- started_at est nullable : NULL = session créée mais pas encore démarrée (statut pending)
  -- Mis à jour automatiquement par le trigger ci-dessous lors de la transition pending → in_progress
  started_at        timestamptz,
  completed_at      timestamptz,
  status            varchar(20) DEFAULT 'pending'
                      CHECK (status IN ('pending', 'in_progress', 'completed', 'abandoned')),
  device_info       jsonb,
  -- computed_metrics est mis à jour uniquement côté serveur (service_role ou SECURITY DEFINER)
  computed_metrics  jsonb,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

CREATE INDEX idx_cognitive_sessions_user_id           ON public.cognitive_sessions(user_id);
CREATE INDEX idx_cognitive_sessions_cognitive_test_id ON public.cognitive_sessions(cognitive_test_id);
CREATE INDEX idx_cognitive_sessions_coach_id          ON public.cognitive_sessions(coach_id);
-- Index composite pour les requêtes "historique d'un test par utilisateur"
CREATE INDEX idx_cognitive_sessions_user_test         ON public.cognitive_sessions(user_id, cognitive_test_id);
-- Index partiel unique : un seul session active (pending/in_progress) par (user, test) à la fois
CREATE UNIQUE INDEX idx_cognitive_sessions_one_active
  ON public.cognitive_sessions(user_id, cognitive_test_id)
  WHERE status IN ('pending', 'in_progress');

-- Trigger : met à jour updated_at automatiquement
CREATE TRIGGER trg_cognitive_sessions_updated_at
  BEFORE UPDATE ON public.cognitive_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger : machine d'état pour les transitions de statut + gestion de started_at
CREATE OR REPLACE FUNCTION enforce_cognitive_session_transitions()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Transitions valides uniquement
  IF OLD.status = 'pending' AND NEW.status NOT IN ('in_progress', 'abandoned') THEN
    RAISE EXCEPTION 'Transition de statut invalide : % → %', OLD.status, NEW.status;
  END IF;
  IF OLD.status = 'in_progress' AND NEW.status NOT IN ('completed', 'abandoned') THEN
    RAISE EXCEPTION 'Transition de statut invalide : % → %', OLD.status, NEW.status;
  END IF;
  IF OLD.status IN ('completed', 'abandoned') THEN
    RAISE EXCEPTION 'Session terminée — statut immuable : %', OLD.status;
  END IF;

  -- Définit started_at lors du démarrage effectif du test
  IF OLD.status = 'pending' AND NEW.status = 'in_progress' AND NEW.started_at IS NULL THEN
    NEW.started_at := now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cognitive_session_state_machine
  BEFORE UPDATE ON public.cognitive_sessions
  FOR EACH ROW EXECUTE FUNCTION enforce_cognitive_session_transitions();

ALTER TABLE public.cognitive_sessions ENABLE ROW LEVEL SECURITY;

-- Le client voit ses propres sessions
CREATE POLICY "cognitive_sessions_client_select"
  ON public.cognitive_sessions FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

-- Le client peut créer des sessions pour lui-même uniquement.
-- coach_id NE PEUT PAS être défini par le client (REVOKE ci-dessous).
CREATE POLICY "cognitive_sessions_client_insert"
  ON public.cognitive_sessions FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Le client peut mettre à jour uniquement son propre statut et device_info.
-- Les colonnes sensibles (computed_metrics, user_id, coach_id...) sont révoquées ci-dessous.
CREATE POLICY "cognitive_sessions_client_update"
  ON public.cognitive_sessions FOR UPDATE
  USING ((SELECT auth.uid()) = user_id);

-- Le coach voit les sessions de ses clients (via table clients)
CREATE POLICY "cognitive_sessions_coach_select"
  ON public.cognitive_sessions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.user_id  = cognitive_sessions.user_id
        AND c.coach_id = (SELECT auth.uid())
    )
  );

-- L'admin voit tout
CREATE POLICY "cognitive_sessions_admin_select"
  ON public.cognitive_sessions FOR SELECT
  USING (public.get_my_role() = 'admin');

-- Colonnes protégées contre la modification directe par le client :
-- computed_metrics : calculé côté serveur uniquement
-- user_id, cognitive_test_id, coach_id : immuables post-création
-- created_at, started_at : gérés par triggers
REVOKE UPDATE (computed_metrics, user_id, cognitive_test_id, coach_id, created_at)
  ON public.cognitive_sessions FROM authenticated;

-- coach_id ne peut pas être défini par le client à l'insertion non plus
REVOKE INSERT (coach_id, computed_metrics)
  ON public.cognitive_sessions FROM authenticated;

-- ============================================================
-- 3. TABLE cognitive_trials
-- Un trial = une épreuve individuelle dans une session (données brutes)
-- ============================================================

CREATE TABLE public.cognitive_trials (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       uuid        NOT NULL REFERENCES public.cognitive_sessions(id) ON DELETE CASCADE,
  trial_index      integer     NOT NULL CHECK (trial_index >= 0),
  stimulus_type    varchar(50),
  stimulus_data    jsonb,
  response_data    jsonb,
  reaction_time_ms integer     CHECK (reaction_time_ms IS NULL OR reaction_time_ms >= 0),
  is_correct       boolean,
  is_anticipation  boolean     DEFAULT false,
  is_lapse         boolean     DEFAULT false,
  recorded_at      timestamptz NOT NULL DEFAULT now()
);

-- Index unique pour garantir l'ordre et éviter les doublons
CREATE UNIQUE INDEX idx_cognitive_trials_session_index ON public.cognitive_trials(session_id, trial_index);
-- Index simple pour les requêtes de chargement d'une session complète
CREATE INDEX idx_cognitive_trials_session_id ON public.cognitive_trials(session_id);

ALTER TABLE public.cognitive_trials ENABLE ROW LEVEL SECURITY;

-- Le client peut lire les trials de ses propres sessions
CREATE POLICY "cognitive_trials_client_select"
  ON public.cognitive_trials FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cognitive_sessions s
      WHERE s.id      = cognitive_trials.session_id
        AND s.user_id = (SELECT auth.uid())
    )
  );

-- Le client peut insérer des trials uniquement pour ses sessions in_progress
CREATE POLICY "cognitive_trials_client_insert"
  ON public.cognitive_trials FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cognitive_sessions s
      WHERE s.id      = cognitive_trials.session_id
        AND s.user_id = (SELECT auth.uid())
        AND s.status  = 'in_progress'
    )
  );

-- Le coach voit les trials de ses clients (via sessions → clients)
CREATE POLICY "cognitive_trials_coach_select"
  ON public.cognitive_trials FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cognitive_sessions s
      JOIN public.clients c ON c.user_id = s.user_id
      WHERE s.id       = cognitive_trials.session_id
        AND c.coach_id = (SELECT auth.uid())
    )
  );

-- L'admin voit tout
CREATE POLICY "cognitive_trials_admin_select"
  ON public.cognitive_trials FOR SELECT
  USING (public.get_my_role() = 'admin');

-- ============================================================
-- 4. TABLE cognitive_normative_stats
-- Base normative par métrique — nécessaire pour calculer les percentiles futurs.
-- Écriture réservée au service_role uniquement.
-- ============================================================

CREATE TABLE public.cognitive_normative_stats (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cognitive_test_id uuid        NOT NULL REFERENCES public.cognitive_test_definitions(id),
  metric_key        varchar(50) NOT NULL,
  mean              real        NOT NULL,
  std_dev           real        NOT NULL CHECK (std_dev > 0),
  sample_size       integer     NOT NULL,
  updated_at        timestamptz DEFAULT now(),
  UNIQUE (cognitive_test_id, metric_key)
);

ALTER TABLE public.cognitive_normative_stats ENABLE ROW LEVEL SECURITY;

-- Lecture publique pour les utilisateurs authentifiés
-- Écriture réservée au service_role (migrations + collecte normative)
CREATE POLICY "cognitive_normative_stats_authenticated_select"
  ON public.cognitive_normative_stats FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- 5. SEED — 5 définitions de tests cognitifs
--
-- normative_n = 0 pour tous : les données normatives (cognitive_normative_stats)
-- seront seedées séparément lorsque les études normatives seront disponibles.
-- Les valeurs scientifiques cibles sont documentées dans les commentaires.
-- ============================================================

INSERT INTO public.cognitive_test_definitions
  (slug, name, description, duration_minutes, trial_based, normative_n, price_cents, instructions_fr, config, metrics_config)
VALUES
  -- PVT : Psychomotor Vigilance Task (test de vigilance et fatigue)
  -- Référence normative cible : n=236
  (
    'pvt',
    'Test de Vigilance PVT',
    'Mesure votre niveau de vigilance et de fatigue mentale. Réagissez le plus vite possible quand le compteur apparaît.',
    20,
    true,
    0,
    0,
    'Un compteur va apparaître à des intervalles aléatoires. Dès que vous le voyez, appuyez le plus vite possible. Le test dure 20 minutes. Restez concentré.',
    '{"duration_seconds": 1200, "min_isi_ms": 2000, "max_isi_ms": 10000, "anticipation_threshold_ms": 100, "lapse_threshold_ms": 500}',
    '[
      {"key": "median_rt",          "label": "RT Médian",              "unit": "ms",    "description": "Médiane des RT valides"},
      {"key": "mean_rt",            "label": "RT Moyen",               "unit": "ms",    "description": "Moyenne des RT valides"},
      {"key": "mean_reciprocal_rt", "label": "Moyenne 1/RT",           "unit": "1/ms",  "description": "Sensible aux lapses"},
      {"key": "fastest_10pct_rt",   "label": "10% les plus rapides",   "unit": "ms",    "description": "Décile le plus rapide"},
      {"key": "slowest_10pct_rt",   "label": "10% les plus lents",     "unit": "ms",    "description": "Décile le plus lent"},
      {"key": "lapse_count",        "label": "Nombre de lapses",       "unit": "count", "description": "RT > 500ms"},
      {"key": "false_start_count",  "label": "Fausses alertes",        "unit": "count", "description": "RT < 100ms"},
      {"key": "cv",                 "label": "Coefficient de variation","unit": "%",     "description": "SD(RT) / Mean(RT) × 100"}
    ]'
  ),

  -- Stroop : test d'inhibition cognitive (couleur vs mot)
  -- Référence normative cible : n=1073
  (
    'stroop',
    'The Stroop Test',
    'Évalue votre capacité à sélectionner des informations pertinentes malgré la présence de distracteurs.',
    5,
    true,
    0,
    0,
    'Des mots de couleur vont apparaître. Identifiez la COULEUR DE L''ENCRE (pas le mot écrit). Répondez le plus vite possible sans faire d''erreur.',
    '{"colors": ["rouge", "bleu", "vert", "jaune"], "trials_per_condition": 24, "conditions": ["congruent", "incongruent", "neutral"], "fixation_ms": 500, "max_response_ms": 3000}',
    '[
      {"key": "mean_rt_congruent",      "label": "RT Congruent",             "unit": "ms"},
      {"key": "mean_rt_incongruent",    "label": "RT Incongruent",           "unit": "ms"},
      {"key": "stroop_effect_rt",       "label": "Effet Stroop (RT)",        "unit": "ms", "description": "RT Incong. - RT Cong."},
      {"key": "accuracy_congruent",     "label": "Précision Congruent",      "unit": "%"},
      {"key": "accuracy_incongruent",   "label": "Précision Incongruent",    "unit": "%"},
      {"key": "stroop_effect_accuracy", "label": "Effet Stroop (précision)", "unit": "%"},
      {"key": "inverse_efficiency",     "label": "Inverse Efficiency Score", "unit": "ms", "description": "RT / Précision"}
    ]'
  ),

  -- Simon Task : test d'interférence spatiale
  -- Référence normative cible : n=678
  (
    'simon',
    'The Simon Task Test',
    'Mesure l''effet de l''interférence spatiale sur la vitesse et la précision de la réponse.',
    10,
    true,
    0,
    0,
    'Un stimulus va apparaître à gauche ou à droite de l''écran. Répondez selon la RÈGLE (couleur ou forme), pas selon la position. Ignorez la position.',
    '{"trials_per_condition": 30, "conditions": ["congruent", "incongruent"], "stimulus_positions": ["left", "right"], "fixation_ms": 500, "max_response_ms": 2000}',
    '[
      {"key": "mean_rt_congruent",     "label": "RT Congruent",            "unit": "ms"},
      {"key": "mean_rt_incongruent",   "label": "RT Incongruent",          "unit": "ms"},
      {"key": "simon_effect_rt",       "label": "Effet Simon (RT)",        "unit": "ms"},
      {"key": "accuracy_congruent",    "label": "Précision Congruent",     "unit": "%"},
      {"key": "accuracy_incongruent",  "label": "Précision Incongruent",   "unit": "%"},
      {"key": "simon_effect_accuracy", "label": "Effet Simon (précision)", "unit": "%"}
    ]'
  ),

  -- Digital Span : test de mémoire de travail (séquences de chiffres)
  -- Référence normative cible : n=936
  (
    'digital_span',
    'Digital Span',
    'Évalue la mémoire de travail en mesurant votre capacité à mémoriser et reproduire des séquences de chiffres.',
    10,
    true,
    0,
    0,
    'Une séquence de chiffres va apparaître un par un. Mémorisez-les et reproduisez la séquence dans l''ordre (forward) ou en ordre inverse (backward).',
    '{"start_length": 3, "max_length": 12, "attempts_per_length": 2, "modes": ["forward", "backward"], "digit_display_ms": 1000, "inter_digit_ms": 300}',
    '[
      {"key": "span_forward",     "label": "Span Forward",        "unit": "digits", "description": "Max séquence correcte forward"},
      {"key": "span_backward",    "label": "Span Backward",       "unit": "digits", "description": "Max séquence correcte backward"},
      {"key": "total_span",       "label": "Span Total",          "unit": "digits", "description": "Forward + Backward"},
      {"key": "longest_sequence", "label": "Plus longue séquence","unit": "digits"},
      {"key": "global_accuracy",  "label": "Précision globale",   "unit": "%"}
    ]'
  ),

  -- Questionnaire Cognitif et Attentionnel (Likert 1-10, non trial-based)
  -- Note : ce test n'a pas de métriques calculées via le module cognitif.
  -- Il pourrait être migré vers test_definitions (moteur de profilage générique)
  -- si son arborescence de compétences est définie.
  (
    'questionnaire_cognitif',
    'Questionnaire Cognitif et Attentionnel',
    'Dresse votre profil cognitif et attentionnel pour identifier vos leviers de progression.',
    15,
    false,
    0,
    0,
    'Répondez aux questions suivantes en évaluant chaque affirmation sur une échelle de 1 à 10.',
    '{"note": "Ce test est un questionnaire Likert, pas un test trial-based. Il pourrait être migré dans le moteur de profilage générique (test_definitions) si son arborescence de compétences est définie."}',
    '[]'
  );
