'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import type {
  AdminUser,
  MonitoringMetric,
  DashboardChartData,
  AdminDashboardStats,
  AdminContentExercise,
  AdminQuestion,
  AdminProfile,
  UserRole,
} from '@/types'

const uuidSchema = z.string().uuid()

async function requireAdmin() {
  const supabase = await createClient()
  const { data: user, error: authError } = await supabase.auth.getUser()
  if (authError || !user.user) return { error: 'Non authentifié' as const, admin: null, userId: null }

  const { data: me } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.user.id)
    .single()

  if (me?.role !== 'admin') return { error: 'Accès refusé' as const, admin: null, userId: null }

  return { error: null, admin: createAdminClient(), userId: user.user.id }
}

// ============================================================
// getAdminDashboardStatsAction — KPIs étendus pour le dashboard
// ============================================================
export async function getAdminDashboardStatsAction(): Promise<{
  data: AdminDashboardStats | null
  error: string | null
}> {
  const { error, admin } = await requireAdmin()
  if (error || !admin) return { data: null, error }

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [
    testsTodayProfilage,
    mrrData,
    signups,
  ] = await Promise.all([
    // Tests de profilage complétés aujourd'hui
    admin
      .from('tests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('updated_at', startOfToday),
    // MRR : somme des paiements subscription ce mois
    admin
      .from('payments')
      .select('amount_cents')
      .eq('type', 'subscription')
      .eq('status', 'succeeded')
      .gte('created_at', startOfMonth),
    // Nouvelles inscriptions cette semaine
    admin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startOfWeek),
  ])

  const mrrCents = (mrrData.data ?? []).reduce((sum, p) => sum + p.amount_cents, 0)

  return {
    data: {
      tests_today_profilage: testsTodayProfilage.count ?? 0,
      mrr_this_month: mrrCents,
      signups_this_week: signups.count ?? 0,
    },
    error: null,
  }
}

// ============================================================
// getAdminDashboardChartsAction — Données graphiques dashboard
// ============================================================
export async function getAdminDashboardChartsAction(): Promise<{
  data: DashboardChartData | null
  error: string | null
}> {
  const { error, admin } = await requireAdmin()
  if (error || !admin) return { data: null, error }

  const now = new Date()

  // Calcul des 6 derniers mois
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [mrrPayments, tierCounts, recentTests] = await Promise.all([
    // Paiements subscription des 6 derniers mois
    admin
      .from('payments')
      .select('amount_cents, created_at')
      .eq('type', 'subscription')
      .eq('status', 'succeeded')
      .gte('created_at', sixMonthsAgo)
      .order('created_at', { ascending: true }),
    // Répartition des tiers
    admin.from('users').select('subscription_tier'),
    // Tests profilage des 30 derniers jours
    admin
      .from('tests')
      .select('updated_at')
      .eq('status', 'completed')
      .gte('updated_at', thirtyDaysAgo),
  ])

  // Agrégation MRR par mois
  const mrrByMonth: Record<string, number> = {}
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    mrrByMonth[key] = 0
  }
  for (const p of mrrPayments.data ?? []) {
    const d = new Date(p.created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (key in mrrByMonth) mrrByMonth[key] += p.amount_cents
  }
  const MONTH_LABELS_FR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
  const mrrEvolution = Object.entries(mrrByMonth).map(([key, cents]) => {
    const monthNum = parseInt(key.split('-')[1], 10) - 1
    return { month: MONTH_LABELS_FR[monthNum], mrr: Math.round(cents / 100) }
  })

  // Répartition par tier
  const tierMap: Record<string, number> = { free: 0, pro: 0 }
  for (const u of tierCounts.data ?? []) {
    const t = u.subscription_tier as string
    if (t in tierMap) tierMap[t]++
  }
  const tierDistribution = [
    { tier: 'Gratuit', count: tierMap.free },
    { tier: 'Pro', count: tierMap.pro },
  ]

  // Tests par jour sur 30 jours
  const testsByDayMap: Record<string, { profilage: number }> = {}
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    testsByDayMap[key] = { profilage: 0 }
  }
  for (const t of recentTests.data ?? []) {
    const d = new Date(t.updated_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    if (key in testsByDayMap) testsByDayMap[key].profilage++
  }
  const testsByDay = Object.entries(testsByDayMap).map(([date, counts]) => ({
    date: `${date.split('-')[2]}/${date.split('-')[1]}`,
    ...counts,
  }))

  return { data: { mrrEvolution, tierDistribution, testsByDay }, error: null }
}

