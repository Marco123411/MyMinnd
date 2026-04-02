-- Migration Niveau 2 : Module programme coach-client
-- Un programme regroupe des séances ordonnées (tous types) en parcours structuré
-- Idempotente : peut être relancée sans erreur si les objets existent déjà

-- ============================================================
-- TABLE: programmes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.programmes (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    client_id   uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    nom         varchar(200) NOT NULL,
    description text,
    statut      varchar(20) NOT NULL DEFAULT 'actif'
                    CHECK (statut IN ('actif', 'archive')),
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_programmes_coach_id  ON public.programmes(coach_id);
CREATE INDEX IF NOT EXISTS idx_programmes_client_id ON public.programmes(client_id);
CREATE INDEX IF NOT EXISTS idx_programmes_statut    ON public.programmes(statut) WHERE statut = 'actif';

DO $$ BEGIN
  CREATE TRIGGER trg_programmes_updated_at
    BEFORE UPDATE ON public.programmes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.programmes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "programmes_select_coach" ON public.programmes
    FOR SELECT TO authenticated USING (coach_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "programmes_select_client" ON public.programmes
    FOR SELECT TO authenticated USING (client_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "programmes_select_admin" ON public.programmes
    FOR SELECT TO authenticated
    USING (public.get_my_role() = 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- TABLE: programme_etapes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.programme_etapes (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    programme_id            uuid        NOT NULL REFERENCES public.programmes(id) ON DELETE CASCADE,
    ordre                   integer     NOT NULL,
    type_seance             varchar(20) NOT NULL
                                CHECK (type_seance IN ('cabinet', 'autonomie', 'recurrente')),
    cabinet_session_id      uuid REFERENCES public.cabinet_sessions(id)      ON DELETE SET NULL,
    autonomous_session_id   uuid REFERENCES public.autonomous_sessions(id)   ON DELETE SET NULL,
    recurring_template_id   uuid REFERENCES public.recurring_templates(id)   ON DELETE SET NULL,
    CONSTRAINT programme_etapes_one_fk CHECK (
        (cabinet_session_id   IS NOT NULL)::int +
        (autonomous_session_id IS NOT NULL)::int +
        (recurring_template_id IS NOT NULL)::int = 1
    ),
    created_at              timestamptz NOT NULL DEFAULT now(),
    UNIQUE (programme_id, ordre)
);

CREATE INDEX IF NOT EXISTS idx_programme_etapes_programme_id ON public.programme_etapes(programme_id);
CREATE INDEX IF NOT EXISTS idx_programme_etapes_order        ON public.programme_etapes(programme_id, ordre);

ALTER TABLE public.programme_etapes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "programme_etapes_select_coach" ON public.programme_etapes
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.programmes p
            WHERE p.id = programme_etapes.programme_id
              AND p.coach_id = auth.uid()
        )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "programme_etapes_select_client" ON public.programme_etapes
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.programmes p
            WHERE p.id = programme_etapes.programme_id
              AND p.client_id = auth.uid()
        )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "programme_etapes_select_admin" ON public.programme_etapes
    FOR SELECT TO authenticated
    USING (public.get_my_role() = 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- Fonction helper : réordonner les étapes après suppression
-- ============================================================
CREATE OR REPLACE FUNCTION public.reorder_programme_etapes_after_delete(
  p_programme_id  uuid,
  p_deleted_ordre integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.programme_etapes
  SET ordre = ordre - 1
  WHERE programme_id = p_programme_id
    AND ordre > p_deleted_ordre;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reorder_programme_etapes_after_delete(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reorder_programme_etapes_after_delete(uuid, integer) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.reorder_programme_etapes_after_delete(uuid, integer) TO service_role;
