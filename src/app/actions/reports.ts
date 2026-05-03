'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { CoachReportRow, CoachPendingTest, CoachAlerts, TestLevelSlug } from '@/types'

// ============================================================
// Récupère tous les tests complétés de tous les clients du coach
// avec les informations enrichies pour le tableau des rapports
// ============================================================
export async function getCoachReportsSummary(): Promise<{
  data: CoachReportRow[] | null
  error: string | null
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Non authentifié' }

  // Requêtes parallèles : fiches clients + tests complétés (pas de dépendance entre elles)
  const [{ data: clientsData, error: clientsError }, { data: testsData, error: testsError }] =
    await Promise.all([
      supabase.from('clients').select('id, nom, user_id').eq('coach_id', user.id),
      supabase
        .from('tests')
        .select(
          `id, level_slug, score_global, report_url, completed_at, client_id, user_id,
           profiles ( name, color ),
           test_definitions ( name )`
        )
        .eq('coach_id', user.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false }),
    ])

  if (clientsError) return { data: null, error: clientsError.message }
  if (testsError) return { data: null, error: testsError.message }
  if (!testsData || testsData.length === 0) return { data: [], error: null }

  // Récupère le percentile global pour chaque test complété
  const testIds = testsData.map((t) => t.id)
  const { data: scoresData, error: scoresError } = await supabase
    .from('test_scores')
    .select('test_id, percentile')
    .eq('entity_type', 'global')
    .in('test_id', testIds)

  if (scoresError) return { data: null, error: scoresError.message }

  // Maps pour jointure en mémoire (évite N+1)
  // Note : la table clients n'a que "nom" (pas de "prenom")
  type ClientInfo = { id: string; nom: string }
  const clientByClientId = new Map<string, ClientInfo>()
  const clientByUserId = new Map<string, ClientInfo>()
  ;(clientsData ?? []).forEach((c) => {
    clientByClientId.set(c.id, { id: c.id, nom: c.nom })
    if (c.user_id) clientByUserId.set(c.user_id, { id: c.id, nom: c.nom })
  })

  const percentileByTestId = new Map<string, number | null>()
  ;(scoresData ?? []).forEach((s) => {
    percentileByTestId.set(s.test_id, s.percentile)
  })

  // Jointure en mémoire : test → client via client_id (ou user_id en fallback)
  const rows: CoachReportRow[] = testsData.map((t) => {
    const client =
      (t.client_id ? clientByClientId.get(t.client_id) : null) ??
      (t.user_id ? clientByUserId.get(t.user_id) : null) ??
      null

    const profiles = Array.isArray(t.profiles) ? t.profiles[0] : t.profiles
    const testDef = Array.isArray(t.test_definitions) ? t.test_definitions[0] : t.test_definitions

    const prof = profiles as { name: string; color: string } | null
    const def = testDef as { name: string } | null

    return {
      testId: t.id,
      clientId: client?.id ?? '',
      clientNom: client?.nom ?? '—',
      clientPrenom: '',
      definitionName: def?.name ?? '—',
      levelSlug: t.level_slug as TestLevelSlug,
      scoreGlobal: t.score_global,
      scorePercentile: percentileByTestId.get(t.id) ?? null,
      profileName: prof?.name ?? null,
      profileColor: prof?.color ?? null,
      completedAt: t.completed_at,
      reportUrl: t.report_url,
    }
  })

  return { data: rows, error: null }
}

