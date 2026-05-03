'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { z } from 'zod'
import { TestInvitationEmail } from '@/emails/TestInvitationEmail'
import type { TestForCoach } from '@/types'

// Durée de validité d'un token d'invitation (30 jours)
const INVITATION_TTL_MS = 30 * 24 * 60 * 60 * 1000

// Initialisation paresseuse pour éviter l'erreur au build sans RESEND_API_KEY
function getResend() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_API_KEY non configurée')
  return new Resend(apiKey)
}

const createInvitationSchema = z.object({
  clientId: z.string().uuid(),
  testDefinitionId: z.string().uuid(),
  levelSlug: z.enum(['discovery', 'complete', 'expert']),
})

// Construit l'URL d'invitation à partir du token
function buildInviteUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return `${base}/test/invite/${token}`
}

// Formate une date en français (ex: "30 avril 2026")
function formatDateFr(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// Helper : vérifie auth + rôle coach
async function requireCoach() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { user: null, error: 'Non authentifié' as const }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'coach') {
    return { user: null, error: 'Accès réservé aux coachs' as const }
  }
  return { user, error: null }
}

/**
 * Crée un test d'invitation pour un client depuis la fiche CRM du coach.
 * Le test est toujours créé en status 'pending' : le client doit cliquer le lien pour démarrer.
 * Si le client a un email, l'invitation lui est envoyée automatiquement.
 */
export async function createInvitationAction(
  clientId: string,
  testDefinitionId: string,
  levelSlug: string
): Promise<{ data: { testId: string; inviteUrl: string; emailSent: boolean } | null; error: string | null }> {
  const parsed = createInvitationSchema.safeParse({ clientId, testDefinitionId, levelSlug })
  if (!parsed.success) return { data: null, error: parsed.error.issues[0].message }

  const { user, error: authError } = await requireCoach()
  if (!user) return { data: null, error: authError }

  const admin = createAdminClient()

  // Vérifie que le client appartient bien à ce coach
  const { data: client, error: clientError } = await admin
    .from('clients')
    .select('id, nom, email')
    .eq('id', parsed.data.clientId)
    .eq('coach_id', user.id)
    .single()

  if (clientError || !client) return { data: null, error: 'Client introuvable' }

  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS).toISOString()

  // Crée le test en status 'pending' — le client le réclame en cliquant le lien
  const { data: test, error: insertError } = await admin
    .from('tests')
    .insert({
      test_definition_id: parsed.data.testDefinitionId,
      user_id: null,             // toujours null — assigné lors de l'acceptation
      coach_id: user.id,
      client_id: parsed.data.clientId,
      level_slug: parsed.data.levelSlug,
      status: 'pending',
      invitation_token: token,
      token_expires_at: expiresAt,
    })
    .select('id')
    .single()

  if (insertError || !test) return { data: null, error: insertError?.message ?? 'Erreur création test' }

  const inviteUrl = buildInviteUrl(token)

  // Auto-envoi de l'email si le client a une adresse et que Resend est configuré
  let emailSent = false
  const clientEmail = client.email as string | null
  if (clientEmail && process.env.RESEND_API_KEY) {
    const [{ data: coachData }, { data: defData }] = await Promise.all([
      admin.from('users').select('nom').eq('id', user.id).single(),
      admin.from('test_definitions').select('name').eq('id', parsed.data.testDefinitionId).single(),
    ])

    const coachName = (coachData as { nom: string } | null)?.nom ?? 'Votre coach'
    const testName = (defData as { name: string } | null)?.name ?? 'Test MINND'

    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error: emailError } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'MINND <noreply@myminnd.com>',
      to: [clientEmail],
      subject: `${coachName} vous invite à passer le ${testName} sur MINND`,
      react: TestInvitationEmail({
        coachName,
        clientName: client.nom as string,
        testName,
        inviteUrl,
        expiresAt: formatDateFr(expiresAt),
      }),
    })

    if (emailError) {
      console.error('[createInvitationAction] Erreur envoi email:', emailError.message)
    } else {
      emailSent = true
    }
  }

  return { data: { testId: test.id, inviteUrl, emailSent }, error: null }
}

/**
 * Renvoie l'email d'invitation pour un test existant (statut pending, token non expiré).
 * Vérifie que le coach est propriétaire du test.
 */
