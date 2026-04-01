'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { z } from 'zod'
import { DispatchAdminEmail } from '@/emails/DispatchAdminEmail'
import { DispatchExpertEmail } from '@/emails/DispatchExpertEmail'
import { DispatchClientEmail } from '@/emails/DispatchClientEmail'
import { ReviewRequestEmail } from '@/emails/ReviewRequestEmail'
import type { DispatchWithDetails, AvailableExpert } from '@/types'

const uuidSchema = z.string().uuid()

function validateUuid(id: string): boolean {
  return uuidSchema.safeParse(id).success
}

// Initialisation paresseuse pour éviter l'erreur au build sans RESEND_API_KEY
function getResend() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY non configurée')
  return new Resend(apiKey)
}

function getFromEmail() {
  return process.env.RESEND_FROM_EMAIL ?? 'MINND <noreply@myminnd.com>'
}

function getAdminEmail() {
  return process.env.ADMIN_EMAIL ?? 'admin@myminnd.com'
}

function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}

// Note: la création de dispatch est dans src/lib/dispatch.ts (non exposée comme server action)

// ============================================================
// getDispatchesAction — liste pour l'admin
// ============================================================
export async function getDispatchesAction(
  statusGroup?: 'pending' | 'active' | 'done'
): Promise<{ data: DispatchWithDetails[]; error: string | null }> {
  const supabase = await createClient()
  const { data: user, error: authError } = await supabase.auth.getUser()
  if (authError || !user.user) return { data: [], error: 'Non authentifié' }

  const { data: me } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.user.id)
    .single()

  if (me?.role !== 'admin') return { data: [], error: 'Accès refusé' }

  const STATUS_MAP: Record<string, string[]> = {
    pending: ['nouveau', 'en_cours'],
    active: ['dispatche', 'accepte', 'en_session'],
    done: ['termine', 'annule'],
  }

  const admin = createAdminClient()
  let query = admin
    .from('dispatches')
    .select(
      `
      *,
      client:users!dispatches_client_id_fkey ( nom, prenom, context ),
      expert:users!dispatches_expert_id_fkey ( nom, prenom ),
      tests ( score_global, profiles ( name, color ) )
      `
    )
    .order('created_at', { ascending: true })

  if (statusGroup && STATUS_MAP[statusGroup]) {
    query = query.in('status', STATUS_MAP[statusGroup])
  }

  const { data, error } = await query

  if (error) return { data: [], error: error.message }

  const dispatches: DispatchWithDetails[] = (data ?? []).map((row) => {
    const client = row.client as unknown as {
      nom: string
      prenom: string | null
      context: string | null
    } | null
    const expert = row.expert as unknown as {
      nom: string
      prenom: string | null
    } | null
    const test = row.tests as unknown as {
      score_global: number | null
      profiles: { name: string; color: string } | null
    } | null

    return {
      id: row.id,
      client_id: row.client_id,
      test_id: row.test_id,
      payment_id: row.payment_id,
      status: row.status,
      expert_id: row.expert_id,
      dispatched_at: row.dispatched_at,
      accepted_at: row.accepted_at,
      contacted_at: row.contacted_at,
      completed_at: row.completed_at,
      expert_payment_id: row.expert_payment_id,
      notes_admin: row.notes_admin,
      created_at: row.created_at,
      updated_at: row.updated_at,
      client_nom: client?.nom ?? '',
      client_prenom: client?.prenom ?? null,
      client_context: client?.context ?? null,
      client_sport: null,
      test_score_global: test?.score_global ?? null,
      test_profile_name: test?.profiles?.name ?? null,
      test_profile_color: test?.profiles?.color ?? null,
      expert_nom: expert?.nom ?? null,
      expert_prenom: expert?.prenom ?? null,
    }
  })

  return { data: dispatches, error: null }
}

