'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import type { RadarDataPoint } from '@/components/ui/radar-chart'
import type { TestHistoryItem } from '@/components/client/TestHistoryTimeline'
import type { MentalProfile, TestLevelSlug, ClientContext, ClientNiveau } from '@/types'

// ─── Types de retour ──────────────────────────────────────────────────────────

export interface ClientHomeData {
  user: {
    id: string
    nom: string
    prenom: string | null
    context: ClientContext | null
  }
  latestTest: {
    id: string
    level_slug: TestLevelSlug
    completed_at: string
    definition_name: string
    definition_slug: string
  } | null
  radarData: RadarDataPoint[]
  globalScore: number | null
  globalPercentile: number | null
  profile: { id: string; name: string; color: string } | null
  pendingTests: Array<{
    id: string
    inviteUrl: string
    definition_name: string
    level_slug: TestLevelSlug
  }>
  nextCabinetSession: { objectif: string; date_seance: string; statut: string } | null
}

export interface ClientProfileData {
  user: { id: string; nom: string; prenom: string | null; context: ClientContext | null }
  allTests: Array<{
    id: string
    completed_at: string
    level_slug: TestLevelSlug
    definition_name: string
    definition_slug: string
    definition_id: string
  }>
  selectedTest: {
    id: string
    level_slug: TestLevelSlug
    definition_slug: string
  } | null
  radarData: RadarDataPoint[]
  globalScore: number | null
  globalPercentile: number | null
  profile: MentalProfile | null
}

export interface ClientTestDetail {
  test: {
    id: string
    level_slug: TestLevelSlug
    score_global: number | null
    completed_at: string
    report_url: string | null
    definition_id: string
    definition_name: string
    definition_slug: string
  }
  nodes: Array<{
    id: string
    parent_id: string | null
    name: string
    depth: number
    is_leaf: boolean
    order_index: number
  }>
  scores: Array<{
    entity_type: string
    entity_id: string | null
    score: number
    percentile: number | null
  }>
  profile: MentalProfile | null
  globalPercentile: number | null
  notesMap: Record<string, string>
}

export interface ClientHistoryData {
  tests: TestHistoryItem[]
  byDefinition: Array<{
    definitionId: string
    definitionName: string
    tests: TestHistoryItem[]
    lineData: Array<{ date: string; score: number; testId: string }>
    comparisonData: {
      t1: { id: string; date: string; scoreGlobal: number | null; radarData: RadarDataPoint[]; leafScores: Array<{ nodeId: string; name: string; score: number; percentile: number | null }> }
      t2: { id: string; date: string; scoreGlobal: number | null; radarData: RadarDataPoint[]; leafScores: Array<{ nodeId: string; name: string; score: number; percentile: number | null }> }
    } | null
  }>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function requireAuthUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) redirect('/login')
  return { supabase, userId: user.id }
}

// ─── Actions ──────────────────────────────────────────────────────────────────

// Construit l'URL d'invitation à partir du token (même logique que tests-invite.ts)
function buildInviteUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return `${base}/test/invite/${token}`
}

