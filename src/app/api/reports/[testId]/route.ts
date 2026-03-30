import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient, createAdminClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ testId: string }>
}

const uuidSchema = z.string().uuid()
// 15 minutes pour le lien de téléchargement direct
const DOWNLOAD_URL_TTL = 900

/**
 * GET /api/reports/:testId
 *
 * Génère une URL signée de courte durée (15 min) pour accéder au rapport PDF.
 * Autorisé : propriétaire du test ou coach associé.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { testId } = await params

  if (!uuidSchema.safeParse(testId).success) {
    return NextResponse.json({ error: 'ID de test invalide' }, { status: 400 })
  }

  // ── Auth ─────────────────────────────────────────────────────
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: userProfile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  const isAdmin = userProfile?.role === 'admin'

  // ── Fetch test ───────────────────────────────────────────────
  const admin = createAdminClient()
  const { data: test, error: testError } = await admin
    .from('tests')
    .select('id, user_id, coach_id, report_url')
    .eq('id', testId)
    .single()

  if (testError || !test) {
    return NextResponse.json({ error: 'Test introuvable' }, { status: 404 })
  }

  const isOwner = test.user_id === user.id
  const isCoach = test.coach_id === user.id
  if (!isOwner && !isCoach && !isAdmin) {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
  }

  if (!test.report_url || !test.user_id) {
    return NextResponse.json(
      { error: 'Rapport non disponible — générez-le via POST /api/reports/generate/:testId' },
      { status: 404 }
    )
  }

  // Génère une URL signée de courte durée (évite de rediriger vers l'URL stockée)
  const storagePath = `${test.user_id}/${testId}.pdf`
  const { data: signedData, error: signedError } = await admin.storage
    .from('reports')
    .createSignedUrl(storagePath, DOWNLOAD_URL_TTL)

  if (signedError || !signedData) {
    return NextResponse.json({ error: 'Erreur lors de la génération du lien de téléchargement' }, { status: 500 })
  }

  return NextResponse.redirect(signedData.signedUrl)
}
