# Implémentation : Finalisation de l'onboarding client (étape 21)

## Contexte

L'architecture de l'onboarding client a été conçue et partiellement implémentée. Il reste 3 éléments manquants à créer ou corriger pour que le flux soit fonctionnel de bout en bout.

### Flux complet attendu

```
Coach invite client
  → email Resend avec lien → /auth/callback?type=invite
  → /accept-invite (définir mot de passe) ✅
  → /client/onboarding (wizard contexte) ← MANQUE OnboardingClient.tsx
  → /client (dashboard) ← MANQUE middleware enforcement
```

---

## Ce qui existe déjà (ne pas retoucher)

| Fichier | État |
|---------|------|
| `src/app/(auth)/accept-invite/page.tsx` | ✅ Fonctionnel |
| `src/app/(client)/client/onboarding/page.tsx` | ✅ Shell fonctionnel |
| `src/app/actions/auth.ts` → `completeClientOnboardingAction` | ✅ Fonctionnel |
| `src/app/actions/clients.ts` → `inviteClientAction` | ✅ Fonctionnel |
| `src/components/coach/InvitationActions.tsx` | ✅ Fonctionnel |
| `src/app/(auth)/register/page.tsx` | ✅ Coach-only |

---

## Tâche 1 — Créer `OnboardingClient.tsx`

**Fichier à créer :** `src/app/(client)/client/onboarding/OnboardingClient.tsx`

Ce composant est déjà importé dans `onboarding/page.tsx` :
```tsx
import { OnboardingClient } from './OnboardingClient'
// ...
<OnboardingClient prenom={prenom} />
```

Il reçoit la prop `prenom: string`.

### Comportement

Wizard en 2 étapes :

**Étape 1 — Choix du contexte**
- Sélecteur de contexte : 4 options (cartes cliquables, pas un `<select>`)
  - `sport` → "Athlète / Sport"
  - `corporate` → "Entreprise / Corporate"
  - `wellbeing` → "Bien-être / Santé"
  - `coaching` → "Développement personnel"
- Si `sport` sélectionné : champ texte "Votre discipline" (ex: Badminton) — optionnel
- Si `corporate` sélectionné : champ texte "Votre entreprise" — optionnel
- Si `wellbeing` ou `coaching` : aucun champ supplémentaire
- Bouton "Continuer →"

**Étape 2 — Premier test**
- Message de bienvenue avec le prénom
- CTA unique : bouton "Commencer mon évaluation" → `router.push('/test/pma')`
- Lien secondaire : "Explorer mon espace d'abord" → `router.push('/client')`

### Appel de l'action

Sur soumission de l'étape 1, appeler `completeClientOnboardingAction` depuis `@/app/actions/auth` :

```typescript
import { completeClientOnboardingAction } from '@/app/actions/auth'

// formData : { context: 'sport' | 'corporate' | 'wellbeing' | 'coaching', sport?: string, entreprise?: string }
const result = await completeClientOnboardingAction(formData)
if (result.error) {
  setError(result.error)
  return
}
// Passer à l'étape 2
setStep(2)
```

### Contraintes UI

- **shadcn/ui uniquement** : `Button`, `Input`, `Label`, `Card`
- Couleurs MINND : teal `#20808D`, dark `#1A1A2E`, light teal bg `#E8F4F5`
- Mobile-first (max-width: `max-w-lg`, centré)
- Indicateur d'étapes simple : "Étape 1 sur 2" en texte petit
- Pas d'animations complexes — transitions simples avec `useState`

### Types

```typescript
import type { ClientOnboardingFormData } from '@/lib/validations/auth'
// ClientOnboardingFormData = { context: 'sport' | 'corporate' | 'wellbeing' | 'coaching', sport?: string, entreprise?: string }
```

---

## Tâche 2 — Corriger le redirect dans `/auth/callback`

**Fichier :** `src/app/auth/callback/route.ts`

