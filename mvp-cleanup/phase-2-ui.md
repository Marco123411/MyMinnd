# Phase 2 — Retrait des UI hors MVP

## Pré-requis

- Phase 1 complétée
- Tu dois être sur la branche `mvp-launch` (vérifier avec `git branch --show-current`)
- Working tree propre

## Contexte projet

Projet : **MINND Mental Performance** — SaaS de performance mentale pour coachs et clients.

**Stack** : Next.js 14+ App Router, Supabase, Tailwind + shadcn/ui, Stripe, Resend, @react-pdf/renderer.

**Règles projet** (voir `CLAUDE.md`) :
- shadcn/ui pour tout composant UI, jamais de composant custom équivalent
- Pas de `any` TypeScript
- Pas de silent catch
- Validation Zod aux frontières
- Commentaires métier en français, code technique en anglais

## Périmètre MVP cible

### Conservé
Auth, CRM coach, tests psychométriques (un seul niveau), annotations + publication, programmes/exercices/séances (sans cognitif), espace client, rapports PDF, profil coach, emails Resend, Stripe (1 abonnement coach), admin minimal (création/activation coachs).

### Retiré (cette phase = couche UI uniquement)
- Tests cognitifs (PVT, Simon, Stroop, Digital Span)
- Marketplace experts
- Admin étendu (monitoring, content, experts, cognitive-presets, dispatch externe)

## Objectif Phase 2

Retirer **uniquement les pages, routes, composants et liens de navigation** des features hors MVP. Ne pas toucher :
- Aux server actions / API routes (Phase 3)
- Aux migrations / schéma BDD (Phase 4)
- Aux emails (Phase 3)

## Tâches à exécuter

### Tâche 2.1 — Retrait UI tests cognitifs

**Supprimer ces dossiers et leur contenu** :
- `src/app/(client)/client/cognitive/`

**Identifier puis supprimer les composants cognitifs** dans `src/components/` :
- Tout composant `PVT*`, `Simon*`, `Stroop*`, `DigitalSpan*`
- `CognitiveTrendChart.tsx`, `BenchmarkDonut.tsx`
- Tout dossier `cognitive/` ou `cognitive-*` sous `src/components/`

**Nettoyer les liens de navigation** vers ces pages :
- Dans le layout client (`src/app/(client)/client/layout.tsx` ou équivalent)
- Dans tout dashboard / sidebar / menu qui pointe vers `/client/cognitive`

**Nettoyer les imports orphelins** :
- Après suppression, faire `npm run build` et corriger les imports cassés
- Les references à des composants/pages cognitifs dans des dashboards/widgets doivent être retirées proprement (pas de commentaire `// removed`)

**Commit** : `chore(mvp): retrait UI tests cognitifs`

### Tâche 2.2 — Retrait UI marketplace experts

**Supprimer ces dossiers** :
- `src/app/(public)/marketplace/`

**Identifier puis supprimer les composants liés** :
- Tout composant sous `src/components/` dont le nom contient `marketplace`, `expert-card`, `expert-list`, `expert-profile` (à confirmer en cherchant)

**Nettoyer les liens** :
- Tout lien `/marketplace` dans la navigation publique, footer, header
- Tout lien depuis l'espace client vers la marketplace

**Commit** : `chore(mvp): retrait UI marketplace experts`

### Tâche 2.3 — Retrait UI admin étendu

**Supprimer ces dossiers admin** :
- `src/app/(admin)/admin/dispatch/`
- `src/app/(admin)/admin/experts/`
- `src/app/(admin)/admin/cognitive-presets/`
- `src/app/(admin)/admin/content/`
- `src/app/(admin)/admin/monitoring/`
- `src/app/(admin)/admin/config/` (si présent et non lié à la création de coachs)

**Conserver** :
- `src/app/(admin)/admin/utilisateurs/` (création/activation de coachs — cœur admin MVP)
- Le layout admin et la page d'accueil admin (à simplifier si nécessaire)

**Nettoyer la navigation admin** :
- Sidebar / menu admin : retirer toutes les entrées vers les pages supprimées
- Page d'accueil admin : retirer les widgets/cartes qui pointent vers du contenu supprimé

**Commit** : `chore(mvp): retrait UI admin étendu`

### Tâche 2.4 — Retrait des niveaux PMA dans la sélection de tests (UI uniquement)

Si l'UI propose un choix Discovery / Complete / Expert lors de la distribution d'un test :

- Localiser les pages : probablement dans `src/app/(test)/` ou `src/app/(dashboard)/coach/` lors de la création/distribution d'un test
- Simplifier l'UI pour qu'un test soit attribué directement, sans choix de niveau
- Conserver le moteur de test, retirer uniquement le sélecteur de tier

**Important** : ne pas toucher aux server actions / scoring. On retire seulement le sélecteur visuel.

**Commit** : `chore(mvp): retrait sélecteur niveaux PMA dans l'UI`

### Tâche 2.5 — Validation

- Lancer `npm run build` et vérifier qu'il passe sans erreur
- Lancer `npm run lint` et corriger les warnings éventuels liés aux fichiers touchés
- Lancer `npm run dev` et vérifier manuellement :
  - Login coach → dashboard coach OK
  - Liste clients OK
  - Distribuer un test à un client OK
  - Login client → espace client OK
  - Pages cognitif / marketplace / admin étendu retournent 404 (normal, supprimées)

**Commit final** : `chore(mvp): phase 2 — UI hors MVP retirée`

## Pièges à éviter

- Ne **pas** supprimer `src/app/(client)/client/review/[dispatchId]/` — c'est la page où le client consulte ses résultats publiés par le coach (utilise la table `dispatches` mais pour le workflow coach→client, pas expert)
- Ne **pas** supprimer la table `dispatches` ni y faire référence (Phase 4)
- Ne **pas** supprimer les server actions ni les API routes (Phase 3)
- Ne **pas** toucher aux fichiers d'emails (`src/emails/`) — Phase 3
- Si tu trouves un composant utilisé à la fois par du code MVP et hors MVP, **garder** et signaler à l'utilisateur

## Critères de validation Phase 2

- [ ] `npm run build` passe
- [ ] `npm run lint` passe
- [ ] Tous les flows MVP listés ci-dessus fonctionnent en local
- [ ] Aucune référence cassée dans la navigation
- [ ] Commits atomiques poussés sur `mvp-launch`

## Fin de phase

Pousser la branche : `git push origin mvp-launch`

Signaler à l'utilisateur que la Phase 2 est terminée et qu'il peut lancer la Phase 3 avec `phase-3-api.md`.
