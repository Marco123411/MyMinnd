-- =====================================================================
-- Phase 4 — Audit live (Tâche 4.1)
-- =====================================================================
-- Usage : à exécuter dans le SQL editor Supabase ou via psql AVANT
-- d'appliquer la migration 20260503120000_mvp_cleanup_drop_unused_tables.
--
-- Objectif : surfacer toute dépendance résiduelle (FK formelles,
-- colonnes "soft", vues, fonctions, triggers, RLS policies, defaults,
-- generated columns) qui pourrait :
--   (a) bloquer un DROP TABLE / DROP COLUMN au moment de la migration ;
--   (b) ou laisser un objet runtime cassé après la migration (trigger
--       qui référence une table droppée, fonction RPC, vue, etc.).
--
-- Critère STOP : si une dépendance est trouvée depuis un objet conservé
-- AUTRE que celles déjà documentées et traitées dans la migration
-- (programme_etapes.cognitive_session_id,
-- program_exercises.cognitive_test_id, program_exercises.preset_id,
-- cognitive_test_presets), arrêter et signaler à un développeur. Cela
-- signifie qu'une dépendance n'a pas été retirée en Phase 3 ni couverte
-- par la migration.
-- =====================================================================


-- ── 1. FK formelles pointant vers chaque table à drop ────────────────

WITH cibles(t) AS (VALUES
  ('cognitive_trials'),
  ('cognitive_sessions'),
  ('cognitive_baselines'),
  ('cognitive_normative_stats'),
  ('cognitive_test_definitions'),
  ('cognitive_test_presets'),
  ('program_exercise_cognitive_types'),
  ('expert_profiles'),
  ('profile_intelligence'),
  ('profile_centroids'),
  ('profile_compatibility'),
  ('study_reference_data'),
  ('elite_markers'),
  ('global_predictors')
)
SELECT
  ccu.table_name  AS referenced_table,
  tc.table_name   AS dependent_table,
  kcu.column_name AS dependent_column,
  tc.constraint_name
FROM information_schema.table_constraints      AS tc
JOIN information_schema.key_column_usage       AS kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema    = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
 AND ccu.table_schema    = tc.table_schema
JOIN cibles
  ON cibles.t = ccu.table_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema    = 'public'
ORDER BY ccu.table_name, tc.table_name;


-- ── 2. Colonnes "soft" (sans FK) au nom suspect sur tables conservées ─
-- Détecte un éventuel `expert_id uuid` ou `cognitive_baseline_id uuid`
-- ajouté sans FK formelle qui resterait orphelin après les DROP.

SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name NOT IN (
    'cognitive_trials','cognitive_sessions','cognitive_baselines',
    'cognitive_normative_stats','cognitive_test_definitions',
    'cognitive_test_presets','program_exercise_cognitive_types',
    'expert_profiles','profile_intelligence','profile_centroids',
    'profile_compatibility','study_reference_data','elite_markers',
    'global_predictors'
  )
  AND (
    column_name ~ '\m(cognitive|expert|centroid|intelligence|elite|predictor|study_reference)\M'
    OR column_name = 'preset_id'
  )
ORDER BY table_name, column_name;


-- ── 3. Vues / vues matérialisées dépendantes ──────────────────────────

SELECT n.nspname AS schema, c.relname AS view_name, c.relkind
FROM pg_depend d
JOIN pg_class     c ON c.oid = d.objid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_class     t ON t.oid = d.refobjid
WHERE c.relkind IN ('v','m')
  AND t.relname IN (
    'cognitive_trials','cognitive_sessions','cognitive_baselines',
    'cognitive_normative_stats','cognitive_test_definitions',
    'cognitive_test_presets','program_exercise_cognitive_types',
    'expert_profiles','profile_intelligence','profile_centroids',
    'profile_compatibility','study_reference_data','elite_markers',
    'global_predictors'
  )
GROUP BY n.nspname, c.relname, c.relkind;


-- ── 4. Fonctions PL/pgSQL référençant les tables à drop ───────────────

SELECT n.nspname AS schema, p.proname AS routine_name
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosrc ~ '\m(cognitive_trials|cognitive_sessions|cognitive_baselines|cognitive_normative_stats|cognitive_test_definitions|cognitive_test_presets|program_exercise_cognitive_types|expert_profiles|profile_intelligence|profile_centroids|profile_compatibility|study_reference_data|elite_markers|global_predictors)\M';


-- ── 5. Triggers liés à des fonctions qui référencent les tables ───────
-- Une fonction matchée en (4) attachée à un trigger sur table conservée
-- casse les writes après la migration.

SELECT
  c.relname  AS on_table,
  t.tgname   AS trigger_name,
  p.proname  AS function_name
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_proc  p ON p.oid = t.tgfoid
WHERE NOT t.tgisinternal
  AND p.prosrc ~ '\m(cognitive_trials|cognitive_sessions|cognitive_baselines|cognitive_normative_stats|cognitive_test_definitions|cognitive_test_presets|program_exercise_cognitive_types|expert_profiles|profile_intelligence|profile_centroids|profile_compatibility|study_reference_data|elite_markers|global_predictors)\M';


-- ── 6. Policies RLS référençant les tables à drop ─────────────────────
-- Une policy USING/WITH CHECK sur une table conservée bloquera le DROP
-- de la table référencée dans son expression.

