-- Lien optionnel cognitive_session → program_exercise
-- NULL quand le test est lancé en autonome
ALTER TABLE public.cognitive_sessions
  ADD COLUMN IF NOT EXISTS program_exercise_id UUID
    REFERENCES public.program_exercises(id) ON DELETE SET NULL;

-- Index pour les requêtes coach (chargement des sessions d'un programme)
CREATE INDEX IF NOT EXISTS idx_cognitive_sessions_program_exercise_id
  ON public.cognitive_sessions(program_exercise_id)
  WHERE program_exercise_id IS NOT NULL;
