-- Migration: Supabase Storage — bucket reports (privé)
-- Stockage des rapports PDF générés après les tests Complete / Expert
-- Bucket PRIVÉ : accès via URL signées uniquement (données de santé mentale confidentielles)

-- ============================================================
-- BUCKET: reports (public = false)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- RLS: storage.objects pour le bucket reports
-- ============================================================

-- Le propriétaire du test peut lire son propre rapport
-- Path: {user_id}/{test_id}.pdf → le premier segment = user_id
CREATE POLICY "reports_select_owner" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'reports'
        AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    );

-- Le coach peut lire les rapports de ses clients
-- split_part(..., '.', 1) retire l'extension .pdf pour comparer uniquement le UUID
CREATE POLICY "reports_select_coach" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'reports'
        AND EXISTS (
            SELECT 1 FROM public.tests t
            WHERE t.id::text = split_part(storage.filename(name), '.', 1)
              AND t.coach_id = (SELECT auth.uid())
        )
    );

-- Admin peut lire tous les rapports
CREATE POLICY "reports_select_admin" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'reports'
        AND public.get_my_role() = 'admin'
    );

-- Le service role (génération automatique + API route avec admin client) peut uploader
CREATE POLICY "reports_insert_service" ON storage.objects
    FOR INSERT TO service_role
    WITH CHECK (bucket_id = 'reports');

CREATE POLICY "reports_update_service" ON storage.objects
    FOR UPDATE TO service_role
    USING (bucket_id = 'reports');

-- Nettoyage : le service role peut supprimer les anciens rapports
CREATE POLICY "reports_delete_service" ON storage.objects
    FOR DELETE TO service_role
    USING (bucket_id = 'reports');
