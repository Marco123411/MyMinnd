'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { Resend } from 'resend'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import {
  clientSchema,
  updateClientSchema,
  type ClientFormData,
  type UpdateClientFormData,
} from '@/lib/validations/clients'
import type { Client, ClientWithLastTest } from '@/types'
import { ClientInvitationEmail } from '@/emails/ClientInvitationEmail'
import { PasswordResetEmail } from '@/emails/PasswordResetEmail'

const uuidSchema = z.string().uuid()

function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY non configurée')
  return new Resend(apiKey)
}

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}

function getFromEmail(): string {
  return process.env.RESEND_FROM_EMAIL ?? 'MINND <noreply@myminnd.com>'
}

export interface ClientFilters {
  statut?: string
  context?: string
  search?: string
  tag?: string
  sortBy?: 'nom' | 'last_test' | 'score'
}

// Récupère tous les clients du coach connecté avec les données du dernier test
export async function getClientsAction(
  filters?: ClientFilters
): Promise<{ data: ClientWithLastTest[]; error: string | null }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [], error: 'Non authentifié' }

  // Étape 1 : récupère les clients (sans join sur tests — le join tests_coach_id_fkey
  // lie tests.coach_id → clients, ce qui ramène TOUS les tests du coach, pas par client)
  let query = supabase
    .from('clients')
    .select('*')
    .eq('coach_id', user.id)
    .order('created_at', { ascending: false })

  if (filters?.statut) query = query.eq('statut', filters.statut)
  if (filters?.context) query = query.eq('context', filters.context)
  if (filters?.search) {
    // F1 FIX : séparation des clauses pour éviter l'injection PostgREST via .or()
    const search = filters.search.trim()
    query = query.or(
      `nom.ilike.${encodePostgrestLike(search)},email.ilike.${encodePostgrestLike(search)}`
    )
  }

  const { data: clients, error } = await query

  if (error) return { data: [], error: error.message }
  if (!clients || clients.length === 0) return { data: [], error: null }

  // Étape 2 : dernier test complété par user_id (une seule requête, pas N+1)
  const userIds = clients.filter((c) => c.user_id).map((c) => c.user_id as string)

  type LastTestRow = {
    user_id: string
    score_global: number | null
    completed_at: string | null
    profiles: { name: string; color: string } | null
  }

  const lastTestMap = new Map<string, LastTestRow>()
  const pendingCountMap = new Map<string, number>()

  if (userIds.length > 0) {
    // Requêtes parallèles : tests complétés et tests en attente (pas de dépendance entre elles)
    const [{ data: recentTests }, { data: pendingTests }] = await Promise.all([
      supabase
        .from('tests')
        .select('user_id, score_global, completed_at, profiles ( name, color )')
        .eq('coach_id', user.id)
        .eq('status', 'completed')
        .in('user_id', userIds)
        .order('completed_at', { ascending: false }),
      supabase
        .from('tests')
        .select('user_id')
        .eq('coach_id', user.id)
        .in('status', ['pending', 'in_progress'])
        .in('user_id', userIds),
    ])

    // Garde uniquement le test le plus récent par user_id
    ;(recentTests ?? []).forEach((t) => {
      const test = t as unknown as LastTestRow
      if (test.user_id && !lastTestMap.has(test.user_id)) {
        lastTestMap.set(test.user_id, test)
      }
    })

    ;(pendingTests ?? []).forEach((t: { user_id: string | null }) => {
      if (t.user_id) {
        pendingCountMap.set(t.user_id, (pendingCountMap.get(t.user_id) ?? 0) + 1)
      }
    })
  }

  const enriched: ClientWithLastTest[] = (clients as Client[]).map((client) => {
    const lastTest = client.user_id ? lastTestMap.get(client.user_id) ?? null : null
    return {
      ...client,
      lastTestScore: lastTest?.score_global ?? null,
      lastTestDate: lastTest?.completed_at ?? null,
      profileName: lastTest?.profiles?.name ?? null,
      profileColor: lastTest?.profiles?.color ?? null,
      pendingTestsCount: client.user_id ? (pendingCountMap.get(client.user_id) ?? 0) : 0,
    }
  })

  if (filters?.sortBy === 'nom') enriched.sort((a, b) => a.nom.localeCompare(b.nom))
  else if (filters?.sortBy === 'score') enriched.sort((a, b) => (b.lastTestScore ?? -1) - (a.lastTestScore ?? -1))
  else if (filters?.sortBy === 'last_test') enriched.sort((a, b) => (b.lastTestDate ?? '').localeCompare(a.lastTestDate ?? ''))

  return { data: enriched, error: null }
}

