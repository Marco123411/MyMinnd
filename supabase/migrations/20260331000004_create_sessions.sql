-- Migration: Tables sessions (cabinet, autonomie, templates récurrents) — Étape 16
-- Module de gestion des séances coach-client

-- ============================================================
-- TABLE: cabinet_sessions
-- Séances en cabinet (présentiel ou visio) planifiées par le coach
-- ============================================================
CREATE TABLE public.cabinet_sessions (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id            uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    client_id           uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    date_seance         timestamptz NOT NULL,
    duree_minutes       integer,
    objectif            text        NOT NULL,
    contenu             text,
    observations        text,
    prochaine_etape     text,
    exercices_utilises  uuid[]      DEFAULT '{}',
    statut              varchar(20) NOT NULL DEFAULT 'planifiee'
                            CHECK (statut IN ('planifiee', 'realisee', 'annulee')),
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cabinet_sessions_coach_id   ON public.cabinet_sessions(coach_id);
CREATE INDEX idx_cabinet_sessions_client_id  ON public.cabinet_sessions(client_id);
CREATE INDEX idx_cabinet_sessions_statut     ON public.cabinet_sessions(statut);
CREATE INDEX idx_cabinet_sessions_date       ON public.cabinet_sessions(date_seance DESC);

CREATE TRIGGER trg_cabinet_sessions_updated_at
    BEFORE UPDATE ON public.cabinet_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.cabinet_sessions ENABLE ROW LEVEL SECURITY;

-- Le coach voit les séances de ses clients
CREATE POLICY "cabinet_sessions_select_coach" ON public.cabinet_sessions
    FOR SELECT TO authenticated
    USING (coach_id = auth.uid());

-- Le client voit ses propres séances cabinet
CREATE POLICY "cabinet_sessions_select_client" ON public.cabinet_sessions
    FOR SELECT TO authenticated
    USING (client_id = auth.uid());

-- L'admin voit tout
CREATE POLICY "cabinet_sessions_select_admin" ON public.cabinet_sessions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND u.role = 'admin'
        )
    );

-- Seul le service_role (server actions avec createAdminClient) peut écrire
-- Pas de policy INSERT/UPDATE/DELETE pour les users authentifiés

-- ============================================================
-- TABLE: autonomous_sessions
-- Séances que le client réalise seul, assignées par le coach
-- ============================================================
CREATE TABLE public.autonomous_sessions (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id            uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    client_id           uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    titre               varchar(200) NOT NULL,
    objectif            text        NOT NULL,
    exercices           jsonb       NOT NULL DEFAULT '[]',
    date_cible          date,
    statut              varchar(20) NOT NULL DEFAULT 'a_faire'
                            CHECK (statut IN ('a_faire', 'en_cours', 'terminee', 'en_retard', 'manquee')),
    date_realisation    timestamptz,
    duree_realisee      integer,
    feedback_client     text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_autonomous_sessions_coach_id   ON public.autonomous_sessions(coach_id);
CREATE INDEX idx_autonomous_sessions_client_id  ON public.autonomous_sessions(client_id);
CREATE INDEX idx_autonomous_sessions_statut     ON public.autonomous_sessions(statut);
CREATE INDEX idx_autonomous_sessions_date_cible ON public.autonomous_sessions(date_cible);

CREATE TRIGGER trg_autonomous_sessions_updated_at
    BEFORE UPDATE ON public.autonomous_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.autonomous_sessions ENABLE ROW LEVEL SECURITY;

-- Le coach voit les séances autonomie de ses clients
CREATE POLICY "autonomous_sessions_select_coach" ON public.autonomous_sessions
    FOR SELECT TO authenticated
    USING (coach_id = auth.uid());

-- Le client voit ses propres séances autonomie
CREATE POLICY "autonomous_sessions_select_client" ON public.autonomous_sessions
    FOR SELECT TO authenticated
    USING (client_id = auth.uid());

-- L'admin voit tout
CREATE POLICY "autonomous_sessions_select_admin" ON public.autonomous_sessions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND u.role = 'admin'
        )
    );

-- Le client peut mettre à jour uniquement les champs de suivi (statut, feedback, durée)
-- Fix F3 : un trigger empêche la modification des colonnes sensibles (coach_id, objectif, exercices, etc.)
CREATE POLICY "autonomous_sessions_update_client" ON public.autonomous_sessions
    FOR UPDATE TO authenticated
    USING (client_id = auth.uid() AND statut NOT IN ('terminee', 'manquee'))
    WITH CHECK (client_id = auth.uid());

-- Trigger de protection : empêche le client de modifier les champs réservés au coach
CREATE OR REPLACE FUNCTION public.protect_autonomous_session_coach_fields()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- Colonnes modifiables par le client : statut, feedback_client, duree_realisee, date_realisation, updated_at
    -- Toutes les autres colonnes sont en lecture seule pour le client
    IF NEW.coach_id     IS DISTINCT FROM OLD.coach_id     THEN RAISE EXCEPTION 'Modification non autorisée : coach_id'; END IF;
    IF NEW.client_id    IS DISTINCT FROM OLD.client_id    THEN RAISE EXCEPTION 'Modification non autorisée : client_id'; END IF;
    IF NEW.titre        IS DISTINCT FROM OLD.titre        THEN RAISE EXCEPTION 'Modification non autorisée : titre'; END IF;
    IF NEW.objectif     IS DISTINCT FROM OLD.objectif     THEN RAISE EXCEPTION 'Modification non autorisée : objectif'; END IF;
    IF NEW.exercices    IS DISTINCT FROM OLD.exercices    THEN RAISE EXCEPTION 'Modification non autorisée : exercices'; END IF;
    IF NEW.date_cible   IS DISTINCT FROM OLD.date_cible   THEN RAISE EXCEPTION 'Modification non autorisée : date_cible'; END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_autonomous_sessions_protect_coach_fields
    BEFORE UPDATE ON public.autonomous_sessions
    FOR EACH ROW
    -- Le trigger ne s'applique pas aux appels service_role (createAdminClient)
    WHEN (current_setting('role') != 'service_role')
    EXECUTE FUNCTION public.protect_autonomous_session_coach_fields();

