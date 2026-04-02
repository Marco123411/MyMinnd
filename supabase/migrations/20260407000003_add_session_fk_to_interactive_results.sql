-- Lie les résultats d'exercices interactifs à la séance autonomie qui les a générés
-- Permet au coach de voir les résultats Bonhomme/Figure directement dans la fiche de séance

ALTER TABLE public.interactive_exercise_results
  ADD COLUMN IF NOT EXISTS autonomous_session_id uuid
    REFERENCES public.autonomous_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_interactive_results_autonomous_session
  ON public.interactive_exercise_results(autonomous_session_id)
  WHERE autonomous_session_id IS NOT NULL;
