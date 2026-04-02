-- Migration Niveau 1 : Normalisation des FKs dans exercise_responses
-- Remplace session_id text par deux colonnes UUID typées

-- Ajout des colonnes FK typées (nullable car une seule sera renseignée)
ALTER TABLE public.exercise_responses
  ADD COLUMN autonomous_session_id  uuid REFERENCES public.autonomous_sessions(id)  ON DELETE SET NULL,
  ADD COLUMN recurring_execution_id uuid REFERENCES public.recurring_executions(id) ON DELETE SET NULL;

-- Index pour les jointures coach (retrouver les réponses d'une séance)
CREATE INDEX idx_exercise_responses_autonomous_session
  ON public.exercise_responses(autonomous_session_id)
  WHERE autonomous_session_id IS NOT NULL;

CREATE INDEX idx_exercise_responses_recurring_execution
  ON public.exercise_responses(recurring_execution_id)
  WHERE recurring_execution_id IS NOT NULL;

-- Migration des données existantes
-- session_type = 'autonomous' : session_id contient l'uuid d'une autonomous_session
-- Guard: vérifie que la ligne cible existe pour éviter une violation FK
UPDATE public.exercise_responses
SET autonomous_session_id = session_id::uuid
WHERE session_type = 'autonomous'
  AND session_id IS NOT NULL
  AND session_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND session_id::uuid IN (SELECT id FROM public.autonomous_sessions);

-- session_type = 'recurring' : session_id contient l'uuid d'une recurring_execution
-- Guard: vérifie que la ligne cible existe pour éviter une violation FK
UPDATE public.exercise_responses
SET recurring_execution_id = session_id::uuid
WHERE session_type = 'recurring'
  AND session_id IS NOT NULL
  AND session_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND session_id::uuid IN (SELECT id FROM public.recurring_executions);

-- Déprécier session_id (gardé pour rétrocompatibilité, ne plus écrire dedans)
COMMENT ON COLUMN public.exercise_responses.session_id
  IS 'DEPRECATED — utiliser autonomous_session_id ou recurring_execution_id';
