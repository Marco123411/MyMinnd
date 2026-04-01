-- Migration: Table reviews — système d'avis vérifiés pour la marketplace MINND
-- Créée après expert_profiles et dispatches

-- ============================================================
-- TABLE: reviews
-- Avis laissés par les clients après une session Level 3 complétée
-- ============================================================
CREATE TABLE public.reviews (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    expert_user_id      uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reviewer_user_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    dispatch_id         uuid        NOT NULL REFERENCES public.dispatches(id) ON DELETE CASCADE,
    rating              integer     NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment             text        CHECK (comment IS NULL OR char_length(comment) <= 500),
    expert_response     text        CHECK (expert_response IS NULL OR char_length(expert_response) <= 500),
    is_published        boolean     NOT NULL DEFAULT true,
    is_edited           boolean     NOT NULL DEFAULT false,
    edited_before       timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (dispatch_id, reviewer_user_id)
);

-- Trigger: updated_at auto-refresh
CREATE TRIGGER trg_reviews_updated_at
    BEFORE UPDATE ON public.reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_reviews_expert_user_id    ON public.reviews(expert_user_id);
CREATE INDEX idx_reviews_reviewer_user_id  ON public.reviews(reviewer_user_id);
CREATE INDEX idx_reviews_dispatch_id       ON public.reviews(dispatch_id);
CREATE INDEX idx_reviews_is_published      ON public.reviews(is_published);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TRIGGER: Fixe edited_before = created_at + 7 jours à l'insertion
-- ============================================================
CREATE OR REPLACE FUNCTION set_review_edited_before()
RETURNS TRIGGER AS $$
BEGIN
    NEW.edited_before := NEW.created_at + INTERVAL '7 days';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reviews_edited_before
    BEFORE INSERT ON public.reviews
    FOR EACH ROW EXECUTE FUNCTION set_review_edited_before();

-- ============================================================
-- TRIGGER: Recalcule note_moyenne et nb_avis dans expert_profiles
-- après chaque INSERT/UPDATE/DELETE sur reviews
-- ============================================================
CREATE OR REPLACE FUNCTION update_expert_review_stats()
RETURNS TRIGGER AS $$
DECLARE
    v_expert_id uuid;
BEGIN
    -- Détermine l'expert concerné selon l'opération
    IF TG_OP = 'DELETE' THEN
        v_expert_id := OLD.expert_user_id;
    ELSE
        v_expert_id := NEW.expert_user_id;
    END IF;

    UPDATE public.expert_profiles
    SET
        note_moyenne = COALESCE((
            SELECT AVG(rating)::real
            FROM public.reviews
            WHERE expert_user_id = v_expert_id AND is_published = true
        ), 0),
        nb_avis = (
            SELECT COUNT(*)::integer
            FROM public.reviews
            WHERE expert_user_id = v_expert_id AND is_published = true
        )
    WHERE user_id = v_expert_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_expert_review_stats
    AFTER INSERT OR UPDATE OR DELETE ON public.reviews
    FOR EACH ROW EXECUTE FUNCTION update_expert_review_stats();

-- ============================================================
-- RLS: Politiques d'accès aux avis
-- ============================================================

-- Lecture publique des avis publiés (marketplace visible sans auth)
CREATE POLICY "reviews_select_public" ON public.reviews
    FOR SELECT TO anon, authenticated
    USING (is_published = true);

-- Un client peut lire ses propres avis non publiés
CREATE POLICY "reviews_select_own" ON public.reviews
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = reviewer_user_id);

-- Un client peut laisser un avis si :
-- 1. Le dispatch lui appartient (client_id = auth.uid())
-- 2. Le dispatch est terminé
-- 3. Il n'a pas déjà laissé d'avis (contrainte UNIQUE dispatch_id+reviewer_user_id)
CREATE POLICY "reviews_insert_client" ON public.reviews
    FOR INSERT TO authenticated
    WITH CHECK (
        (SELECT auth.uid()) = reviewer_user_id
        AND EXISTS (
            SELECT 1 FROM public.dispatches d
            WHERE d.id = dispatch_id
              AND d.client_id = (SELECT auth.uid())
              AND d.status = 'termine'
        )
    );

-- Un client peut modifier son avis une seule fois, dans les 7 jours
-- La restriction is_edited/edited_before est gérée par le trigger enforce_review_edit_rules
-- Le WITH CHECK vérifie uniquement la propriété (évite que la mise à jour bypass la USING clause)
CREATE POLICY "reviews_update_client" ON public.reviews
    FOR UPDATE TO authenticated
    USING (
        (SELECT auth.uid()) = reviewer_user_id
        AND is_edited = false
        AND now() < edited_before
    )
    WITH CHECK (
        (SELECT auth.uid()) = reviewer_user_id
    );

-- Un expert peut répondre à un avis (une seule fois, expert_response doit être NULL)
-- La restriction de colonne est gérée par le trigger enforce_expert_response_columns
CREATE POLICY "reviews_update_expert_response" ON public.reviews
    FOR UPDATE TO authenticated
    USING (
        (SELECT auth.uid()) = expert_user_id
        AND expert_response IS NULL
    )
    WITH CHECK (
        (SELECT auth.uid()) = expert_user_id
    );

-- ============================================================
-- TRIGGER: Protège les colonnes lors d'une mise à jour client
-- Force is_edited=true et bloque la modification des champs protégés
-- ============================================================
CREATE OR REPLACE FUNCTION enforce_review_edit_rules()
RETURNS TRIGGER AS $$
BEGIN
    -- Si c'est le reviewer qui met à jour (pas l'expert)
    IF NEW.reviewer_user_id = (SELECT auth.uid()) THEN
        -- Force is_edited à true — empêche le client de le remettre à false
        NEW.is_edited := true;
        -- Préserve les champs immuables
        NEW.edited_before := OLD.edited_before;
        NEW.expert_user_id := OLD.expert_user_id;
        NEW.reviewer_user_id := OLD.reviewer_user_id;
        NEW.dispatch_id := OLD.dispatch_id;
        NEW.is_published := OLD.is_published;
        NEW.expert_response := OLD.expert_response;
        NEW.created_at := OLD.created_at;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_enforce_review_edit_rules
    BEFORE UPDATE ON public.reviews
    FOR EACH ROW
    WHEN (pg_trigger_depth() = 0)
    EXECUTE FUNCTION enforce_review_edit_rules();

-- ============================================================
-- TRIGGER: Protège les colonnes lors d'une réponse expert
-- Seul expert_response peut être modifié par l'expert
-- ============================================================
CREATE OR REPLACE FUNCTION enforce_expert_response_columns()
RETURNS TRIGGER AS $$
BEGIN
    -- Si c'est l'expert qui met à jour, il ne peut modifier que expert_response
    IF NEW.expert_user_id = (SELECT auth.uid()) AND OLD.expert_response IS NULL THEN
        NEW.rating := OLD.rating;
        NEW.comment := OLD.comment;
        NEW.is_published := OLD.is_published;
        NEW.is_edited := OLD.is_edited;
        NEW.edited_before := OLD.edited_before;
        NEW.reviewer_user_id := OLD.reviewer_user_id;
        NEW.dispatch_id := OLD.dispatch_id;
        NEW.created_at := OLD.created_at;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
