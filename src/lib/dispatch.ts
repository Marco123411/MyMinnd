// Bibliothèque de création de dispatch — non exposée comme server action
// Importée directement par le webhook Stripe (server-side uniquement)

import { createAdminClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { DispatchAdminEmail } from '@/emails/DispatchAdminEmail'

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

// Crée un enregistrement dispatch et notifie l'admin par email
// Appelée uniquement depuis du code serveur de confiance (webhook Stripe)
export async function createDispatch(
  clientId: string,
  testId: string,
  paymentId: string
): Promise<{ dispatchId: string | null; error: string | null }> {
  const admin = createAdminClient()

  const { data: dispatch, error: insertError } = await admin
    .from('dispatches')
    .insert({ client_id: clientId, test_id: testId, payment_id: paymentId })
    .select('id')
    .single()

  if (insertError) {
    console.error('[dispatch] Erreur création dispatch:', insertError)
    return { dispatchId: null, error: insertError.message }
  }

  // Fetch client + test info for email
  const [clientResult, testResult] = await Promise.all([
    admin.from('users').select('nom, prenom, context').eq('id', clientId).single(),
    admin.from('tests').select('score_global, profiles ( name, color )').eq('id', testId).single(),
  ])

  const clientData = clientResult.data
  const testData = testResult.data

  const clientName = clientData
    ? `${clientData.prenom ?? ''} ${clientData.nom}`.trim()
    : 'Client'

  const profileName =
    testData && testData.profiles
      ? (testData.profiles as unknown as { name: string; color: string }).name
      : null

  const scoreGlobal =
    testData && typeof testData.score_global === 'number' ? testData.score_global : null

  try {
    const resend = getResend()
    await resend.emails.send({
      from: getFromEmail(),
      to: getAdminEmail(),
      subject: `Nouvelle demande Level 3 : ${clientName}`,
      react: DispatchAdminEmail({
        title: 'Nouvelle demande Level 3',
        message: 'Un client vient de payer un test Level 3 et attend un expert certifié.',
        details: {
          Client: clientName,
          Context: clientData?.context ?? 'Non renseigné',
          ...(scoreGlobal !== null ? { 'Score global': `${scoreGlobal.toFixed(1)} / 10` } : {}),
          ...(profileName ? { 'Profil MINND': profileName } : {}),
        },
        ctaUrl: `${getAppUrl()}/admin/dispatch/${dispatch.id}`,
        ctaLabel: 'Voir le dispatch',
      }),
    })
  } catch (emailError) {
    console.error('[dispatch] Erreur email admin:', emailError)
  }

  return { dispatchId: dispatch.id, error: null }
}
