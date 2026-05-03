-- Migration: ajout de la colonne slug sur profiles
-- Pour générer des URLs publiques stables /profil/[slug] (tâche B — partage social)

-- Extension pour slugification sans accents
CREATE EXTENSION IF NOT EXISTS unaccent;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS slug varchar(100);

-- Index unique partiel (NULL autorisé pour données legacy non encore slugifiées)
CREATE UNIQUE INDEX IF NOT EXISTS ux_profiles_slug
    ON public.profiles (slug)
    WHERE slug IS NOT NULL;

-- Seed des slugs pour les profils existants (kebab-case sans accents)
UPDATE public.profiles
SET slug = LOWER(
    REGEXP_REPLACE(
        REGEXP_REPLACE(
            UNACCENT(name),
            '[^a-zA-Z0-9]+', '-', 'g'
        ),
        '^-|-$', '', 'g'
    )
)
WHERE slug IS NULL;
