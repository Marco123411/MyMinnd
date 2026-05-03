# Phase 3 — Retrait des API, server actions et emails hors MVP

## Pré-requis

- Phases 1 et 2 complétées
- Tu dois être sur la branche `mvp-launch`
- `npm run build` et `npm run lint` passent
- Working tree propre

## Contexte projet

Projet : **MINND Mental Performance** — SaaS coach/client.

**Stack** : Next.js 14+ App Router, Supabase, Stripe, Resend.

**Règles projet** (voir `CLAUDE.md`) :
- Pas de `any` TypeScript
- Pas de silent catch
- Validation Zod aux frontières
- Commentaires métier en français

## Périmètre Phase 3

Retirer la couche **API routes, server actions, emails et logique Stripe** correspondant aux features hors MVP, sans toucher à la BDD (Phase 4).

## Tâches à exécuter

### Tâche 3.1 — Retrait API tests cognitifs

**Supprimer** :
- `src/app/api/cognitive/` (toutes les routes : `[sessionId]/score/`, `load-preview/`, etc.)
- Tout server action lié au cognitif dans `src/lib/actions/` ou `src/app/actions/` (chercher fichiers nommés `cognitive*`, ou contenant des références à `cognitive_sessions`, `cognitive_trials`, `cognitive_test_definitions`)
- Tout helper de scoring cognitif dans `src/lib/`

**Important** : ne pas toucher aux migrations BDD (Phase 4). Les tables resteront en BDD jusqu'à la Phase 4.

**Commit** : `chore(mvp): retrait API tests cognitifs`

### Tâche 3.2 — Retrait server actions marketplace

**Supprimer** :
- Le fichier `marketplace.ts` (probablement dans `src/lib/actions/` ou `src/app/actions/`)
- Toute API route liée si présente (`src/app/api/marketplace/`, `src/app/api/experts/`)

**Vérifier** : aucune autre partie du code n'importe ces actions (sinon supprimer/adapter les imports).

**Commit** : `chore(mvp): retrait server actions marketplace`

### Tâche 3.3 — Retrait Profile Intelligence avancé

**Supprimer** :
- `src/components/profile-intelligence/` (si pas déjà fait en Phase 2)
- Le fichier server action `profile-intelligence.ts`
- Toute API route liée

**À conserver impérativement** :
- Le scoring de base (`scoring.ts`) — calcul z-scores, percentiles
- La logique normative basique (`normative_stats`)
- Les `profiles` simples si utilisés pour afficher le résultat d'un test au coach

**Vérifier** que les pages de résultats de test fonctionnent toujours après ce retrait.

**Commit** : `chore(mvp): retrait Profile Intelligence avancé`

### Tâche 3.4 — Simplification du workflow dispatch (expert externe)

**Contexte critique** : la table `dispatches` est utilisée pour DEUX choses :
- Workflow expert externe (admin envoie un test à un expert qui le review) → **À retirer**
- Publication coach→client (le coach annote, puis publie ; client voit après `released_at`) → **À conserver**

**Démarche** :

1. **Lire** le fichier des server actions dispatches (probablement `dispatches.ts`)
2. **Identifier** quelles fonctions servent au workflow expert vs au workflow coach
3. **Retirer** les fonctions du workflow expert :
   - Assignation d'un dispatch à un expert
   - Notification de l'expert
   - Récupération de la review d'un expert
4. **Conserver** les fonctions du workflow coach :
   - Création d'un dispatch quand le coach annote
   - Mise à jour de `released_at` quand le coach publie
   - Récupération côté client des dispatches `released_at IS NOT NULL`

**Simplifier les statuts** : si possible, restreindre l'usage des statuts `dispatches.status` à `draft` / `released` / `archived` côté code (sans modifier le schéma BDD encore).

**Commit** : `chore(mvp): retrait workflow dispatch expert externe`

### Tâche 3.5 — Retrait des emails dispatch expert

**Supprimer ces fichiers d'emails** dans `src/emails/` :
- `DispatchAdminEmail.tsx`
- `DispatchExpertEmail.tsx`
- `DispatchClientEmail.tsx` — **à vérifier d'abord** :
  - Si utilisé pour notifier le client après review d'un **expert externe** → supprimer
  - Si utilisé pour notifier le client après publication par le **coach** → conserver et renommer si pertinent
  - En cas de doute, demander à l'utilisateur

**Conserver impérativement** :
- `ClientInvitationEmail`
- `ClientManualActivationEmail`
- `PasswordResetEmail`
- `TestInvitationEmail`
- `TestCompletedCoachEmail`
- `TestResultsReadyEmail`
- `ReviewRequestEmail`
- Tout email Stripe

**Nettoyer** les appels à ces emails dans les server actions retirées en 3.4.

**Commit** : `chore(mvp): retrait emails dispatch expert`

### Tâche 3.6 — Simplification Stripe

**Conserver** :
- `src/app/api/stripe/checkout-session/`
- `src/app/api/stripe/portal-session/`
- `src/app/api/stripe/webhooks/`

**Supprimer** :
- `src/app/api/stripe/checkout-test/` (achat unique de tests par les clients)

**Simplifier** :
- Dans la logique Stripe (`src/lib/stripe/` ou équivalent), si plusieurs tiers existent (`free`, `pro`, `expert`), simplifier à **un seul abonnement coach**
- Mettre à jour les webhooks pour ne gérer qu'un seul produit
- Adapter le code qui lit `payments.tier` pour accepter une valeur unique

**Ne pas modifier** la table `payments` en BDD (Phase 4).

**Commit** : `chore(mvp): simplification Stripe à un seul abonnement coach`

### Tâche 3.7 — Retrait des niveaux PMA (logique)

**Si une logique différencie Discovery / Complete / Expert** dans :
- Le moteur de test
- Le scoring
- Le déclenchement de PDF
- L'envoi d'emails

**Action** : simplifier pour qu'il n'y ait qu'un seul comportement. Retirer les branches conditionnelles liées au tier de test.

**Important** : conserver la logique de scoring, juste retirer les variations selon le tier.

**Commit** : `chore(mvp): unification des niveaux PMA en un seul niveau`

### Tâche 3.8 — Validation finale

- `npm run build` passe sans erreur
- `npm run lint` passe
- Test manuel :
  - Coach invite un client → email d'invitation reçu
  - Client active son compte → onboarding OK
  - Coach distribue un test → client le passe
  - Coach reçoit notification de fin de test
  - Coach annote et publie → client reçoit notification et voit ses résultats
  - Coach souscrit à l'abonnement Stripe → checkout fonctionne

**Commit final** : `chore(mvp): phase 3 — API, emails et Stripe simplifiés`

## Pièges à éviter

- **Ne pas** drop de tables BDD en Phase 3 (c'est la Phase 4)
- **Ne pas** supprimer la table `dispatches` ni `payments` en code
- Si une server action est utilisée à la fois par du code MVP et hors MVP, **séparer en deux** plutôt que tout supprimer
- Avant de supprimer un email, vérifier qu'il n'est pas appelé depuis un endroit MVP (chercher les `import` dans tout le projet)
- Si un doute sur un fichier (utilisé ou pas), **demander à l'utilisateur** plutôt que supprimer

## Fin de phase

Pousser la branche : `git push origin mvp-launch`

Signaler à l'utilisateur :
- Que la Phase 3 est terminée
- Que les tables BDD non utilisées existent toujours mais sans aucun code qui les référence
- Qu'il peut lancer la Phase 4 avec `phase-4-bdd.md` (de préférence avec un développeur, sur un environnement de staging d'abord)
