-- Migration: Tables exercises + interactive_exercise_results — Step 12
-- Bibliothèque d'exercices MINND + stockage des exercices interactifs

-- ============================================================
-- TABLE: exercises
-- Bibliothèque d'exercices (templates assignables par le coach)
-- ============================================================
CREATE TABLE public.exercises (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    titre       text        NOT NULL,
    description text,
    categorie   text        NOT NULL DEFAULT 'general',
    format      varchar(20) NOT NULL DEFAULT 'document'
                    CHECK (format IN ('video', 'document', 'audio', 'questionnaire', 'interactive')),
    is_custom   boolean     NOT NULL DEFAULT false,
    is_public   boolean     NOT NULL DEFAULT false,
    coach_id    uuid        REFERENCES public.users(id) ON DELETE SET NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_exercises_coach_id ON public.exercises(coach_id);
CREATE INDEX idx_exercises_format   ON public.exercises(format);
CREATE INDEX idx_exercises_public   ON public.exercises(is_public) WHERE is_public = true;

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

-- Tous les utilisateurs authentifiés voient les exercices publics
CREATE POLICY "exercises_select_public" ON public.exercises
    FOR SELECT TO authenticated
    USING (is_public = true);

-- Un coach voit ses propres exercices personnalisés
CREATE POLICY "exercises_select_own" ON public.exercises
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = coach_id);

-- Admin voit tout
CREATE POLICY "exercises_select_admin" ON public.exercises
    FOR SELECT TO authenticated
    USING (public.get_my_role() = 'admin');

-- Seul le service_role peut écrire (création manuelle ou via seed)
-- Pas de policy INSERT/UPDATE/DELETE pour les users authentifiés

-- ============================================================
-- TABLE: interactive_exercise_results
-- Stockage des résultats des exercices interactifs (jsonb)
-- ============================================================
CREATE TABLE public.interactive_exercise_results (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    exercise_type   varchar(50) NOT NULL
                        CHECK (exercise_type IN ('bonhomme_performance', 'figure_performance')),
    coach_id        uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    client_id       uuid        REFERENCES public.users(id) ON DELETE SET NULL,
    data            jsonb       NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_exercise_results_coach_id      ON public.interactive_exercise_results(coach_id);
CREATE INDEX idx_exercise_results_client_id     ON public.interactive_exercise_results(client_id);
CREATE INDEX idx_exercise_results_exercise_type ON public.interactive_exercise_results(exercise_type);
CREATE INDEX idx_exercise_results_created_at    ON public.interactive_exercise_results(created_at DESC);

ALTER TABLE public.interactive_exercise_results ENABLE ROW LEVEL SECURITY;

-- Le coach voit ses propres résultats
CREATE POLICY "exercise_results_select_coach" ON public.interactive_exercise_results
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = coach_id);

-- Le client voit les résultats qui le concernent
CREATE POLICY "exercise_results_select_client" ON public.interactive_exercise_results
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = client_id);

-- Admin voit tout
CREATE POLICY "exercise_results_select_admin" ON public.interactive_exercise_results
    FOR SELECT TO authenticated
    USING (public.get_my_role() = 'admin');

-- Le coach peut insérer ses propres résultats via service_role (server actions)
-- Pas de policy INSERT directe — les server actions utilisent createAdminClient()

-- ============================================================
-- SEED: Exercices interactifs MINND natifs
-- ============================================================
INSERT INTO public.exercises (titre, description, categorie, format, is_custom, is_public, coach_id)
VALUES
    (
        'Le Bonhomme de Performance',
        'Outil interactif de visualisation des 7 dimensions de la performance. Le client évalue mentalement, stratégiquement, tactiquement, physiquement, hygiène de vie, technique et relationnellement sa performance via des curseurs 0-100. Un personnage SVG se dessine en temps réel.',
        'evaluation',
        'interactive',
        false,
        true,
        NULL
    ),
    (
        'La Figure de Performance',
        'Radar hexagonal à 6 facteurs (Psychologique, Physique, Technique, Tactique, Social, Matériel) avec curseurs et notes par dimension. Idéal pour un bilan coach-athlète complet.',
        'evaluation',
        'interactive',
        false,
        true,
        NULL
    );