// ============================================================
// Calcule les 3 alertes prioritaires pour les cards du Command Center
// ============================================================
export async function getCoachAlerts(): Promise<{
  data: CoachAlerts | null
  error: string | null
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Non authentifié' }

  // Seuils temporels pour les alertes
  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  // Requêtes parallèles : pas de dépendance entre elles
  const [
    { data: clientsWithUser, error: clientsError },
    { data: recentlyActive, error: activeError },
    { data: everCompleted, error: everError },
    { count: pendingOld, error: pendingError },
    { count: pdfMissing, error: pdfError },
  ] = await Promise.all([
    // Clients du coach ayant un compte utilisateur
    supabase.from('clients').select('user_id').eq('coach_id', user.id).not('user_id', 'is', null),
    // Users ayant complété un test chez ce coach dans les 90 derniers jours
    supabase
      .from('tests')
      .select('user_id')
      .eq('coach_id', user.id)
      .eq('status', 'completed')
      .gte('completed_at', ninetyDaysAgo.toISOString())
      .not('user_id', 'is', null),
    // Users ayant complété au moins un test avec ce coach (tous temps confondus)
    // Exclut les nouveaux clients jamais testés du compteur "inactifs"
    supabase
      .from('tests')
      .select('user_id')
      .eq('coach_id', user.id)
      .eq('status', 'completed')
      .not('user_id', 'is', null),
    // Tests pending depuis plus de 7 jours (relance requise)
    supabase
      .from('tests')
      .select('*', { count: 'exact', head: true })
      .eq('coach_id', user.id)
      .eq('status', 'pending')
      .lt('created_at', sevenDaysAgo.toISOString()),
    // Tests complétés sans rapport PDF généré
    supabase
      .from('tests')
      .select('*', { count: 'exact', head: true })
      .eq('coach_id', user.id)
      .eq('status', 'completed')
      .is('report_url', null),
  ])

  if (clientsError) return { data: null, error: clientsError.message }
  if (activeError) return { data: null, error: activeError.message }
  if (everError) return { data: null, error: everError.message }
  if (pendingError) return { data: null, error: pendingError.message }
  if (pdfError) return { data: null, error: pdfError.message }

  // Clients inactifs = clients ayant déjà passé au moins un test, mais pas dans les 90 derniers jours
  // On exclut les nouveaux clients jamais testés (ce ne sont pas des "inactifs")
  const activeSet = new Set<string>()
  ;(recentlyActive ?? []).forEach((t) => {
    if (t.user_id) activeSet.add(t.user_id)
  })
  const everCompletedSet = new Set<string>()
  ;(everCompleted ?? []).forEach((t) => {
    if (t.user_id) everCompletedSet.add(t.user_id)
  })
  const inactifs = (clientsWithUser ?? []).filter(
    (c) => everCompletedSet.has(c.user_id as string) && !activeSet.has(c.user_id as string)
  ).length

  return {
    data: {
      inactifs,
      pendingOld: pendingOld ?? 0,
      pdfMissing: pdfMissing ?? 0,
    },
    error: null,
  }
}

// ============================================================
// Récupère les tests en attente de réponse client (section "Tests en cours")
// Admin client requis pour accéder à invitation_token (champ révoqué pour authenticated)
// ============================================================
export async function getCoachPendingTests(): Promise<{
  data: CoachPendingTest[] | null
  error: string | null
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Non authentifié' }

  const admin = createAdminClient()

  const { data: tests, error } = await admin
    .from('tests')
    .select(
      `id, level_slug, created_at, client_id, invitation_token,
       test_definitions ( name ),
       clients ( id, nom )`
    )
    .eq('coach_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) return { data: null, error: error.message }
  if (!tests || tests.length === 0) return { data: [], error: null }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const rows: CoachPendingTest[] = tests.map((t) => {
    const clientRel = Array.isArray(t.clients) ? t.clients[0] : t.clients
    const defRel = Array.isArray(t.test_definitions) ? t.test_definitions[0] : t.test_definitions

    const client = clientRel as { id: string; nom: string } | null
    const def = defRel as { name: string } | null

    // Calcul du nombre de jours depuis l'envoi de l'invitation
    const daysWaiting = Math.floor(
      (Date.now() - new Date(t.created_at).getTime()) / (1000 * 60 * 60 * 24)
    )

    return {
      testId: t.id,
      clientId: client?.id ?? '',
      clientNom: client?.nom ?? '—',
      clientPrenom: '',
      definitionName: def?.name ?? '—',
      levelSlug: t.level_slug as TestLevelSlug,
      createdAt: t.created_at,
      daysWaiting,
      inviteUrl: t.invitation_token ? `${baseUrl}/test/invite/${t.invitation_token}` : null,
    }
  })

  return { data: rows, error: null }
}