// ============================================================
// getAdminUsersAction — Liste des utilisateurs pour l'admin
// ============================================================
export async function getAdminUsersAction(filters?: {
  role?: string
  tier?: string
  search?: string
}): Promise<{ data: AdminUser[]; error: string | null }> {
  const { error, admin } = await requireAdmin()
  if (error || !admin) return { data: [], error }

  let query = admin
    .from('users')
    .select('id, role, context, nom, prenom, photo_url, subscription_tier, subscription_status, is_active, created_at, last_login_at, email:auth_user_email')
    .order('created_at', { ascending: false })
    .limit(200)

  if (filters?.role) query = query.eq('role', filters.role)
  if (filters?.tier) query = query.eq('subscription_tier', filters.tier)

  const { data: users, error: dbError } = await query
  if (dbError) return { data: [], error: dbError.message }

  // Récupération du nombre de tests par utilisateur
  const userIds = (users ?? []).map((u) => u.id as string)
  const { data: testCounts } = userIds.length > 0
    ? await admin
        .from('tests')
        .select('user_id')
        .in('user_id', userIds)
    : { data: [] }

  const countMap: Record<string, number> = {}
  for (const t of testCounts ?? []) {
    const uid = t.user_id as string
    countMap[uid] = (countMap[uid] ?? 0) + 1
  }

  // Récupération des emails depuis auth.users via admin API
  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const emailMap: Record<string, string> = {}
  for (const au of authUsers?.users ?? []) {
    if (au.email) emailMap[au.id] = au.email
  }

  let result: AdminUser[] = (users ?? []).map((u) => ({
    id: u.id as string,
    role: u.role as AdminUser['role'],
    context: u.context as AdminUser['context'],
    nom: u.nom as string,
    prenom: u.prenom as string | null,
    photo_url: u.photo_url as string | null,
    subscription_tier: u.subscription_tier as AdminUser['subscription_tier'],
    subscription_status: u.subscription_status as AdminUser['subscription_status'],
    is_active: u.is_active as boolean,
    created_at: u.created_at as string,
    last_login_at: u.last_login_at as string | null,
    email: emailMap[u.id as string] ?? '',
    test_count: countMap[u.id as string] ?? 0,
  }))

  // Filtre recherche côté serveur (ilike sur nom/email)
  if (filters?.search) {
    const q = filters.search.toLowerCase()
    result = result.filter(
      (u) =>
        u.nom.toLowerCase().includes(q) ||
        (u.prenom ?? '').toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
    )
  }

  return { data: result, error: null }
}

// ============================================================
// updateUserRoleAction — Changer le rôle d'un utilisateur
// ============================================================
export async function updateUserRoleAction(
  userId: string,
  role: UserRole
): Promise<{ error: string | null }> {
  if (!uuidSchema.safeParse(userId).success) return { error: 'ID invalide' }
  if (!['client', 'coach', 'admin'].includes(role)) return { error: 'Rôle invalide' }

  const { error, admin, userId: currentUserId } = await requireAdmin()
  if (error || !admin) return { error }
  if (userId === currentUserId) return { error: 'Impossible de modifier son propre rôle' }

  const { error: dbError } = await admin
    .from('users')
    .update({ role })
    .eq('id', userId)

  if (dbError) return { error: dbError.message }
  revalidatePath('/admin/utilisateurs')
  return { error: null }
}

