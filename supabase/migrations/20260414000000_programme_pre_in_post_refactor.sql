-- Refactor Pré/In/Post :
-- 1. Ajouter 'titre' à programme_etapes (nom libre pour les étapes cognitives)
-- 2. Ajouter 'exercise_id' à program_exercises (exercices bibliothèque)
-- 3. Mettre à jour les contraintes

-- ── 1. Titre libre sur programme_etapes ──────────────────────────────────────
ALTER TABLE public.programme_etapes
  ADD COLUMN IF NOT EXISTS titre TEXT;

-- ── 2. Lien vers la bibliothèque d'exercices dans program_exercises ──────────
-- Note RLS : les policies existantes sur program_exercises contrôlent l'accès
-- au niveau de la ligne (via programme → coach_id / client_id).
-- La colonne exercise_id n'a pas besoin de policy supplémentaire.
-- L'ownership de l'exercice est vérifié côté serveur dans addExerciseToEtapeAction
-- avant toute insertion (filtre coach_id ou is_public).
ALTER TABLE public.program_exercises
  ADD COLUMN IF NOT EXISTS exercise_id UUID
    REFERENCES public.exercises(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_program_exercises_exercise_id
  ON public.program_exercises(exercise_id)
  WHERE exercise_id IS NOT NULL;

-- ── 3. Contrainte : exercise_id XOR cognitive_test_id (pas les deux) ─────────
-- Remplace la contrainte de phase obligatoire pour les deux types
ALTER TABLE public.program_exercises
  DROP CONSTRAINT IF EXISTS chk_pe_cognitive_requires_phase;

ALTER TABLE public.program_exercises
  ADD CONSTRAINT chk_pe_one_source CHECK (
    (cognitive_test_id IS NOT NULL AND exercise_id IS NULL)
    OR (cognitive_test_id IS NULL  AND exercise_id IS NOT NULL)
    OR (cognitive_test_id IS NULL  AND exercise_id IS NULL)
  );

-- Phase obligatoire dès qu'une source est définie
ALTER TABLE public.program_exercises
  ADD CONSTRAINT chk_pe_source_requires_phase CHECK (
    (cognitive_test_id IS NULL AND exercise_id IS NULL) OR phase IS NOT NULL
  );

-- ── 4. Assouplir programme_etapes_one_fk pour les étapes cognitives ──────────
-- Les étapes cognitives n'ont plus de cognitive_session_id obligatoire :
-- leurs drills sont dans program_exercises.
ALTER TABLE public.programme_etapes
  DROP CONSTRAINT IF EXISTS programme_etapes_one_fk;

ALTER TABLE public.programme_etapes
  ADD CONSTRAINT programme_etapes_one_fk CHECK (
    -- Étapes cognitives : aucune FK de séance requise (drills dans program_exercises)
    type_seance = 'cognitif'
    OR (
      -- Autres types : exactement 1 FK de séance
      (cabinet_session_id    IS NOT NULL)::int +
      (autonomous_session_id IS NOT NULL)::int +
      (recurring_template_id IS NOT NULL)::int = 1
    )
  );
