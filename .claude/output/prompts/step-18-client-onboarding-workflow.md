# Step 18 — Workflow d'onboarding coach-client (invitations, statut, accès)

## Contexte & problème à résoudre

### Ce qui est cassé aujourd'hui

Le coach peut créer une fiche client dans le CRM, mais il n'existe **aucun moyen** de :
1. Envoyer au client ses accès à la plateforme (pas de bouton "Inviter")
2. Savoir si le client a bien reçu son invitation / a créé son compte
3. Renvoyer l'email d'invitation si le client ne l'a pas reçu
4. Réinitialiser le mot de passe d'un client depuis le dashboard coach

**Le flux actuel est cassé :**
```
Coach crée fiche CRM → clients.user_id = NULL
↓
Coach envoie un test → invite_token généré (lié au test, pas au client)
↓
Client reçoit l'email, clique, crée un compte → associateTestToUser() → clients.user_id renseigné
```

**Problèmes :**
- Le client n'a accès à la plateforme QUE si le coach lui a envoyé un test en premier
- Impossible d'inviter un client à créer son compte sans lui affecter un test
- Le coach ne sait jamais si le client a accepté ou non
- `clients.user_id` reste NULL indéfiniment si aucun test n'est envoyé

### Ce qu'il faut construire

Un workflow en 3 états clairs :
```
[Non invité] → [Invitation envoyée] → [Compte actif]
     ↓               ↓
  Bouton            Bouton
 "Inviter"        "Renvoyer"
```

---

## Stack technique

- **Next.js 14+ App Router** avec Server Actions
- **Supabase** : PostgreSQL + Auth + RLS
- Admin client (`createAdminClient()`) pour les opérations `auth.admin.*`
- **Resend** pour les emails (déjà intégré)
- **shadcn/ui** pour tous les composants UI

## Fichiers existants à connaître

```
src/
  app/
    actions/
      clients.ts          ← Server actions clients existantes (archiveClientAction, etc.)
    (dashboard)/coach/
      clients/
        [id]/page.tsx     ← Page détail client (MODIFIER)
  types/index.ts          ← Types TypeScript (MODIFIER)
  lib/
    supabase/
      server.ts           ← createClient() + createAdminClient()
supabase/
  migrations/             ← Nouvelles migrations SQL ici
```

### Table `clients` actuelle (colonnes pertinentes)
```sql
id          uuid PRIMARY KEY  -- CRM id (utilisé dans les URLs)
coach_id    uuid              -- FK vers users(id)
email       text              -- Email du client (nullable)
user_id     uuid              -- FK vers users(id) (NULL jusqu'à création compte)
nom         text
statut      varchar(20)       -- 'actif' | 'archive'
```

---

## Tâche 1 — Migration SQL : ajout statut d'invitation

Créer `supabase/migrations/20260401000000_add_invitation_status_to_clients.sql`

```sql
-- Migration: Ajout du statut d'invitation clients — Étape 18

-- Enum pour le statut d'invitation
CREATE TYPE public.invitation_status AS ENUM ('none', 'pending', 'accepted');

-- Colonnes d'invitation sur la table clients
ALTER TABLE public.clients
  ADD COLUMN invitation_status public.invitation_status NOT NULL DEFAULT 'none',
  ADD COLUMN invited_at        timestamptz;

-- Index pour requêtes par statut
CREATE INDEX idx_clients_invitation_status ON public.clients(invitation_status)
  WHERE invitation_status != 'accepted';

-- ============================================================
-- TRIGGER: Auto-link user_id quand un client accepte l'invitation
-- Déclenché quand un user Supabase Auth confirme son email
-- ============================================================
CREATE OR REPLACE FUNCTION public.link_client_on_email_confirm()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Quand un user confirme son email, cherche un client CRM avec le même email
  -- dont le user_id est encore NULL (pas encore lié)
  UPDATE public.clients
  SET
    user_id           = NEW.id,
    invitation_status = 'accepted'
  WHERE
    LOWER(email)      = LOWER(NEW.email)
    AND user_id       IS NULL
    AND invitation_status = 'pending';

  RETURN NEW;
END;
$$;

-- Trigger sur auth.users (email_confirmed_at passe de NULL à une valeur)
-- Note: nécessite une migration dans le schéma auth via service_role
CREATE OR REPLACE TRIGGER trg_link_client_on_confirm
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.link_client_on_email_confirm();

-- RLS : le coach peut mettre à jour invitation_status et invited_at sur ses propres clients
-- (déjà couvert par la policy UPDATE existante sur clients si elle existe)
-- Vérifier que la policy UPDATE du coach inclut ces colonnes
```