// ============================================================
// toggleUserActiveAction — Activer/désactiver un compte
// ============================================================
export async function toggleUserActiveAction(
  userId: string,
  is_active: boolean
): Promise<{ error: string | null }> {
  if (!uuidSchema.safeParse(userId).success) return { error: 'ID invalide' }

  const { error, admin, userId: currentUserId } = await requireAdmin()
  if (error || !admin) return { error }
  if (userId === currentUserId) return { error: 'Impossible de désactiver son propre compte' }

  const { error: dbError } = await admin
    .from('users')
    .update({ is_active })
    .eq('id', userId)

  if (dbError) return { error: dbError.message }
  revalidatePath('/admin/utilisateurs')
  return { error: null }
}

// ============================================================
// getAdminMonitoringMetricsAction — Métriques plateforme
// ============================================================
export async function getAdminMonitoringMetricsAction(): Promise<{
  data: MonitoringMetric[]
  error: string | null
}> {
  const { error, admin } = await requireAdmin()
  if (error || !admin) return { data: [], error }

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const startOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()).toISOString()
  const startOfThisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const startOfLastWeek = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    dauToday,
    dauYesterday,
    mauThis,
    mauLast,
    testsThisWeek,
    testsLastWeek,
    mrrThis,
    mrrLast,
    subsStartOfMonth,
    unsubsThisMonth,
  ] = await Promise.all([
    // DAU aujourd'hui
    admin.from('users').select('id', { count: 'exact', head: true }).gte('last_login_at', startOfToday),
    // DAU hier
    admin.from('users').select('id', { count: 'exact', head: true }).gte('last_login_at', startOfYesterday).lt('last_login_at', startOfToday),
    // MAU ce mois
    admin.from('users').select('id', { count: 'exact', head: true }).gte('last_login_at', thirtyDaysAgo),
    // MAU mois dernier
    admin.from('users').select('id', { count: 'exact', head: true }).gte('last_login_at', startOfLastMonth).lt('last_login_at', startOfThisMonth),
    // Tests profilage cette semaine
    admin.from('tests').select('id', { count: 'exact', head: true }).eq('status', 'completed').gte('updated_at', startOfThisWeek),
    // Tests profilage semaine dernière
    admin.from('tests').select('id', { count: 'exact', head: true }).eq('status', 'completed').gte('updated_at', startOfLastWeek).lt('updated_at', startOfThisWeek),
    // MRR ce mois
    admin.from('payments').select('amount_cents').eq('type', 'subscription').eq('status', 'succeeded').gte('created_at', startOfThisMonth),
    // MRR mois dernier
    admin.from('payments').select('amount_cents').eq('type', 'subscription').eq('status', 'succeeded').gte('created_at', startOfLastMonth).lt('created_at', startOfThisMonth),
    // Abonnés début du mois (proxy: abonnés actifs actuellement — approx)
    admin.from('users').select('id', { count: 'exact', head: true }).neq('subscription_tier', 'free').eq('subscription_status', 'active'),
    // Désabonnements ce mois (cancelled this month)
    admin.from('users').select('id', { count: 'exact', head: true }).eq('subscription_status', 'cancelled').gte('updated_at', startOfThisMonth),
  ])

  const mrrThisCents = (mrrThis.data ?? []).reduce((s, p) => s + p.amount_cents, 0)
  const mrrLastCents = (mrrLast.data ?? []).reduce((s, p) => s + p.amount_cents, 0)

  const subCount = subsStartOfMonth.count ?? 1
  const churnThis = Math.round(((unsubsThisMonth.count ?? 0) / subCount) * 100 * 10) / 10
  const churnLast = 0 // Approximation — pas de données historiques stockées

  function deltaPct(current: number, previous: number): number | null {
    if (previous === 0) return null
    return Math.round(((current - previous) / previous) * 100 * 10) / 10
  }

  const metrics: MonitoringMetric[] = [
    {
      key: 'dau',
      label: 'DAU (actifs aujourd\'hui)',
      value: dauToday.count ?? 0,
      previous: dauYesterday.count ?? 0,
      frequency: 'quotidien',
      delta_pct: deltaPct(dauToday.count ?? 0, dauYesterday.count ?? 0),
    },
    {
      key: 'mau',
      label: 'MAU (actifs 30 jours)',
      value: mauThis.count ?? 0,
      previous: mauLast.count ?? 0,
      frequency: 'mensuel',
      delta_pct: deltaPct(mauThis.count ?? 0, mauLast.count ?? 0),
    },
    {
      key: 'tests_profilage',
      label: 'Tests profilage complétés',
      value: testsThisWeek.count ?? 0,
      previous: testsLastWeek.count ?? 0,
      frequency: 'hebdo',
      delta_pct: deltaPct(testsThisWeek.count ?? 0, testsLastWeek.count ?? 0),
    },
    {
      key: 'mrr',
      label: 'MRR (abonnements)',
      value: Math.round(mrrThisCents / 100),
      previous: Math.round(mrrLastCents / 100),
      unit: '€',
      frequency: 'mensuel',
      delta_pct: deltaPct(mrrThisCents, mrrLastCents),
    },
    {
      key: 'churn',
      label: 'Taux de churn',
      value: churnThis,
      previous: churnLast,
      unit: '%',
      frequency: 'mensuel',
      delta_pct: null,
    },
  ]

  return { data: metrics, error: null }
}

