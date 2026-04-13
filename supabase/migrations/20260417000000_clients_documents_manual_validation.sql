-- Migration: Documents clients + validation manuelle
-- Permet aux coachs de joindre des dossiers PDF à leurs clients pré-existants
-- et d'activer manuellement un compte sans passer par le flux d'invitation email

-- ============================================================
-- TABLE clients — nouveaux champs
-- ============================================================

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS documents JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS manually_validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS manually_validated_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.clients.documents IS
  'Documents attachés à la fiche client : [{name, url, type, uploaded_at, uploaded_by}]';
COMMENT ON COLUMN public.clients.manually_validated_at IS
  'Timestamp de la validation manuelle du compte (bypass flux invitation email)';
COMMENT ON COLUMN public.clients.manually_validated_by IS
  'UUID du coach ou admin qui a effectué la validation manuelle';

-- Index pour détecter rapidement les clients validés manuellement
CREATE INDEX IF NOT EXISTS idx_clients_manually_validated
  ON public.clients (manually_validated_at)
  WHERE manually_validated_at IS NOT NULL;

-- ============================================================
-- BUCKET: dossiers (public = false)
-- Stockage des dossiers d'inscription et documents administratifs clients
-- Bucket PRIVÉ : accès via URL signées uniquement
-- Path convention: {coach_id}/{client_id}/{timestamp}_{filename}
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('dossiers', 'dossiers', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- RLS: storage.objects pour le bucket dossiers
-- ============================================================

-- Le coach peut uploader dans son propre dossier (chemin commence par son user_id)
CREATE POLICY "dossiers_insert_coach" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'dossiers'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );

-- Le coach peut lire ses propres dossiers clients
CREATE POLICY "dossiers_select_coach" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'dossiers'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );

-- Admin peut lire tous les dossiers
CREATE POLICY "dossiers_select_admin" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'dossiers'
        AND public.get_my_role() = 'admin'
    );

-- Le coach peut supprimer ses propres dossiers
CREATE POLICY "dossiers_delete_coach" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'dossiers'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );
