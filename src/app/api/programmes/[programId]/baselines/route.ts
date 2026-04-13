import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { evaluateBenchmark } from '@/lib/cognitive/scoring'
import type { CognitiveBenchmark } from '@/types'

const uuidSchema = z.string().uuid()

const createBaselineSchema = z.object({
  name:      z.string().min(1).max(100),
  pre_date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  post_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).refine((d) => d.pre_date < d.post_date, {
  message: 'pre_date doit être antérieure à post_date',
})

type BaselineComparison = {
  test_slug: string
  test_name: string
  metrics: Record<string, {
    pre: number
    post: number
    delta: number
    delta_percent: number
    improved: boolean
  }>
  pre_benchmark:  Record<string, 'elite' | 'average' | 'poor'>
  post_benchmark: Record<string, 'elite' | 'average' | 'poor'>
}

type BaselineSummary = {
  tests_compared:    number
  metrics_improved:  number
  metrics_regressed: number
  metrics_stable:    number
  overall_trend:     'improving' | 'stable' | 'declining'
}

// Retourne la date ±7 jours sous forme de strings ISO pour la requête Supabase
// Parses as UTC (appending T00:00:00Z) to avoid timezone shifts on the day boundary
function windowAround(dateStr: string): { from: string; to: string } {
  const d = new Date(dateStr + 'T00:00:00Z')
  const from = new Date(d); from.setUTCDate(from.getUTCDate() - 7)
  const to   = new Date(d); to.setUTCDate(to.getUTCDate() + 7)
  return {
    from: from.toISOString(),
    to:   to.toISOString(),
  }
}

// GET — liste des baselines d'un programme (résumé uniquement)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  const { programId } = await params

  if (!uuidSchema.safeParse(programId).success) {
    return NextResponse.json({ error: 'programId invalide' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  // Vérifie que l'utilisateur est coach ou client de ce programme
  const { data: prog } = await supabase
    .from('programmes')
    .select('id, coach_id, client_id')
    .eq('id', programId)
    .single()

  if (!prog || (prog.coach_id !== user.id && prog.client_id !== user.id)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const { data: baselines, error } = await supabase
    .from('cognitive_baselines')
    .select('id, name, pre_date, post_date, created_at, results')
    .eq('programme_id', programId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Erreur lors de la récupération des baselines' }, { status: 500 })

  // Retourne résumé sans les détails complets
  const summaries = (baselines ?? []).map((b) => {
    const summary = (b.results as { summary?: BaselineSummary } | null)?.summary ?? null
    return {
      id:         b.id,
      name:       b.name,
      pre_date:   b.pre_date,
      post_date:  b.post_date,
      created_at: b.created_at,
      summary,
    }
  })

  return NextResponse.json({ data: summaries })
}

// POST — crée une baseline et calcule les comparaisons Pre/Post
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ programId: string }> }
) {
  const { programId } = await params

  if (!uuidSchema.safeParse(programId).success) {
    return NextResponse.json({ error: 'programId invalide' }, { status: 400 })
  }

  const body = await req.json().catch(() => null)
  const parsed = createBaselineSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 })
  }

  const { name, pre_date, post_date } = parsed.data

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  // Vérifie que l'utilisateur est coach de ce programme
  const { data: prog } = await supabase
    .from('programmes')
    .select('id, coach_id, client_id')
    .eq('id', programId)
    .eq('coach_id', user.id)
    .single()

  if (!prog) return NextResponse.json({ error: 'Programme introuvable ou accès refusé' }, { status: 403 })

  const admin = createAdminClient()
  const preWindow  = windowAround(pre_date)
  const postWindow = windowAround(post_date)

  // Récupère les sessions Pre et Post du client dans les fenêtres ±7j
  // Triées par date décroissante — buildTestMap prend la première occurrence (la plus récente) par slug
  const [{ data: preSessions }, { data: postSessions }] = await Promise.all([
    admin
      .from('cognitive_sessions')
      .select('id, cognitive_test_id, computed_metrics, benchmark_results, cognitive_test_definitions(id, slug, name)')
      .eq('user_id', prog.client_id)
      .eq('phase_context', 'pre')
      .eq('status', 'completed')
      .gte('completed_at', preWindow.from)
      .lte('completed_at', preWindow.to)
      .order('completed_at', { ascending: false }),
    admin
      .from('cognitive_sessions')
      .select('id, cognitive_test_id, computed_metrics, benchmark_results, cognitive_test_definitions(id, slug, name)')
      .eq('user_id', prog.client_id)
      .eq('phase_context', 'post')
      .eq('status', 'completed')
      .gte('completed_at', postWindow.from)
      .lte('completed_at', postWindow.to)
      .order('completed_at', { ascending: false }),
  ])

  type SessionRow = {
    id: string
    cognitive_test_id: string
    computed_metrics: Record<string, number> | null
    benchmark_results: Array<{ metric: string; value: number; zone: 'elite' | 'average' | 'poor' }> | null
    cognitive_test_definitions: { id: string; slug: string; name: string } | { id: string; slug: string; name: string }[] | null
  }

  const buildTestMap = (sessions: SessionRow[] | null) => {
    const map = new Map<string, SessionRow>()
    for (const s of sessions ?? []) {
      const def = Array.isArray(s.cognitive_test_definitions) ? s.cognitive_test_definitions[0] : s.cognitive_test_definitions
      // Ne prend que la première occurrence par slug (sessions triées décroissantes → la plus récente)
      if (def?.slug && !map.has(def.slug)) map.set(def.slug, s)
    }
    return map
  }

  const preMap  = buildTestMap(preSessions as SessionRow[] | null)
  const postMap = buildTestMap(postSessions as SessionRow[] | null)

  // Slugs présents dans les deux groupes
  const commonSlugs = [...preMap.keys()].filter((slug) => postMap.has(slug))

  // Pour les benchmarks — chargement groupé
  const testIds = commonSlugs.map((slug) => {
    const def = Array.isArray(preMap.get(slug)!.cognitive_test_definitions)
      ? (preMap.get(slug)!.cognitive_test_definitions as { id: string }[])[0]
      : preMap.get(slug)!.cognitive_test_definitions as { id: string } | null
    return def?.id
  }).filter(Boolean) as string[]

  const { data: allBenchmarks } = testIds.length > 0
    ? await supabase
        .from('cognitive_benchmarks')
        .select('*')
        .in('test_definition_id', testIds)
    : { data: [] }

  const benchmarksByTestId = new Map<string, CognitiveBenchmark[]>()
  for (const b of (allBenchmarks ?? []) as CognitiveBenchmark[]) {
    const arr = benchmarksByTestId.get(b.test_definition_id) ?? []
    arr.push(b)
    benchmarksByTestId.set(b.test_definition_id, arr)
  }

  const comparisons: BaselineComparison[] = []
  let totalImproved = 0, totalRegressed = 0, totalStable = 0

  for (const slug of commonSlugs) {
    const preS  = preMap.get(slug)!
    const postS = postMap.get(slug)!
    const def = Array.isArray(preS.cognitive_test_definitions)
      ? preS.cognitive_test_definitions[0]
      : preS.cognitive_test_definitions

    if (!def || !preS.computed_metrics || !postS.computed_metrics) continue

    const preMetrics  = preS.computed_metrics
    const postMetrics = postS.computed_metrics
    const testBenchmarks = benchmarksByTestId.get(def.id) ?? []

    const commonMetrics = Object.keys(preMetrics).filter((k) => postMetrics[k] !== undefined)

    const metricsResult: BaselineComparison['metrics'] = {}
    const preBenchmark:  BaselineComparison['pre_benchmark']  = {}
    const postBenchmark: BaselineComparison['post_benchmark'] = {}

    for (const key of commonMetrics) {
      const preVal  = preMetrics[key]
      const postVal = postMetrics[key]
      const delta   = postVal - preVal
      const deltaPercent = preVal !== 0 ? (delta / Math.abs(preVal)) * 100 : 0

      const bm = testBenchmarks.find((b) => b.metric === key)
      const improved = bm
        ? (bm.direction === 'lower_is_better' ? delta < 0 : delta > 0)
        : delta > 0  // fallback heuristique

      metricsResult[key] = {
        pre:           preVal,
        post:          postVal,
        delta:         parseFloat(delta.toFixed(2)),
        delta_percent: parseFloat(deltaPercent.toFixed(1)),
        improved,
      }

      // Stable en premier : évite de comptabiliser de micro-améliorations comme "improved"
      if (Math.abs(deltaPercent) < 2) totalStable++
      else if (improved) totalImproved++
      else totalRegressed++

      if (bm) {
        preBenchmark[key]  = evaluateBenchmark(preVal, bm)
        postBenchmark[key] = evaluateBenchmark(postVal, bm)
      }
    }

    comparisons.push({
      test_slug:      slug,
      test_name:      def.name,
      metrics:        metricsResult,
      pre_benchmark:  preBenchmark,
      post_benchmark: postBenchmark,
    })
  }

  const overall: BaselineSummary['overall_trend'] =
    totalImproved > totalRegressed ? 'improving'
    : totalRegressed > totalImproved ? 'declining'
    : 'stable'

  const summary: BaselineSummary = {
    tests_compared:    comparisons.length,
    metrics_improved:  totalImproved,
    metrics_regressed: totalRegressed,
    metrics_stable:    totalStable,
    overall_trend:     overall,
  }

  const results = { comparisons, summary }

  const { data: baseline, error: insertError } = await supabase
    .from('cognitive_baselines')
    .insert({
      programme_id: programId,
      name,
      pre_date,
      post_date,
      results,
    })
    .select('id, name, pre_date, post_date, created_at')
    .single()

  if (insertError) return NextResponse.json({ error: 'Erreur lors de la création de la baseline' }, { status: 500 })

  return NextResponse.json({ data: { ...baseline, results } }, { status: 201 })
}
