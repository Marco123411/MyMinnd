-- Migration Step 31 : Cognitive Scoring V2 — benchmark_results + baselines Pre/Post

-- Colonne pour stocker les résultats de benchmark calculés à la completion de chaque session
ALTER TABLE cognitive_sessions
  ADD COLUMN IF NOT EXISTS benchmark_results JSONB;

-- Empêche les utilisateurs authentifiés de falsifier leurs propres benchmark_results via l'API REST
REVOKE UPDATE (benchmark_results) ON public.cognitive_sessions FROM authenticated;
REVOKE INSERT ON public.cognitive_sessions FROM authenticated;

-- Table Baselines Pre/Post : compare un snapshot "pre" vs "post" pour un programme
CREATE TABLE IF NOT EXISTS cognitive_baselines (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id     UUID NOT NULL REFERENCES programmes(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  pre_date         DATE NOT NULL,
  post_date        DATE NOT NULL,
  pre_session_ids  UUID[],  -- sessions spécifiques sélectionnées (optionnel)
  post_session_ids UUID[],  -- sessions spécifiques sélectionnées (optionnel)
  results          JSONB,   -- cache des comparaisons calculées (BaselineComparison[])
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- Index pour accès rapide par programme
CREATE INDEX IF NOT EXISTS idx_cognitive_baselines_programme_id
  ON cognitive_baselines(programme_id);

-- RLS activé
ALTER TABLE cognitive_baselines ENABLE ROW LEVEL SECURITY;

-- Coach du programme peut faire tout (CRUD)
CREATE POLICY "Coach CRUD baselines"
  ON cognitive_baselines
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM programmes p
      WHERE p.id = cognitive_baselines.programme_id
        AND p.coach_id = auth.uid()
    )
  );

-- Client peut lire ses propres baselines
CREATE POLICY "Client SELECT baselines"
  ON cognitive_baselines
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM programmes p
      WHERE p.id = cognitive_baselines.programme_id
        AND p.client_id = auth.uid()
    )
  );
