# Feature : Clients pré-existants — Upload dossier PDF + Validation manuelle

## Contexte métier

Marc a des clients qu'il a validés avant la création de la plateforme (en commission, avec acompte).
Il veut pouvoir :
1. Créer ces clients dans son CRM coach
2. Joindre leur dossier d'inscription (PDF rempli avant la plateforme) à leur fiche
3. Activer leur compte manuellement (sans attendre leur confirmation email)
4. Le client reçoit un email "créez votre mot de passe" et peut accéder immédiatement

---

## Ce qui existe déjà (NE PAS TOUCHER)

- `/coach/clients/new` — Formulaire de création client (fonctionnel)
- `src/app/actions/clients.ts` — `createClientAction()`, `inviteClientAction()`
- `supabase/migrations/20260401000000_add_invitation_status_to_clients.sql` — ENUM `invitation_status` (`none | pending | accepted`)
- Trigger PostgreSQL `link_client_on_email_confirm()` — lie `clients.user_id` quand email confirmé (NE PAS MODIFIER)
- Bucket Supabase Storage `reports` — pattern de référence pour les policies

---

## Ce qui doit être implémenté

### 1. Migration SQL

Créer `supabase/migrations/20260417000000_clients_documents_manual_validation.sql` :

```sql
-- Ajouter les champs pour les dossiers et la validation manuelle
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS documents JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS manually_validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS manually_validated_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Commentaires
COMMENT ON COLUMN public.clients.documents IS
  'Liste de documents attachés : [{name, url, uploaded_at, uploaded_by, type}]';
COMMENT ON COLUMN public.clients.manually_validated_at IS
  'Timestamp de la validation manuelle du compte (bypass flux invitation email)';
COMMENT ON COLUMN public.clients.manually_validated_by IS
  'ID du coach/admin qui a validé manuellement';

-- Nouveau bucket Supabase Storage pour les dossiers clients
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dossiers',
  'dossiers',
  false,
  10485760, -- 10 MB max
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Policy : Le coach peut uploader les dossiers de SES clients
CREATE POLICY "coaches_upload_own_client_documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'dossiers'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);

-- Policy : Le coach peut lire les dossiers de SES clients
CREATE POLICY "coaches_read_own_client_documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'dossiers'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);

-- Policy : L'admin peut tout lire
CREATE POLICY "admin_read_all_documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'dossiers'
  AND public.get_my_role() = 'admin'
);

-- Policy : Le coach peut supprimer ses dossiers
CREATE POLICY "coaches_delete_own_client_documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'dossiers'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);
```

---

### 2. Types TypeScript

Dans `src/types/index.ts`, ajouter dans l'interface `Client` existante :

```typescript
// Documents joints (dossiers d'inscription, etc.)
documents: ClientDocument[]
manually_validated_at: string | null
manually_validated_by: string | null
```

Ajouter le type `ClientDocument` :

```typescript
export interface ClientDocument {
  name: string          // Nom affiché ("Dossier inscription 2024")
  url: string           // URL signée ou chemin storage
  type: 'inscription' | 'contrat' | 'autre'
  uploaded_at: string   // ISO timestamp
  uploaded_by: string   // UUID du coach
}
```

---

### 3. Server Action `manuallyValidateClientAction()`

Dans `src/app/actions/clients.ts`, ajouter APRÈS les fonctions d'invitation existantes :