// ============================================================
// getDispatchAction — détail pour admin ou expert
// ============================================================
export async function getDispatchAction(id: string): Promise<{
  data: DispatchWithDetails | null
  error: string | null
}> {
  const parsed = z.string().uuid().safeParse(id)
  if (!parsed.success) return { data: null, error: 'ID invalide' }

  const supabase = await createClient()
  const { data: user, error: authError } = await supabase.auth.getUser()
  if (authError || !user.user) return { data: null, error: 'Non authentifié' }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('dispatches')
    .select(
      `
      *,
      client:users!dispatches_client_id_fkey ( nom, prenom, context ),
      expert:users!dispatches_expert_id_fkey ( nom, prenom ),
      tests ( score_global, profiles ( name, color ) )
      `
    )
    .eq('id', id)
    .single()

  if (error || !data) return { data: null, error: error?.message ?? 'Introuvable' }

  // Vérifier les droits : admin ou expert assigné
  const { data: me } = await admin
    .from('users')
    .select('role')
    .eq('id', user.user.id)
    .single()

  const isAdmin = me?.role === 'admin'
  const isAssignedExpert = data.expert_id === user.user.id

  if (!isAdmin && !isAssignedExpert) {
    return { data: null, error: 'Accès refusé' }
  }

  const client = data.client as unknown as {
    nom: string
    prenom: string | null
    context: string | null
  } | null
  const expert = data.expert as unknown as { nom: string; prenom: string | null } | null
  const test = data.tests as unknown as {
    score_global: number | null
    profiles: { name: string; color: string } | null
  } | null

  return {
    data: {
      id: data.id,
      client_id: data.client_id,
      test_id: data.test_id,
      payment_id: data.payment_id,
      status: data.status,
      expert_id: data.expert_id,
      dispatched_at: data.dispatched_at,
      accepted_at: data.accepted_at,
      contacted_at: data.contacted_at,
      completed_at: data.completed_at,
      expert_payment_id: data.expert_payment_id,
      notes_admin: data.notes_admin,
      created_at: data.created_at,
      updated_at: data.updated_at,
      client_nom: client?.nom ?? '',
      client_prenom: client?.prenom ?? null,
      client_context: client?.context ?? null,
      client_sport: null,
      test_score_global: test?.score_global ?? null,
      test_profile_name: test?.profiles?.name ?? null,
      test_profile_color: test?.profiles?.color ?? null,
      expert_nom: expert?.nom ?? null,
      expert_prenom: expert?.prenom ?? null,
    },
    error: null,
  }
}

// ============================================================
// getDispatchStatsAction — KPIs pour le dashboard admin
// ============================================================
export async function getDispatchStatsAction(): Promise<{
  data: {
    pending_count: number
    active_count: number
    done_this_month: number
    revenue_l3_cents: number
    alert_pending_2h: number
    alert_expert_4h: number
  } | null
  error: string | null
}> {
  const supabase = await createClient()
  const { data: user, error: authError } = await supabase.auth.getUser()
  if (authError || !user.user) return { data: null, error: 'Non authentifié' }

  const { data: me } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.user.id)
    .single()

  if (me?.role !== 'admin') return { data: null, error: 'Accès refusé' }

  const admin = createAdminClient()

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString()
  const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString()

  const [pending, active, doneMonth, revenueL3, alert2h, alert4h] =
    await Promise.all([
      admin
        .from('dispatches')
        .select('id', { count: 'exact', head: true })
        .in('status', ['nouveau', 'en_cours']),
      admin
        .from('dispatches')
        .select('id', { count: 'exact', head: true })
        .in('status', ['dispatche', 'accepte', 'en_session']),
      admin
        .from('dispatches')
        .select('id', { count: 'exact', head: true })
        .in('status', ['termine', 'annule'])
        .gte('completed_at', startOfMonth),
      admin
        .from('payments')
        .select('amount_cents')
        .eq('type', 'test_l3')
        .eq('status', 'succeeded')
        .gte('created_at', startOfMonth),
      // Alertes : dispatches en attente > 2h sans être traités
      admin
        .from('dispatches')
        .select('id', { count: 'exact', head: true })
        .in('status', ['nouveau'])
        .lt('created_at', twoHoursAgo),
      // Alertes : experts qui n'ont pas répondu > 4h
      admin
        .from('dispatches')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'dispatche')
        .lt('dispatched_at', fourHoursAgo),
    ])

  const revenueCents = (revenueL3.data ?? []).reduce(
    (sum, p) => sum + p.amount_cents,
    0
  )

  return {
    data: {
      pending_count: pending.count ?? 0,
      active_count: active.count ?? 0,
      done_this_month: doneMonth.count ?? 0,
      revenue_l3_cents: revenueCents,
      alert_pending_2h: alert2h.count ?? 0,
      alert_expert_4h: alert4h.count ?? 0,
    },
    error: null,
  }
}