export async function resendInvitationAction(
  testId: string
): Promise<{ error: string | null }> {
  const uuidParsed = z.string().uuid().safeParse(testId)
  if (!uuidParsed.success) return { error: 'ID test invalide' }

  const { user, error: authError } = await requireCoach()
  if (!user) return { error: authError }

  const admin = createAdminClient()

  // Parallélisation : test + nom du coach simultanément
  const [{ data: test, error: fetchError }, { data: coachData }] = await Promise.all([
    admin
      .from('tests')
      .select(`
        id,
        coach_id,
        invitation_token,
        token_expires_at,
        status,
        test_definitions ( name ),
        clients ( nom, email )
      `)
      .eq('id', testId)
      .single(),
    admin.from('users').select('nom').eq('id', user.id).single(),
  ])

  if (fetchError || !test) return { error: 'Test introuvable' }
  if (test.coach_id !== user.id) return { error: 'Accès refusé' }
  if (!test.invitation_token) return { error: 'Ce test n\'a pas de lien d\'invitation' }
  if (test.status !== 'pending') return { error: 'Ce test n\'est plus en attente' }
  // Vérifie aussi que le token n'est pas expiré (F7 : envoi d'email pour token expiré)
  if (test.token_expires_at && new Date(test.token_expires_at) < new Date()) {
    return { error: 'Le lien a expiré. Régénérez-le avant de renvoyer l\'email.' }
  }

  const client = Array.isArray(test.clients) ? test.clients[0] : test.clients
  const definition = Array.isArray(test.test_definitions) ? test.test_definitions[0] : test.test_definitions

  const clientRecord = client as { nom: string; email: string | null } | null
  const defRecord = definition as { name: string } | null

  if (!clientRecord?.email) return { error: 'Ce client n\'a pas d\'email renseigné' }

  const coachName = coachData?.nom ?? 'Votre coach'
  const testName = defRecord?.name ?? 'Test MINND'
  const inviteUrl = buildInviteUrl(test.invitation_token)
  const expiresAt = formatDateFr(test.token_expires_at!)

  const resend = getResend()
  const { error: emailError } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'MINND <noreply@myminnd.com>',
    to: [clientRecord.email],
    subject: `${coachName} vous invite à passer le ${testName} sur MINND`,
    react: TestInvitationEmail({
      coachName,
      clientName: clientRecord.nom,
      testName,
      inviteUrl,
      expiresAt,
    }),
  })

  if (emailError) return { error: emailError.message }
  return { error: null }
}

/**
 * Régénère un nouveau token d'invitation (invalide l'ancien).
 * Uniquement pour les tests pending ou expired.
 */
export async function regenerateInvitationAction(
  testId: string
): Promise<{ data: { inviteUrl: string } | null; error: string | null }> {
  const uuidParsed = z.string().uuid().safeParse(testId)
  if (!uuidParsed.success) return { data: null, error: 'ID test invalide' }

  const { user, error: authError } = await requireCoach()
  if (!user) return { data: null, error: authError }

  const admin = createAdminClient()

  const { data: test, error: fetchError } = await admin
    .from('tests')
    .select('id, coach_id, status')
    .eq('id', testId)
    .single()

  if (fetchError || !test) return { data: null, error: 'Test introuvable' }
  if (test.coach_id !== user.id) return { data: null, error: 'Accès refusé' }
  if (test.status !== 'pending' && test.status !== 'expired') {
    return { data: null, error: 'Impossible de régénérer un lien pour ce test' }
  }

  const newToken = crypto.randomUUID()
  const newExpiresAt = new Date(Date.now() + INVITATION_TTL_MS).toISOString()

  const { error: updateError } = await admin
    .from('tests')
    .update({ invitation_token: newToken, token_expires_at: newExpiresAt, status: 'pending' })
    .eq('id', testId)

  if (updateError) return { data: null, error: updateError.message }

  return { data: { inviteUrl: buildInviteUrl(newToken) }, error: null }
}

/**
 * Récupère tous les tests d'un client CRM pour le coach (incluant pending).
 * Utilise le client admin pour lire invitation_token.
 * Le token brut n'est PAS exposé : l'URL complète est construite côté serveur.
 */
export async function getClientTestsForCoach(
  clientId: string
): Promise<{ data: TestForCoach[] | null; error: string | null }> {
  const uuidParsed = z.string().uuid().safeParse(clientId)
  if (!uuidParsed.success) return { data: null, error: 'ID client invalide' }

  const { user, error: authError } = await requireCoach()
  if (!user) return { data: null, error: authError }

  const admin = createAdminClient()

  const { data: rows, error } = await admin
    .from('tests')
    .select(`
      id,
      client_id,
      level_slug,
      status,
      score_global,
      created_at,
      completed_at,
      invitation_token,
      token_expires_at,
      test_definitions ( name ),
      profiles ( name, color )
    `)
    .eq('coach_id', user.id)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return { data: null, error: error.message }

  const tests: TestForCoach[] = (rows ?? []).map((row) => {
    const def = Array.isArray(row.test_definitions) ? row.test_definitions[0] : row.test_definitions
    const prof = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles

    // Construit l'URL côté serveur — le token brut n'est jamais envoyé au client (F6)
    const inviteUrl = row.invitation_token ? buildInviteUrl(row.invitation_token) : null

    return {
      id: row.id,
      client_id: row.client_id,
      level_slug: row.level_slug as TestForCoach['level_slug'],
      status: row.status as TestForCoach['status'],
      score_global: row.score_global,
      created_at: row.created_at,
      completed_at: row.completed_at,
      invite_url: inviteUrl,
      token_expires_at: row.token_expires_at ?? null,
      definition_name: (def as { name: string } | null)?.name ?? '—',
      profile_name: (prof as { name: string } | null)?.name ?? null,
      profile_color: (prof as { color: string } | null)?.color ?? null,
    }
  })

  return { data: tests, error: null }
}