// ============================================================
// getAdminExercisesAction — Bibliothèque d'exercices pour admin
// ============================================================
export async function getAdminExercisesAction(): Promise<{
  data: AdminContentExercise[]
  error: string | null
}> {
  const { error, admin } = await requireAdmin()
  if (error || !admin) return { data: [], error }

  const { data, error: dbError } = await admin
    .from('exercises')
    .select(`
      id, titre, description, categorie, format, is_custom, is_public, coach_id,
      coach:users(nom)
    `)
    .order('created_at', { ascending: false })

  if (dbError) return { data: [], error: dbError.message }

  const result: AdminContentExercise[] = (data ?? []).map((e) => ({
    id: e.id as string,
    titre: e.titre as string,
    description: e.description as string | null,
    categorie: e.categorie as string | null,
    format: e.format as string,
    is_custom: e.is_custom as boolean,
    is_public: e.is_public as boolean,
    coach_id: e.coach_id as string | null,
    coach_nom: (e.coach as unknown as { nom: string } | null)?.nom ?? null,
  }))

  return { data: result, error: null }
}

// ============================================================
// updateAdminExerciseAction — Modifier un exercice
// ============================================================
const exerciseUpdateSchema = z.object({
  titre: z.string().min(1).optional(),
  description: z.string().optional(),
  categorie: z.string().optional(),
  is_public: z.boolean().optional(),
})

export async function updateAdminExerciseAction(
  id: string,
  data: z.infer<typeof exerciseUpdateSchema>
): Promise<{ error: string | null }> {
  if (!uuidSchema.safeParse(id).success) return { error: 'ID invalide' }

  const parsed = exerciseUpdateSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Données invalides' }

  const { error, admin } = await requireAdmin()
  if (error || !admin) return { error }

  const { error: dbError } = await admin
    .from('exercises')
    .update(parsed.data)
    .eq('id', id)

  if (dbError) return { error: dbError.message }
  revalidatePath('/admin/content')
  return { error: null }
}

// ============================================================
// getAdminProfilesAction — Profils mentaux pour édition des textes
// ============================================================
export async function getAdminProfilesAction(): Promise<{
  data: AdminProfile[]
  error: string | null
}> {
  const { error, admin } = await requireAdmin()
  if (error || !admin) return { data: [], error }

  const { data, error: dbError } = await admin
    .from('profiles')
    .select(`
      id, name, color, family, description, strengths, weaknesses, recommendations,
      test_definition_id,
      test_definitions(name)
    `)
    .order('name')

  if (dbError) return { data: [], error: dbError.message }

  const result: AdminProfile[] = (data ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    color: p.color as string,
    family: p.family as string | null,
    description: p.description as string | null,
    strengths: p.strengths as string | null,
    weaknesses: p.weaknesses as string | null,
    recommendations: p.recommendations as string | null,
    test_definition_id: p.test_definition_id as string,
    test_definition_name: (p.test_definitions as unknown as { name: string } | null)?.name ?? '',
  }))

  return { data: result, error: null }
}