// ============================================================
// getAvailableExpertsAction — liste d'experts pour assignation
// ============================================================
export async function getAvailableExpertsAction(): Promise<{
  data: AvailableExpert[]
  error: string | null
}> {
  const supabase = await createClient()
  const { data: user, error: authError } = await supabase.auth.getUser()
  if (authError || !user.user) return { data: [], error: 'Non authentifié' }

  const { data: me } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.user.id)
    .single()

  if (me?.role !== 'admin') return { data: [], error: 'Accès refusé' }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('users')
    .select('id, nom, prenom, context, subscription_tier')
    .eq('role', 'coach')
    .eq('is_active', true)
    .in('subscription_tier', ['pro', 'expert'])
    .order('subscription_tier', { ascending: false }) // expert avant pro

  if (error) return { data: [], error: error.message }

  return {
    data: (data ?? []).map((u) => ({
      id: u.id,
      nom: u.nom,
      prenom: u.prenom,
      context: u.context,
      subscription_tier: u.subscription_tier as 'pro' | 'expert',
    })),
    error: null,
  }
}

// ============================================================
// assignExpertAction — admin assigne un expert
// ============================================================
export async function assignExpertAction(
  dispatchId: string,
  expertId: string
): Promise<{ error: string | null }> {
  if (!validateUuid(dispatchId) || !validateUuid(expertId)) return { error: 'ID invalide' }

  const supabase = await createClient()
  const { data: user, error: authError } = await supabase.auth.getUser()
  if (authError || !user.user) return { error: 'Non authentifié' }

  const { data: me } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.user.id)
    .single()

  if (me?.role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()

  // Fetch dispatch + expert + client data for email
  const { data: dispatch } = await admin
    .from('dispatches')
    .select(
      'id, client_id, test_id, client:users!dispatches_client_id_fkey ( nom, prenom, context ), tests ( score_global, profiles ( name, color ) )'
    )
    .eq('id', dispatchId)
    .single()

  const { data: expert } = await admin
    .from('users')
    .select('nom, prenom')
    .eq('id', expertId)
    .single()

  // Guard : ne dispatcher que si le statut est valide (évite les race conditions)
  const { error: updateError, count } = await admin
    .from('dispatches')
    .update({
      expert_id: expertId,
      status: 'dispatche',
      dispatched_at: new Date().toISOString(),
    })
    .eq('id', dispatchId)
    .in('status', ['nouveau', 'en_cours'])

  if (updateError) return { error: updateError.message }
  if (count === 0) return { error: 'Dispatch déjà assigné ou statut invalide' }

  // Email à l'expert
  if (dispatch && expert) {
    const client = dispatch.client as unknown as {
      nom: string
      prenom: string | null
      context: string | null
    } | null
    const test = dispatch.tests as unknown as {
      score_global: number | null
      profiles: { name: string; color: string } | null
    } | null

    const clientName = client
      ? `${client.prenom ?? ''} ${client.nom}`.trim()
      : 'Client'
    const expertName = `${expert.prenom ?? ''} ${expert.nom}`.trim()

    try {
      const resend = getResend()
      const { data: expertAuth } = await admin.auth.admin.getUserById(expertId)

      if (expertAuth?.user?.email) {
        await resend.emails.send({
          from: getFromEmail(),
          to: expertAuth.user.email,
          subject: `Mission MINND : ${clientName} attend votre analyse`,
          react: DispatchExpertEmail({
            expertName,
            clientName,
            clientContext: client?.context ?? 'sport',
            clientSport: null,
            scoreGlobal: test?.score_global ?? null,
            profileName: test?.profiles?.name ?? null,
            dispatchUrl: `${getAppUrl()}/coach/dispatch/${dispatchId}`,
          }),
        })
      }

    } catch (emailError) {
      console.error('[dispatch] Erreur email expert:', emailError)
    }
  }

  return { error: null }
}