// Échappe les caractères spéciaux PostgREST dans une valeur ilike
function encodePostgrestLike(value: string): string {
  // Échappe les caractères qui pourraient injecter des clauses PostgREST
  return `%${value.replace(/[,%()]/g, '')}%`
}

// Récupère un client par ID (vérifie l'appartenance au coach — défense en profondeur)
export async function getClientAction(
  id: string
): Promise<{ data: Client | null; error: string | null }> {
  const supabase = await createClient()

  // F2 FIX : auth + filtre coach_id explicite (défense en profondeur en plus du RLS)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Non authentifié' }

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .eq('coach_id', user.id)
    .single()

  if (error) return { data: null, error: error.message }

  const client = data as Client

  // Fallback sync : si invitation pending et user_id toujours NULL,
  // vérifie si le client a confirmé son compte depuis (trigger peut avoir un délai)
  // Utilise un RPC ciblé pour éviter de dumper tous les auth.users
  if (client.invitation_status === 'pending' && !client.user_id && client.email) {
    const admin = createAdminClient()
    const { data: confirmedUserId } = await admin.rpc('get_confirmed_user_id_by_email', {
      p_email: client.email,
    })
    if (confirmedUserId) {
      await admin
        .from('clients')
        .update({ user_id: confirmedUserId, invitation_status: 'accepted' })
        .eq('id', client.id)
      client.user_id = confirmedUserId as string
      client.invitation_status = 'accepted'
    }
  }

  return { data: client, error: null }
}

// Crée un nouveau client (avec vérification limite Pro)
export async function createClientAction(
  formData: ClientFormData
): Promise<{ data: { id: string } | null; error: string | null }> {
  const parsed = clientSchema.safeParse(formData)
  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Non authentifié' }

  // F9 FIX : limite pour tier Pro uniquement (spec étape 6 : "Limite Coach Pro")
  // Free = pas de limite définie, Pro = 30 actifs max, Expert = illimité
  const { data: profile } = await supabase
    .from('users')
    .select('subscription_tier')
    .eq('id', user.id)
    .single()

  if (profile?.subscription_tier === 'pro') {
    const { count } = await supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('coach_id', user.id)
      .eq('statut', 'actif')

    if ((count ?? 0) >= 30) {
      return {
        data: null,
        error: 'Limite atteinte (30 clients actifs). Passez à Expert pour débloquer la limite.',
      }
    }
  }

  const { nom, email, context, sport, niveau, entreprise, poste, date_naissance, objectifs, notes_privees, statut, tags } =
    parsed.data

  const { data, error } = await supabase
    .from('clients')
    .insert({
      coach_id: user.id,
      nom,
      email: email || null,
      context,
      sport: sport || null,
      niveau: niveau ?? null,
      entreprise: entreprise || null,
      poste: poste || null,
      date_naissance: date_naissance || null,
      objectifs: objectifs || null,
      notes_privees: notes_privees || null,
      statut,
      tags,
    })
    .select('id')
    .single()

  if (error) return { data: null, error: error.message }
  return { data: { id: data.id }, error: null }
}

