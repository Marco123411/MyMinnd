-- =====================================================================
-- MVP cleanup — Phase 4
-- =====================================================================
-- Objectif :
--   1. Retirer les colonnes / contraintes / table résiduelles que la
--      Phase 3 a laissées en BDD (côté code, tout est déjà nettoyé).
--   2. Drop des tables des features supprimées du MVP : bloc cognitif,
--      marketplace experts, profile intelligence avancé.
--
-- Pré-requis :
--   - Phases 1, 2, 3 mergées sur mvp-launch.
--   - Audit `mvp-cleanup/phase-4-audit-fk.sql` exécuté ; aucune
--     dépendance résiduelle hors de celles traitées ici (FK formelles,
--     vues, fonctions, triggers, policies, defaults, generated cols).
--   - Backup BDD < 24h.
--   - Migration appliquée sur staging avant la prod.
--
-- Notes :
--   - Pas de CASCADE : les FK résiduelles depuis des tables conservées
--     sont retirées explicitement en première section, et l'ordre des
--     DROP TABLE respecte les FK internes au domaine retiré.
--   - `cognitive_test_presets` n'apparaissait pas dans la liste
--     initiale de la spec (mvp-cleanup/phase-4-bdd.md) mais sa raison
--     d'être est entièrement liée au domaine cognitif → drop, intercalé
--     entre `cognitive_sessions` (qui a une FK vers presets via
--     preset_id) et `cognitive_test_definitions`.
-- =====================================================================

-- Garde-fous : éviter qu'un long verrou concurrent ne fasse stampede.
-- Si un autre process tient un AccessShare > 5s, la migration
-- échoue proprement plutôt que de bloquer toute l'app.
SET lock_timeout      = '5s';
SET statement_timeout = '120s';

BEGIN;

-- =====================================================================
-- 0. Pré-flight : nettoyer les rows qui violeraient les CHECK
--    reconstruits plus bas. Comptages logués pour audit.
-- =====================================================================

DO $$
DECLARE
  cognitif_rows int;
  one_fk_zero_rows int;
  pe_cognitive_rows int;
BEGIN
  SELECT count(*) INTO cognitif_rows
    FROM public.programme_etapes
    WHERE type_seance = 'cognitif';
  RAISE NOTICE 'programme_etapes rows with type_seance=cognitif: %', cognitif_rows;

  -- Rows qui n'ont aucun FK de séance non-cognitive : après DROP COLUMN
  -- cognitive_session_id elles violeraient programme_etapes_one_fk.
  SELECT count(*) INTO one_fk_zero_rows
    FROM public.programme_etapes
    WHERE cabinet_session_id    IS NULL
      AND autonomous_session_id IS NULL
      AND recurring_template_id IS NULL;
  RAISE NOTICE 'programme_etapes rows with no kept FK (will be deleted): %', one_fk_zero_rows;

  SELECT count(*) INTO pe_cognitive_rows
    FROM public.program_exercises
    WHERE cognitive_test_id IS NOT NULL;
  RAISE NOTICE 'program_exercises rows linked to a cognitive test (preserved as orphan shells): %', pe_cognitive_rows;
END $$;

-- Suppression des rows orphelines de programme_etapes (cognitif-only).
-- Justification : la feature cognitive est retirée du MVP ; ces étapes
-- n'ont plus de cible. Les autres tables de séance (cabinet, autonome,
-- recurring) restent conservées.
DELETE FROM public.programme_etapes
 WHERE cabinet_session_id    IS NULL
   AND autonomous_session_id IS NULL
   AND recurring_template_id IS NULL;


-- =====================================================================
-- 1. Colonnes / contraintes résiduelles sur les tables CONSERVÉES
-- =====================================================================

-- 1.a programme_etapes : la colonne `cognitive_session_id` et la
--      valeur 'cognitif' du `type_seance` sont devenues obsolètes.
ALTER TABLE public.programme_etapes
  DROP CONSTRAINT IF EXISTS programme_etapes_one_fk;

ALTER TABLE public.programme_etapes
  DROP CONSTRAINT IF EXISTS programme_etapes_type_seance_check;

DROP INDEX IF EXISTS public.idx_programme_etapes_cognitive_session_id;

ALTER TABLE public.programme_etapes
  DROP COLUMN IF EXISTS cognitive_session_id;

-- Reconstruire les CHECK sans la dimension cognitive. Pattern
-- NOT VALID + VALIDATE pour minimiser le verrou : NOT VALID prend
-- ACCESS EXCLUSIVE bref, VALIDATE prend SHARE UPDATE EXCLUSIVE
-- (lectures/écritures concurrentes possibles).
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


-- 1.b program_exercises : retirer les colonnes liées au domaine
--      cognitif. La table elle-même est conservée (anticipée pour
--      d'autres outils PM) mais les colonnes cognitives n'ont plus
--      de cible.
ALTER TABLE public.program_exercises
  DROP CONSTRAINT IF EXISTS chk_pe_cognitive_requires_phase;

DROP INDEX IF EXISTS public.idx_program_exercises_cognitive_test_id;

ALTER TABLE public.program_exercises
  DROP COLUMN IF EXISTS preset_id;

ALTER TABLE public.program_exercises
  DROP COLUMN IF EXISTS cognitive_test_id;


-- =====================================================================
-- 2. Bloc cognitif (ordre : enfants → presets/benchmarks → définitions)
-- -- cognitive_test_presets et cognitive_benchmarks pointent vers
--    cognitive_test_definitions ; cognitive_sessions.preset_id pointe
--    vers cognitive_test_presets. Ordre :
--      trials → sessions → baselines → normative_stats →
--      presets → benchmarks → definitions.
-- -- cognitive_benchmarks (seuils normatifs Elite/Average/Poor) avait
--    été oubliée dans la liste initiale de la spec.
-- =====================================================================
DROP TABLE IF EXISTS public.cognitive_trials;
DROP TABLE IF EXISTS public.cognitive_sessions;
DROP TABLE IF EXISTS public.cognitive_baselines;
DROP TABLE IF EXISTS public.cognitive_normative_stats;
DROP TABLE IF EXISTS public.cognitive_test_presets;
DROP TABLE IF EXISTS public.cognitive_benchmarks;
DROP TABLE IF EXISTS public.cognitive_test_definitions;


-- =====================================================================
-- 3. Liaison programmes ↔ cognitif (table de jointure orpheline)
-- =====================================================================
DROP TABLE IF EXISTS public.program_exercise_cognitive_types;


-- =====================================================================
-- 4. Marketplace experts
-- =====================================================================
DROP TABLE IF EXISTS public.expert_profiles;


-- =====================================================================
-- 5. Profile intelligence avancé
-- =====================================================================
DROP TABLE IF EXISTS public.profile_intelligence;
DROP TABLE IF EXISTS public.profile_centroids;
DROP TABLE IF EXISTS public.profile_compatibility;
DROP TABLE IF EXISTS public.study_reference_data;
DROP TABLE IF EXISTS public.elite_markers;
DROP TABLE IF EXISTS public.global_predictors;


COMMIT;

RESET lock_timeout;
RESET statement_timeout;