// ============================================================
// expertAcceptAction — expert accepte la mission
// ============================================================
export async function expertAcceptAction(
  dispatchId: string
): Promise<{ error: string | null }> {
  if (!validateUuid(dispatchId)) return { error: 'ID invalide' }

  const supabase = await createClient()
  const { data: user, error: authError } = await supabase.auth.getUser()
  if (authError || !user.user) return { error: 'Non authentifié' }

  const admin = createAdminClient()

  // Vérifier que l'expert est bien assigné à ce dispatch
  const { data: dispatch } = await admin
    .from('dispatches')
    .select('expert_id, client_id, id, client:users!dispatches_client_id_fkey ( nom, prenom )')
    .eq('id', dispatchId)
    .single()

  if (!dispatch || dispatch.expert_id !== user.user.id) {
    return { error: 'Accès refusé' }
  }

  // Guard : accepter uniquement si statut = dispatche
  const { error: updateError, count } = await admin
    .from('dispatches')
    .update({ status: 'accepte', accepted_at: new Date().toISOString() })
    .eq('id', dispatchId)
    .eq('status', 'dispatche')

  if (updateError) return { error: updateError.message }
  if (count === 0) return { error: 'Mission déjà traitée ou statut invalide' }

  // Fetch expert name + client email
  const { data: expertData } = await admin
    .from('users')
    .select('nom, prenom')
    .eq('id', user.user.id)
    .single()

  const { data: clientAuth } = await admin.auth.admin.getUserById(
    dispatch.client_id
  )

  const client = dispatch.client as unknown as { nom: string; prenom: string | null } | null
  const clientName = client ? `${client.prenom ?? ''} ${client.nom}`.trim() : 'Client'
  const expertName = expertData
    ? `${expertData.prenom ?? ''} ${expertData.nom}`.trim()
    : 'Votre expert'

  try {
    const resend = getResend()

    // Email au client
    if (clientAuth?.user?.email) {
      await resend.emails.send({
        from: getFromEmail(),
        to: clientAuth.user.email,
        subject: `${expertName} va vous contacter sous 24h`,
        react: DispatchClientEmail({
          clientName,
          expertName,
          messageType: 'accepted',
        }),
      })
    }

    // Email à l'admin
    await resend.emails.send({
      from: getFromEmail(),
      to: getAdminEmail(),
      subject: `[MINND] Mission acceptée — dispatch ${dispatchId}`,
      react: DispatchAdminEmail({
        title: 'Mission acceptée',
        message: `${expertName} a accepté la mission pour ${clientName}.`,
        details: {
          Expert: expertName,
          Client: clientName,
          'Dispatch ID': dispatchId,
        },
        ctaUrl: `${getAppUrl()}/admin/dispatch/${dispatchId}`,
        ctaLabel: 'Voir le dispatch',
      }),
    })
  } catch (emailError) {
    console.error('[dispatch] Erreur emails acceptation:', emailError)
  }

  return { error: null }
}

// ============================================================
// expertDeclineAction — expert décline la mission
// ============================================================
export async function expertDeclineAction(
  dispatchId: string
): Promise<{ error: string | null }> {
  if (!validateUuid(dispatchId)) return { error: 'ID invalide' }

  const supabase = await createClient()
  const { data: user, error: authError } = await supabase.auth.getUser()
  if (authError || !user.user) return { error: 'Non authentifié' }

  const admin = createAdminClient()

  const { data: dispatch } = await admin
    .from('dispatches')
    .select('expert_id, client_id')
    .eq('id', dispatchId)
    .single()

  if (!dispatch || dispatch.expert_id !== user.user.id) {
    return { error: 'Accès refusé' }
  }

  // Guard : décliner uniquement si statut = dispatche
  const { error: updateError, count } = await admin
    .from('dispatches')
    .update({
      status: 'en_cours', // en_cours = nécessite reassignement (cohérent avec reassignDispatchAction)
      expert_id: null,
      dispatched_at: null,
    })
    .eq('id', dispatchId)
    .eq('status', 'dispatche')

  if (updateError) return { error: updateError.message }
  if (count === 0) return { error: 'Mission déjà traitée ou statut invalide' }

  const { data: expertData } = await admin
    .from('users')
    .select('nom, prenom')
    .eq('id', user.user.id)
    .single()

  const expertName = expertData
    ? `${expertData.prenom ?? ''} ${expertData.nom}`.trim()
    : 'Expert'

  try {
    const resend = getResend()
    await resend.emails.send({
      from: getFromEmail(),
      to: getAdminEmail(),
      subject: `[MINND] Mission déclinée — reassignement nécessaire`,
      react: DispatchAdminEmail({
        title: 'Mission déclinée',
        message: `${expertName} a décliné la mission. Un reassignement est nécessaire.`,
        details: {
          Expert: expertName,
          'Dispatch ID': dispatchId,
        },
        ctaUrl: `${getAppUrl()}/admin/dispatch/${dispatchId}`,
        ctaLabel: 'Reassigner la mission',
      }),
    })
  } catch (emailError) {
    console.error('[dispatch] Erreur email déclin:', emailError)
  }

  return { error: null }
}

// ============================================================
// markContactedAction — expert marque le contact effectué
// ============================================================
export async function markContactedAction(
  dispatchId: string
): Promise<{ error: string | null }> {
  if (!validateUuid(dispatchId)) return { error: 'ID invalide' }

  const supabase = await createClient()
  const { data: user, error: authError } = await supabase.auth.getUser()
  if (authError || !user.user) return { error: 'Non authentifié' }

  const admin = createAdminClient()

  const { data: dispatch } = await admin
    .from('dispatches')
    .select('expert_id')
    .eq('id', dispatchId)
    .single()

  if (!dispatch || dispatch.expert_id !== user.user.id) {
    return { error: 'Accès refusé' }
  }

  // Guard : marquer contact uniquement si statut = accepte
  const { error: updateError, count } = await admin
    .from('dispatches')
    .update({ status: 'en_session', contacted_at: new Date().toISOString() })
    .eq('id', dispatchId)
    .eq('status', 'accepte')

  if (updateError) return { error: updateError.message }
  if (count === 0) return { error: 'Statut invalide pour cette action' }
  return { error: null }
}

