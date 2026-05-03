import { NextResponse, type NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/server'
import { ContactRequestExpiredEmail } from '@/emails/ContactRequestExpiredEmail'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Batch size limite pour rester sous les 60s de Vercel Hobby / 300s Pro.
// À raison de ~1-2s par demande (3 queries + 1 email), 50 ≈ 100s worst-case.
const BATCH_LIMIT = 50

// Compare le Bearer en temps constant.
function verifyCronSecret(authHeader: string | null, secret: string): boolean {
  if (!authHeader) return false
  const expected = `Bearer ${secret}`
  if (authHeader.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }
  if (!verifyCronSecret(request.headers.get('authorization'), cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const nowIso = new Date().toISOString()

  const { data: expired, error: fetchError } = await admin
    .from('contact_requests')
    .select('id, athlete_user_id, coach_user_id')
    .eq('status', 'pending')
    .lt('expires_at', nowIso)
    .limit(BATCH_LIMIT)

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  const rows = expired ?? []
  if (rows.length === 0) {
    return NextResponse.json({ expired: 0 })
  }

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'MINND <noreply@myminnd.com>'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myminnd.com'

  // Préchargement en bulk des identités (évite N+1)
  const athleteIds = Array.from(new Set(rows.map((r) => r.athlete_user_id)))
  const coachIds = Array.from(new Set(rows.map((r) => r.coach_user_id)))
  const [{ data: athleteUsers }, { data: coachUsers }] = await Promise.all([
    admin.from('users').select('id, nom, prenom').in('id', athleteIds),
    admin.from('users').select('id, nom, prenom').in('id', coachIds),
  ])
  const userById = new Map([...(athleteUsers ?? []), ...(coachUsers ?? [])].map((u) => [u.id, u]))

  let expiredCount = 0
  let emailsSent = 0
  let emailsFailed = 0

  // Boucle par demande : transition status='expired' APRÈS tentative d'email
  // pour éviter un état 'expired' sans notification en cas de crash/timeout.
  for (const row of rows) {
    // 1. Envoi email (best-effort, seulement si Resend configuré)
    let emailSent = true
    if (resend) {
      const { data: athleteAuth } = await admin.auth.admin.getUserById(row.athlete_user_id)
      const athleteEmail = athleteAuth?.user?.email
      if (athleteEmail) {
        const athleteUser = userById.get(row.athlete_user_id)
        const coachUser = userById.get(row.coach_user_id)
        const athleteFirstName = athleteUser?.prenom ?? athleteUser?.nom ?? 'Athlète'
        const coachFullName =
          [coachUser?.prenom, coachUser?.nom].filter(Boolean).join(' ') || 'Coach'

        const { error: emailError } = await resend.emails.send({
          from: fromEmail,
          to: [athleteEmail],
          subject: 'Votre demande a expiré',
          react: ContactRequestExpiredEmail({
            athleteName: athleteFirstName,
            coachName: coachFullName,
            marketplaceUrl: `${appUrl}/marketplace`,
          }),
        })
        if (emailError) {
          emailSent = false
          emailsFailed++
          console.error('[cron/expire-contact-requests] email error:', emailError.message)
        } else {
          emailsSent++
        }
      }
    }

    // 2. Transition d'état : toujours exécuté, même si email a échoué (la prochaine
    //    exécution ne re-déclenchera pas d'email car status != 'pending').
    //    Nous loggons l'échec email pour retraitement manuel si besoin.
    const { error: updateError } = await admin
      .from('contact_requests')
      .update({ status: 'expired' })
      .eq('id', row.id)
      .eq('status', 'pending')
    if (!updateError) {
      expiredCount++
    } else {
      console.error('[cron/expire-contact-requests] update error:', updateError.message)
    }

    // Note : emailSent=false reste tracé dans emailsFailed pour observabilité.
    if (!emailSent) {
      // volontairement silencieux : déjà tracé dans emailsFailed
    }
  }

  return NextResponse.json({
    expired: expiredCount,
    emails_sent: emailsSent,
    emails_failed: emailsFailed,
  })
}
