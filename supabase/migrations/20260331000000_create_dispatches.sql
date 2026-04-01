-- Migration: Table dispatches — workflow de mise en relation Level 3
-- Créée après payments et tests (FKs vers ces tables)

-- ============================================================
-- TABLE: dispatches
-- Suit le cycle de vie complet d'une mission expert Level 3
-- ============================================================
CREATE TABLE public.dispatches (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id           uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    test_id             uuid        NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
    payment_id          uuid        NOT NULL REFERENCES public.payments(id),
    status              varchar(20) NOT NULL DEFAULT 'nouveau'
                            CHECK (status IN ('nouveau', 'en_cours', 'dispatche', 'accepte', 'en_session', 'termine', 'annule')),
    expert_id           uuid        REFERENCES public.users(id) ON DELETE SET NULL,
    dispatched_at       timestamptz,
    accepted_at         timestamptz,
    contacted_at        timestamptz,
    completed_at        timestamptz,
    expert_payment_id   uuid        REFERENCES public.payments(id) ON DELETE SET NULL,
    notes_admin         text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Trigger: updated_at auto-refresh (réutilise la fonction de la migration 000000)
CREATE TRIGGER trg_dispatches_updated_at
    BEFORE UPDATE ON public.dispatches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Contrainte UNIQUE : un paiement Level 3 ne peut créer qu'un seul dispatch (idempotency)
ALTER TABLE public.dispatches ADD CONSTRAINT dispatches_payment_id_unique UNIQUE (payment_id);

CREATE INDEX idx_dispatches_client_id  ON public.dispatches(client_id);
CREATE INDEX idx_dispatches_expert_id  ON public.dispatches(expert_id);
CREATE INDEX idx_dispatches_status     ON public.dispatches(status);
CREATE INDEX idx_dispatches_test_id    ON public.dispatches(test_id);

ALTER TABLE public.dispatches ENABLE ROW LEVEL SECURITY;

-- Un client voit ses propres dispatches
CREATE POLICY "dispatches_select_client" ON public.dispatches
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = client_id);

-- Un coach/expert voit les dispatches où il est expert assigné
CREATE POLICY "dispatches_select_expert" ON public.dispatches
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = expert_id);

-- Admin voit tout
CREATE POLICY "dispatches_select_admin" ON public.dispatches
    FOR SELECT TO authenticated
    USING (public.get_my_role() = 'admin');

-- Seul le service_role (webhooks, server actions avec admin client) peut écrire
-- Pas de policy INSERT/UPDATE/DELETE → refus par défaut pour les users authentifiés