> **Note :** Si le trigger `auth.users` n'est pas applicable (restrictions Supabase), utiliser
> à la place un callback webhook ou vérifier `user_id` dans `getClientAction()` avec une
> requête `auth.admin.getUserByEmail()` — voir Tâche 4.

---

## Tâche 2 — Types TypeScript

Dans `src/types/index.ts`, ajouter :

```typescript
// Statut d'invitation d'un client coach
export type InvitationStatus = 'none' | 'pending' | 'accepted'
```

Dans l'interface `Client` (ou `CrmClient`) existante, ajouter les champs :
```typescript
invitation_status: InvitationStatus
invited_at: string | null
```

---

## Tâche 3 — Server Actions : inviteClientAction & resendInviteAction

Dans `src/app/actions/clients.ts`, ajouter les deux actions suivantes.

### `inviteClientAction`

```typescript
'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Envoie une invitation Supabase Auth au client.
 * - Crée ou retrouve l'utilisateur dans auth.users
 * - Envoie l'email d'invitation (lien d'accès avec mot de passe à définir)
 * - Met à jour clients.invitation_status = 'pending' + invited_at = now()
 */
export async function inviteClientAction(
  clientId: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  // Récupérer la fiche client (vérification que le coach est bien propriétaire)
  const admin = createAdminClient()
  const { data: client, error: fetchError } = await admin
    .from('clients')
    .select('id, email, nom, coach_id, invitation_status, user_id')
    .eq('id', clientId)
    .eq('coach_id', user.id)
    .single()

  if (fetchError || !client) return { error: 'Client introuvable' }
  if (!client.email) return { error: 'Ce client n\'a pas d\'adresse email renseignée' }
  if (client.user_id) return { error: 'Ce client a déjà un compte actif' }

  // Envoyer l'invitation via Supabase Auth Admin API
  // Si l'utilisateur existe déjà, renvoie un lien d'invite (re-invite)
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    client.email,
    {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/client/welcome`,
      data: {
        // Métadonnées transmises à auth.users.user_metadata
        coach_id: user.id,
        client_crm_id: clientId,
        nom: client.nom,
      },
    }
  )

  if (inviteError) {
    // Cas : email déjà confirmé (user existe déjà)
    if (inviteError.message?.includes('already been registered')) {
      // Tenter de récupérer l'user existant et lier manuellement
      const { data: existingUser } = await admin.auth.admin.listUsers()
      const found = existingUser?.users.find(
        (u) => u.email?.toLowerCase() === client.email!.toLowerCase()
      )
      if (found) {
        await admin
          .from('clients')
          .update({ user_id: found.id, invitation_status: 'accepted' })
          .eq('id', clientId)
        revalidatePath(`/coach/clients/${clientId}`)
        return { error: null }
      }
    }
    return { error: `Erreur d'invitation : ${inviteError.message}` }
  }

  // Mettre à jour le statut dans le CRM
  await admin
    .from('clients')
    .update({
      invitation_status: 'pending',
      invited_at: new Date().toISOString(),
    })
    .eq('id', clientId)

  revalidatePath(`/coach/clients/${clientId}`)
  return { error: null }
}
```

### `resendInviteAction`

```typescript
/**
 * Renvoie l'email d'invitation (même logique qu'inviteClientAction).
 * Supabase génère un nouveau lien et invalide l'ancien.
 */
