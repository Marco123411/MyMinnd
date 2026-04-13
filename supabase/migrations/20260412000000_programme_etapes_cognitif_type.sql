-- Migration : ajout du type 'cognitif' comme étape autonome de programme
-- Un coach peut programmer un test cognitif comme étape à part entière
-- (distinct des drills Pre/In/Post qui enrichissent une séance existante)

-- ── 1. Ajouter cognitive_session_id dans programme_etapes ─────────────────────
ALTER TABLE public.programme_etapes
  ADD COLUMN IF NOT EXISTS cognitive_session_id UUID
    REFERENCES public.cognitive_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_programme_etapes_cognitive_session_id
  ON public.programme_etapes(cognitive_session_id)
  WHERE cognitive_session_id IS NOT NULL;

-- ── 2. Ajouter programme_etape_id dans cognitive_sessions (back-reference) ─────
ALTER TABLE public.cognitive_sessions
  ADD COLUMN IF NOT EXISTS programme_etape_id UUID
    REFERENCES public.programme_etapes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cognitive_sessions_programme_etape_id
  ON public.cognitive_sessions(programme_etape_id)
  WHERE programme_etape_id IS NOT NULL;

-- ── 3. Mettre à jour le CHECK sur type_seance ──────────────────────────────────
ALTER TABLE public.programme_etapes
  DROP CONSTRAINT IF EXISTS programme_etapes_type_seance_check;

ALTER TABLE public.programme_etapes
  ADD CONSTRAINT programme_etapes_type_seance_check
    CHECK (type_seance IN ('cabinet', 'autonomie', 'recurrente', 'cognitif'));

-- ── 4. Remplacer le CHECK one_fk pour inclure cognitive_session_id ─────────────
-- Nouvelle logique : exactement 1 FK non-null parmi les 4 colonnes
ALTER TABLE public.programme_etapes
  DROP CONSTRAINT IF EXISTS programme_etapes_one_fk;

ALTER TABLE public.programme_etapes
  ADD CONSTRAINT programme_etapes_one_fk CHECK (
    (cabinet_session_id    IS NOT NULL)::int +
    (autonomous_session_id IS NOT NULL)::int +
    (recurring_template_id IS NOT NULL)::int +
    (cognitive_session_id  IS NOT NULL)::int = 1
  );
