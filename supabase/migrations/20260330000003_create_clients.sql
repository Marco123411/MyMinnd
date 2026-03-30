-- Migration: CRM Coach — table clients
-- Liaison coach → client avec champs contextuels et RLS

-- ============================================================
-- TABLE: clients
-- CRM du coach : un coach peut avoir plusieurs clients
-- ============================================================
CREATE TABLE public.clients (
    id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id         uuid         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    user_id          uuid         REFERENCES public.users(id) ON DELETE SET NULL,
    nom              varchar(100) NOT NULL CHECK (nom <> ''),
    email            varchar(255),
    context          varchar(20)  NOT NULL DEFAULT 'sport'
                         CHECK (context IN ('sport', 'corporate', 'wellbeing', 'coaching')),
    sport            varchar(100),
    niveau           varchar(20)  CHECK (niveau IN ('amateur', 'semi-pro', 'professionnel', 'elite')),
    entreprise       varchar(200),
    poste            varchar(200),
    date_naissance   date,
    objectifs        text,
    notes_privees    text,
    statut           varchar(20)  NOT NULL DEFAULT 'actif'
                         CHECK (statut IN ('actif', 'en_pause', 'archive')),
    tags             text[]       NOT NULL DEFAULT '{}',
    photo            text,
    created_at       timestamptz  NOT NULL DEFAULT now(),
    updated_at       timestamptz  NOT NULL DEFAULT now()
);

-- Trigger: updated_at auto-refresh (update_updated_at_column défini en migration 000)
CREATE TRIGGER trg_clients_updated_at
    BEFORE UPDATE ON public.clients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- RLS: clients
-- Un coach voit uniquement SES clients. Admin voit tout.
-- ============================================================
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Coach voit ses propres clients
CREATE POLICY "clients_select_coach" ON public.clients
    FOR SELECT TO authenticated
    USING (coach_id = (SELECT auth.uid()));

-- Admin voit tout
CREATE POLICY "clients_select_admin" ON public.clients
    FOR SELECT TO authenticated
    USING (public.get_my_role() = 'admin');

-- Coach insère ses propres clients (coach_id = auth.uid() forcé)
CREATE POLICY "clients_insert_coach" ON public.clients
    FOR INSERT TO authenticated
    WITH CHECK (coach_id = (SELECT auth.uid()));

-- Coach met à jour ses propres clients uniquement
CREATE POLICY "clients_update_coach" ON public.clients
    FOR UPDATE TO authenticated
    USING (coach_id = (SELECT auth.uid()))
    WITH CHECK (coach_id = (SELECT auth.uid()));

-- Pas de DELETE : archivage via statut = 'archive'
