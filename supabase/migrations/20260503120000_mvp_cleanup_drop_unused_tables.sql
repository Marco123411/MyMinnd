-- =====================================================================
-- MVP cleanup — Phase 4
-- =====================================================================
-- Objectif :
--   1. Retirer les colonnes / contraintes / table résiduelles que la
--      Phase 3 a laissées en BDD (côté code, tout est déjà nettoyé).
--   2. Drop des tables des features supprimées du MVP : bloc cognitif,
--      marketplace experts, profile intelligence avancé.
--
-- Ordonnancement (important) :
--   1. Désarmer triggers/fonctions du domaine cognitif.
--   2. Retirer sur les tables conservées les colonnes/contraintes qui
--      pointent vers le domaine cognitif (libère les FK).
--   3. Drop des tables retirées du MVP (15 tables au total).
--   4. Nettoyer les programme_etapes orphelines.
--   5. Reconstruire les CHECK constraints sans la dimension cognitive.
--
-- Pourquoi cet ordre :
--   - Ne pas DELETE programme_etapes tant que cognitive_sessions vit :
--     une cascade (programme_etapes → program_exercises → cognitive_sessions
--     ON DELETE SET NULL) déclencherait des UPDATE sur cognitive_sessions
--     qui violent un index unique partiel (idx_cognitive_sessions_one_active)
--     ou un trigger de transition de statut.
--   - Une fois cognitive_sessions dropée, plus aucune cascade vers le
--     domaine cognitif ; le DELETE devient propre.
-- =====================================================================

-- Garde-fous : abandonner proprement si un long verrou concurrent.
SET lock_timeout      = '5s';
SET statement_timeout = '120s';

BEGIN;

-- =====================================================================
-- 1. Désarmer triggers / fonctions du domaine cognitif
-- =====================================================================
-- enforce_cognitive_session_transitions valide les transitions de
-- statut sur cognitive_sessions et bloquerait les UPDATE en cascade.
-- Drop avec CASCADE retire aussi tout trigger qui l'utilise. Les
-- tables cognitives sont dropées plus bas, donc la perte de la
-- fonction est sans effet.
DROP FUNCTION IF EXISTS public.enforce_cognitive_session_transitions() CASCADE;


-- =====================================================================
-- 2. Tables conservées : retirer les références au domaine cognitif
-- =====================================================================

-- 2.a programme_etapes : drop des contraintes et de la colonne FK.
--      On garde la table, mais on retire la dimension cognitive.
ALTER TABLE public.programme_etapes
  DROP CONSTRAINT IF EXISTS programme_etapes_one_fk;

ALTER TABLE public.programme_etapes
  DROP CONSTRAINT IF EXISTS programme_etapes_type_seance_check;

DROP INDEX IF EXISTS public.idx_programme_etapes_cognitive_session_id;

ALTER TABLE public.programme_etapes
  DROP COLUMN IF EXISTS cognitive_session_id;


-- 2.b program_exercises : drop des colonnes liées au domaine cognitif.
--      La table elle-même reste (anticipée pour d'autres outils PM).
ALTER TABLE public.program_exercises
  DROP CONSTRAINT IF EXISTS chk_pe_cognitive_requires_phase;

DROP INDEX IF EXISTS public.idx_program_exercises_cognitive_test_id;

ALTER TABLE public.program_exercises
  DROP COLUMN IF EXISTS preset_id;

ALTER TABLE public.program_exercises
  DROP COLUMN IF EXISTS cognitive_test_id;


-- =====================================================================
-- 3. Drop des tables hors MVP (15 tables)
-- =====================================================================

-- Bloc cognitif (ordre enfant → parent ; presets et benchmarks
-- pointent vers cognitive_test_definitions, donc en avant-dernier) :
DROP TABLE IF EXISTS public.cognitive_trials;
DROP TABLE IF EXISTS public.cognitive_sessions;
DROP TABLE IF EXISTS public.cognitive_baselines;
DROP TABLE IF EXISTS public.cognitive_normative_stats;
DROP TABLE IF EXISTS public.cognitive_test_presets;
DROP TABLE IF EXISTS public.cognitive_benchmarks;
DROP TABLE IF EXISTS public.cognitive_test_definitions;

-- Liaison programmes ↔ cognitif :
DROP TABLE IF EXISTS public.program_exercise_cognitive_types;

-- Marketplace experts :
DROP TABLE IF EXISTS public.expert_profiles;

-- Profile intelligence avancé :
DROP TABLE IF EXISTS public.profile_intelligence;
DROP TABLE IF EXISTS public.profile_centroids;
DROP TABLE IF EXISTS public.profile_compatibility;
DROP TABLE IF EXISTS public.study_reference_data;
DROP TABLE IF EXISTS public.elite_markers;
DROP TABLE IF EXISTS public.global_predictors;


-- =====================================================================
-- 4. Nettoyer les programme_etapes orphelines
-- =====================================================================
-- Maintenant que cognitive_sessions n'existe plus, plus aucune cascade
-- ne ricoche dans le domaine cognitif. Le DELETE est sûr.

DO $$
DECLARE
  cognitif_rows    int;
  one_fk_zero_rows int;
BEGIN
  SELECT count(*) INTO cognitif_rows
    FROM public.programme_etapes
    WHERE type_seance = 'cognitif';
  RAISE NOTICE 'programme_etapes rows with type_seance=cognitif: %', cognitif_rows;

  -- Rows sans aucun FK de séance non-cognitive après le DROP COLUMN.
  SELECT count(*) INTO one_fk_zero_rows
    FROM public.programme_etapes
    WHERE cabinet_session_id    IS NULL
      AND autonomous_session_id IS NULL
      AND recurring_template_id IS NULL;
  RAISE NOTICE 'programme_etapes rows with no kept FK (will be deleted): %', one_fk_zero_rows;
END $$;

DELETE FROM public.programme_etapes
 WHERE cabinet_session_id    IS NULL
   AND autonomous_session_id IS NULL
   AND recurring_template_id IS NULL;


-- =====================================================================
-- 5. Reconstruire les CHECK constraints sans la dimension cognitive
-- =====================================================================
-- Pattern NOT VALID + VALIDATE pour minimiser le verrou.

ALTER TABLE public.programme_etapes
  ADD CONSTRAINT programme_etapes_type_seance_check
    CHECK (type_seance IN ('cabinet', 'autonomie', 'recurrente'))
    NOT VALID;
ALTER TABLE public.programme_etapes
  VALIDATE CONSTRAINT programme_etapes_type_seance_check;

ALTER TABLE public.programme_etapes
  ADD CONSTRAINT programme_etapes_one_fk CHECK (
    (cabinet_session_id    IS NOT NULL)::int +
    (autonomous_session_id IS NOT NULL)::int +
    (recurring_template_id IS NOT NULL)::int = 1
  ) NOT VALID;
ALTER TABLE public.programme_etapes
  VALIDATE CONSTRAINT programme_etapes_one_fk;


COMMIT;

RESET lock_timeout;
RESET statement_timeout;
