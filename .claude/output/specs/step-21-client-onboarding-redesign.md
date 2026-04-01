# Étape 21 — Refonte de l'onboarding client (plateforme coach-centrique)

## Contexte et décisions de conception

### Problème

Le flux d'onboarding client actuel présente 5 problèmes structurels :

1. **La page `/register` permet aux clients de s'inscrire eux-mêmes** — en contradiction avec le modèle coach-centrique. Un client sans coach n'a aucune valeur sur la plateforme.
2. **Pas de mot de passe après invitation** — `inviteUserByEmail` crée un compte via magic link uniquement. La prochaine reconnexion impose un "mot de passe oublié". C'est bloquant pour des clients qui se connectent régulièrement.
3. **Welcome page morte** — `/client/welcome` affiche "Bienvenue" sans action guidée. Le client ne sait pas quoi faire ensuite.
4. **`/auth/complete-profile` non enforced** — Rien n'oblige le client à compléter son profil (contexte, sport/entreprise) avant d'accéder au dashboard. `context = NULL` reste possible.
5. **Badge "Compte actif" trompeur** — S'affiche si `user_id !== null` dans la table `clients`, même si l'auth user a été supprimé (cas Laporte).

### Décisions prises (issues du brainstorm)

**1. Inscription publique = coachs uniquement**
La page `/register` ne crée que des coachs. Le sélecteur de rôle est supprimé, `role: 'coach'` est hardcodé. Un client ne peut PAS s'inscrire lui-même.

**2. Invitation = seul chemin d'accès client**
Le coach crée la fiche client (email requis) puis clique "Inviter". L'action crée l'auth user via `admin.createUser` puis envoie un email Resend personnalisé avec `generateLink({ type: 'invite' })`. Le client reçoit un email en français, brandé MINND.

**3. Définition du mot de passe à l'acceptation de l'invitation**
Quand le client clique le lien, il est redirigé vers `/auth/accept-invite` où il définit son mot de passe AVANT d'accéder à quoi que ce soit. Pas de skip possible.

**4. Onboarding wizard en 2 étapes après le mot de passe**
`/client/onboarding` guide le client :
- Étape 1 : Confirmation du contexte (sport / corporate / wellbeing / coaching) + champ sport ou entreprise si applicable
- Étape 2 : CTA unique "Passer mon premier test" → `/test/pma`
Le middleware bloque l'accès à `/client/*` tant que `context = NULL`.

**5. Email requis à la création d'un client**
Dans le formulaire "Nouveau client", l'email devient obligatoire. Un modal propose immédiatement d'envoyer l'invitation après la création.

**6. Badge "Compte actif" validé**
Le badge s'affiche uniquement si l'auth user existe réellement. L'action `resetClientPasswordAction` (déjà corrigée) sert de modèle : on vérifie via `getUserById` avant d'afficher l'état.

---

## Architecture — Ce qui change

### `/register` — Suppression du sélecteur de rôle

**Avant :** `role: 'client' | 'coach'` sélectionnable + champs conditionnels selon rôle.
**Après :** Page simplifiée "Créer un compte Coach". `role` hardcodé à `'coach'`. Les champs `context` et `sport/entreprise` sont supprimés (inutiles pour un coach).

### Nouveau flux d'invitation

**Avant :** `inviteUserByEmail(email, { data: { coach_id, client_crm_id } })`
**Après :**
```
1. admin.auth.admin.createUser({
     email,
     app_metadata: { role: 'client', coach_id: coachId },
     user_metadata: { nom: client.nom },
     email_confirm: false   // le client doit cliquer le lien
   })

2. admin.auth.admin.generateLink({
     type: 'invite',
     email,
     options: { redirectTo: `${APP_URL}/auth/accept-invite` }
   })

3. Resend.send({
     to: email,
     template: "invitation-client-minnd",  // Email français brandé
     variables: { nom, coachNom, actionLink }
   })
```

### Nouvelle route `/auth/accept-invite`

