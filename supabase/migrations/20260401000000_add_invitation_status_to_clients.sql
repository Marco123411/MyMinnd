-- Migration: Ajout du statut d'invitation clients — Étape 18

-- Enum pour le statut d'invitation
CREATE TYPE public.invitation_status AS ENUM ('none', 'pending', 'accepted');

-- Colonnes d'invitation sur la table clients
ALTER TABLE public.clients
  ADD COLUMN invitation_status public.invitation_status NOT NULL DEFAULT 'none',
  ADD COLUMN invited_at        timestamptz;

-- Index pour requêtes par statut (optimise les requêtes sur clients non encore acceptés)
CREATE INDEX idx_clients_invitation_status ON public.clients(invitation_status)
  WHERE invitation_status != 'accepted';

-- ============================================================
-- HELPER: Lookup d'un auth user confirmé par email (sans pagination)
-- Utilisé par le fallback TypeScript — évite de lister tous les users
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_confirmed_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql SECURITY DEFINER SET search_path = ''
AS $$
  SELECT id FROM auth.users
  WHERE LOWER(email) = LOWER(p_email)
    AND email_confirmed_at IS NOT NULL
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_confirmed_user_id_by_email(text) TO service_role;

-- ============================================================
-- TRIGGER: Auto-link user_id quand un client accepte l'invitation
-- Déclenché quand un user Supabase Auth confirme son email.
-- Scoped au coach qui a envoyé l'invitation via user_metadata.coach_id
-- ============================================================
CREATE OR REPLACE FUNCTION public.link_client_on_email_confirm()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_coach_id uuid;
BEGIN
  -- Récupère le coach_id depuis les métadonnées de l'invitation (définies dans inviteUserByEmail)
  v_coach_id := (NEW.raw_user_meta_data->>'coach_id')::uuid;

  -- Cas 1 : invitation MINND avec coach_id connu → lie uniquement ce client
  IF v_coach_id IS NOT NULL THEN
    UPDATE public.clients
    SET
      user_id           = NEW.id,
      invitation_status = 'accepted'
    WHERE
      LOWER(email)      = LOWER(NEW.email)
      AND coach_id      = v_coach_id
      AND user_id       IS NULL
      AND invitation_status = 'pending';
  ELSE
    -- Cas 2 : inscription directe (pas via invitation coach) → lie tous les clients pending
    -- avec cet email (comportement conservateur — le fallback TypeScript prend le relai)
    UPDATE public.clients
    SET
      user_id           = NEW.id,
      invitation_status = 'accepted'
    WHERE
      LOWER(email)      = LOWER(NEW.email)
      AND user_id       IS NULL
      AND invitation_status = 'pending';
  END IF;

  RETURN NEW;
END;
$$;

-- Grant permissions for supabase_auth_admin to execute this function
GRANT EXECUTE ON FUNCTION public.link_client_on_email_confirm() TO supabase_auth_admin;

-- Trigger sur auth.users (email_confirmed_at passe de NULL à une valeur)
CREATE OR REPLACE TRIGGER trg_link_client_on_confirm
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.link_client_on_email_confirm();

-- RLS : la policy UPDATE existante sur clients couvre déjà ces nouvelles colonnes
-- (le coach peut mettre à jour tous les champs de ses propres clients)