```typescript
/**
 * Validation manuelle d'un client pré-existant.
 * Bypass le flux d'invitation email classique.
 * Crée le compte Supabase Auth avec email déjà confirmé,
 * lie le client CRM, et envoie un lien "créer mot de passe".
 *
 * IMPORTANT: N'utilise PAS le trigger link_client_on_email_confirm()
 * car on bypasse la confirmation email — la liaison est faite manuellement ici.
 */
export async function manuallyValidateClientAction(clientId: string): Promise<ActionResult<void>> {
  // 1. Authentification + vérification rôle
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: currentUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!currentUser || !['coach', 'admin'].includes(currentUser.role)) {
    return { error: 'Accès refusé' }
  }

  // 2. Récupérer le client — vérifier qu'il appartient au coach
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, nom, email, coach_id, invitation_status, user_id')
    .eq('id', clientId)
    .single()

  if (clientError || !client) return { error: 'Client introuvable' }
  if (currentUser.role === 'coach' && client.coach_id !== user.id) {
    return { error: 'Ce client ne vous appartient pas' }
  }
  if (!client.email) return { error: 'Ce client n\'a pas d\'email — impossible de créer un compte' }
  if (client.invitation_status === 'accepted') {
    return { error: 'Ce client est déjà activé' }
  }

  // 3. Créer le compte Supabase Auth avec email déjà confirmé (bypass flux invitation)
  const adminClient = createAdminClient()
  const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
    email: client.email,
    email_confirm: true, // Pas besoin de confirmation email
    user_metadata: { nom: client.nom },
    app_metadata: { role: 'client', coach_id: client.coach_id },
  })

  if (createError) {
    // Si le user existe déjà (email en double), récupérer l'ID existant
    if (createError.message.includes('already registered')) {
      const { data: existingUsers } = await adminClient.auth.admin.listUsers()
      const existingUser = existingUsers?.users.find(u => u.email === client.email)
      if (!existingUser) return { error: 'Compte existant introuvable' }

      // Lier le client existant au user existant
      const { error: linkError } = await adminClient
        .from('clients')
        .update({
          user_id: existingUser.id,
          invitation_status: 'accepted',
          manually_validated_at: new Date().toISOString(),
          manually_validated_by: user.id,
        })
        .eq('id', clientId)

      if (linkError) return { error: 'Erreur lors de la liaison du compte existant' }
      return { success: true }
    }
    return { error: `Erreur création compte : ${createError.message}` }
  }

  // 4. Créer le profil dans public.users (le trigger handle_new_user le fait normalement,
  //    mais avec email_confirm=true et admin API il peut ne pas se déclencher selon la config)
  const { error: profileError } = await adminClient
    .from('users')
    .upsert({
      id: newUser.user.id,
      role: 'client',
      nom: client.nom,
      is_active: true,
    })
  // Ignorer l'erreur si le profil existe déjà (trigger a fonctionné)
  if (profileError && !profileError.message.includes('duplicate')) {
    // Nettoyer le user Auth créé pour éviter un orphelin
    await adminClient.auth.admin.deleteUser(newUser.user.id)
    return { error: 'Erreur création profil utilisateur' }
  }

  // 5. Lier le client CRM au nouveau compte Auth (bypass du trigger)
  const { error: linkError } = await adminClient
    .from('clients')
    .update({
      user_id: newUser.user.id,
      invitation_status: 'accepted',
      manually_validated_at: new Date().toISOString(),
      manually_validated_by: user.id,
    })
    .eq('id', clientId)

  if (linkError) {
    // Nettoyer le user Auth créé
    await adminClient.auth.admin.deleteUser(newUser.user.id)
    return { error: 'Erreur lors de la liaison du client' }
  }

  // 6. Générer un lien "créer votre mot de passe" et envoyer par email
  const { data: linkData, error: linkGenError } = await adminClient.auth.admin.generateLink({
    type: 'recovery', // Type "reset password" = lien de définition du mot de passe
    email: client.email,
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/client/onboarding`,
    },
  })

  if (!linkGenError && linkData) {
    // Envoyer l'email via Resend (utiliser le template d'invitation ou en créer un dédié)
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from: 'MINND <noreply@minnd.fr>',
      to: client.email,
      subject: 'Votre compte MINND est activé — Créez votre mot de passe',
      react: ClientManualActivationEmail({
        clientNom: client.nom,
        setPasswordUrl: linkData.properties.action_link,
      }),
    })
  }
  // Note : si l'email échoue, le compte est déjà actif — ce n'est pas bloquant
  // Le coach peut renvoyer un lien manuellement depuis la fiche client

  return { success: true }
}
```

---

### 4. Server Action `uploadClientDocumentAction()`

Dans `src/app/actions/clients.ts` :

```typescript
/**
 * Upload un PDF et l'attache à la fiche client.
 * Chemin storage : dossiers/{coach_id}/{client_id}/{filename}
 */