// ============================================================
// markSessionCompleteAction — expert termine la session
// ============================================================
export async function markSessionCompleteAction(
  dispatchId: string
): Promise<{ error: string | null }> {
  if (!validateUuid(dispatchId)) return { error: 'ID invalide' }

  const supabase = await createClient()
  const { data: user, error: authError } = await supabase.auth.getUser()
  if (authError || !user.user) return { error: 'Non authentifié' }

  const admin = createAdminClient()

  const { data: dispatch } = await admin
    .from('dispatches')
    .select(
      'expert_id, client_id, client:users!dispatches_client_id_fkey ( nom, prenom )'
    )
    .eq('id', dispatchId)
    .single()

  if (!dispatch || dispatch.expert_id !== user.user.id) {
    return { error: 'Accès refusé' }
  }

  // Créer le paiement expert 49 € (status=pending, paiement manuel)
  const { data: expertPayment, error: paymentError } = await admin
    .from('payments')
    .insert({
      user_id: dispatch.expert_id,
      type: 'expert_payout',
      amount_cents: 4900,
      status: 'pending',
      metadata: { dispatch_id: dispatchId },
    })
    .select('id')
    .single()

  if (paymentError) {
    console.error('[dispatch] Erreur création paiement expert:', paymentError)
    return { error: 'Erreur création paiement expert — session non clôturée' }
  }

  // Guard : terminer uniquement si statut = en_session
  const { error: updateError, count } = await admin
    .from('dispatches')
    .update({
      status: 'termine',
      completed_at: new Date().toISOString(),
      expert_payment_id: expertPayment.id,
    })
    .eq('id', dispatchId)
    .eq('status', 'en_session')

  if (updateError) return { error: updateError.message }
  if (count === 0) return { error: 'Statut invalide pour clôturer la session' }

  const { data: expertData } = await admin
    .from('users')
    .select('nom, prenom')
    .eq('id', user.user.id)
    .single()

  const { data: clientAuth } = await admin.auth.admin.getUserById(dispatch.client_id)
  const client = dispatch.client as unknown as { nom: string; prenom: string | null } | null
  const clientName = client ? `${client.prenom ?? ''} ${client.nom}`.trim() : 'Client'
  const expertName = expertData
    ? `${expertData.prenom ?? ''} ${expertData.nom}`.trim()
    : 'Votre expert'

  try {
    const resend = getResend()

    // Email au client : confirmation de fin de session + demande d'avis
    if (clientAuth?.user?.email) {
      await resend.emails.send({
        from: getFromEmail(),
        to: clientAuth.user.email,
        subject: `Votre session avec ${expertName} est terminée`,
        react: DispatchClientEmail({
          clientName,
          expertName,
          messageType: 'session_done',
        }),
      })

      // Email de demande d'avis (non-bloquant)
      await resend.emails.send({
        from: getFromEmail(),
        to: clientAuth.user.email,
        subject: `Partagez votre expérience avec ${expertName}`,
        react: ReviewRequestEmail({
          clientName,
          expertName,
          reviewUrl: `${getAppUrl()}/client/review/${dispatchId}`,
        }),
      }).catch((err) => {
        console.error('[dispatch] Erreur email demande avis:', err)
      })
    }

    // Email à l'admin pour virement manuel
    await resend.emails.send({
      from: getFromEmail(),
      to: getAdminEmail(),
      subject: `[MINND] Session terminée — virement expert 49€ à effectuer`,
      react: DispatchAdminEmail({
        title: 'Session terminée — Paiement expert à effectuer',
        message: `La session est terminée. Un virement de 49 € doit être effectué à ${expertName}.`,
        details: {
          Expert: expertName,
          Montant: '49,00 €',
          'Dispatch ID': dispatchId,
          'Payment ID': expertPayment?.id ?? 'Erreur création',
        },
        ctaUrl: `${getAppUrl()}/admin/dispatch/${dispatchId}`,
        ctaLabel: 'Voir le dispatch',
      }),
    })
  } catch (emailError) {
    console.error('[dispatch] Erreur emails session terminée:', emailError)
  }

  return { error: null }
}

// ============================================================
// updateDispatchNotesAction — admin met à jour les notes
// ============================================================
export async function updateDispatchNotesAction(
  dispatchId: string,
  notes: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: user, error: authError } = await supabase.auth.getUser()
  if (authError || !user.user) return { error: 'Non authentifié' }

  const { data: me } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.user.id)
    .single()

  if (me?.role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const { error: updateError } = await admin
    .from('dispatches')
    .update({ notes_admin: notes })
    .eq('id', dispatchId)

  if (updateError) return { error: updateError.message }
  return { error: null }
}

// ============================================================
// reassignDispatchAction — admin force un reassignement
// ============================================================
export async function reassignDispatchAction(
  dispatchId: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: user, error: authError } = await supabase.auth.getUser()
  if (authError || !user.user) return { error: 'Non authentifié' }

  const { data: me } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.user.id)
    .single()

  if (me?.role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const { error: updateError } = await admin
    .from('dispatches')
    .update({
      status: 'en_cours',
      expert_id: null,
      dispatched_at: null,
    })
    .eq('id', dispatchId)

  if (updateError) return { error: updateError.message }
  return { error: null }
}

// ============================================================
// cancelDispatchAction — admin annule un dispatch
// ============================================================
export async function cancelDispatchAction(
  dispatchId: string
): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { data: user, error: authError } = await supabase.auth.getUser()
  if (authError || !user.user) return { error: 'Non authentifié' }

  const { data: me } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.user.id)
    .single()

  if (me?.role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const { error: updateError } = await admin
    .from('dispatches')
    .update({ status: 'annule' })
    .eq('id', dispatchId)

  if (updateError) return { error: updateError.message }
  return { error: null }
}
