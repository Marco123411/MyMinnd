-- =====================================================================
-- Phase 4 — Audit live (Tâche 4.1)
-- =====================================================================
-- Usage : copier-coller dans le SQL editor Supabase, lancer.
-- Le résultat final est UN SEUL tableau qui regroupe TOUTES les
-- sections d'audit avec une colonne "section" et "verdict".
--
-- Critère de lecture :
--   - section "9. volumes" : info uniquement
--   - section "10. dispatches/payments" : info pour Phase 5
--   - toutes les autres sections : doivent être vides ou ne contenir
--     QUE les dépendances déjà documentées dans la migration
--     (programme_etapes.cognitive_session_id,
--      program_exercises.cognitive_test_id,
--      program_exercises.preset_id,
--      cognitive_test_presets.cognitive_test_id).
--
-- Si une section "non-info" contient une ligne UNEXPECTED, STOP.
-- =====================================================================

DROP TABLE IF EXISTS pg_temp.phase4_audit;
CREATE TEMP TABLE pg_temp.phase4_audit (
  section text,
  detail  text,
  verdict text
);

-- ── 1. FK formelles pointant vers chaque table à drop ────────────────
INSERT INTO pg_temp.phase4_audit (section, detail, verdict)
WITH cibles(t) AS (VALUES
  ('cognitive_trials'),('cognitive_sessions'),('cognitive_baselines'),
  ('cognitive_normative_stats'),('cognitive_test_definitions'),
  ('cognitive_test_presets'),('cognitive_benchmarks'),
  ('program_exercise_cognitive_types'),
  ('expert_profiles'),('profile_intelligence'),('profile_centroids'),
  ('profile_compatibility'),('study_reference_data'),
  ('elite_markers'),('global_predictors')
)
SELECT
  '1. FK formelles',
  format('FK from %s.%s -> %s (constraint: %s)',
    tc.table_name, kcu.column_name, ccu.table_name, tc.constraint_name),
  CASE
    WHEN (tc.table_name, kcu.column_name) IN (
      ('programme_etapes','cognitive_session_id'),
      ('program_exercises','cognitive_test_id'),
      ('program_exercises','preset_id'),
      ('cognitive_test_presets','cognitive_test_id'),
      ('cognitive_sessions','preset_id')
    ) THEN 'OK (documenté dans la migration)'
    WHEN tc.table_name IN (
      'cognitive_trials','cognitive_sessions','cognitive_baselines',
      'cognitive_normative_stats','cognitive_test_definitions',
      'cognitive_test_presets','cognitive_benchmarks','program_exercise_cognitive_types',
      'expert_profiles','profile_intelligence','profile_centroids',
      'profile_compatibility','study_reference_data',
      'elite_markers','global_predictors'
    ) THEN 'OK (FK interne au domaine retiré)'
    ELSE '⛔ UNEXPECTED — dépendance résiduelle non traitée'
  END
FROM information_schema.table_constraints      AS tc
JOIN information_schema.key_column_usage       AS kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema    = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
 AND ccu.table_schema    = tc.table_schema
JOIN cibles ON cibles.t = ccu.table_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema    = 'public';


-- ── 2. Colonnes "soft" suspectes sur tables conservées ───────────────
INSERT INTO pg_temp.phase4_audit (section, detail, verdict)
SELECT
  '2. Colonnes soft suspectes',
  format('%s.%s (%s)', table_name, column_name, data_type),
  CASE
    WHEN (table_name, column_name) IN (
      ('programme_etapes','cognitive_session_id'),
      ('program_exercises','cognitive_test_id'),
      ('program_exercises','preset_id')
    ) THEN 'OK (sera retirée par la migration)'
    ELSE '⛔ UNEXPECTED — colonne soft hors-périmètre'
  END
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name NOT IN (
    'cognitive_trials','cognitive_sessions','cognitive_baselines',
    'cognitive_normative_stats','cognitive_test_definitions',
    'cognitive_test_presets','cognitive_benchmarks','program_exercise_cognitive_types',
    'expert_profiles','profile_intelligence','profile_centroids',
    'profile_compatibility','study_reference_data','elite_markers',
    'global_predictors'
  )
  AND (
    column_name ~ '\m(cognitive|expert|centroid|intelligence|elite|predictor|study_reference)\M'
    OR column_name = 'preset_id'
  );


