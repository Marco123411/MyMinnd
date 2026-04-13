-- Suivi de complétion des drills cognitifs par le client
ALTER TABLE public.program_exercises
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
