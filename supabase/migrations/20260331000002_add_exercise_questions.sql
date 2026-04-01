-- Étape 13 : Exercices personnalisés avec formulaires (Form Builder)

-- ============================================================
-- 1. Ajout du champ questions à la table exercises
-- ============================================================

ALTER TABLE exercises ADD COLUMN IF NOT EXISTS questions jsonb DEFAULT '[]';

-- ============================================================
-- 2. Table exercise_responses
-- Stocke les réponses des clients aux exercices avec questions
-- ============================================================

CREATE TABLE IF NOT EXISTS public.exercise_responses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id  uuid NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- session_id nullable : les sessions (autonomous/recurring) ne sont pas encore implémentées
  session_id   text,
  session_type varchar(20) CHECK (session_type IN ('autonomous', 'recurring')),
  responses    jsonb NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now()
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS exercise_responses_exercise_id_idx ON public.exercise_responses (exercise_id);
CREATE INDEX IF NOT EXISTS exercise_responses_user_id_idx     ON public.exercise_responses (user_id);
CREATE INDEX IF NOT EXISTS exercise_responses_completed_at_idx ON public.exercise_responses (completed_at DESC);

-- ============================================================
-- 3. RLS (Row Level Security)
-- ============================================================

ALTER TABLE public.exercise_responses ENABLE ROW LEVEL SECURITY;

-- Le client peut lire ses propres réponses
CREATE POLICY "exercise_responses_client_select"
  ON public.exercise_responses FOR SELECT
  USING (user_id = auth.uid());

-- Le client peut insérer ses propres réponses
CREATE POLICY "exercise_responses_client_insert"
  ON public.exercise_responses FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Le coach peut lire les réponses de ses clients
-- (via la table clients : clients.user_id = exercise_responses.user_id ET clients.coach_id = auth.uid())
CREATE POLICY "exercise_responses_coach_select"
  ON public.exercise_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.user_id   = exercise_responses.user_id
        AND c.coach_id  = auth.uid()
    )
  );

-- L'admin peut tout lire
CREATE POLICY "exercise_responses_admin_select"
  ON public.exercise_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );
