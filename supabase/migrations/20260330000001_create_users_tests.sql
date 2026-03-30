-- Migration: Users, Payments, Tests, Responses, Test Scores + RLS
-- Ordre: users → get_my_role() → payments → tests → responses, test_scores
-- Note: get_my_role() doit être créé APRÈS public.users (SQL valide le corps à la création)

-- ============================================================
-- TABLE: users
-- Extension de auth.users avec les données métier
-- ============================================================
CREATE TABLE public.users (
    id                   uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role                 varchar(20) NOT NULL DEFAULT 'client'
                             CHECK (role IN ('client', 'coach', 'admin')),
    context              varchar(20) CHECK (context IN ('sport', 'corporate', 'wellbeing', 'coaching')),
    nom                  varchar(100) NOT NULL CHECK (nom <> ''),
    prenom               varchar(100),
    photo_url            text,
    subscription_tier    varchar(20) NOT NULL DEFAULT 'free'
                             CHECK (subscription_tier IN ('free', 'pro', 'expert')),
    subscription_status  varchar(20) NOT NULL DEFAULT 'inactive'
                             CHECK (subscription_status IN ('active', 'inactive', 'past_due', 'cancelled')),
    stripe_customer_id   varchar(255) UNIQUE,
    is_active            boolean     NOT NULL DEFAULT true,
    created_at           timestamptz NOT NULL DEFAULT now(),
    last_login_at        timestamptz
);

-- ============================================================
-- HELPER: get_my_role()
-- Lit le rôle du user connecté sans déclencher les policies RLS
-- (SECURITY DEFINER bypasse RLS — évite la récursion infinie)
-- Créé ici, après public.users, car SQL valide le corps à la création
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = ''
AS $$
    SELECT role FROM public.users WHERE id = (SELECT auth.uid())
$$;

-- Trigger: insère automatiquement une ligne dans users à l'inscription Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.users (id, nom, prenom, role)
    VALUES (
        NEW.id,
        -- NULLIF évite une chaîne vide qui violerait CHECK (nom <> '')
        NULLIF(COALESCE(
            NULLIF(NEW.raw_user_meta_data ->> 'nom',        ''),
            NULLIF(NEW.raw_user_meta_data ->> 'full_name',  ''),
            split_part(NEW.email, '@', 1)
        ), ''),
        NULLIF(NEW.raw_user_meta_data ->> 'prenom', ''),
        'client'
    )
    ON CONFLICT (id) DO NOTHING;  -- idem si le trigger se déclenche deux fois
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS: users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Un user voit sa propre ligne
CREATE POLICY "users_select_own" ON public.users
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = id);

-- Admin voit tout (get_my_role bypasse RLS → pas de récursion)
CREATE POLICY "users_select_admin" ON public.users
    FOR SELECT TO authenticated
    USING (public.get_my_role() = 'admin');

-- Un user peut modifier sa propre ligne (colonnes sensibles révoquées ci-dessous)
CREATE POLICY "users_update_own" ON public.users
    FOR UPDATE TO authenticated
    USING ((SELECT auth.uid()) = id)
    WITH CHECK ((SELECT auth.uid()) = id);

-- Sécurité colonne : colonnes sensibles non modifiables par authenticated
-- role, subscription_tier, subscription_status → gérés par le backend (service_role)
-- is_active, stripe_customer_id, created_at → champs système, jamais écrits par le client
REVOKE UPDATE (role, subscription_tier, subscription_status, is_active, stripe_customer_id, created_at)
    ON public.users FROM authenticated;

-- stripe_customer_id : données Stripe confidentielles, lues uniquement par le backend
REVOKE SELECT (stripe_customer_id) ON public.users FROM authenticated;

