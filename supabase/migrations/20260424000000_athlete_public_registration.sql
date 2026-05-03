-- Migration: Inscription publique athlète
-- Permet qu'un athlète se crée un compte client sans être invité par un coach.
-- Le client existe alors avec coach_id = NULL jusqu'à acceptation par un praticien.

-- ============================================================
-- 1. clients.coach_id → NULLABLE
-- ============================================================
-- Avant : NOT NULL (invitation coach-first obligatoire)
-- Après : NULL autorisé = athlète auto-inscrit sans coach
ALTER TABLE public.clients
    ALTER COLUMN coach_id DROP NOT NULL;

-- Index pour la lookup par user_id (athlète self-read + acceptation lead)
CREATE INDEX IF NOT EXISTS idx_clients_user_id
    ON public.clients (user_id);

-- ============================================================
-- 2. RLS : athlètes peuvent lire/éditer leur propre fiche
-- ============================================================
-- Ajoute des policies pour les lignes où le client est l'athlète lui-même
-- (coach_id peut être NULL jusqu'à mise en relation).

-- Athlète voit sa propre fiche
CREATE POLICY "clients_select_self" ON public.clients
    FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- Athlète peut insérer sa propre fiche (coach_id doit être NULL).
-- Verrouille aussi invitation_status='none' (défaut "self-signup") pour empêcher
-- un athlète malicieux de fabriquer une fiche avec status='accepted' côté direct SQL.
-- Le back-end (signUpAthleteAction) utilise admin client et n'est pas soumis à cette policy.
CREATE POLICY "clients_insert_self" ON public.clients
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = (SELECT auth.uid())
        AND coach_id IS NULL
        AND invitation_status = 'none'
    );

-- Index unique partiel : empêche qu'un athlète ait plusieurs fiches sans coach.
-- (Un athlète n'a qu'UNE fiche clients avec coach_id IS NULL ; dès qu'un coach
-- accepte, coach_id est renseigné et l'index n'applique plus.)
CREATE UNIQUE INDEX IF NOT EXISTS ux_clients_self_no_coach
    ON public.clients (user_id)
    WHERE coach_id IS NULL;

-- Athlète peut mettre à jour sa propre fiche (hors changement de coach_id)
-- Un trigger protège les colonnes coach-only contre les modifications athlète.
CREATE POLICY "clients_update_self" ON public.clients
    FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

-- ============================================================
-- 3. Trigger de protection : athlète ne peut pas changer coach_id
-- ============================================================
CREATE OR REPLACE FUNCTION public.protect_client_coach_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- service_role et coach owner peuvent modifier coach_id librement.
    -- current_setting('role', true) : deuxième arg = true → retourne NULL si non défini
    -- (évite "unrecognized configuration parameter").
    IF current_setting('role', true) = 'service_role' THEN
        RETURN NEW;
    END IF;

    -- Si la modif vient du coach actuel (coach_id = auth.uid()), autorisé
    IF OLD.coach_id IS NOT NULL AND OLD.coach_id = auth.uid() THEN
        RETURN NEW;
    END IF;

    -- Sinon (athlète qui update sa propre fiche), empêche tout changement de coach_id
    IF NEW.coach_id IS DISTINCT FROM OLD.coach_id THEN
        RAISE EXCEPTION 'Modification non autorisée : coach_id';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_clients_protect_coach_assignment
    BEFORE UPDATE ON public.clients
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_client_coach_assignment();