// Met à jour un client existant
export async function updateClientAction(
  id: string,
  formData: UpdateClientFormData
): Promise<{ error: string | null }> {
  const parsed = updateClientSchema.safeParse(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  // F3 FIX : auth + coach_id dans le WHERE
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { nom, email, context, sport, niveau, entreprise, poste, date_naissance, objectifs, notes_privees, statut, tags } =
    parsed.data

  const { error } = await supabase
    .from('clients')
    .update({
      nom,
      email: email || null,
      context,
      sport: sport || null,
      niveau: niveau ?? null,
      entreprise: entreprise || null,
      poste: poste || null,
      date_naissance: date_naissance || null,
      objectifs: objectifs || null,
      notes_privees: notes_privees || null,
      statut,
      tags,
    })
    .eq('id', id)
    .eq('coach_id', user.id)

  if (error) return { error: error.message }
  return { error: null }
}

// Archive ou réactive un client
export async function archiveClientAction(
  id: string,
  statut: 'actif' | 'archive'
): Promise<{ error: string | null }> {
  // F4 FIX : auth + coach_id dans le WHERE
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { error } = await supabase
    .from('clients')
    .update({ statut })
    .eq('id', id)
    .eq('coach_id', user.id)

  if (error) return { error: error.message }
  return { error: null }
}

// Récupère les scores domaine (depth=0) du dernier test complété pour le radar du slide-over
export async function getClientRadarData(
  clientId: string
): Promise<{ data: Array<{ subject: string; value: number; fullMark: number }> | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Non authentifié' }

  const { data: client } = await supabase
    .from('clients')
    .select('user_id')
    .eq('id', clientId)
    .eq('coach_id', user.id)
    .single()

  if (!client?.user_id) return { data: null, error: null }

  const { data: lastTest } = await supabase
    .from('tests')
    .select('id')
    .eq('user_id', client.user_id)
    .eq('coach_id', user.id)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!lastTest) return { data: null, error: null }

  const { data: scores } = await supabase
    .from('test_scores')
    .select('score, entity_id')
    .eq('test_id', lastTest.id)
    .eq('entity_type', 'competency_node')

  if (!scores || scores.length === 0) return { data: null, error: null }

  const entityIds = scores
    .map((s: { score: number; entity_id: string | null }) => s.entity_id)
    .filter((id): id is string => id !== null)

  if (entityIds.length === 0) return { data: null, error: null }

  const { data: nodes } = await supabase
    .from('competency_tree')
    .select('id, name, depth')
    .in('id', entityIds)
    .eq('depth', 0)

  if (!nodes || nodes.length === 0) return { data: null, error: null }

  const nodeMap = new Map(
    (nodes as Array<{ id: string; name: string; depth: number }>).map((n) => [n.id, n.name])
  )

  const radarData = (scores as Array<{ score: number; entity_id: string | null }>)
    .filter((s) => s.entity_id && nodeMap.has(s.entity_id))
    .map((s) => ({
      subject: nodeMap.get(s.entity_id!)!,
      value: s.score,
      fullMark: 10 as const,
    }))

  return { data: radarData.length > 0 ? radarData : null, error: null }
}

