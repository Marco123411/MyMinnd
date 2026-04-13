-- Fix : restaure la permission INSERT sur cognitive_sessions pour les utilisateurs authentifiés
-- La migration 20260415 avait révoqué INSERT par erreur, bloquant la création de toute session cognitive.
-- Seul REVOKE UPDATE (benchmark_results) est nécessaire pour protéger la colonne contre la falsification.
GRANT INSERT ON public.cognitive_sessions TO authenticated;
