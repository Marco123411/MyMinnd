import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { computeTestScores } from '@/lib/scoring'

interface RouteParams {
  params: Promise<{ testId: string }>
}

/**
 * POST /api/tests/:testId/score
 *
 * Recalcule et persiste les scores d'un test complété.
 * Réservé au propriétaire du test ou à un admin.
 * Utile pour recalculer après mise à jour de la base normative.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { testId } = await params

  if (!testId || !/^[0-9a-f-]{36}$/i.test(testId)) {
    return NextResponse.json({ error: 'ID de test invalide' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  // Récupère le profil utilisateur pour vérifier le rôle
  const { data: userProfile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = userProfile?.role === 'admin'

  // Vérifie que le test existe et appartient à l'utilisateur (ou admin)
  // Note: Supabase builder is immutable — must capture the returned value of each .eq() call
  const { data: test, error: testError } = await (isAdmin
    ? supabase.from('tests').select('id, test_definition_id, status, user_id').eq('id', testId).single()
    : supabase.from('tests').select('id, test_definition_id, status, user_id').eq('id', testId).eq('user_id', user.id).single()
  )
  if (testError || !test) {
    return NextResponse.json({ error: 'Test introuvable' }, { status: 404 })
  }
  if (test.status !== 'completed') {
    return NextResponse.json({ error: 'Le test n\'est pas encore terminé' }, { status: 422 })
  }

  const admin = createAdminClient()

  // Calcul des scores via le moteur
  const scoring = await computeTestScores(test.id, test.test_definition_id, admin)

  // Construit les lignes test_scores
  const testScores: {
    test_id: string
    entity_type: 'competency_node' | 'global'
    entity_id: string | null
    score: number
    percentile: number | null
  }[] = []

  if (scoring.globalScore !== null) {
    testScores.push({
      test_id: testId,
      entity_type: 'global',
      entity_id: null,
      score: scoring.globalScore,
      percentile: scoring.globalPercentile,
    })
  }
  for (const { nodeId, score, percentile } of scoring.leafScores) {
    testScores.push({ test_id: testId, entity_type: 'competency_node', entity_id: nodeId, score, percentile })
  }
  for (const { nodeId, score, percentile } of scoring.domainScores) {
    testScores.push({ test_id: testId, entity_type: 'competency_node', entity_id: nodeId, score, percentile })
  }

  // Persiste les scores (admin requis — pas de policy INSERT/DELETE pour authenticated)
  if (testScores.length > 0) {
    await admin.from('test_scores').delete().eq('test_id', testId)
    const { error: insertError } = await admin.from('test_scores').insert(testScores)
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }
  }

  // Met à jour score_global et profile_id (colonnes révoquées pour authenticated)
  const { error: updateError } = await admin
    .from('tests')
    .update({ score_global: scoring.globalScore, profile_id: scoring.profileId })
    .eq('id', testId)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Récupère les détails du profil pour la réponse
  let profileData: {
    id: string
    name: string
    family: string | null
    color: string
    description: string | null
    strengths: string | null
    weaknesses: string | null
    recommendations: string | null
  } | null = null

  if (scoring.profileId) {
    const { data: profile } = await admin
      .from('profiles')
      .select('id, name, family, color, description, strengths, weaknesses, recommendations')
      .eq('id', scoring.profileId)
      .single()
    profileData = profile ?? null
  }

  // Construit la réponse selon le format spec
  return NextResponse.json({
    score_global:    scoring.globalScore,
    global_percentile: scoring.globalPercentile,
    scores_domaines: scoring.domainScores.map((d) => ({
      node_id:    d.nodeId,
      name:       d.name,
      score:      d.score,
      percentile: d.percentile,
    })),
    scores_feuilles: scoring.leafScores.map((l) => ({
      node_id:    l.nodeId,
      name:       l.name,
      score:      l.score,
      percentile: l.percentile,
    })),
    profile: profileData,
  })
}
