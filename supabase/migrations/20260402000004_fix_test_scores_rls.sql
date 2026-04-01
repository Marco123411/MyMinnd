-- Fix test_scores RLS: clients can only read scores for published tests
-- Previously, the app-level guard could be bypassed via direct Supabase SDK queries

-- Drop all known client-facing permissive policies (including legacy names)
DROP POLICY IF EXISTS "client_read_own_scores" ON public.test_scores;
DROP POLICY IF EXISTS "clients_read_own_scores" ON public.test_scores;
DROP POLICY IF EXISTS "test_scores_select_own" ON public.test_scores;

-- Recreate with results_released_at guard
CREATE POLICY "client_read_released_scores" ON public.test_scores
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tests t
      WHERE t.id = test_id
        AND t.user_id = (SELECT auth.uid())
        AND t.results_released_at IS NOT NULL
    )
  );