export async function uploadClientDocumentAction(
  clientId: string,
  formData: FormData
): Promise<ActionResult<{ url: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  // Vérifier que le client appartient au coach
  const { data: client } = await supabase
    .from('clients')
    .select('id, coach_id, documents, nom')
    .eq('id', clientId)
    .single()

  if (!client || client.coach_id !== user.id) return { error: 'Accès refusé' }

  const file = formData.get('file') as File
  if (!file || file.type !== 'application/pdf') {
    return { error: 'Fichier invalide — PDF uniquement' }
  }
  if (file.size > 10 * 1024 * 1024) {
    return { error: 'Fichier trop volumineux — 10 MB maximum' }
  }

  const documentName = (formData.get('name') as string) || file.name
  const docType = (formData.get('type') as ClientDocument['type']) || 'inscription'
  const timestamp = Date.now()
  const storagePath = `${user.id}/${clientId}/${timestamp}_${file.name}`

  // Upload vers le bucket dossiers
  const { error: uploadError } = await supabase.storage
    .from('dossiers')
    .upload(storagePath, file, { contentType: 'application/pdf', upsert: false })

  if (uploadError) return { error: `Erreur upload : ${uploadError.message}` }

  // Générer URL signée 1 an (documents administratifs)
  const { data: signedUrl } = await supabase.storage
    .from('dossiers')
    .createSignedUrl(storagePath, 365 * 24 * 60 * 60)

  if (!signedUrl) return { error: 'Impossible de générer l\'URL du document' }

  // Mettre à jour le champ documents JSONB
  const newDoc: ClientDocument = {
    name: documentName,
    url: signedUrl.signedUrl,
    type: docType,
    uploaded_at: new Date().toISOString(),
    uploaded_by: user.id,
  }

  const updatedDocuments = [...(client.documents || []), newDoc]

  const { error: updateError } = await supabase
    .from('clients')
    .update({ documents: updatedDocuments })
    .eq('id', clientId)

  if (updateError) return { error: 'Erreur mise à jour fiche client' }

  return { success: true, data: { url: signedUrl.signedUrl } }
}
```

---

### 5. Composant Email `ClientManualActivationEmail`

Créer `src/emails/ClientManualActivationEmail.tsx` en s'inspirant de `ClientInvitationEmail.tsx` existant.

```tsx
// Template email pour activation manuelle de compte
// Différent de l'invitation : le compte est DÉJÀ actif, le client doit juste créer son MDP
interface Props {
  clientNom: string
  setPasswordUrl: string
}
```

Contenu du mail :
- Sujet : "Votre espace MINND est prêt — Créez votre mot de passe"
- Corps : "Votre coach a activé votre espace personnel MINND. Cliquez ci-dessous pour choisir votre mot de passe et accéder à votre tableau de bord."
- CTA : "Créer mon mot de passe" → `setPasswordUrl`
- Logo MINND (déjà présent dans les autres emails)

---

### 6. UI — Upload de document dans la fiche client

Dans `src/app/(dashboard)/coach/clients/[id]/edit/ClientEditForm.tsx` (ou créer un composant `ClientDocumentsSection`), ajouter une section "Documents" :

```tsx
// Section Documents dans le formulaire d'édition client
// Afficher les documents existants (client.documents) avec lien de téléchargement
// Formulaire upload : <Input type="file" accept=".pdf" /> + champ "Nom du document"
// Select type : "Dossier d'inscription" | "Contrat" | "Autre"
// Bouton "Joindre le document" → appelle uploadClientDocumentAction()
```

---

### 7. UI — Bouton "Valider manuellement" dans la fiche client

Dans `src/app/(dashboard)/coach/clients/[id]/page.tsx` ou dans `src/components/coach/InvitationActions.tsx`, ajouter une nouvelle option :

**Condition d'affichage :** `client.invitation_status !== 'accepted'` ET `client.email` est renseigné

**UI :** Bouton secondaire "Activer manuellement" avec Dialog de confirmation :
```
"Vous allez activer le compte de {client.nom} sans passer par le flux d'invitation email classique.
Le client recevra un email pour créer son mot de passe et pourra se connecter immédiatement.

Cette action est irréversible."

[Annuler]  [Activer le compte]
```

Après succès : rafraîchir la page, afficher un toast "Compte activé — email de création de mot de passe envoyé"

---

## Ordre d'implémentation recommandé

1. **Migration SQL** → appliquer localement et en production
2. **Types TypeScript** → `ClientDocument` dans `src/types/index.ts`
3. **Server Actions** → `uploadClientDocumentAction()` puis `manuallyValidateClientAction()`
4. **Email template** → `ClientManualActivationEmail.tsx`
5. **UI upload documents** → section dans `ClientEditForm.tsx`
6. **UI validation manuelle** → bouton dans `InvitationActions.tsx` ou détail client

---

## Points d'attention critiques

### Sécurité
- Valider le MIME type côté serveur (pas seulement `accept=".pdf"` côté client)
- `manually_validated_by` doit référencer le coach/admin qui a validé (auditabilité)
- URL signées 1 an pour les documents (contrairement aux rapports à 7 jours)
- Ne jamais exposer le `storagePath` brut — toujours URL signée

### Cohérence architecture
- `invitation_status` garde toujours la valeur `'accepted'` comme état final
- Pas de nouveau ENUM — `manually_validated_at IS NOT NULL` distingue les validations manuelles
- Le trigger `link_client_on_email_confirm()` n'est PAS modifié — la liaison est faite manuellement dans l'action

### Edge cases
- Client avec email déjà inscrit (autre coach) → gérer le conflit proprement
- Échec de l'email Resend après création du compte → compte actif mais sans email → le coach peut renvoyer manuellement
- Double-clic sur "Valider" → vérifier `invitation_status !== 'accepted'` comme guard

### GDPR
- Les PDFs d'inscription contiennent des données personnelles → respecter le droit à l'effacement
- Ajouter la suppression du fichier Storage dans la logique d'archivage/suppression client

---

## Résultat attendu

- Un coach peut créer un client, uploader son dossier PDF, et activer son compte en 3 clics
- Le client reçoit un email propre l'invitant à créer son mot de passe
- Le client peut se connecter immédiatement et compléter son onboarding
- La fiche coach montre le badge "Compte actif" + "Validé manuellement le [date]" + lien vers le dossier PDF
