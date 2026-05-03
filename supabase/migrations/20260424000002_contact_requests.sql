-- Migration: Mise en relation athlète → praticien
-- Permet à un athlète de demander un accompagnement à un praticien visible dans la marketplace.
-- Le praticien reçoit un email avec les résultats PMA et peut accepter/décliner.

-- ============================================================
-- TABLE: contact_requests
-- ============================================================
CREATE TABLE public.contact_requests (
    id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    athlete_user_id        uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    coach_user_id          uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    test_id                uuid        REFERENCES public.tests(id) ON DELETE SET NULL,
    status                 varchar(20) NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','accepted','declined','expired')),
    message                text,
    sport                  varchar(100),
    level                  varchar(20) CHECK (level IS NULL OR level IN ('amateur','semi-pro','professionnel','elite')),
    objective              text        CHECK (objective IS NULL OR char_length(objective) <= 500),
    coach_response_message text        CHECK (coach_response_message IS NULL OR char_length(coach_response_message) <= 1000),
    consent_share_results  boolean     NOT NULL DEFAULT false,
    created_at             timestamptz NOT NULL DEFAULT now(),
    responded_at           timestamptz,
    expires_at             timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
    updated_at             timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT contact_requests_consent_required CHECK (consent_share_results = true),
    CONSTRAINT contact_requests_different_users  CHECK (athlete_user_id <> coach_user_id)
);

-- Un athlète ne peut avoir qu'une demande pending par praticien
CREATE UNIQUE INDEX ux_contact_requests_unique_pending
    ON public.contact_requests (athlete_user_id, coach_user_id)
    WHERE status = 'pending';

-- Index pour performance
CREATE INDEX idx_contact_requests_coach
    ON public.contact_requests (coach_user_id, status);
CREATE INDEX idx_contact_requests_athlete
    ON public.contact_requests (athlete_user_id);
CREATE INDEX idx_contact_requests_expires_pending
    ON public.contact_requests (expires_at)
    WHERE status = 'pending';

-- Trigger updated_at
CREATE TRIGGER trg_contact_requests_updated_at
    BEFORE UPDATE ON public.contact_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- RLS: contact_requests
-- ============================================================
ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

-- Athlète lit ses propres demandes
CREATE POLICY "contact_requests_select_athlete" ON public.contact_requests
    FOR SELECT TO authenticated
    USING (athlete_user_id = (SELECT auth.uid()));

-- Praticien lit les demandes qui lui sont adressées
CREATE POLICY "contact_requests_select_coach" ON public.contact_requests
    FOR SELECT TO authenticated
    USING (coach_user_id = (SELECT auth.uid()));

-- Admin lit tout
CREATE POLICY "contact_requests_select_admin" ON public.contact_requests
    FOR SELECT TO authenticated
    USING (public.get_my_role() = 'admin');

-- Athlète crée sa propre demande (status=pending + consent requis par CHECK)
CREATE POLICY "contact_requests_insert_athlete" ON public.contact_requests
    FOR INSERT TO authenticated
    WITH CHECK (
        athlete_user_id = (SELECT auth.uid())
        AND status = 'pending'
    );

-- Praticien met à jour SES demandes (accept/decline)
CREATE POLICY "contact_requests_update_coach" ON public.contact_requests
    FOR UPDATE TO authenticated
    USING (coach_user_id = (SELECT auth.uid()))
    WITH CHECK (coach_user_id = (SELECT auth.uid()));

-- Pas de DELETE — expiration via cron (service_role)

-- ============================================================
-- Trigger : empêche le praticien de modifier les champs athlète
-- ============================================================
CREATE OR REPLACE FUNCTION public.protect_contact_request_athlete_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- service_role peut tout modifier (cron d'expiration + actions d'acceptation).
    -- current_setting('role', true) : deuxième arg true → NULL si non défini (évite erreur).
    IF current_setting('role', true) = 'service_role' THEN
        RETURN NEW;
    END IF;

    -- Transitions de statut autorisées côté praticien : seulement pending → accepted|declined.
    -- Empêche de rouvrir une demande (accepted/declined/expired → pending) ou d'écraser
    -- un statut final, ce qui contournerait le paywall ou l'invariant "un seul coach".
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF OLD.status <> 'pending' THEN
            RAISE EXCEPTION 'Transition de statut non autorisée depuis %', OLD.status;
        END IF;
        IF NEW.status NOT IN ('accepted', 'declined') THEN
            RAISE EXCEPTION 'Statut cible non autorisé : %', NEW.status;
        END IF;
    END IF;

    -- Champs athlète en lecture seule côté praticien
    IF NEW.athlete_user_id IS DISTINCT FROM OLD.athlete_user_id THEN
        RAISE EXCEPTION 'Modification non autorisée : athlete_user_id';
    END IF;
    IF NEW.coach_user_id IS DISTINCT FROM OLD.coach_user_id THEN
        RAISE EXCEPTION 'Modification non autorisée : coach_user_id';
    END IF;
    IF NEW.test_id IS DISTINCT FROM OLD.test_id THEN
        RAISE EXCEPTION 'Modification non autorisée : test_id';
    END IF;
    IF NEW.sport IS DISTINCT FROM OLD.sport THEN
        RAISE EXCEPTION 'Modification non autorisée : sport';
    END IF;
    IF NEW.level IS DISTINCT FROM OLD.level THEN
        RAISE EXCEPTION 'Modification non autorisée : level';
    END IF;
    IF NEW.objective IS DISTINCT FROM OLD.objective THEN
        RAISE EXCEPTION 'Modification non autorisée : objective';
    END IF;
    IF NEW.message IS DISTINCT FROM OLD.message THEN
        RAISE EXCEPTION 'Modification non autorisée : message';
    END IF;
    IF NEW.consent_share_results IS DISTINCT FROM OLD.consent_share_results THEN
        RAISE EXCEPTION 'Modification non autorisée : consent_share_results';
    END IF;
    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        RAISE EXCEPTION 'Modification non autorisée : created_at';
    END IF;
    IF NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
        RAISE EXCEPTION 'Modification non autorisée : expires_at';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_contact_requests_protect_athlete_fields
    BEFORE UPDATE ON public.contact_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_contact_request_athlete_fields();
