-- Annotations du coach sur les compétences d'un test client
CREATE TABLE public.test_coach_notes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id           UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  coach_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  node_id           UUID NOT NULL REFERENCES public.competency_tree(id) ON DELETE CASCADE,
  note              TEXT NOT NULL CHECK (char_length(note) BETWEEN 1 AND 2000),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Une seule note par compétence par test
  UNIQUE (test_id, node_id)
);

-- Trigger updated_at (réutilise la fonction existante de 20260330000000)
CREATE TRIGGER trg_test_coach_notes_updated_at
  BEFORE UPDATE ON public.test_coach_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.test_coach_notes ENABLE ROW LEVEL SECURITY;

-- Le coach peut lire/écrire ses propres annotations
CREATE POLICY "coach_crud_own_notes"
  ON public.test_coach_notes
  FOR ALL
  USING ((SELECT auth.uid()) = coach_id)
  WITH CHECK ((SELECT auth.uid()) = coach_id);

-- Le client peut lire les annotations des tests publiés qui lui appartiennent
CREATE POLICY "client_read_released_notes"
  ON public.test_coach_notes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tests t
      WHERE t.id = test_id
        AND t.user_id = (SELECT auth.uid())
        AND t.results_released_at IS NOT NULL
    )
  );
