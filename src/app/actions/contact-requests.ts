'use server'

import { z } from 'zod'
import { Resend } from 'resend'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import {
  createContactRequestSchema,
  declineContactRequestSchema,
  type CreateContactRequestFormData,
  type DeclineContactRequestFormData,
} from '@/lib/validations/contact-requests'
import { ContactRequestCoachEmail } from '@/emails/ContactRequestCoachEmail'
import { ContactRequestAcceptedEmail } from '@/emails/ContactRequestAcceptedEmail'
import { ContactRequestDeclinedEmail } from '@/emails/ContactRequestDeclinedEmail'

function getResend() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return null
  return new Resend(apiKey)
}

function getFromEmail(): string {
  return process.env.RESEND_FROM_EMAIL ?? 'MINND <noreply@myminnd.com>'
}

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://myminnd.com'
}

// Crée une demande d'accompagnement d'un athlète vers un praticien
export async function createContactRequestAction(
  input: CreateContactRequestFormData
): Promise<{ data: { id: string } | null; error: string | null }> {
  const parsed = createContactRequestSchema.safeParse(input)
  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Non authentifié' }

  // 1. L'utilisateur doit être un client
  const { data: userRow } = await supabase
    .from('users')
    .select('role, nom, prenom')
    .eq('id', user.id)
    .single()
  if (!userRow || userRow.role !== 'client') {
    return { data: null, error: 'Action réservée aux athlètes' }
  }

  // 2. Le test doit appartenir à l'utilisateur ET être complété
  const { data: test } = await supabase
    .from('tests')
    .select('id, status, user_id, score_global, profile_id')
    .eq('id', parsed.data.test_id)
    .eq('user_id', user.id)
    .single()
  if (!test || test.status !== 'completed') {
    return { data: null, error: 'Vous devez avoir complété le PMA avant de contacter un praticien' }
  }

  // 3. Le praticien cible doit être un coach actif sur plan pro/expert
  const { data: coachRow } = await supabase
    .from('users')
    .select('role, is_active, subscription_tier, subscription_status')
    .eq('id', parsed.data.coach_user_id)
    .single()
  if (!coachRow || coachRow.role !== 'coach' || !coachRow.is_active) {
    return { data: null, error: 'Praticien introuvable' }
  }
  if (coachRow.subscription_tier === 'free') {
    return {
      data: null,
      error: "Ce praticien n'accepte pas les demandes via MyMINND pour le moment.",
    }
  }

  // 4. Pas de demande pending existante (l'index partiel unique le garantit aussi)
  const { data: existingPending } = await supabase
    .from('contact_requests')
    .select('id')
    .eq('athlete_user_id', user.id)
    .eq('coach_user_id', parsed.data.coach_user_id)
    .eq('status', 'pending')
    .maybeSingle()
  if (existingPending) {
    return { data: null, error: 'Vous avez déjà une demande en attente pour ce praticien' }
  }

  // 5. Insertion
  const { data: inserted, error: insertError } = await supabase
    .from('contact_requests')
    .insert({
      athlete_user_id: user.id,
      coach_user_id: parsed.data.coach_user_id,
      test_id: parsed.data.test_id,
      sport: parsed.data.sport,
      level: parsed.data.level,
      objective: parsed.data.objective,
      message: parsed.data.message ?? null,
      consent_share_results: true,
      status: 'pending',
    })
    .select('id')
    .single()

  if (insertError || !inserted) {
    return { data: null, error: insertError?.message ?? 'Erreur lors de la création de la demande' }
  }

  // 6. Email au praticien (best-effort)
  const resend = getResend()
  if (resend) {
    const admin = createAdminClient()
    const [{ data: coachAuthData }, { data: coachProfile }, { data: profileData }] =
      await Promise.all([
        admin.auth.admin.getUserById(parsed.data.coach_user_id),
        admin.from('users').select('nom, prenom').eq('id', parsed.data.coach_user_id).single(),
        test.profile_id
          ? admin.from('profiles').select('name').eq('id', test.profile_id).single()
          : Promise.resolve({ data: null }),
      ])

    const coachEmail = coachAuthData?.user?.email
    if (coachEmail) {
      const coachFirstName = coachProfile?.prenom ?? coachProfile?.nom ?? 'Coach'
      const athleteFullName = [userRow.prenom, userRow.nom].filter(Boolean).join(' ') || 'Athlète'
      const profileName = profileData?.name ?? null

      const { error: emailError } = await resend.emails.send({
        from: getFromEmail(),
        to: [coachEmail],
        subject: `Nouvelle demande d'accompagnement — ${athleteFullName}`,
        react: ContactRequestCoachEmail({
          coachName: coachFirstName,
          athleteName: athleteFullName,
          profileName,
          globalScore: test.score_global,
          sport: parsed.data.sport,
          level: parsed.data.level,
          objective: parsed.data.objective,
          leadsUrl: `${getAppUrl()}/coach/leads`,
        }),
      })
      if (emailError) {
        console.error('[createContactRequestAction] Erreur envoi email coach:', emailError.message)
      }
    }
  }

  return { data: { id: inserted.id }, error: null }
}

