-- Ajoute archived_at sur programmes pour tracer la date d'archivage
-- et permettre la suppression automatique après 30 jours.

ALTER TABLE public.programmes
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Backfill : programmes déjà archivés → on utilise updated_at comme date d'archivage
UPDATE public.programmes
  SET archived_at = updated_at
WHERE statut = 'archive' AND archived_at IS NULL;

-- Trigger : met à jour archived_at automatiquement lors d'un changement de statut
CREATE OR REPLACE FUNCTION set_programme_archived_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.statut = 'archive' AND OLD.statut <> 'archive' THEN
    NEW.archived_at := now();
  ELSIF NEW.statut <> 'archive' THEN
    NEW.archived_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_programme_archived_at ON public.programmes;
CREATE TRIGGER trg_programme_archived_at
  BEFORE UPDATE ON public.programmes
  FOR EACH ROW EXECUTE FUNCTION set_programme_archived_at();
