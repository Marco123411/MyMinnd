-- Migration: Comptes de test — accès premium automatique
-- Objectif : pendant la phase de test (avant Stripe), les admins ont expert/active
-- et une fonction RPC permet de promouvoir n'importe quel compte manuellement.

-- ============================================================
-- 1. Élève tous les comptes admin existants au tier expert
-- ============================================================
UPDATE public.users
SET
    subscription_tier   = 'expert',
    subscription_status = 'active'
WHERE role = 'admin';

-- ============================================================
-- 2. Fonction RPC : grant_test_premium(p_user_id)
--    Permet de promouvoir n'importe quel compte depuis Supabase SQL Editor
--    Usage : SELECT public.grant_test_premium('<uuid>');
-- ============================================================
CREATE OR REPLACE FUNCTION public.grant_test_premium(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
    UPDATE public.users
    SET
        subscription_tier   = 'expert',
        subscription_status = 'active'
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Utilisateur % introuvable', p_user_id;
    END IF;
END;
$$;

-- Seul le service role peut appeler cette fonction
REVOKE EXECUTE ON FUNCTION public.grant_test_premium(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.grant_test_premium(uuid) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.grant_test_premium(uuid) TO service_role;