-- ── 3. Vues / matérialisées dépendantes ──────────────────────────────
INSERT INTO pg_temp.phase4_audit (section, detail, verdict)
SELECT
  '3. Vues / matérialisées',
  format('%s.%s (kind=%s, depends on %s)', n.nspname, c.relname, c.relkind, t.relname),
  '⛔ UNEXPECTED — vue à supprimer ou réécrire avant migration'
FROM pg_depend d
JOIN pg_class     c ON c.oid = d.objid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_class     t ON t.oid = d.refobjid
WHERE c.relkind IN ('v','m')
  AND t.relname IN (
    'cognitive_trials','cognitive_sessions','cognitive_baselines',
    'cognitive_normative_stats','cognitive_test_definitions',
    'cognitive_test_presets','cognitive_benchmarks','program_exercise_cognitive_types',
    'expert_profiles','profile_intelligence','profile_centroids',
    'profile_compatibility','study_reference_data','elite_markers',
    'global_predictors'
  )
GROUP BY n.nspname, c.relname, c.relkind, t.relname;


-- ── 4. Fonctions PL/pgSQL référençant ces tables ─────────────────────
INSERT INTO pg_temp.phase4_audit (section, detail, verdict)
SELECT
  '4. Fonctions',
  format('%s.%s', n.nspname, p.proname),
  '⛔ UNEXPECTED — fonction à supprimer ou réécrire'
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosrc ~ '\m(cognitive_trials|cognitive_sessions|cognitive_baselines|cognitive_normative_stats|cognitive_test_definitions|cognitive_test_presets|cognitive_benchmarks|program_exercise_cognitive_types|expert_profiles|profile_intelligence|profile_centroids|profile_compatibility|study_reference_data|elite_markers|global_predictors)\M';


-- ── 5. Triggers liés à des fonctions concernées ──────────────────────
INSERT INTO pg_temp.phase4_audit (section, detail, verdict)
SELECT
  '5. Triggers',
  format('trigger %s on %s -> function %s', t.tgname, c.relname, p.proname),
  '⛔ UNEXPECTED — trigger qui cassera après la migration'
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_proc  p ON p.oid = t.tgfoid
WHERE NOT t.tgisinternal
  AND p.prosrc ~ '\m(cognitive_trials|cognitive_sessions|cognitive_baselines|cognitive_normative_stats|cognitive_test_definitions|cognitive_test_presets|cognitive_benchmarks|program_exercise_cognitive_types|expert_profiles|profile_intelligence|profile_centroids|profile_compatibility|study_reference_data|elite_markers|global_predictors)\M';


-- ── 6. Policies RLS référençant ces tables ────────────────────────────
INSERT INTO pg_temp.phase4_audit (section, detail, verdict)
SELECT
  '6. Policies RLS',
  format('policy %s on %s', pol.polname, c.relname),
  '⛔ UNEXPECTED — policy qui bloquera le DROP'
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
WHERE pg_get_expr(pol.polqual, pol.polrelid)      ~ '\m(cognitive_trials|cognitive_sessions|cognitive_baselines|cognitive_normative_stats|cognitive_test_definitions|cognitive_test_presets|cognitive_benchmarks|program_exercise_cognitive_types|expert_profiles|profile_intelligence|profile_centroids|profile_compatibility|study_reference_data|elite_markers|global_predictors)\M'
   OR pg_get_expr(pol.polwithcheck, pol.polrelid) ~ '\m(cognitive_trials|cognitive_sessions|cognitive_baselines|cognitive_normative_stats|cognitive_test_definitions|cognitive_test_presets|cognitive_benchmarks|program_exercise_cognitive_types|expert_profiles|profile_intelligence|profile_centroids|profile_compatibility|study_reference_data|elite_markers|global_predictors)\M';


