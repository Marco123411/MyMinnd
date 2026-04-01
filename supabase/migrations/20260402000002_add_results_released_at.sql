-- Contrôle la visibilité des résultats côté client
-- NULL = résultats non publiés, valeur = date de publication par le coach
ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS results_released_at TIMESTAMPTZ DEFAULT NULL;

-- Index pour les requêtes "résultats non encore publiés" côté coach
CREATE INDEX IF NOT EXISTS idx_tests_results_released_at
  ON public.tests (results_released_at)
  WHERE results_released_at IS NULL;
