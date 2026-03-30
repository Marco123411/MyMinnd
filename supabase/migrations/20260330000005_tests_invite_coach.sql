-- Migration: Support tests d'invitation (coach → client sans compte MINND)
-- - user_id devient nullable (test en attente d'acceptation)
-- - Ajout client_id FK vers clients (permet de retrouver les tests d'un client CRM)
-- - Politique RLS permettant au coach d'insérer et de mettre à jour ses tests d'invitation

-- user_id peut être NULL pour les tests créés par invitation (avant acceptation du client)
ALTER TABLE public.tests ALTER COLUMN user_id DROP NOT NULL;

-- Lien vers la fiche CRM du client (peut être NULL pour les tests auto-créés par le client)
ALTER TABLE public.tests ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX idx_tests_client_id ON public.tests(client_id);

-- Le coach peut insérer un test d'invitation pour un client (user_id NULL au départ)
CREATE POLICY "tests_insert_coach" ON public.tests
    FOR INSERT TO authenticated
    WITH CHECK (
        (SELECT auth.uid()) = coach_id
        AND user_id IS NULL
    );

-- Le coach peut mettre à jour uniquement les colonnes d'invitation sur ses propres tests
-- Note : score_global, profile_id, user_id, test_definition_id, level_slug, payment_id, created_at
--        sont déjà révoqués pour authenticated dans la migration 000001.
-- On révoque également les colonnes métier que le coach ne doit pas modifier directement.
REVOKE UPDATE (coach_id, started_at, completed_at, report_url)
    ON public.tests FROM authenticated;

-- Politique UPDATE : le coach peut mettre à jour ses tests (ex: régénérer invitation_token)
-- Les colonnes protégées ci-dessus + celles de la migration 000001 ne sont pas accessibles.
CREATE POLICY "tests_update_coach" ON public.tests
    FOR UPDATE TO authenticated
    USING ((SELECT auth.uid()) = coach_id)
    WITH CHECK ((SELECT auth.uid()) = coach_id);
