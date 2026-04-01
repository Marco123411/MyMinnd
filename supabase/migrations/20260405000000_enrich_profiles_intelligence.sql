-- Étape 25 : Couche Intelligence Profil
-- Enrichit la table profiles + crée profile_compatibility + study_reference_data

-- ============================================================
-- 1. Enrichissement de la table profiles
-- ============================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tagline varchar(200);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS celebrity_examples jsonb DEFAULT '[]';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS coach_priority text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS coach_exercise text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS coach_trap text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS team_role varchar(100);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS team_contribution text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avg_compatibility real;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS forces_details jsonb DEFAULT '[]';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS faiblesses_details jsonb DEFAULT '[]';

-- ============================================================
-- 2. Table : profile_compatibility (matrice 8×8)
-- ============================================================

CREATE TABLE IF NOT EXISTS profile_compatibility (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    test_definition_id  uuid        NOT NULL REFERENCES test_definitions(id) ON DELETE CASCADE,
    profile_a_id        uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    profile_b_id        uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    score               integer     NOT NULL CHECK (score >= 1 AND score <= 10),
    synergie            text,
    friction            text,
    conseil             text,
    UNIQUE (test_definition_id, profile_a_id, profile_b_id)
);

CREATE INDEX IF NOT EXISTS idx_compat_profile_a ON profile_compatibility(profile_a_id);
CREATE INDEX IF NOT EXISTS idx_compat_profile_b ON profile_compatibility(profile_b_id);
CREATE INDEX IF NOT EXISTS idx_compat_test_def ON profile_compatibility(test_definition_id);

ALTER TABLE profile_compatibility ENABLE ROW LEVEL SECURITY;
-- SELECT seul : INSERT/UPDATE/DELETE sont refusés par défaut (RLS default-deny).
-- Les écritures se font exclusivement via service_role dans les migrations.
CREATE POLICY "authenticated read profile_compatibility"
    ON profile_compatibility FOR SELECT TO authenticated USING (true);

-- ============================================================
-- 3. Table : study_reference_data (données de l'étude N=5705)
-- ============================================================

CREATE TABLE IF NOT EXISTS study_reference_data (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    test_definition_id  uuid        NOT NULL REFERENCES test_definitions(id) ON DELETE CASCADE,
    key                 varchar(100) NOT NULL,
    value               jsonb       NOT NULL,
    UNIQUE (test_definition_id, key)
);

CREATE INDEX IF NOT EXISTS idx_study_data_test_def ON study_reference_data(test_definition_id);
CREATE INDEX IF NOT EXISTS idx_study_data_key ON study_reference_data(key);

ALTER TABLE study_reference_data ENABLE ROW LEVEL SECURITY;
-- SELECT seul : INSERT/UPDATE/DELETE sont refusés par défaut (RLS default-deny).
-- Les écritures se font exclusivement via service_role dans les migrations.
CREATE POLICY "authenticated read study_reference_data"
    ON study_reference_data FOR SELECT TO authenticated USING (true);
