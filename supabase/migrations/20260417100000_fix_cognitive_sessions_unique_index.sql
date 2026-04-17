-- Fix : l'index unique idx_cognitive_sessions_one_active ne distinguait pas program_exercise_id.
-- Résultat : relancer le même test cognitif depuis un 2e exercice de programme levait
-- "duplicate key value violates unique constraint".
-- Solution : recréer l'index en incluant program_exercise_id (NULL traité comme valeur distincte via COALESCE).

DROP INDEX IF EXISTS public.idx_cognitive_sessions_one_active;

-- Nouvelle contrainte :
--   - mode autonome (program_exercise_id IS NULL) : 1 seule session active par (user, test)
--   - mode programme                              : 1 seule session active par (user, test, exercice)
CREATE UNIQUE INDEX idx_cognitive_sessions_one_active
  ON public.cognitive_sessions(
    user_id,
    cognitive_test_id,
    COALESCE(program_exercise_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE status IN ('pending', 'in_progress');
