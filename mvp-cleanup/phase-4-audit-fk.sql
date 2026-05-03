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

SELECT 'cognitive_trials'             AS table_name, count(*) FROM public.cognitive_trials
UNION ALL SELECT 'cognitive_sessions',        count(*) FROM public.cognitive_sessions
UNION ALL SELECT 'cognitive_baselines',       count(*) FROM public.cognitive_baselines
UNION ALL SELECT 'cognitive_normative_stats', count(*) FROM public.cognitive_normative_stats
UNION ALL SELECT 'cognitive_test_definitions',count(*) FROM public.cognitive_test_definitions
UNION ALL SELECT 'cognitive_test_presets',    count(*) FROM public.cognitive_test_presets
UNION ALL SELECT 'program_exercise_cognitive_types', count(*) FROM public.program_exercise_cognitive_types
UNION ALL SELECT 'expert_profiles',           count(*) FROM public.expert_profiles
UNION ALL SELECT 'profile_intelligence',      count(*) FROM public.profile_intelligence
UNION ALL SELECT 'profile_centroids',         count(*) FROM public.profile_centroids
UNION ALL SELECT 'profile_compatibility',     count(*) FROM public.profile_compatibility
UNION ALL SELECT 'study_reference_data',      count(*) FROM public.study_reference_data
UNION ALL SELECT 'elite_markers',             count(*) FROM public.elite_markers
UNION ALL SELECT 'global_predictors',         count(*) FROM public.global_predictors
ORDER BY table_name;


-- ── 10. État des colonnes simplifiables (Tâche 4.3) ──────────────────
-- Aide au mapping business avant écriture de la migration de
-- simplification.

SELECT 'dispatches.status' AS column, status AS value, count(*) AS rows
FROM public.dispatches
GROUP BY status
ORDER BY count(*) DESC;

-- payments : la colonne réelle s'appelle `type` (pas `tier`). Confirmer
-- l'intention business avec l'utilisateur si la spec parle de `tier`.
SELECT 'payments.type' AS column, type AS value, count(*) AS rows
FROM public.payments
GROUP BY type
ORDER BY count(*) DESC;