Page client-side. Rendue accessible sans authentification complète (l'utilisateur vient de cliquer un magic link).

Flow :
1. Supabase échange le token automatiquement via `/auth/callback`
2. Callback détecte `type=invite` → redirige vers `/auth/accept-invite`
3. Page affiche un formulaire "Créez votre mot de passe" (nouveau mdp + confirmation)
4. Submit → `supabase.auth.updateUser({ password })` → redirect `/client/onboarding`

### Nouvelle route `/client/onboarding`

Page Server Component. Accessible uniquement si `user.role = 'client'` ET `context = NULL`.

Étapes :
1. **Contexte** : sélecteur sport / corporate / wellbeing / coaching
   - Si sport : champ "Discipline" (ex : Badminton)
   - Si corporate : champ "Entreprise"
   - Si wellbeing / coaching : rien
2. **Premier test** : CTA "Je suis prêt — commencer mon évaluation" → `/test/pma`

Action : `completeClientOnboardingAction(context, sport?, entreprise?)` — met à jour `public.users` et `public.clients` en parallèle.

### Middleware — Protection de `/client/*`

Ajout d'une vérification : si `role = 'client'` ET `context = NULL` → redirect `/client/onboarding`.
Exception : `/client/onboarding` lui-même est accessible.

### Email Resend — Template d'invitation

Nouveau template en français (composant React Email) :
- Objet : "Votre coach vous invite sur MINND"
- Corps : nom du client, nom du coach, bouton CTA "Rejoindre MINND"
- Branding MINND (teal #20808D, police Galano)
- Lien d'action : `generateLink.action_link`

---

## Fichiers à créer

| Fichier | Type | Description |
|---------|------|-------------|
| `src/app/(auth)/accept-invite/page.tsx` | Page | Formulaire de création de mot de passe post-invitation |
| `src/app/(client)/client/onboarding/page.tsx` | Page | Wizard 2 étapes : contexte + CTA premier test |
| `src/app/(client)/client/onboarding/OnboardingClient.tsx` | Client Component | Formulaire interactif du wizard |
| `src/emails/ClientInvitationEmail.tsx` | Email | Template Resend pour l'invitation client |
| `supabase/migrations/YYYYMMDD_fix_client_onboarding.sql` | Migration | Aucun changement de schéma — uniquement commentaires |

---

## Fichiers à modifier

| Fichier | Modification |
|---------|-------------|
| `src/app/(public)/register/page.tsx` (ou équivalent) | Supprimer sélecteur de rôle, hardcoder `role: 'coach'`, simplifier le formulaire |
| `src/app/actions/auth.ts` | Ajouter `completeClientOnboardingAction` |
| `src/app/actions/clients.ts` | Modifier `inviteClientAction` → `createUser` + `generateLink(type:'invite')` + Resend |
| `src/app/(dashboard)/coach/clients/new/page.tsx` | Rendre `email` requis + modal "Inviter maintenant ?" après création |
| `src/app/api/auth/callback/route.ts` (ou équivalent) | Détecter `type=invite` → redirect `/auth/accept-invite` |
| `middleware.ts` | Ajouter vérification `context = NULL` → redirect `/client/onboarding` |
| `src/components/coach/InvitationActions.tsx` | Valider l'existence de l'auth user avant d'afficher "Compte actif" |
| `src/lib/validations/auth.ts` | Ajouter `clientOnboardingSchema` |

---

## Critères d'acceptation

### Inscription

- [ ] La page `/register` ne propose plus de créer un compte "client"
- [ ] Un coach peut s'inscrire normalement (email + password + nom)
- [ ] Un client qui essaie d'accéder à `/register` peut s'inscrire mais sera sans coach (acceptable — le middleware le redirigera vers onboarding)

### Invitation

- [ ] Le champ email est requis dans "Nouveau client"
- [ ] Après création d'un client, un modal propose d'envoyer l'invitation immédiatement
- [ ] L'invitation envoie un email Resend en français avec le nom du coach et le nom du client
- [ ] L'email contient un lien qui expire (Supabase gère l'expiration — 1h par défaut)
- [ ] Le coach peut renvoyer l'invitation (nouveau lien, ancien invalidé)

### Acceptation de l'invitation

- [ ] Le client clique le lien → atterrit sur `/auth/accept-invite`
- [ ] Il doit définir un mot de passe (min 8 caractères, confirmation)
- [ ] Sans mot de passe défini, impossible d'accéder au dashboard
- [ ] Après le mot de passe → redirect `/client/onboarding`

### Onboarding

- [ ] `/client/onboarding` force le choix de contexte
- [ ] Les champs conditionnels (discipline, entreprise) s'affichent selon le contexte
- [ ] L'étape finale affiche un CTA unique vers le premier test
- [ ] Après complétion → `context` n'est plus NULL dans `public.users`
- [ ] Un client avec `context = NULL` est redirigé vers `/client/onboarding` par le middleware
- [ ] Un client avec `context` défini accède normalement à `/client`

### Badge "Compte actif"

- [ ] Le badge affiche "Compte actif" seulement si l'auth user existe réellement
- [ ] Un `user_id` orphelin affiche "Compte invalide" avec un bouton "Ré-inviter"
- [ ] "Ré-inviter" remet `user_id = NULL`, `invitation_status = 'none'`, puis lance une nouvelle invitation

---

## Contraintes techniques

- **NEVER** utiliser `any` TypeScript
- **Validation Zod** sur tous les inputs des Server Actions
- **Pas de refonte** du middleware existant — ajouter uniquement la règle `context = NULL`
- **Garder** le trigger SQL `link_client_on_email_confirm` — il reste utile pour les cas edge
- **Garder** la table `clients.invitation_status` et sa machine à états existante
- L'email d'invitation utilise **Resend** (déjà configuré), pas le SMTP Supabase natif
- Commentaires logique métier en **français**, code technique en **anglais**

---

## Ordre d'implémentation recommandé

1. **Modifier `/register`** — le plus simple, impact immédiat, aucun risque
2. **Créer `/auth/accept-invite`** + modifier le callback auth
3. **Modifier `inviteClientAction`** pour utiliser `createUser` + `generateLink` + Resend
4. **Créer `/client/onboarding`** + `completeClientOnboardingAction`
5. **Modifier le middleware** pour enforcer `context != NULL`
6. **Rendre email requis** dans le formulaire "Nouveau client" + modal invitation
7. **Corriger le badge "Compte actif"** dans `InvitationActions`