// Invite un client : createUser (metadata) + generateLink (token) + email Resend personnalisé
export async function inviteClientAction(
  clientId: string
): Promise<{ error: string | null }> {
  const parsed = uuidSchema.safeParse(clientId)
  if (!parsed.success) return { error: 'ID client invalide' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const admin = createAdminClient()

  // Récupère le client et le nom du coach en parallèle
  const [clientResult, coachResult] = await Promise.all([
    admin
      .from('clients')
      .select('id, email, nom, coach_id, invitation_status, user_id')
      .eq('id', clientId)
      .eq('coach_id', user.id)
      .single(),
    admin
      .from('users')
      .select('nom')
      .eq('id', user.id)
      .single(),
  ])

  const { data: client, error: fetchError } = clientResult
  if (fetchError || !client) return { error: 'Client introuvable' }
  if (!client.email) return { error: "Ce client n'a pas d'adresse email renseignée" }
  if (client.user_id) return { error: 'Ce client a déjà un compte actif' }

  const coachName = coachResult.data?.nom ?? 'Votre coach'

  // Crée l'utilisateur auth avec les métadonnées nécessaires (role + coach_id)
  let authUserId: string
  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email: client.email,
    app_metadata: { role: 'client', coach_id: user.id },
    user_metadata: { nom: client.nom },
    email_confirm: false,
  })

  if (createError) {
    // Cas : email déjà enregistré dans Supabase Auth — récupère l'ID existant
    if (
      createError.message?.includes('already been registered') ||
      createError.message?.includes('already exists')
    ) {
      const { data: existingUserId } = await admin.rpc('get_confirmed_user_id_by_email', {
        p_email: client.email,
      })
      if (!existingUserId) {
        console.error('[inviteClientAction] createUser + rpc failed:', createError.message)
        return { error: "Erreur lors de la création du compte. Réessayez." }
      }
      authUserId = existingUserId as string
    } else {
      console.error('[inviteClientAction] createUser error:', createError.message)
      return { error: "Erreur lors de la création du compte. Réessayez." }
    }
  } else {
    if (!newUser.user) return { error: "Erreur lors de la création du compte" }
    authUserId = newUser.user.id
  }

  // Génère le lien d'invitation — passé par le callback pour l'échange de token SSR
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'invite',
    email: client.email,
    options: { redirectTo: `${getAppUrl()}/auth/callback` },
  })

  if (linkError || !linkData?.properties?.action_link) {
    console.error('[inviteClientAction] generateLink error:', linkError?.message)
    return { error: "Erreur lors de la génération du lien d'invitation. Réessayez." }
  }

  // Lie le user_id et met à jour le statut d'invitation
  const { error: updateError } = await admin
    .from('clients')
    .update({
      user_id: authUserId,
      invitation_status: 'pending',
      invited_at: new Date().toISOString(),
    })
    .eq('id', clientId)

  if (updateError) {
    console.error('[inviteClientAction] Status update error:', updateError.message)
    return { error: "Invitation générée mais statut non mis à jour. Rechargez la page." }
  }

  // Envoie l'email d'invitation brandé MINND via Resend
  try {
    const resend = getResend()
    const { error: emailError } = await resend.emails.send({
      from: getFromEmail(),
      to: [client.email],
      subject: `${coachName} vous invite sur MINND`,
      react: ClientInvitationEmail({
        clientName: client.nom,
        coachName,
        actionLink: linkData.properties.action_link,
      }),
    })
    if (emailError) {
      console.error('[inviteClientAction] Email send error:', emailError)
      return { error: `Erreur d'envoi email : ${emailError.message}` }
    }
  } catch (err) {
    console.error('[inviteClientAction] Resend exception:', err)
    return { error: "Impossible d'envoyer l'email. Vérifiez la configuration Resend." }
  }

  revalidatePath(`/coach/clients/${clientId}`)
  revalidatePath('/coach/clients')
  return { error: null }
}

// Renvoie l'email d'invitation (génère un nouveau lien, invalide l'ancien)
export async function resendInviteAction(
  clientId: string
): Promise<{ error: string | null }> {
  return inviteClientAction(clientId)
}

// Réinvite un client dont le compte auth est orphelin (user_id dans clients mais auth.user supprimé)
export async function reinviteClientAction(
  clientId: string
): Promise<{ error: string | null }> {
  const parsed = uuidSchema.safeParse(clientId)
  if (!parsed.success) return { error: 'ID client invalide' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const admin = createAdminClient()

  // Réinitialise le compte orphelin avant de relancer l'invitation
  const { error: resetError } = await admin
    .from('clients')
    .update({ user_id: null, invitation_status: 'none' })
    .eq('id', clientId)
    .eq('coach_id', user.id)

  if (resetError) return { error: 'Erreur lors de la réinitialisation du compte' }

  return inviteClientAction(clientId)
}

// Envoie un email de réinitialisation de mot de passe au client
export async function resetClientPasswordAction(
  clientId: string
): Promise<{ error: string | null }> {
  // F3 FIX : validation UUID à la frontière d'entrée
  const parsed = uuidSchema.safeParse(clientId)
  if (!parsed.success) return { error: 'ID client invalide' }

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

  if (!client?.user_id) {
    return { error: 'Client sans compte actif' }
  }

  // Récupère l'email réel depuis auth.users (source de vérité — évite les désynchronisations avec clients.email)
  const { data: authUser, error: authUserError } = await admin.auth.admin.getUserById(client.user_id)
  if (authUserError || !authUser.user?.email) {
    return { error: 'Compte introuvable dans le système d\'authentification' }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: authUser.user.email,
    options: { redirectTo: `${appUrl}/auth/reset-password` },
  })

  if (linkError || !linkData?.properties?.action_link) {
    console.error('[resetClientPasswordAction] generateLink error:', linkError?.message)
    return { error: 'Erreur lors de la génération du lien de réinitialisation.' }
  }

  // Récupère le nom du client pour personnaliser l'email
  const clientName = client.email?.split('@')[0] ?? 'Client'
  const { data: clientRow } = await admin
    .from('clients')
    .select('nom')
    .eq('id', clientId)
    .single()

  try {
    const resend = getResend()
    const { error: emailError } = await resend.emails.send({
      from: getFromEmail(),
      to: [authUser.user.email],
      subject: 'Réinitialisez votre mot de passe MINND',
      react: PasswordResetEmail({
        clientName: clientRow?.nom ?? clientName,
        resetLink: linkData.properties.action_link,
      }),
    })
    if (emailError) {
      console.error('[resetClientPasswordAction] Email send error:', emailError)
      return { error: `Erreur d'envoi email : ${emailError.message}` }
    }
  } catch (err) {
    console.error('[resetClientPasswordAction] Resend exception:', err)
    return { error: "Impossible d'envoyer l'email. Vérifiez la configuration Resend." }
  }

  return { error: null }
}