/** Données pour la page d'accueil client : dernier test + radar + profil + tests en attente */
export async function getClientHomeData(): Promise<ClientHomeData> {
  const { supabase, userId } = await requireAuthUser()
  const admin = createAdminClient()

  const [userResult, testResult, clientCrmResult, nextSessionResult] = await Promise.all([
    supabase
      .from('users')
      .select('id, nom, prenom, context')
      .eq('id', userId)
      .single(),
    supabase
      .from('tests')
      .select('id, level_slug, score_global, profile_id, completed_at, test_definition_id, test_definitions(id, name, slug)')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .not('results_released_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Admin requis : RLS de clients n'autorise que coach_id = auth.uid()
    admin
      .from('clients')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle(),
    // Prochaine séance cabinet planifiée (RLS client permet la lecture)
    supabase
      .from('cabinet_sessions')
      .select('objectif, date_seance, statut')
      .eq('client_id', userId)
      .order('date_seance', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  if (userResult.error) throw new Error(userResult.error.message)

  const userData = userResult.data
  const latestTestRaw = testResult.data as (typeof testResult.data & { test_definitions: { id: string; name: string; slug: string } | null }) | null

  // Récupère les tests en attente via le record CRM (les tests pending ont user_id = null)
  type PendingRow = {
    id: string
    level_slug: string
    invitation_token: string | null
    test_definitions: { name: string } | null
  }
  let pendingTests: ClientHomeData['pendingTests'] = []
  const clientCrmRecord = clientCrmResult.data
  if (clientCrmRecord) {
    const { data: pendingRows } = await admin
      .from('tests')
      .select('id, level_slug, invitation_token, test_definitions(name)')
      .eq('client_id', clientCrmRecord.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5)

    pendingTests = ((pendingRows ?? []) as unknown as PendingRow[])
      .filter((r) => r.invitation_token)
      .map((r) => ({
        id: r.id,
        inviteUrl: buildInviteUrl(r.invitation_token!),
        definition_name: r.test_definitions?.name ?? '—',
        level_slug: r.level_slug as TestLevelSlug,
      }))
  }

  const nextCabinetSession = nextSessionResult.data as { objectif: string; date_seance: string; statut: string } | null

  if (!latestTestRaw || !latestTestRaw.test_definitions) {
    return {
      user: userData,
      latestTest: null,
      radarData: [],
      globalScore: null,
      globalPercentile: null,
      profile: null,
      pendingTests,
      nextCabinetSession,
    }
  }

  const def = latestTestRaw.test_definitions

  const [scoresResult, nodesResult, profileResult] = await Promise.all([
    supabase
      .from('test_scores')
      .select('entity_id, entity_type, score, percentile')
      .eq('test_id', latestTestRaw.id),
    supabase
      .from('competency_tree')
      .select('id, name, order_index')
      .eq('test_definition_id', latestTestRaw.test_definition_id)
      .eq('depth', 0)
      .order('order_index'),
    latestTestRaw.profile_id && latestTestRaw.level_slug !== 'discovery'
      ? supabase
          .from('profiles')
          .select('id, name, color')
          .eq('id', latestTestRaw.profile_id)
          .single()
      : Promise.resolve({ data: null, error: null }),
  ])

  const scores = scoresResult.data ?? []
  const domainNodes = nodesResult.data ?? []

  const radarData: RadarDataPoint[] = domainNodes.map((node) => ({
    subject: node.name,
    value: scores.find((s) => s.entity_id === node.id)?.score ?? 0,
    fullMark: 10,
  }))

  const globalRow = scores.find((s) => s.entity_type === 'global')
  const globalScore = latestTestRaw.score_global ?? globalRow?.score ?? null
  const globalPercentile = globalRow?.percentile ?? null

  return {
    user: userData,
    latestTest: {
      id: latestTestRaw.id,
      level_slug: latestTestRaw.level_slug as TestLevelSlug,
      completed_at: latestTestRaw.completed_at ?? '',
      definition_name: def.name,
      definition_slug: def.slug,
    },
    radarData,
    globalScore,
    globalPercentile,
    profile: profileResult.data ?? null,
    pendingTests,
    nextCabinetSession,
  }
}

/** Données pour la page profil mental — liste des tests + données du test sélectionné */
export async function getClientProfileData(testId?: string): Promise<ClientProfileData> {
  const { supabase, userId } = await requireAuthUser()

  const [userResult, allTestsResult] = await Promise.all([
    supabase.from('users').select('id, nom, prenom, context').eq('id', userId).single(),
    supabase
      .from('tests')
      .select('id, level_slug, score_global, profile_id, completed_at, test_definition_id, test_definitions(id, name, slug)')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false }),
  ])

  if (userResult.error) throw new Error(userResult.error.message)

  type TestWithDef = {
    id: string
    level_slug: string
    score_global: number | null
    profile_id: string | null
    completed_at: string | null
    test_definition_id: string
    test_definitions: { id: string; name: string; slug: string } | null
  }

  const allTestsRaw = (allTestsResult.data ?? []) as unknown as TestWithDef[]
  const allTests = allTestsRaw
    .filter((t) => t.test_definitions)
    .map((t) => ({
      id: t.id,
      completed_at: t.completed_at ?? '',
      level_slug: t.level_slug as TestLevelSlug,
      definition_name: t.test_definitions!.name,
      definition_slug: t.test_definitions!.slug,
      definition_id: t.test_definitions!.id,
    }))

  const selected = testId
    ? allTestsRaw.find((t) => t.id === testId)
    : allTestsRaw[0]

  if (!selected || !selected.test_definitions) {
    return {
      user: userResult.data,
      allTests,
      selectedTest: null,
      radarData: [],
      globalScore: null,
      globalPercentile: null,
      profile: null,
    }
  }

  // Inclure la requête profil dans le même Promise.all (supprime le waterfall séquentiel)
  const [scoresResult, nodesResult, profileResult] = await Promise.all([
    supabase
      .from('test_scores')
      .select('entity_id, entity_type, score, percentile')
      .eq('test_id', selected.id),
    supabase
      .from('competency_tree')
      .select('id, name, depth, order_index')
      .eq('test_definition_id', selected.test_definition_id)
      .eq('depth', 0)
      .order('order_index'),
    selected.profile_id && selected.level_slug !== 'discovery'
      ? supabase
          .from('profiles')
          .select('id, test_definition_id, name, family, color, population_pct, avg_score, description, strengths, weaknesses, recommendations')
          .eq('id', selected.profile_id)
          .single()
      : Promise.resolve({ data: null, error: null }),
  ])

  const scores = scoresResult.data ?? []
  const domainNodes = nodesResult.data ?? []

  const radarData: RadarDataPoint[] = domainNodes.map((node) => ({
    subject: node.name,
    value: scores.find((s) => s.entity_id === node.id)?.score ?? 0,
    fullMark: 10,
  }))

  const globalRow = scores.find((s) => s.entity_type === 'global')
  const globalScore = selected.score_global ?? globalRow?.score ?? null
  const globalPercentile = globalRow?.percentile ?? null

  const profile = profileResult.data as MentalProfile | null

  return {
    user: userResult.data,
    allTests,
    selectedTest: {
      id: selected.id,
      level_slug: selected.level_slug as TestLevelSlug,
      definition_slug: selected.test_definitions.slug,
    },
    radarData,
    globalScore,
    globalPercentile,
    profile,
  }
}

/** Données complètes d'un test pour la page résultats détaillés */
export async function getClientTestDetail(testId: string): Promise<ClientTestDetail | null> {
  const { supabase, userId } = await requireAuthUser()

  const { data: testRaw, error: testError } = await supabase
    .from('tests')
    .select('id, level_slug, score_global, completed_at, report_url, profile_id, test_definition_id, results_released_at, test_definitions(id, name, slug)')
    .eq('id', testId)
    .eq('user_id', userId)
    .eq('status', 'completed')
    .single()

  if (testError || !testRaw) return null

  type TestRaw = {
    id: string
    level_slug: string
    score_global: number | null
    completed_at: string | null
    report_url: string | null
    profile_id: string | null
    test_definition_id: string
    results_released_at: string | null
    test_definitions: { id: string; name: string; slug: string } | null
  }
  const test = testRaw as unknown as TestRaw
  if (!test.test_definitions) return null

  // Si les résultats ne sont pas encore publiés par le coach, bloquer l'accès
  if (!test.results_released_at) return null

  // Requête profil + notes incluses dans le Promise.all (supprime le waterfall séquentiel)
  const [nodesResult, scoresResult, profileResult, notesResult] = await Promise.all([
    supabase
      .from('competency_tree')
      .select('id, parent_id, name, depth, is_leaf, order_index')
      .eq('test_definition_id', test.test_definition_id)
      .order('order_index'),
    supabase
      .from('test_scores')
      .select('entity_type, entity_id, score, percentile')
      .eq('test_id', testId),
    test.profile_id && test.level_slug !== 'discovery'
      ? supabase
          .from('profiles')
          .select('id, test_definition_id, name, family, color, population_pct, avg_score, description, strengths, weaknesses, recommendations')
          .eq('id', test.profile_id)
          .single()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from('test_coach_notes')
      .select('node_id, note')
      .eq('test_id', testId),
  ])

  const nodes = nodesResult.data ?? []
  const scores = scoresResult.data ?? []
  const profile = profileResult.data as MentalProfile | null

  const notesMap: Record<string, string> = {}
  for (const row of notesResult.data ?? []) {
    notesMap[row.node_id] = row.note
  }

  const globalRow = scores.find((s) => s.entity_type === 'global')

  return {
    test: {
      id: test.id,
      level_slug: test.level_slug as TestLevelSlug,
      score_global: test.score_global,
      completed_at: test.completed_at ?? '',
      report_url: test.report_url,
      definition_id: test.test_definitions.id,
      definition_name: test.test_definitions.name,
      definition_slug: test.test_definitions.slug,
    },
    nodes,
    scores,
    profile,
    globalPercentile: globalRow?.percentile ?? null,
    notesMap,
  }
}

/** Historique complet des tests du client avec données de comparaison */
export async function getClientHistory(): Promise<ClientHistoryData> {
  const { supabase, userId } = await requireAuthUser()

  const { data: testsRaw } = await supabase
    .from('tests')
    .select('id, level_slug, score_global, completed_at, profile_id, test_definition_id, test_definitions(id, name, slug)')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .not('results_released_at', 'is', null)
    .order('completed_at', { ascending: false })

  type TestRaw = {
    id: string
    level_slug: string
    score_global: number | null
    completed_at: string | null
    profile_id: string | null
    test_definition_id: string
    test_definitions: { id: string; name: string; slug: string } | null
  }

  const rawTests = (testsRaw ?? []) as unknown as TestRaw[]

  // Collecter les IDs de profils uniques
  const profileIds = [...new Set(rawTests.map((t) => t.profile_id).filter(Boolean) as string[])]
  let profileMap: Record<string, { name: string; color: string }> = {}

  if (profileIds.length > 0) {
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, name, color')
      .in('id', profileIds)
    profileMap = Object.fromEntries((profilesData ?? []).map((p) => [p.id, p]))
  }

  const tests: TestHistoryItem[] = rawTests
    .filter((t) => t.test_definitions)
    .map((t) => ({
      id: t.id,
      completed_at: t.completed_at ?? '',
      level_slug: t.level_slug as TestLevelSlug,
      score_global: t.score_global,
      definition_name: t.test_definitions!.name,
      profile_name: t.profile_id ? profileMap[t.profile_id]?.name ?? null : null,
      profile_color: t.profile_id ? profileMap[t.profile_id]?.color ?? null : null,
    }))

  // Grouper par définition
  const byDefinitionMap = new Map<string, { name: string; tests: TestHistoryItem[]; defId: string; slug: string }>()
  for (const t of rawTests) {
    if (!t.test_definitions) continue
    const defId = t.test_definition_id
    if (!byDefinitionMap.has(defId)) {
      byDefinitionMap.set(defId, { name: t.test_definitions.name, tests: [], defId, slug: t.test_definitions.slug })
    }
    const histItem = tests.find((h) => h.id === t.id)
    if (histItem) byDefinitionMap.get(defId)!.tests.push(histItem)
  }

  // Pour les définitions avec 2+ tests : charger les scores pour comparaison
  const byDefinition = await Promise.all(
    Array.from(byDefinitionMap.values()).map(async (group) => {
      const lineData = group.tests
        .filter((t) => t.score_global !== null)
        .map((t) => ({ date: t.completed_at, score: t.score_global!, testId: t.id }))
        .reverse() // chronologique

      if (group.tests.length < 2) {
        return {
          definitionId: group.defId,
          definitionName: group.name,
          tests: group.tests,
          lineData,
          comparisonData: null,
        }
      }

      // T1 = le plus ancien, T2 = le plus récent
      const t1 = group.tests[group.tests.length - 1]
      const t2 = group.tests[0]

      const [scores1, scores2, nodesResult] = await Promise.all([
        supabase.from('test_scores').select('entity_id, entity_type, score, percentile').eq('test_id', t1.id),
        supabase.from('test_scores').select('entity_id, entity_type, score, percentile').eq('test_id', t2.id),
        supabase
          .from('competency_tree')
          .select('id, parent_id, name, depth, order_index, is_leaf')
          .eq('test_definition_id', group.defId)
          .order('order_index'),
      ])

      const s1 = scores1.data ?? []
      const s2 = scores2.data ?? []
      const nodes = nodesResult.data ?? []
      const domainNodes = nodes.filter((n) => n.depth === 0)
      const leafNodes = nodes.filter((n) => n.is_leaf)

      const toRadar = (scores: typeof s1): RadarDataPoint[] =>
        domainNodes.map((n) => ({
          subject: n.name,
          value: scores.find((s) => s.entity_id === n.id)?.score ?? 0,
          fullMark: 10,
        }))

      const toLeaf = (scores: typeof s1) =>
        leafNodes.map((n) => ({
          nodeId: n.id,
          name: n.name,
          score: scores.find((s) => s.entity_id === n.id)?.score ?? 0,
          percentile: scores.find((s) => s.entity_id === n.id)?.percentile ?? null,
        }))

      return {
        definitionId: group.defId,
        definitionName: group.name,
        tests: group.tests,
        lineData,
        comparisonData: {
          t1: { id: t1.id, date: t1.completed_at, scoreGlobal: t1.score_global, radarData: toRadar(s1), leafScores: toLeaf(s1) },
          t2: { id: t2.id, date: t2.completed_at, scoreGlobal: t2.score_global, radarData: toRadar(s2), leafScores: toLeaf(s2) },
        },
      }
    }),
  )

  return { tests, byDefinition }
}

/** Informations sur le coach assigné au client */
export async function getClientCoach() {
  const { supabase, userId } = await requireAuthUser()

  // Admin client nécessaire : la RLS de `clients` autorise uniquement coach_id = auth.uid()
  // Un client ne peut pas lire son propre enregistrement CRM via le client RLS standard
  const admin = createAdminClient()
  const { data: clientRecord } = await admin
    .from('clients')
    .select('id, coach_id, nom, email')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (!clientRecord) return { coach: null, sentTests: [] }

  const [coachResult, testsResult] = await Promise.all([
    // Admin client : la RLS de `users` n'autorise pas un client à lire le profil d'un autre user
    admin
      .from('users')
      .select('id, nom, prenom, photo_url')
      .eq('id', clientRecord.coach_id)
      .single(),
    // Admin requis : les tests pending ont user_id = null, invisibles via RLS client standard
    // On filtre par client_id (record CRM) pour inclure les tests en attente
    admin
      .from('tests')
      .select('id, level_slug, status, score_global, completed_at, created_at, test_definitions(name)')
      .eq('client_id', clientRecord.id)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  type TestWithDef = { id: string; level_slug: string; status: string; score_global: number | null; completed_at: string | null; created_at: string; test_definitions: { name: string } | null }
  const sentTests = ((testsResult.data ?? []) as unknown as TestWithDef[]).map((t) => ({
    id: t.id,
    level_slug: t.level_slug as TestLevelSlug,
    status: t.status,
    score_global: t.score_global,
    completed_at: t.completed_at,
    created_at: t.created_at,
    definition_name: t.test_definitions?.name ?? '—',
  }))

  return {
    coach: coachResult.data
      ? {
          id: coachResult.data.id,
          nom: coachResult.data.nom,
          prenom: coachResult.data.prenom,
          photo_url: coachResult.data.photo_url,
        }
      : null,
    sentTests,
  }
}

// ─── Schémas de validation ────────────────────────────────────────────────────

const updateSettingsSchema = z.object({
  nom: z.string().min(1, 'Le nom est requis'),
  prenom: z.string().optional(),
  photo_url: z.string().url().optional().or(z.literal('')),
  context: z.enum(['sport', 'corporate', 'wellbeing', 'coaching']),
  sport: z.string().optional(),
  niveau: z.enum(['amateur', 'semi-pro', 'professionnel', 'elite']).optional().or(z.literal('')),
})

export type UpdateSettingsData = z.infer<typeof updateSettingsSchema>

/** Met à jour le profil du client (nom, prenom, photo, context) */
export async function updateClientSettings(
  data: UpdateSettingsData,
): Promise<{ success: boolean; error?: string }> {
  const parsed = updateSettingsSchema.safeParse(data)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message }

  const { supabase, userId } = await requireAuthUser()
  const admin = createAdminClient()

  const updates: Record<string, unknown> = {
    nom: parsed.data.nom,
    prenom: parsed.data.prenom ?? null,
    context: parsed.data.context,
  }
  if (parsed.data.photo_url) updates.photo_url = parsed.data.photo_url

  // Mise à jour du profil public.users (admin bypass RLS pour context)
  const { error } = await admin.from('users').update(updates).eq('id', userId)
  if (error) return { success: false, error: error.message }

  // Mise à jour du record CRM clients si context=sport avec sport/niveau
  if (parsed.data.context === 'sport') {
    await supabase
      .from('clients')
      .update({
        sport: parsed.data.sport ?? null,
        niveau: parsed.data.niveau || null,
      })
      .eq('user_id', userId)
  }

  return { success: true }
}

/** Suppression douce du compte (is_active = false) */
export async function deleteClientAccount(): Promise<void> {
  const { userId } = await requireAuthUser()
  const admin = createAdminClient()

  await admin.from('users').update({ is_active: false }).eq('id', userId)

  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

// ─── Nav visibility ───────────────────────────────────────────────────────────

export interface ClientNavVisibility {
  hasExercises: boolean
  hasSessions: boolean
  hasTests: boolean
  hasCognitive: boolean
  hasProgramme: boolean
}

/** Détermine quels onglets nav afficher selon le contenu assigné au client */
export async function getClientNavVisibility(): Promise<ClientNavVisibility> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { hasExercises: false, hasSessions: false, hasTests: false, hasCognitive: false, hasProgramme: false }
  }

  const [exercises, sessions, tests, cognitive, programmes] = await Promise.all([
    supabase
      .from('exercises')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', user.id)
      .limit(1),
    supabase
      .from('cabinet_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', user.id)
      .limit(1),
    supabase
      .from('tests')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .limit(1),
    supabase
      .from('cognitive_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .limit(1),
    supabase
      .from('programmes')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', user.id)
      .eq('statut', 'actif')
      .limit(1),
  ])

  return {
    hasExercises: (exercises.count ?? 0) > 0,
    hasSessions: (sessions.count ?? 0) > 0,
    hasTests: (tests.count ?? 0) > 0,
    hasCognitive: (cognitive.count ?? 0) > 0,
    hasProgramme: (programmes.count ?? 0) > 0,
  }
}