SELECT
  c.relname  AS on_table,
  pol.polname,
  pg_get_expr(pol.polqual,      pol.polrelid) AS using_expr,
  pg_get_expr(pol.polwithcheck, pol.polrelid) AS check_expr
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
WHERE pg_get_expr(pol.polqual, pol.polrelid)      ~ '\m(cognitive_trials|cognitive_sessions|cognitive_baselines|cognitive_normative_stats|cognitive_test_definitions|cognitive_test_presets|program_exercise_cognitive_types|expert_profiles|profile_intelligence|profile_centroids|profile_compatibility|study_reference_data|elite_markers|global_predictors)\M'
   OR pg_get_expr(pol.polwithcheck, pol.polrelid) ~ '\m(cognitive_trials|cognitive_sessions|cognitive_baselines|cognitive_normative_stats|cognitive_test_definitions|cognitive_test_presets|program_exercise_cognitive_types|expert_profiles|profile_intelligence|profile_centroids|profile_compatibility|study_reference_data|elite_markers|global_predictors)\M';


-- ── 7. Defaults de colonnes référençant les tables à drop ─────────────

SELECT table_name, column_name, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_default IS NOT NULL
  AND column_default ~ '\m(cognitive_trials|cognitive_sessions|cognitive_baselines|cognitive_normative_stats|cognitive_test_definitions|cognitive_test_presets|program_exercise_cognitive_types|expert_profiles|profile_intelligence|profile_centroids|profile_compatibility|study_reference_data|elite_markers|global_predictors)\M';


-- ── 8. Generated columns référençant les tables à drop ────────────────

SELECT table_name, column_name, generation_expression
FROM information_schema.columns
WHERE table_schema = 'public'
  AND generation_expression IS NOT NULL
  AND generation_expression ~ '\m(cognitive_trials|cognitive_sessions|cognitive_baselines|cognitive_normative_stats|cognitive_test_definitions|cognitive_test_presets|program_exercise_cognitive_types|expert_profiles|profile_intelligence|profile_centroids|profile_compatibility|study_reference_data|elite_markers|global_predictors)\M';


-- ── 9. Volumes de données qui seront détruits ─────────────────────────
-- Information uniquement, pas un blocage. Permet à l'utilisateur de
-- décider si une sauvegarde additionnelle des données métier vaut le
-- coup avant DROP (par ex. exporter en CSV).
--
-- Tolérant aux tables absentes : si une table de la liste n'existe pas
-- dans la BDD, l'audit le signale au lieu d'échouer. Les résultats
-- apparaissent dans l'onglet "Results" (Supabase SQL editor) ou en
-- sortie de psql.

DROP TABLE IF EXISTS pg_temp.phase4_audit_volumes;
CREATE TEMP TABLE pg_temp.phase4_audit_volumes (
  table_name text PRIMARY KEY,
  row_count  bigint,
  status     text
);

DO $$
DECLARE
  t text;
  n bigint;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'cognitive_trials','cognitive_sessions','cognitive_baselines',
    'cognitive_normative_stats','cognitive_test_definitions',
    'cognitive_test_presets','program_exercise_cognitive_types',
    'expert_profiles','profile_intelligence','profile_centroids',
    'profile_compatibility','study_reference_data','elite_markers',
    'global_predictors'
  ]) LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      INSERT INTO pg_temp.phase4_audit_volumes VALUES (t, NULL, 'table absente');
    ELSE
      EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
      INSERT INTO pg_temp.phase4_audit_volumes VALUES (t, n, 'présente');
    END IF;
  END LOOP;
END $$;

SELECT table_name, row_count, status
FROM pg_temp.phase4_audit_volumes
ORDER BY table_name;


-- ── 10. État des colonnes simplifiables (Phase 5) ────────────────────
-- Aide au mapping business pour la phase de simplification reportée
-- (mvp-cleanup/phase-5-simplifications.md). Tolérant aux tables
-- absentes : la table dispatches ou payments peut ne pas encore
-- exister dans toutes les BDD (dev local, projet pas migré, etc.).

DROP TABLE IF EXISTS pg_temp.phase4_audit_status_values;
CREATE TEMP TABLE pg_temp.phase4_audit_status_values (
  source     text,
  value      text,
  rows       bigint
);

DO $$
BEGIN
  IF to_regclass('public.dispatches') IS NULL THEN
    INSERT INTO pg_temp.phase4_audit_status_values
      VALUES ('dispatches.status', '(table absente)', NULL);
  ELSE
    EXECUTE $sql$
      INSERT INTO pg_temp.phase4_audit_status_values (source, value, rows)
      SELECT 'dispatches.status', status, count(*)
      FROM public.dispatches
      GROUP BY status
    $sql$;
  END IF;

  IF to_regclass('public.payments') IS NULL THEN
    INSERT INTO pg_temp.phase4_audit_status_values
      VALUES ('payments.type', '(table absente)', NULL);
  ELSE
    EXECUTE $sql$
      INSERT INTO pg_temp.phase4_audit_status_values (source, value, rows)
      SELECT 'payments.type', type, count(*)
      FROM public.payments
      GROUP BY type
    $sql$;
  END IF;
END $$;

SELECT source, value, rows
FROM pg_temp.phase4_audit_status_values
ORDER BY source, rows DESC NULLS FIRST;