**Problème :** Lignes 81-83, pour un client avec `context === null`, le callback redirige vers `/complete-profile`. Mais le flux d'invitation doit aller vers `/client/onboarding`.

**Correction :**

```typescript
// AVANT (ligne 81-83) :
if (userData.context === null && userData.role === 'client') {
  return NextResponse.redirect(`${base}/complete-profile`)
}

// APRÈS :
if (userData.context === null && userData.role === 'client') {
  return NextResponse.redirect(`${base}/client/onboarding`)
}
```

---

## Tâche 3 — Ajouter la règle `context = NULL` dans le middleware

**Fichier :** `middleware.ts`

**Problème :** Le middleware actuel vérifie uniquement le rôle. Un client avec `context = NULL` peut accéder à `/client` sans passer par l'onboarding.

**Modification à apporter :**

Dans la fonction `middleware`, après la récupération de `userData.role` (ligne ~74), ajouter une requête supplémentaire pour le contexte client :

```typescript
// Après avoir récupéré role :
const role = userData.role as UserRole

// Mauvais rôle pour cette route → redirection vers l'espace approprié
if (!isRouteAllowed(pathname, role)) {
  return NextResponse.redirect(new URL(roleHome(role), request.url))
}

// AJOUTER ICI — Client sans contexte → forcer l'onboarding
if (
  role === 'client' &&
  pathname.startsWith('/client') &&
  pathname !== '/client/onboarding'
) {
  const { data: clientProfile } = await supabase
    .from('users')
    .select('context')
    .eq('id', user.id)
    .single()

  if (clientProfile && clientProfile.context === null) {
    return NextResponse.redirect(new URL('/client/onboarding', request.url))
  }
}
```

**Important :** La requête `users` est déjà faite plus haut pour le rôle. Pour éviter une double requête, modifier la première sélection pour inclure `context` en même temps que `role` :

```typescript
// AVANT :
const { data: userData } = await supabase
  .from('users')
  .select('role')
  .eq('id', user.id)
  .single()

// APRÈS :
const { data: userData } = await supabase
  .from('users')
  .select('role, context')
  .eq('id', user.id)
  .single()
```

Puis la règle onboarding utilise directement `userData.context` sans requête supplémentaire :

```typescript
if (
  role === 'client' &&
  pathname.startsWith('/client') &&
  pathname !== '/client/onboarding'
) {
  if (userData.context === null) {
    return NextResponse.redirect(new URL('/client/onboarding', request.url))
  }
}
```

---

## Résumé des fichiers à toucher

| Fichier | Action | Difficulté |
|---------|--------|------------|
| `src/app/(client)/client/onboarding/OnboardingClient.tsx` | CRÉER | Principale |
| `src/app/auth/callback/route.ts` | MODIFIER (1 ligne) | Triviale |
| `middleware.ts` | MODIFIER (select + règle context) | Simple |

---

## Critères d'acceptation

- [ ] Un client qui reçoit l'invitation, clique le lien, définit son mot de passe → atterrit sur `/client/onboarding`
- [ ] Le wizard affiche les 4 options de contexte sous forme de cartes
- [ ] Le champ "Discipline" apparaît si `sport` est sélectionné
- [ ] Le champ "Entreprise" apparaît si `corporate` est sélectionné
- [ ] Après validation → étape 2 s'affiche avec CTA "Commencer mon évaluation"
- [ ] Un client avec `context = NULL` qui tente d'aller sur `/client/dashboard` est redirigé vers `/client/onboarding`
- [ ] Un client avec `context` défini accède normalement à `/client`
- [ ] Pas de `any` TypeScript
- [ ] shadcn/ui uniquement pour les composants

---

## Contraintes globales (CLAUDE.md)

- `NEVER` utiliser `any` TypeScript
- `NEVER` silent catch — toujours gérer les erreurs explicitement
- Valider les inputs avec Zod (déjà fait dans `completeClientOnboardingAction`)
- shadcn/ui pour tous les composants UI
- Commentaires logique métier en **français**, code technique en **anglais**
