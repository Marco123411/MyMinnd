import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement, type ReactElement } from 'react'
import { z } from 'zod'
import type { DocumentProps } from '@react-pdf/renderer'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { ReportDocument } from '@/components/pdf/ReportDocument'
import type { ReportData, ScoreEntry, NodeEntry } from '@/components/pdf/ReportDocument'

interface RouteParams {
  params: Promise<{ testId: string }>
}

const uuidSchema = z.string().uuid()

// Vercel Pro : 60s max pour la génération PDF + upload Storage
export const maxDuration = 60

/**
 * POST /api/reports/generate/:testId
 *
 * Génère le rapport PDF d'un test Complete/Expert, l'upload sur Supabase Storage
 * et enregistre l'URL signée (1 an) dans tests.report_url.
 * Autorisé : propriétaire du test, coach associé, ou admin.
 * Idempotent : retourne le rapport existant si déjà généré (sauf ?force=true).
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { testId } = await params
  const force = new URL(request.url).searchParams.get('force') === 'true'

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

  // ── Fetch test + définition ───────────────────────────────────
  const admin = createAdminClient()

  const { data: test, error: testError } = await admin
    .from('tests')
    .select('id, user_id, coach_id, level_slug, status, score_global, profile_id, completed_at, test_definition_id, report_url, test_definitions(name)')
    .eq('id', testId)
    .single()

  if (testError || !test) {
    return NextResponse.json({ error: 'Test introuvable' }, { status: 404 })
  }

  // Vérification des droits d'accès
  const isOwner = test.user_id === user.id
  const isCoach = test.coach_id === user.id
  if (!isOwner && !isCoach && !isAdmin) {
    return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
  }

  if (test.status !== 'completed') {
    return NextResponse.json({ error: 'Le test n\'est pas encore terminé' }, { status: 422 })
  }

  // Discovery n'inclut pas de rapport PDF
  if (test.level_slug === 'discovery') {
    return NextResponse.json({ error: 'Le niveau Discovery n\'inclut pas de rapport PDF' }, { status: 422 })
  }

  if (!test.user_id) {
    return NextResponse.json({ error: 'Aucun utilisateur associé à ce test' }, { status: 422 })
  }

  // Idempotency : rapport déjà généré → retourner l'URL existante
  if (!force && test.report_url) {
    return NextResponse.json({ url: test.report_url })
  }

  // ── Fetch data en parallèle (1re vague) ──────────────────────
  const [clientResult, nodesResult, scoresResult, prevTestResult, profileResult] = await Promise.all([
    // Données du client
    admin
      .from('users')
      .select('nom, prenom, context')
      .eq('id', test.user_id)
      .single(),
    // Arbre de compétences
    admin
      .from('competency_tree')
      .select('id, parent_id, name, depth, is_leaf, order_index')
      .eq('test_definition_id', test.test_definition_id)
      .order('order_index'),
    // Scores du test
    admin
      .from('test_scores')
      .select('entity_type, entity_id, score, percentile')
      .eq('test_id', testId),
    // Test précédent du même type (T2 longitudinal)
    admin
      .from('tests')
      .select('id, score_global, completed_at')
      .eq('user_id', test.user_id)
      .eq('test_definition_id', test.test_definition_id)
      .eq('status', 'completed')
      .neq('id', testId)
      .order('completed_at', { ascending: false })
      .limit(1),
    // Profil mental (inclus dans la même vague)
    test.profile_id
      ? admin
          .from('profiles')
          .select('id, test_definition_id, name, family, color, population_pct, avg_score, description, strengths, weaknesses, recommendations')
          .eq('id', test.profile_id)
          .single()
      : Promise.resolve({ data: null, error: null }),
  ])

  if (clientResult.error || !clientResult.data) {
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
  if (nodesResult.error) {
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }
  if (scoresResult.error) {
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }

  const nodes = (nodesResult.data ?? []) as NodeEntry[]
  const scores = (scoresResult.data ?? []) as ScoreEntry[]

  // Validation : arbre de compétences requis
  if (nodes.length === 0) {
    return NextResponse.json({ error: 'Données de compétences introuvables pour ce test' }, { status: 422 })
  }

  // ── Fetch données T2 (2e vague, dépend de prevTestData.id) ────
  const prevTestData = Array.isArray(prevTestResult.data) ? prevTestResult.data[0] : null
  let previousTest: ReportData['previousTest'] = undefined

  if (prevTestData) {
    const { data: prevScores } = await admin
      .from('test_scores')
      .select('entity_type, entity_id, score, percentile')
      .eq('test_id', prevTestData.id)

    if (prevScores) {
      previousTest = {
        completed_at: prevTestData.completed_at as string,
        score_global: prevTestData.score_global as number | null,
        scores: prevScores as ScoreEntry[],
      }
    }
  }

  const globalPercentile = scores.find((s) => s.entity_type === 'global')?.percentile ?? null

  // Nom du test depuis le join (F3)
  const testDef = test.test_definitions as { name?: string } | null
  const definitionName = testDef?.name ?? 'Profil Mental'

  // ── Build ReportData ─────────────────────────────────────────
  const reportData: ReportData = {
    test: {
      id: test.id as string,
      level_slug: test.level_slug as string,
      score_global: test.score_global as number | null,
      completed_at: test.completed_at as string,
      definition_name: definitionName,
    },
    client: {
      nom: clientResult.data.nom as string,
      prenom: clientResult.data.prenom as string | null,
      context: clientResult.data.context as string | null,
    },
    nodes,
    scores,
    profile: profileResult.data ?? null,
    globalPercentile,
    previousTest,
  }

  // ── Générer le PDF ───────────────────────────────────────────
  let pdfBuffer: Buffer
  try {
    pdfBuffer = await renderToBuffer(
      createElement(ReportDocument, { data: reportData }) as ReactElement<DocumentProps>
    )
  } catch {
    return NextResponse.json({ error: 'Erreur de génération du rapport PDF' }, { status: 500 })
  }

  // ── Upload sur Supabase Storage (bucket privé) ───────────────
  const storagePath = `${test.user_id}/${testId}.pdf`

  const { error: uploadError } = await admin.storage
    .from('reports')
    .upload(storagePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (uploadError) {
    return NextResponse.json({ error: 'Erreur lors de l\'enregistrement du rapport' }, { status: 500 })
  }

  // URL signée valable 1 an (accès authentifié uniquement)
  const ONE_YEAR_IN_SECONDS = 31_536_000
  const { data: signedData, error: signedError } = await admin.storage
    .from('reports')
    .createSignedUrl(storagePath, ONE_YEAR_IN_SECONDS)

  if (signedError || !signedData) {
    return NextResponse.json({ error: 'Erreur lors de la génération de l\'URL' }, { status: 500 })
  }

  const reportUrl = signedData.signedUrl

  // ── Enregistre l'URL dans tests.report_url ───────────────────
  const { error: updateError } = await admin
    .from('tests')
    .update({ report_url: reportUrl })
    .eq('id', testId)

  if (updateError) {
    return NextResponse.json({ error: 'Erreur lors de la mise à jour du test' }, { status: 500 })
  }

  return NextResponse.json({ url: reportUrl })
}
