-- Migration: Cognitive test presets
-- Presets nommés par test (admin globaux + personnels coach)
-- Config encapsulée — jamais exposée comme valeurs brutes dans l'UI

-- ============================================================
-- TABLE: cognitive_test_presets
-- ============================================================

CREATE TABLE public.cognitive_test_presets (
  id                    uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  cognitive_test_id     uuid         NOT NULL REFERENCES public.cognitive_test_definitions(id) ON DELETE CASCADE,
  slug                  varchar(100) NOT NULL,
  name                  varchar(200) NOT NULL,
  description           text,
  config                jsonb        NOT NULL,
  -- Validation scientifique
  is_validated          boolean      NOT NULL DEFAULT false,
  validation_reference  text,
  -- Propriété : NULL = preset global (admin), uuid = preset personnel du coach
  coach_id              uuid         REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active             boolean      NOT NULL DEFAULT true,
  created_at            timestamptz  NOT NULL DEFAULT now(),
  updated_at            timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (cognitive_test_id, slug, coach_id)
);

CREATE INDEX ON public.cognitive_test_presets (cognitive_test_id, is_active);
CREATE INDEX ON public.cognitive_test_presets (coach_id) WHERE coach_id IS NOT NULL;

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.cognitive_test_presets ENABLE ROW LEVEL SECURITY;

-- Lecture : presets globaux (coach_id IS NULL) ou presets du coach connecté
CREATE POLICY "coach_read_presets" ON public.cognitive_test_presets
  FOR SELECT USING (
    is_active = true AND (
      coach_id IS NULL
      OR coach_id = auth.uid()
    )
  );

-- Création : uniquement ses propres presets (coach_id = auth.uid()), non validés
CREATE POLICY "coach_create_own_presets" ON public.cognitive_test_presets
  FOR INSERT WITH CHECK (
    coach_id = auth.uid()
    AND is_validated = false
  );

-- Modification : uniquement ses propres presets, non validés
CREATE POLICY "coach_manage_own_presets" ON public.cognitive_test_presets
  FOR UPDATE USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid() AND is_validated = false);

-- Suppression : uniquement ses propres presets
CREATE POLICY "coach_delete_own_presets" ON public.cognitive_test_presets
  FOR DELETE USING (coach_id = auth.uid());

-- ============================================================
-- ALTER TABLE cognitive_sessions
-- Stocke le preset utilisé + la config résolue au moment de l'invitation
-- config_used est IMMUABLE après création
-- ============================================================

ALTER TABLE public.cognitive_sessions
  ADD COLUMN preset_id   uuid  REFERENCES public.cognitive_test_presets(id),
  ADD COLUMN config_used jsonb;

-- ============================================================
-- SEED : presets globaux par défaut
-- Scientifiquement validés ou non selon la littérature
-- ============================================================

-- PVT — Standard (10 min) — validé
INSERT INTO public.cognitive_test_presets
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
FROM public.cognitive_test_definitions WHERE slug = 'pvt';

-- PVT — Court (5 min) — validé
INSERT INTO public.cognitive_test_presets
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
FROM public.cognitive_test_definitions WHERE slug = 'pvt';

-- Stroop — Standard (24 essais/condition) — validé
INSERT INTO public.cognitive_test_presets
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
FROM public.cognitive_test_definitions WHERE slug = 'stroop';

-- Stroop — Rapide (12 essais/condition) — non validé
INSERT INTO public.cognitive_test_presets
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
FROM public.cognitive_test_definitions WHERE slug = 'stroop';

-- Simon — Standard (30 essais/condition) — validé
INSERT INTO public.cognitive_test_presets
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
FROM public.cognitive_test_definitions WHERE slug = 'simon';

-- Simon — Rapide (20 essais/condition) — non validé
INSERT INTO public.cognitive_test_presets
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
FROM public.cognitive_test_definitions WHERE slug = 'simon';

-- Digital Span — Standard (empan max 12) — validé
INSERT INTO public.cognitive_test_presets
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
FROM public.cognitive_test_definitions WHERE slug = 'digital_span';

-- Digital Span — Étendu (empan max 16) — non validé
INSERT INTO public.cognitive_test_presets
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
FROM public.cognitive_test_definitions WHERE slug = 'digital_span';
