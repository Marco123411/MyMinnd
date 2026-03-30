-- Migration: Moteur de test générique
-- Tables: test_definitions, competency_tree, questions, profiles, profile_centroids, normative_stats

-- ============================================================
-- TABLE: test_definitions
-- ============================================================
CREATE TABLE test_definitions (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    slug                varchar(50) UNIQUE NOT NULL,
    name                varchar(200) NOT NULL,
    description         text,
    context             varchar(20) NOT NULL
                            CHECK (context IN ('sport', 'corporate', 'wellbeing', 'coaching')),
    scale_min           integer     NOT NULL DEFAULT 1,
    scale_max           integer     NOT NULL DEFAULT 10,
    clustering_algo     varchar(20) NOT NULL DEFAULT 'kmeans',
    clustering_k        integer,
    normative_n         integer     NOT NULL DEFAULT 0,
    is_active           boolean     NOT NULL DEFAULT true,
    levels              jsonb       NOT NULL
                            CHECK (jsonb_typeof(levels) = 'array' AND jsonb_array_length(levels) > 0),
    report_template_id  uuid,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CHECK (scale_min >= 1),
    CHECK (scale_max > scale_min)
);

-- Trigger: updated_at auto-refresh
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_test_definitions_updated_at
    BEFORE UPDATE ON test_definitions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLE: competency_tree
-- ============================================================
CREATE TABLE competency_tree (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    test_definition_id  uuid        NOT NULL REFERENCES test_definitions(id) ON DELETE CASCADE,
    parent_id           uuid        REFERENCES competency_tree(id) ON DELETE CASCADE,
    name                varchar(200) NOT NULL,
    slug                varchar(100) NOT NULL,
    description         text,
    depth               integer     NOT NULL CHECK (depth >= 0),
    order_index         integer     NOT NULL CHECK (order_index > 0),
    is_leaf             boolean     NOT NULL,
    UNIQUE (test_definition_id, slug)
);

CREATE INDEX idx_competency_tree_test_id   ON competency_tree(test_definition_id);
CREATE INDEX idx_competency_tree_parent_id ON competency_tree(parent_id);

-- ============================================================
-- TABLE: questions
-- ============================================================
CREATE TABLE questions (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    test_definition_id  uuid        NOT NULL REFERENCES test_definitions(id) ON DELETE CASCADE,
    competency_node_id  uuid        NOT NULL REFERENCES competency_tree(id) ON DELETE CASCADE,
    text_fr             text        NOT NULL,
    text_en             text,
    is_reversed         boolean     NOT NULL DEFAULT false,
    is_active           boolean     NOT NULL DEFAULT true,
    level_required      varchar(20) NOT NULL
                            CHECK (level_required IN ('discovery', 'complete')),
    order_index         integer     NOT NULL CHECK (order_index > 0),
    UNIQUE (test_definition_id, order_index)
);

CREATE INDEX idx_questions_test_id    ON questions(test_definition_id);
CREATE INDEX idx_questions_node_id    ON questions(competency_node_id);
CREATE INDEX idx_questions_test_level ON questions(test_definition_id, level_required);
CREATE INDEX idx_questions_reversed   ON questions(test_definition_id, is_reversed);

-- ============================================================
-- TABLE: profiles
-- ============================================================
CREATE TABLE profiles (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    test_definition_id  uuid        NOT NULL REFERENCES test_definitions(id) ON DELETE CASCADE,
    name                varchar(100) NOT NULL,
    family              varchar(50),
    color               varchar(7)  NOT NULL
                            CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
    population_pct      real        CHECK (population_pct >= 0 AND population_pct <= 100),
    avg_score           real,
    description         text,
    strengths           text,
    weaknesses          text,
    recommendations     text,
    UNIQUE (test_definition_id, name)
);

CREATE INDEX idx_profiles_test_id ON profiles(test_definition_id);

-- ============================================================
-- TABLE: profile_centroids
-- ============================================================
CREATE TABLE profile_centroids (
    id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id          uuid    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    competency_node_id  uuid    NOT NULL REFERENCES competency_tree(id) ON DELETE CASCADE,
    value               real    NOT NULL,
    UNIQUE (profile_id, competency_node_id)
);

CREATE INDEX idx_profile_centroids_profile_id ON profile_centroids(profile_id);
CREATE INDEX idx_profile_centroids_node_id    ON profile_centroids(competency_node_id);

-- ============================================================
-- TABLE: normative_stats
-- ============================================================
CREATE TABLE normative_stats (
    id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    test_definition_id       uuid        NOT NULL REFERENCES test_definitions(id) ON DELETE CASCADE,
    competency_node_id       uuid        NOT NULL REFERENCES competency_tree(id) ON DELETE CASCADE,
    mean                     real        NOT NULL,
    std_dev                  real        NOT NULL CHECK (std_dev > 0),
    sample_size              integer     NOT NULL CHECK (sample_size > 0),
    percentile_distribution  jsonb,
    updated_at               timestamptz NOT NULL DEFAULT now(),
    UNIQUE (test_definition_id, competency_node_id)
);

CREATE TRIGGER trg_normative_stats_updated_at
    BEFORE UPDATE ON normative_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_normative_stats_test_id ON normative_stats(test_definition_id);
CREATE INDEX idx_normative_stats_node_id ON normative_stats(competency_node_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- Ces tables sont des données de référence (read-only pour les clients).
-- Seul service_role peut écrire (pas de policy INSERT/UPDATE/DELETE = refusé par défaut).
-- ============================================================
ALTER TABLE test_definitions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE competency_tree    ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_centroids  ENABLE ROW LEVEL SECURITY;
ALTER TABLE normative_stats    ENABLE ROW LEVEL SECURITY;

-- Lecture publique pour les utilisateurs authentifiés
CREATE POLICY "authenticated read test_definitions"  ON test_definitions  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated read competency_tree"   ON competency_tree   FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated read questions"         ON questions          FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated read profiles"          ON profiles           FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated read profile_centroids" ON profile_centroids  FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated read normative_stats"   ON normative_stats    FOR SELECT TO authenticated USING (true);