// ============================================================
// updateAdminProfileAction — Modifier les textes d'un profil
// ============================================================
const profileUpdateSchema = z.object({
  description: z.string().optional(),
  strengths: z.string().optional(),
  weaknesses: z.string().optional(),
  recommendations: z.string().optional(),
})

export async function updateAdminProfileAction(
  id: string,
  data: z.infer<typeof profileUpdateSchema>
): Promise<{ error: string | null }> {
  if (!uuidSchema.safeParse(id).success) return { error: 'ID invalide' }

  const parsed = profileUpdateSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Données invalides' }

  const { error, admin } = await requireAdmin()
  if (error || !admin) return { error }

  const { error: dbError } = await admin
    .from('profiles')
    .update(parsed.data)
    .eq('id', id)

  if (dbError) return { error: dbError.message }
  revalidatePath('/admin/content')
  return { error: null }
}

// ============================================================
// getAdminQuestionsAction — Questions par test_definition
// ============================================================
export async function getAdminQuestionsAction(
  testDefinitionId?: string
): Promise<{ data: AdminQuestion[]; error: string | null }> {
  const { error, admin } = await requireAdmin()
  if (error || !admin) return { data: [], error }

  if (testDefinitionId && !uuidSchema.safeParse(testDefinitionId).success) {
    return { data: [], error: 'ID invalide' }
  }

  let query = admin
    .from('questions')
    .select(`
      id, text_fr, is_reversed, is_active, level_required,
      test_definition_id,
      test_definitions(slug),
      competency_node_id,
      competency_tree(name)
    `)
    .order('order_index')

  if (testDefinitionId) query = query.eq('test_definition_id', testDefinitionId)

  const { data, error: dbError } = await query
  if (dbError) return { data: [], error: dbError.message }

  const result: AdminQuestion[] = (data ?? []).map((q) => ({
    id: q.id as string,
    text_fr: q.text_fr as string,
    is_reversed: q.is_reversed as boolean,
    is_active: q.is_active as boolean,
    level_required: q.level_required as string | null,
    test_definition_id: q.test_definition_id as string,
    test_definition_slug: (q.test_definitions as unknown as { slug: string } | null)?.slug ?? '',
    competency_node_id: q.competency_node_id as string,
    competency_node_name: (q.competency_tree as unknown as { name: string } | null)?.name ?? '',
  }))

  return { data: result, error: null }
}

// ============================================================
// updateAdminQuestionAction — Modifier une question (pas d'ajout/suppression)
// ============================================================
const questionUpdateSchema = z.object({
  text_fr: z.string().min(5).optional(),
  is_reversed: z.boolean().optional(),
  is_active: z.boolean().optional(),
})

export async function updateAdminQuestionAction(
  id: string,
  data: z.infer<typeof questionUpdateSchema>
): Promise<{ error: string | null }> {
  if (!uuidSchema.safeParse(id).success) return { error: 'ID invalide' }

  const parsed = questionUpdateSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Données invalides' }

  const { error, admin } = await requireAdmin()
  if (error || !admin) return { error }

  const { error: dbError } = await admin
    .from('questions')
    .update(parsed.data)
    .eq('id', id)

  if (dbError) return { error: dbError.message }
  revalidatePath('/admin/content')
  return { error: null }
}

// ============================================================
// getAdminTestDefinitionsAction — Définitions de tests pour sélecteurs
// ============================================================
export async function getAdminTestDefinitionsAction(): Promise<{
  data: { id: string; slug: string; name: string }[]
  error: string | null
}> {
  const { error, admin } = await requireAdmin()
  if (error || !admin) return { data: [], error }

  const { data, error: dbError } = await admin
    .from('test_definitions')
    .select('id, slug, name')
    .order('name')

  if (dbError) return { data: [], error: dbError.message }
  return { data: (data ?? []) as { id: string; slug: string; name: string }[], error: null }
}