export async function resendInviteAction(
  clientId: string
): Promise<{ error: string | null }> {
  // Même logique qu'inviteClientAction — appel direct
  return inviteClientAction(clientId)
}
```

### `resetClientPasswordAction` (optionnel v1)

```typescript
/**
 * Envoie un email de réinitialisation de mot de passe au client.
 * Utilise generateLink pour créer un lien recovery.
 */
export async function resetClientPasswordAction(
  clientId: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const admin = createAdminClient()
  const { data: client } = await admin
    .from('clients')
    .select('email, user_id, coach_id')
    .eq('id', clientId)
    .eq('coach_id', user.id)
    .single()

  if (!client?.email || !client.user_id) {
    return { error: 'Client sans compte actif' }
  }

  const { error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: client.email,
    options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password` },
  })

  return { error: error?.message ?? null }
}
```

---

## Tâche 4 — Synchronisation user_id (fallback sans trigger)

Si le trigger `auth.users` n'est pas faisable, ajouter cette logique dans `getClientAction()` :

```typescript
// Dans getClientAction, après avoir récupéré le client :
// Si invitation_status = 'pending' et user_id = NULL,
// vérifier si l'utilisateur a créé son compte depuis
if (client.invitation_status === 'pending' && !client.user_id && client.email) {
  const admin = createAdminClient()
  const { data: users } = await admin.auth.admin.listUsers()
  const confirmedUser = users?.users.find(
    (u) =>
      u.email?.toLowerCase() === client.email!.toLowerCase() &&
      u.email_confirmed_at !== null
  )
  if (confirmedUser) {
    await admin
      .from('clients')
      .update({ user_id: confirmedUser.id, invitation_status: 'accepted' })
      .eq('id', client.id)
    client.user_id = confirmedUser.id
    client.invitation_status = 'accepted'
  }
}
```

---

## Tâche 5 — Composant UI : InvitationStatusBadge + boutons d'action

Créer `src/components/coach/InvitationActions.tsx` :

```tsx
'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Mail, RotateCcw, CheckCircle2, UserX } from 'lucide-react'
import { inviteClientAction, resendInviteAction } from '@/app/actions/clients'
import type { InvitationStatus } from '@/types'

interface InvitationActionsProps {
  clientId: string
  status: InvitationStatus
  hasUserAccount: boolean  // client.user_id !== null
}

export function InvitationActions({
  clientId,
  status,
  hasUserAccount,
}: InvitationActionsProps) {
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function handleInvite() {
    setMessage(null)
    startTransition(async () => {
      const result = await inviteClientAction(clientId)
      if (result.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({ type: 'success', text: 'Invitation envoyée !' })
      }
    })
  }

  function handleResend() {
    setMessage(null)
    startTransition(async () => {
      const result = await resendInviteAction(clientId)
      if (result.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({ type: 'success', text: 'Invitation renvoyée !' })
      }
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {/* Badge statut */}
        {status === 'none' && !hasUserAccount && (
          <Badge variant="outline" className="text-gray-500 gap-1">
            <UserX className="h-3 w-3" />
            Non invité
          </Badge>
        )}
        {status === 'pending' && !hasUserAccount && (
          <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 gap-1">
            <Mail className="h-3 w-3" />
            Invitation envoyée
          </Badge>
        )}
        {(status === 'accepted' || hasUserAccount) && (
          <Badge className="bg-green-100 text-green-700 gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Compte actif
          </Badge>
        )}

        {/* Bouton action */}
        {status === 'none' && !hasUserAccount && (
          <Button
            size="sm"
            onClick={handleInvite}
            disabled={isPending}
            className="bg-[#20808D] hover:bg-[#1a6b77] text-white gap-1"
          >
            <Mail className="h-3.5 w-3.5" />
            {isPending ? 'Envoi…' : 'Inviter'}
          </Button>
        )}
        {status === 'pending' && !hasUserAccount && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleResend}
            disabled={isPending}
            className="gap-1"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {isPending ? 'Envoi…' : 'Renvoyer'}
          </Button>
        )}
      </div>

      {message && (
        <p className={`text-xs ${message.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
```

---

## Tâche 6 — Intégration dans ClientDetailPage

Dans `src/app/(dashboard)/coach/clients/[id]/page.tsx` :

### 1. Import à ajouter
```typescript
import { InvitationActions } from '@/components/coach/InvitationActions'
```

### 2. Dans l'en-tête client (dans la div des infos client)

Après les badges existants (statut, tags), ajouter :

```tsx
{/* Statut d'invitation et action */}
<div className="mt-2">
  <InvitationActions
    clientId={id}
    status={client.invitation_status}
    hasUserAccount={!!client.user_id}
  />
</div>
```

### 3. S'assurer que `getClientAction` retourne les nouveaux champs

Dans `src/app/actions/clients.ts`, la requête `select` de `getClientAction` doit inclure :
```typescript
.select(`
  id,
  ...,  // champs existants
  invitation_status,
  invited_at
`)
```

---

## Tâche 7 — Variable d'environnement requise

S'assurer que `NEXT_PUBLIC_APP_URL` est défini dans `.env.local` et `.env.production` :

```env
NEXT_PUBLIC_APP_URL=https://votre-domaine.com
# En dev :
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Tâche 8 — Page de bienvenue client (optionnel v1)

Créer `src/app/(client)/client/welcome/page.tsx` — page affichée après clic sur le lien d'invitation :

```tsx
// Page simple qui confirme que le compte est créé
// et redirige vers /client/dashboard
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function WelcomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold text-[#1A1A2E]">Bienvenue sur MINND !</h1>
        <p className="text-muted-foreground">Votre compte est activé.</p>
        <a href="/client/dashboard" className="text-[#20808D] underline">
          Accéder à mon espace
        </a>
      </div>
    </div>
  )
}
```

---

## Résumé des fichiers à créer / modifier

| Fichier | Action |
|---------|--------|
| `supabase/migrations/20260401000000_add_invitation_status_to_clients.sql` | CRÉER |
| `src/types/index.ts` | MODIFIER (InvitationStatus + champs dans Client) |
| `src/app/actions/clients.ts` | MODIFIER (inviteClientAction, resendInviteAction) |
| `src/components/coach/InvitationActions.tsx` | CRÉER |
| `src/app/(dashboard)/coach/clients/[id]/page.tsx` | MODIFIER (import + intégration) |
| `src/app/(client)/client/welcome/page.tsx` | CRÉER (optionnel) |

---

## Critères d'acceptation

- [ ] Un coach sans email renseigné sur le client voit un message d'erreur clair
- [ ] Le badge statut change de "Non invité" → "Invitation envoyée" sans rechargement de page
- [ ] Le bouton "Renvoyer" apparaît si le statut est "pending"
- [ ] Quand le client accepte et crée son compte, le badge passe à "Compte actif"
- [ ] `clients.user_id` est renseigné automatiquement après création du compte
- [ ] Un client avec compte actif ne voit pas de bouton d'invitation

---

## Risques à gérer

1. **Email déjà dans Supabase Auth** (client de plusieurs coachs) — géré dans `inviteClientAction` avec fallback `listUsers`
2. **Lien d'invite expiré** (24h par défaut) — le bouton "Renvoyer" suffit
3. **NEXT_PUBLIC_APP_URL manquant** — `inviteUserByEmail` plantera, vérifier les env vars
4. **RLS sur clients** — vérifier que le coach ne peut inviter que SES clients (le `eq('coach_id', user.id)` le garantit)