-- ── 7. Defaults de colonnes référençant ces tables ───────────────────
INSERT INTO pg_temp.phase4_audit (section, detail, verdict)
SELECT
  '7. Defaults',
  format('%s.%s default = %s', table_name, column_name, column_default),
  '⛔ UNEXPECTED — default qui cassera après la migration'
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_default IS NOT NULL
  AND column_default ~ '\m(cognitive_trials|cognitive_sessions|cognitive_baselines|cognitive_normative_stats|cognitive_test_definitions|cognitive_test_presets|cognitive_benchmarks|program_exercise_cognitive_types|expert_profiles|profile_intelligence|profile_centroids|profile_compatibility|study_reference_data|elite_markers|global_predictors)\M';


-- ── 8. Generated columns référençant ces tables ──────────────────────
INSERT INTO pg_temp.phase4_audit (section, detail, verdict)
SELECT
  '8. Generated columns',
  format('%s.%s generated = %s', table_name, column_name, generation_expression),
  '⛔ UNEXPECTED — colonne générée qui cassera après la migration'
FROM information_schema.columns
WHERE table_schema = 'public'
  AND generation_expression IS NOT NULL
  AND generation_expression ~ '\m(cognitive_trials|cognitive_sessions|cognitive_baselines|cognitive_normative_stats|cognitive_test_definitions|cognitive_test_presets|cognitive_benchmarks|program_exercise_cognitive_types|expert_profiles|profile_intelligence|profile_centroids|profile_compatibility|study_reference_data|elite_markers|global_predictors)\M';


-- ── 9. Volumes (info uniquement) ─────────────────────────────────────
DO $$
DECLARE
  t text;
  n bigint;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'cognitive_trials','cognitive_sessions','cognitive_baselines',
    'cognitive_normative_stats','cognitive_test_definitions',
    'cognitive_test_presets','cognitive_benchmarks','program_exercise_cognitive_types',
    'expert_profiles','profile_intelligence','profile_centroids',
    'profile_compatibility','study_reference_data','elite_markers',
    'global_predictors'
  ]) LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      INSERT INTO pg_temp.phase4_audit VALUES ('9. Volumes', t || ' = (table absente)', 'info');
    ELSE
      EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
      INSERT INTO pg_temp.phase4_audit VALUES ('9. Volumes', t || ' = ' || n || ' rows', 'info');
    END IF;
  END LOOP;
END $$;


-- ── 10. Etat dispatches/payments (info pour Phase 5) ─────────────────
DO $$
DECLARE
  rec record;
BEGIN
  IF to_regclass('public.dispatches') IS NULL THEN
    INSERT INTO pg_temp.phase4_audit VALUES ('10. Phase 5 (dispatches)', 'table absente', 'info');
  ELSE
    FOR rec IN EXECUTE $sql$SELECT status, count(*) AS c FROM public.dispatches GROUP BY status$sql$ LOOP
      INSERT INTO pg_temp.phase4_audit
        VALUES ('10. Phase 5 (dispatches)', 'status=' || COALESCE(rec.status::text,'NULL') || ' rows=' || rec.c, 'info');
    END LOOP;
  END IF;

  IF to_regclass('public.payments') IS NULL THEN
    INSERT INTO pg_temp.phase4_audit VALUES ('10. Phase 5 (payments)', 'table absente', 'info');
  ELSE
    FOR rec IN EXECUTE $sql$SELECT type, count(*) AS c FROM public.payments GROUP BY type$sql$ LOOP
      INSERT INTO pg_temp.phase4_audit
        VALUES ('10. Phase 5 (payments)', 'type=' || COALESCE(rec.type::text,'NULL') || ' rows=' || rec.c, 'info');
    END LOOP;
  END IF;
END $$;


-- ── Résumé final ──────────────────────────────────────────────────────
-- Lit ce tableau ligne par ligne. Si une seule ligne contient
-- '⛔ UNEXPECTED', NE PAS appliquer la migration et signaler.

SELECT section, detail, verdict
FROM pg_temp.phase4_audit
ORDER BY section, verdict DESC, detail;