-- ============================================================
-- TABLE: payments
-- INSERT / UPDATE / DELETE réservés au service_role (webhooks Stripe)
-- Pas de policy INSERT/UPDATE/DELETE → refus par défaut RLS
-- ============================================================
CREATE TABLE public.payments (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type                varchar(20) NOT NULL
                            CHECK (type IN ('subscription', 'test_l2', 'test_l3', 'expert_payout')),
    amount_cents        integer     NOT NULL CHECK (amount_cents > 0),
    currency            varchar(3)  NOT NULL DEFAULT 'EUR',
    stripe_payment_id   varchar(255),
    status              varchar(20) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
    metadata            jsonb,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_user_id ON public.payments(user_id);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Un user voit ses propres paiements
CREATE POLICY "payments_select_own" ON public.payments
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);

-- Admin voit tout
CREATE POLICY "payments_select_admin" ON public.payments
    FOR SELECT TO authenticated
    USING (public.get_my_role() = 'admin');

-- ============================================================
-- TABLE: tests
-- ============================================================
CREATE TABLE public.tests (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    test_definition_id  uuid        NOT NULL REFERENCES public.test_definitions(id),
    user_id             uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    coach_id            uuid        REFERENCES public.users(id),
    level_slug          varchar(20) NOT NULL
                            CHECK (level_slug IN ('discovery', 'complete', 'expert')),
    status              varchar(20) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'in_progress', 'completed', 'expired')),
    score_global        real        CHECK (score_global >= 1 AND score_global <= 10),
    profile_id          uuid        REFERENCES public.profiles(id),
    -- ON DELETE SET NULL : le test reste valide si le paiement est supprimé
    payment_id          uuid        REFERENCES public.payments(id) ON DELETE SET NULL,
    -- invitation_token : non visible par authenticated (révoqué plus bas)
    invitation_token    varchar(255) UNIQUE,
    token_expires_at    timestamptz,
    started_at          timestamptz,
    completed_at        timestamptz,
    report_url          text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    -- completed_at ne peut pas précéder started_at
    CONSTRAINT tests_completed_after_started CHECK (
        completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at
    )
);

-- Trigger: updated_at auto-refresh (réutilise la fonction de la migration 000000)
CREATE TRIGGER trg_tests_updated_at
    BEFORE UPDATE ON public.tests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_tests_user_id         ON public.tests(user_id);
CREATE INDEX idx_tests_coach_id        ON public.tests(coach_id);
CREATE INDEX idx_tests_definition      ON public.tests(test_definition_id);
CREATE INDEX idx_tests_user_status     ON public.tests(user_id, status);

-- Coach voit les users ayant des tests assignés à lui
-- (policy créée ici car public.tests doit exister au moment de la création)
CREATE POLICY "users_select_coach_clients" ON public.users
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tests t
            WHERE t.user_id = public.users.id
              AND t.coach_id = (SELECT auth.uid())
        )
    );

ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;

-- Client voit ses propres tests
CREATE POLICY "tests_select_own" ON public.tests
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);

-- Coach voit les tests où il est assigné
CREATE POLICY "tests_select_coach" ON public.tests
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = coach_id);

-- Admin voit tout
CREATE POLICY "tests_select_admin" ON public.tests
    FOR SELECT TO authenticated
    USING (public.get_my_role() = 'admin');

-- Un client peut créer un test pour lui-même
CREATE POLICY "tests_insert_own" ON public.tests
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- Un client peut mettre à jour son propre test (ex. status in_progress → completed)
-- Les colonnes sensibles sont révoquées ci-dessous
CREATE POLICY "tests_update_own" ON public.tests
    FOR UPDATE TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- invitation_token et token_expires_at : gérés uniquement par le backend
REVOKE SELECT (invitation_token, token_expires_at) ON public.tests FROM authenticated;

-- Colonnes système non modifiables par le client
REVOKE UPDATE (user_id, test_definition_id, level_slug, created_at, payment_id, profile_id, score_global)
    ON public.tests FROM authenticated;

