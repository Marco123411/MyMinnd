-- Migration: Table expert_profiles — profils experts pour la marketplace MINND
-- Créée après users et dispatches (FKs vers ces tables)

-- ============================================================
-- TABLE: expert_profiles
-- Profil public d'un coach certifié sur la marketplace
-- ============================================================
CREATE TABLE public.expert_profiles (
    id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               uuid        NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    photo_url             text,
    titre                 varchar(200) NOT NULL,
    specialites           text[]      NOT NULL DEFAULT '{}',
    sports                text[]      DEFAULT '{}',
    contexts_couverts     text[]      NOT NULL DEFAULT '{sport}',
    public_cible          text[]      DEFAULT '{}',
    localisation          varchar(200) NOT NULL,
    tarif_seance          real,
    bio                   text        NOT NULL,
    badge_certifie        boolean     NOT NULL DEFAULT false,
    nb_profils_analyses   integer     NOT NULL DEFAULT 0,
    disponibilites        jsonb,
    note_moyenne          real        NOT NULL DEFAULT 0,
    nb_avis               integer     NOT NULL DEFAULT 0,
    taux_reponse          real        NOT NULL DEFAULT 0,
    is_visible            boolean     NOT NULL DEFAULT true,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Trigger: updated_at auto-refresh (réutilise la fonction de la migration 000000)
CREATE TRIGGER trg_expert_profiles_updated_at
    BEFORE UPDATE ON public.expert_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_expert_profiles_user_id       ON public.expert_profiles(user_id);
CREATE INDEX idx_expert_profiles_is_visible    ON public.expert_profiles(is_visible);
CREATE INDEX idx_expert_profiles_note_moyenne  ON public.expert_profiles(note_moyenne DESC);
CREATE INDEX idx_expert_profiles_localisation  ON public.expert_profiles(localisation);

ALTER TABLE public.expert_profiles ENABLE ROW LEVEL SECURITY;

-- Lecture publique : tout le monde peut voir les profils visibles (annuaire marketplace)
CREATE POLICY "expert_profiles_select_public" ON public.expert_profiles
    FOR SELECT TO anon, authenticated
    USING (is_visible = true);

-- Un expert authentifié peut voir son propre profil même s'il est masqué
CREATE POLICY "expert_profiles_select_own" ON public.expert_profiles
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);

-- Un expert peut mettre à jour son propre profil
CREATE POLICY "expert_profiles_update_own" ON public.expert_profiles
    FOR UPDATE TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- Seul le service_role peut insérer (création du profil via server action admin client)
-- et mettre à jour le badge_certifie (admin uniquement)
-- Pas de policy INSERT/DELETE pour authenticated → refus par défaut

-- ============================================================
-- TRIGGER: Mise à jour stats expert quand un dispatch est complété
-- Incrémente nb_profils_analyses et recalcule taux_reponse
-- ============================================================
CREATE OR REPLACE FUNCTION update_expert_dispatch_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Déclenché seulement quand le statut passe à 'termine'
    IF NEW.status = 'termine' AND OLD.status IS DISTINCT FROM 'termine' AND NEW.expert_id IS NOT NULL THEN
        UPDATE public.expert_profiles
        SET
            nb_profils_analyses = nb_profils_analyses + 1,
            taux_reponse = (
                SELECT CASE
                    WHEN COUNT(*) FILTER (WHERE status NOT IN ('nouveau', 'en_cours')) = 0 THEN 0::real
                    ELSE (
                        COUNT(*) FILTER (WHERE status IN ('accepte', 'en_session', 'termine'))::real /
                        COUNT(*) FILTER (WHERE status NOT IN ('nouveau', 'en_cours'))::real * 100
                    )
                END
                FROM public.dispatches
                WHERE expert_id = NEW.expert_id
            )
        WHERE user_id = NEW.expert_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_dispatch_expert_stats
    AFTER UPDATE ON public.dispatches
    FOR EACH ROW EXECUTE FUNCTION update_expert_dispatch_stats();
