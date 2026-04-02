-- Migration Niveau 1 : Aligner exercices_utilises sur le format ExerciceOrdonné[]
-- cabinet_sessions.exercices_utilises : uuid[] → jsonb

-- Ajouter la nouvelle colonne JSONB
ALTER TABLE public.cabinet_sessions
  ADD COLUMN exercices_utilises_v2 jsonb NOT NULL DEFAULT '[]';

-- Migrer les données : uuid[] → [{ exercise_id, ordre, consignes }]
UPDATE public.cabinet_sessions
SET exercices_utilises_v2 = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'exercise_id', e::text,
      'ordre',       idx - 1,
      'consignes',   ''
    ) ORDER BY idx
  )
  FROM unnest(exercices_utilises) WITH ORDINALITY AS t(e, idx)
)
WHERE array_length(exercices_utilises, 1) > 0;

-- Renommer les colonnes
ALTER TABLE public.cabinet_sessions
  RENAME COLUMN exercices_utilises    TO exercices_utilises_legacy;
ALTER TABLE public.cabinet_sessions
  RENAME COLUMN exercices_utilises_v2 TO exercices_utilises;

-- Supprimer l'ancienne colonne (array)
ALTER TABLE public.cabinet_sessions
  DROP COLUMN exercices_utilises_legacy;
