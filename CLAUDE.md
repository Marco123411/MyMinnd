# MINND Mental Performance — Plateforme SaaS

Plateforme SaaS de performance mentale : tests psychométriques (Likert 1-10) et cognitifs (temps de réaction, mémoire de travail) pour coachs et clients (athlètes, individus, professionnels).

## Stack technique

- **Framework** : Next.js 14+ App Router
- **BDD** : Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **ORM** : Prisma ou requêtes Supabase directes — rester cohérent dans un même module
- **Styling** : Tailwind CSS + shadcn/ui
- **Paiement** : Stripe (Subscriptions + Checkout + Connect)
- **Email** : Resend
- **PDF** : @react-pdf/renderer côté serveur
- **Déploiement** : Vercel

## Commandes

- `npm run dev` — Dev server
- `npm run build` — Build production
- `npm run lint` — Lint

## Design system MINND

### Couleurs
- Teal (primaire) : `#20808D`
- Mauve : `#944454`
- Gold : `#FFC553`
- Orange : `#A84B2F`
- Dark : `#1A1A2E`
- Light Teal (backgrounds) : `#E8F4F5`

### Typographie
- Titres : Halogen (fallback : Geist/Inter)
- Corps : Galano Grotesque (fallback : Inter)

### UI
- Mobile-first pour l'espace client
- Desktop-optimized pour le dashboard coach

## Architecture des données

### Moteur de test générique
Chaque test = instance d'un `test_definition` avec sa propre `competency_tree`, base normative, centroïdes et profils. **Ajouter un test = config en base, zéro code.**

### Rôles
- `client` : passe les tests. Champ `context` : `sport | corporate | wellbeing | coaching`
- `coach` : CRM + dashboard + suivi clients
- `admin` : dispatch, contenu, monitoring

### Scoring des tests de profilage (NON-NÉGOCIABLE)
1. Score feuille = moyenne des réponses (inversion si applicable : `11 - réponse`)
2. Score domaine = moyenne des scores feuilles enfants
3. Score global = moyenne de **TOUTES** les feuilles (pas des domaines)
4. Percentile = rang relatif vs base normative
5. Profil = centroïde K-Means le plus proche en z-scores

### Niveaux PMA (test de profilage)
- Discovery (gratuit) : 40-50 questions, score global + domaines
- Complete (19 €) : 155 questions, profil MINND + rapport PDF
- Expert (79 €) : Complete + session 30-45 min avec expert certifié

## Règles

- **ALWAYS** utiliser shadcn/ui pour tous les composants UI — NEVER créer des composants UI custom si shadcn/ui a l'équivalent
- **NEVER** utiliser `any` en TypeScript
- **NEVER** faire de silent catch — toujours gérer les erreurs explicitement
- **NEVER** mélanger Prisma et requêtes Supabase directes dans un même module
- Valider tous les inputs avec Zod
- Commentaires en **français** pour la logique métier, en **anglais** pour le code technique
- Tables BDD : `snake_case`