// Met à jour l'email du client dans auth.users ET dans la table clients
export async function updateClientEmailAction(
  clientId: string,
  newEmail: string
): Promise<{ error: string | null }> {
  const idParsed = uuidSchema.safeParse(clientId)
  if (!idParsed.success) return { error: 'ID client invalide' }

  const emailParsed = z.string().email().safeParse(newEmail.trim())
  if (!emailParsed.success) return { error: 'Adresse email invalide' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const admin = createAdminClient()

  const { data: client } = await admin
    .from('clients')
    .select('user_id, coach_id')
    .eq('id', clientId)
    .eq('coach_id', user.id)
    .single()

  if (!client?.user_id) return { error: 'Client sans compte actif' }

  // Sécurité : interdit de modifier l'email de son propre compte via le CRM client
  if (client.user_id === user.id) {
    return { error: 'Impossible de modifier votre propre compte via le CRM. Utilisez les paramètres de votre profil.' }
  }

  // Met à jour l'email dans Supabase Auth (envoie un email de confirmation au nouvel email)
  const { error: authError } = await admin.auth.admin.updateUserById(client.user_id, {
    email: emailParsed.data,
  })

  if (authError) {
    console.error('[updateClientEmailAction] Auth error:', authError.message)
    return { error: 'Erreur lors de la mise à jour de l\'email.' }
  }

  // Synchronise l'email dans la table CRM
  const { error: crmError } = await admin
    .from('clients')
    .update({ email: emailParsed.data })
    .eq('id', clientId)

  if (crmError) {
    console.error('[updateClientEmailAction] CRM sync error:', crmError.message)
    return { error: 'Email mis à jour dans Auth mais non synchronisé dans le CRM.' }
  }

  // Envoie un lien de réinitialisation au nouvel email pour notifier le client
  // (Supabase ne l'envoie pas automatiquement lors d'un changement admin)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const { error: resetError } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: emailParsed.data,
    options: { redirectTo: `${appUrl}/auth/reset-password` },
  })
  if (resetError) {
    console.error('[updateClientEmailAction] Reset link error:', resetError.message)
    // Non bloquant : l'email a bien été changé, juste la notif qui a échoué
  }

  revalidatePath(`/coach/clients/${clientId}`)
  return { error: null }
}

// Met à jour les notes privées et objectifs (pour l'onglet Notes)
export async function updateClientNotesAction(
  id: string,
  notes_privees: string,
  objectifs: string
): Promise<{ error: string | null }> {
  // F5 FIX : auth + coach_id dans le WHERE
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { error } = await supabase
    .from('clients')
    .update({ notes_privees: notes_privees || null, objectifs: objectifs || null })
    .eq('id', id)
    .eq('coach_id', user.id)

  if (error) return { error: error.message }
  return { error: null }
}