-- Le coach/service_role peut tout écrire (via createAdminClient)

-- ============================================================
-- TABLE: recurring_templates
-- Templates réutilisables de séances (routines pré-comp, quotidiennes, etc.)
-- ============================================================
CREATE TABLE public.recurring_templates (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id        uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    client_id       uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    titre           varchar(200) NOT NULL,
    description     text,
    exercices       jsonb       NOT NULL DEFAULT '[]',
    duree_estimee   integer,
    trigger_type    varchar(30)
                        CHECK (trigger_type IN ('pre_entrainement', 'pre_competition', 'quotidien', 'post_entrainement', 'libre')),
    is_active       boolean     NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_recurring_templates_coach_id   ON public.recurring_templates(coach_id);
CREATE INDEX idx_recurring_templates_client_id  ON public.recurring_templates(client_id);
CREATE INDEX idx_recurring_templates_active     ON public.recurring_templates(is_active) WHERE is_active = true;

ALTER TABLE public.recurring_templates ENABLE ROW LEVEL SECURITY;

-- Le coach voit ses propres templates
CREATE POLICY "recurring_templates_select_coach" ON public.recurring_templates
    FOR SELECT TO authenticated
    USING (coach_id = auth.uid());

-- Le client voit les templates qui lui sont assignés
CREATE POLICY "recurring_templates_select_client" ON public.recurring_templates
    FOR SELECT TO authenticated
    USING (client_id = auth.uid());

-- L'admin voit tout
CREATE POLICY "recurring_templates_select_admin" ON public.recurring_templates
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND u.role = 'admin'
        )
    );

-- Seul le service_role peut écrire

-- ============================================================
-- TABLE: recurring_executions
-- Chaque exécution d'un template récurrent par le client
-- ============================================================
CREATE TABLE public.recurring_executions (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id     uuid        NOT NULL REFERENCES public.recurring_templates(id) ON DELETE CASCADE,
    client_id       uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    started_at      timestamptz NOT NULL DEFAULT now(),
    completed       boolean     NOT NULL DEFAULT false,
    duree_minutes   integer,
    feedback        text,
    data            jsonb       DEFAULT '{}'
);

CREATE INDEX idx_recurring_executions_template_id ON public.recurring_executions(template_id);
CREATE INDEX idx_recurring_executions_client_id   ON public.recurring_executions(client_id);
CREATE INDEX idx_recurring_executions_started_at  ON public.recurring_executions(started_at DESC);

ALTER TABLE public.recurring_executions ENABLE ROW LEVEL SECURITY;

-- Le client voit ses propres exécutions
CREATE POLICY "recurring_executions_select_client" ON public.recurring_executions
    FOR SELECT TO authenticated
    USING (client_id = auth.uid());

-- Le client peut insérer ses propres exécutions uniquement pour les templates qui lui sont assignés
-- Fix L10 : vérifie que le template appartient bien au client
CREATE POLICY "recurring_executions_insert_client" ON public.recurring_executions
    FOR INSERT TO authenticated
    WITH CHECK (
        client_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.recurring_templates rt
            WHERE rt.id = recurring_executions.template_id
              AND rt.client_id = auth.uid()
              AND rt.is_active = true
        )
    );

-- Le client peut mettre à jour ses propres exécutions (terminer, feedback)
CREATE POLICY "recurring_executions_update_client" ON public.recurring_executions
    FOR UPDATE TO authenticated
    USING (client_id = auth.uid())
    WITH CHECK (client_id = auth.uid());

-- Le coach voit les exécutions des clients qui lui appartiennent
CREATE POLICY "recurring_executions_select_coach" ON public.recurring_executions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.recurring_templates rt
            WHERE rt.id = recurring_executions.template_id
              AND rt.coach_id = auth.uid()
        )
    );

-- L'admin voit tout
CREATE POLICY "recurring_executions_select_admin" ON public.recurring_executions
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid() AND u.role = 'admin'
        )
    );

-- ============================================================
-- FONCTION: Mise à jour automatique des statuts overdue
-- Appelée depuis les server actions avant chaque lecture
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_overdue_autonomous_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Fix L1 : 3 cas distincts pour éviter qu'une session saute l'état en_retard
    --
    -- Cas 1 : a_faire → en_retard (dépassée mais pas encore de +7 jours)
    UPDATE public.autonomous_sessions
    SET statut = 'en_retard', updated_at = now()
    WHERE statut = 'a_faire'
      AND date_cible IS NOT NULL
      AND date_cible < CURRENT_DATE
      AND date_cible + INTERVAL '7 days' >= CURRENT_DATE;

    -- Cas 2 : a_faire → manquee directement (dépassée de plus de 7 jours sans jamais être passée en_retard)
    UPDATE public.autonomous_sessions
    SET statut = 'manquee', updated_at = now()
    WHERE statut = 'a_faire'
      AND date_cible IS NOT NULL
      AND date_cible + INTERVAL '7 days' < CURRENT_DATE;

    -- Cas 3 : en_retard → manquee (était déjà en_retard et maintenant +7 jours dépassés)
    UPDATE public.autonomous_sessions
    SET statut = 'manquee', updated_at = now()
    WHERE statut = 'en_retard'
      AND date_cible IS NOT NULL
      AND date_cible + INTERVAL '7 days' < CURRENT_DATE;
END;
$$;
