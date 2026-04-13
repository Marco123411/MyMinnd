-- Étape 29 : Table program_exercises pour les drills cognitifs dans les microcycles
-- Liée à programme_etapes (structure de séance existante)

CREATE TABLE IF NOT EXISTS public.program_exercises (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_etape_id          UUID        NOT NULL
    REFERENCES public.programme_etapes(id) ON DELETE CASCADE,

  -- Drill cognitif (NULL si outil PM classique — tool_definition_id ajouté quand tool_definitions existera)
  cognitive_test_id           UUID
    REFERENCES public.cognitive_test_definitions(id) ON DELETE SET NULL,

  -- Phase dans la session structurée Pre/In/Post (obligatoire si drill cognitif)
  phase                       TEXT
    CHECK (phase IN ('pre', 'in', 'post')),

  -- Paramètres de configuration (override des valeurs par défaut du test_definition)
  configured_duration_sec     INTEGER
    CHECK (configured_duration_sec IS NULL OR configured_duration_sec > 0),

  configured_intensity_percent INTEGER
    CHECK (configured_intensity_percent IS NULL OR (configured_intensity_percent >= 10 AND configured_intensity_percent <= 100)),

  -- CLS calculé via computeCognitiveLoad et stocké à la sauvegarde
  cognitive_load_score        INTEGER
    CHECK (cognitive_load_score IS NULL OR (cognitive_load_score >= 1 AND cognitive_load_score <= 26)),

  -- Ordre d'affichage dans la colonne de phase
  display_order               INTEGER     NOT NULL DEFAULT 0,

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Contrainte : un drill cognitif doit avoir une phase
  CONSTRAINT chk_pe_cognitive_requires_phase
    CHECK (cognitive_test_id IS NULL OR phase IS NOT NULL)
);

-- Index pour les requêtes par séance
CREATE INDEX IF NOT EXISTS idx_program_exercises_etape_id
  ON public.program_exercises(programme_etape_id);

CREATE INDEX IF NOT EXISTS idx_program_exercises_cognitive_test_id
  ON public.program_exercises(cognitive_test_id);

-- RLS
ALTER TABLE public.program_exercises ENABLE ROW LEVEL SECURITY;

-- Coaches : accès aux exercices des programmes de leurs clients
CREATE POLICY "coaches_select_program_exercises" ON public.program_exercises
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.programme_etapes pe
      JOIN public.programmes p ON p.id = pe.programme_id
      WHERE pe.id = program_exercises.programme_etape_id
        AND p.coach_id = auth.uid()
    )
  );

CREATE POLICY "coaches_insert_program_exercises" ON public.program_exercises
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.programme_etapes pe
      JOIN public.programmes p ON p.id = pe.programme_id
      WHERE pe.id = programme_etape_id
        AND p.coach_id = auth.uid()
    )
  );

CREATE POLICY "coaches_update_program_exercises" ON public.program_exercises
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.programme_etapes pe
      JOIN public.programmes p ON p.id = pe.programme_id
      WHERE pe.id = program_exercises.programme_etape_id
        AND p.coach_id = auth.uid()
    )
  );

CREATE POLICY "coaches_delete_program_exercises" ON public.program_exercises
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.programme_etapes pe
      JOIN public.programmes p ON p.id = pe.programme_id
      WHERE pe.id = program_exercises.programme_etape_id
        AND p.coach_id = auth.uid()
    )
  );

-- Clients : lecture de leurs propres exercices
CREATE POLICY "clients_select_program_exercises" ON public.program_exercises
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.programme_etapes pe
      JOIN public.programmes p ON p.id = pe.programme_id
      JOIN public.clients c ON c.user_id = p.client_id
      WHERE pe.id = program_exercises.programme_etape_id
        AND c.user_id = auth.uid()
    )
  );

-- Admins : accès complet
CREATE POLICY "admins_all_program_exercises" ON public.program_exercises
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- Révocation : cognitive_load_score calculé côté serveur uniquement
-- INSERT et UPDATE révoqués pour empêcher les coaches de falsifier la valeur
REVOKE INSERT (cognitive_load_score) ON public.program_exercises FROM authenticated;
REVOKE UPDATE (cognitive_load_score) ON public.program_exercises FROM authenticated;