-- ============================================================
-- TABLE: responses
-- ============================================================
CREATE TABLE public.responses (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id         uuid        NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
    question_id     uuid        NOT NULL REFERENCES public.questions(id),
    raw_score       integer     NOT NULL CHECK (raw_score >= 1 AND raw_score <= 10),
    -- computed_score = raw_score ou 11 - raw_score (si is_reversed) → toujours dans [1, 10]
    computed_score  real        NOT NULL CHECK (computed_score >= 1 AND computed_score <= 10),
    answered_at     timestamptz NOT NULL DEFAULT now(),
    UNIQUE (test_id, question_id)
);

CREATE INDEX idx_responses_test_id     ON public.responses(test_id);
CREATE INDEX idx_responses_question_id ON public.responses(question_id);

ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;

-- Un client voit ses propres réponses (via tests)
CREATE POLICY "responses_select_own" ON public.responses
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tests t
            WHERE t.id = responses.test_id AND t.user_id = (SELECT auth.uid())
        )
    );

-- Un coach voit les réponses de ses clients
CREATE POLICY "responses_select_coach" ON public.responses
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tests t
            WHERE t.id = responses.test_id AND t.coach_id = (SELECT auth.uid())
        )
    );

-- Admin voit tout
CREATE POLICY "responses_select_admin" ON public.responses
    FOR SELECT TO authenticated
    USING (public.get_my_role() = 'admin');

-- Un client peut insérer des réponses sur ses tests en cours seulement
CREATE POLICY "responses_insert_own" ON public.responses
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tests t
            WHERE t.id = responses.test_id
              AND t.user_id = (SELECT auth.uid())
              AND t.status = 'in_progress'
        )
    );

-- ============================================================
-- TABLE: test_scores
-- INSERT / UPDATE / DELETE réservés au service_role (scoring post-test)
-- Pas de policy INSERT/UPDATE/DELETE → refus par défaut RLS
-- ============================================================
CREATE TABLE public.test_scores (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id         uuid        NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
    entity_type     varchar(20) NOT NULL
                        CHECK (entity_type IN ('competency_node', 'global')),
    entity_id       uuid        REFERENCES public.competency_tree(id),
    score           real        NOT NULL CHECK (score >= 1 AND score <= 10),
    percentile      integer     CHECK (percentile >= 1 AND percentile <= 99),
    -- entity_id obligatoire pour competency_node, NULL pour global
    CONSTRAINT test_scores_entity_consistency CHECK (
        (entity_type = 'global'          AND entity_id IS NULL) OR
        (entity_type = 'competency_node' AND entity_id IS NOT NULL)
    )
);

-- UNIQUE partiel : NULL != NULL en PostgreSQL → deux index séparés
CREATE UNIQUE INDEX idx_test_scores_global_unique ON public.test_scores (test_id)
    WHERE entity_type = 'global';

CREATE UNIQUE INDEX idx_test_scores_node_unique ON public.test_scores (test_id, entity_id)
    WHERE entity_type = 'competency_node';

CREATE INDEX idx_test_scores_test_id   ON public.test_scores(test_id);
CREATE INDEX idx_test_scores_entity_id ON public.test_scores(entity_id);

ALTER TABLE public.test_scores ENABLE ROW LEVEL SECURITY;

-- Un client voit ses propres scores
CREATE POLICY "test_scores_select_own" ON public.test_scores
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tests t
            WHERE t.id = test_scores.test_id AND t.user_id = (SELECT auth.uid())
        )
    );

-- Un coach voit les scores de ses clients
CREATE POLICY "test_scores_select_coach" ON public.test_scores
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tests t
            WHERE t.id = test_scores.test_id AND t.coach_id = (SELECT auth.uid())
        )
    );

-- Admin voit tout
CREATE POLICY "test_scores_select_admin" ON public.test_scores
    FOR SELECT TO authenticated
    USING (public.get_my_role() = 'admin');