// Accepte une demande : crée/update le lien coach_id et notifie l'athlète
export async function acceptContactRequestAction(
  requestId: string
): Promise<{ error: string | null }> {
  if (!z.string().uuid().safeParse(requestId).success) {
    return { error: 'ID invalide' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  // Vérifie que l'utilisateur est un coach pro/expert
  const { data: coachRow } = await supabase
    .from('users')
    .select('role, subscription_tier')
    .eq('id', user.id)
    .single()
  if (!coachRow || coachRow.role !== 'coach') return { error: 'Accès réservé aux coachs' }
  if (coachRow.subscription_tier === 'free') {
    return { error: 'Passez au plan Pro pour accepter les demandes de leads' }
  }

  // Vérifie la demande (RLS + status pending)
  const { data: request } = await supabase
    .from('contact_requests')
    .select('id, athlete_user_id, coach_user_id, status')
    .eq('id', requestId)
    .single()
  if (!request || request.coach_user_id !== user.id) return { error: 'Demande introuvable' }
  if (request.status !== 'pending') return { error: 'Cette demande a déjà été traitée' }

  const admin = createAdminClient()

  // Si l'athlète a déjà un coach (clients.coach_id non NULL), on refuse
  const { data: existingClient } = await admin
    .from('clients')
    .select('id, coach_id, nom, email')
    .eq('user_id', request.athlete_user_id)
    .maybeSingle()

  if (existingClient && existingClient.coach_id && existingClient.coach_id !== user.id) {
    return { error: 'Cet athlète est déjà accompagné par un autre praticien' }
  }

  // 1. Réclamation atomique du lien coach_id (gère la course entre coaches).
  //    Le clients.coach_id sert de source de vérité pour le mode teaser/full.
  if (existingClient) {
    // UPDATE conditionnel : n'accepte le claim que si coach_id est encore NULL
    // OU déjà égal à user.id (idempotence).
    const { data: updatedRows, error: linkError } = await admin
      .from('clients')
      .update({ coach_id: user.id, invitation_status: 'accepted' })
      .eq('id', existingClient.id)
      .or(`coach_id.is.null,coach_id.eq.${user.id}`)
      .select('id')
    if (linkError) return { error: linkError.message }
    if (!updatedRows || updatedRows.length === 0) {
      return { error: 'Cet athlète est déjà accompagné par un autre praticien' }
    }
  } else {
    // Pas de fiche clients (cas limite) → insertion directe (coach_id défini).
    const { data: athleteAuth } = await admin.auth.admin.getUserById(request.athlete_user_id)
    const { data: athleteUser } = await admin
      .from('users')
      .select('nom, prenom')
      .eq('id', request.athlete_user_id)
      .single()
    const athleteFullName = athleteUser
      ? [athleteUser.prenom, athleteUser.nom].filter(Boolean).join(' ')
      : 'Athlète'
    const { error: insertError } = await admin.from('clients').insert({
      user_id: request.athlete_user_id,
      coach_id: user.id,
      nom: athleteFullName,
      email: athleteAuth?.user?.email ?? null,
      context: 'sport',
      invitation_status: 'accepted',
    })
    if (insertError) return { error: insertError.message }
  }

  // 2. Liaison réussie → mise à jour de contact_requests (idempotent).
  const { error: updateError } = await admin
    .from('contact_requests')
    .update({ status: 'accepted', responded_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('status', 'pending')
  if (updateError) return { error: updateError.message }

  // 3. Propagation aux anciens tests : met à jour tests.coach_id des tests PMA
  //    de l'athlète pour que le mode full s'affiche partout.
  //    (Note : les résultats restent accessibles ; seule la vue change.)
  await admin
    .from('tests')
    .update({ coach_id: user.id })
    .eq('user_id', request.athlete_user_id)
    .is('coach_id', null)

  // Email à l'athlète (best-effort)
  const resend = getResend()
  if (resend) {
    const [{ data: athleteAuth }, { data: athleteUser }, { data: coachUser }, { data: lastTest }] =
      await Promise.all([
        admin.auth.admin.getUserById(request.athlete_user_id),
        admin.from('users').select('nom, prenom').eq('id', request.athlete_user_id).single(),
        admin.from('users').select('nom, prenom').eq('id', user.id).single(),
        admin
          .from('tests')
          .select('id')
          .eq('user_id', request.athlete_user_id)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

    const athleteEmail = athleteAuth?.user?.email
    if (athleteEmail) {
      const athleteFirstName = athleteUser?.prenom ?? athleteUser?.nom ?? 'Athlète'
      const coachFullName = [coachUser?.prenom, coachUser?.nom].filter(Boolean).join(' ') || 'Coach'
      const resultsPath = lastTest?.id ? `/client/results/${lastTest.id}` : '/client'

      const { error: emailError } = await resend.emails.send({
        from: getFromEmail(),
        to: [athleteEmail],
        subject: `${coachFullName} accepte de vous accompagner`,
        react: ContactRequestAcceptedEmail({
          athleteName: athleteFirstName,
          coachName: coachFullName,
          resultsUrl: `${getAppUrl()}${resultsPath}`,
        }),
      })
      if (emailError) {
        console.error('[acceptContactRequestAction] Erreur envoi email athlète:', emailError.message)
      }
    }
  }

  return { error: null }
}

// Décline une demande avec message optionnel
export async function declineContactRequestAction(
  requestId: string,
  input: DeclineContactRequestFormData
): Promise<{ error: string | null }> {
  if (!z.string().uuid().safeParse(requestId).success) return { error: 'ID invalide' }
  const parsed = declineContactRequestSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { data: request } = await supabase
    .from('contact_requests')
    .select('id, athlete_user_id, coach_user_id, status')
    .eq('id', requestId)
    .single()
  if (!request || request.coach_user_id !== user.id) return { error: 'Demande introuvable' }
  if (request.status !== 'pending') return { error: 'Cette demande a déjà été traitée' }

  const admin = createAdminClient()
  const { error: updateError } = await admin
    .from('contact_requests')
    .update({
      status: 'declined',
      responded_at: new Date().toISOString(),
      coach_response_message: parsed.data.coach_response_message ?? null,
    })
    .eq('id', requestId)
    .eq('status', 'pending')
  if (updateError) return { error: updateError.message }

  // Email poli à l'athlète
  const resend = getResend()
  if (resend) {
    const [{ data: athleteAuth }, { data: athleteUser }, { data: coachUser }] = await Promise.all([
      admin.auth.admin.getUserById(request.athlete_user_id),
      admin.from('users').select('nom, prenom').eq('id', request.athlete_user_id).single(),
      admin.from('users').select('nom, prenom').eq('id', user.id).single(),
    ])

    const athleteEmail = athleteAuth?.user?.email
    if (athleteEmail) {
      const athleteFirstName = athleteUser?.prenom ?? athleteUser?.nom ?? 'Athlète'
      const coachFullName = [coachUser?.prenom, coachUser?.nom].filter(Boolean).join(' ') || 'Coach'

      const { error: emailError } = await resend.emails.send({
        from: getFromEmail(),
        to: [athleteEmail],
        subject: 'Mise à jour de votre demande',
        react: ContactRequestDeclinedEmail({
          athleteName: athleteFirstName,
          coachName: coachFullName,
          coachMessage: parsed.data.coach_response_message ?? null,
          marketplaceUrl: `${getAppUrl()}/marketplace`,
        }),
      })
      if (emailError) {
        console.error('[declineContactRequestAction] Erreur envoi email athlète:', emailError.message)
      }
    }
  }

  return { error: null }
}

// Compte les demandes pending pour le coach connecté (badge sidebar)
export async function getPendingContactRequestsCountAction(): Promise<number> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return 0

  const { count } = await supabase
    .from('contact_requests')
    .select('id', { count: 'exact', head: true })
    .eq('coach_user_id', user.id)
    .eq('status', 'pending')

  return count ?? 0
}

// Vérifie s'il existe une demande pending de l'athlète courant vers un coach donné
export async function getExistingPendingRequestAction(
  coachUserId: string
): Promise<{ hasPending: boolean; error: string | null }> {
  if (!z.string().uuid().safeParse(coachUserId).success) {
    return { hasPending: false, error: 'ID invalide' }
  }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { hasPending: false, error: null }

  const { data } = await supabase
    .from('contact_requests')
    .select('id')
    .eq('athlete_user_id', user.id)
    .eq('coach_user_id', coachUserId)
    .eq('status', 'pending')
    .maybeSingle()

  return { hasPending: !!data, error: null }
}
