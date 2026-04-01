'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type {
  ProfileIntelligenceData,
  MentalProfile,
  LeafZScore,
  EliteMarker,
  GlobalPredictor,
  ScoreByLevel,
  ActiveInsight,
  ConditionalInsightDef,
} from '@/types'

// Schéma de validation des conditions d'insights (valeurs numériques uniquement)
const conditionThresholdSchema = z.record(z.string(), z.number())
const conditionSchema = z.object({
  min: conditionThresholdSchema.optional(),
  max: conditionThresholdSchema.optional(),
})

// Calcule le z-score d'une valeur par rapport à la distribution normative
function calcZ(score: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0
  return parseFloat(((score - mean) / stdDev).toFixed(3))
}

// Évalue les insights conditionnels en fonction des scores du client
function evaluateInsights(
  insights: ConditionalInsightDef[],
  scoresBySlug: Record<string, number>
): ActiveInsight[] {
  const active: ActiveInsight[] = []

  for (const insight of insights) {
    if (active.length >= 4) break

    if (insight.condition === 'always') {
      if (insight.text_positive) {
        active.push({ id: insight.id, title: insight.title, text: insight.text_positive })
      }
      continue
    }

    // Valide le schéma de la condition avant tout accès numérique
    const condParsed = conditionSchema.safeParse(insight.condition)
    if (!condParsed.success) continue

    const cond = condParsed.data
    let conditionMet = true

    // Vérifier les conditions min (valeurs minimales requises)
    if (cond.min) {
      for (const [slug, threshold] of Object.entries(cond.min)) {
        const clientScore = scoresBySlug[slug]
        if (clientScore === undefined || clientScore < threshold) {
          conditionMet = false
          break
        }
      }
    }

    // Vérifier les conditions max (valeurs maximales requises)
    if (conditionMet && cond.max) {
      for (const [slug, threshold] of Object.entries(cond.max)) {
        const clientScore = scoresBySlug[slug]
        if (clientScore === undefined || clientScore > threshold) {
          conditionMet = false
          break
        }
      }
    }

    if (conditionMet && insight.text_positive) {
      active.push({ id: insight.id, title: insight.title, text: insight.text_positive })
    } else if (!conditionMet && insight.text_negative) {
      active.push({ id: insight.id, title: insight.title, text: insight.text_negative })
    }
  }

  return active
}

export async function getProfileIntelligenceData(
  testId: string
): Promise<ProfileIntelligenceData | null> {
  // Validation UUID en entrée (défense en profondeur)
  if (!z.string().uuid().safeParse(testId).success) return null

  const supabase = await createClient()

  // Vérification d'identité
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Requête principale : test avec son niveau et son profil
  const { data: test, error: testError } = await supabase
    .from('tests')
    .select('id, test_definition_id, level_slug, score_global, profile_id, status, results_released_at, user_id, coach_id')
    .eq('id', testId)
    .eq('status', 'completed')
    .single()

  if (testError || !test) return null

  // Seuls le client propriétaire ou le coach peuvent accéder
  const isOwner = test.user_id === user.id
  const isCoach = test.coach_id === user.id
  if (!isOwner && !isCoach) return null

  // Le client ne voit que les résultats publiés
  if (isOwner && !isCoach && !test.results_released_at) return null

  if (!test.profile_id) return null

  // Récupération parallèle de toutes les données nécessaires
  const [
    { data: testScores },
    { data: nodes },
    { data: normativeStats },
    { data: profileRaw },
    { data: centroids },
    { data: studyDataRows },
  ] = await Promise.all([
    // Scores du test (feuilles + domaines + global)
    supabase
      .from('test_scores')
      .select('entity_type, entity_id, score, percentile')
      .eq('test_id', testId),

    // Arbre de compétences complet
    supabase
      .from('competency_tree')
      .select('id, name, slug, depth, is_leaf, parent_id, order_index')
      .eq('test_definition_id', test.test_definition_id)
      .order('order_index'),

    // Statistiques normatives (mean, std_dev par nœud feuille)
    supabase
      .from('normative_stats')
      .select('competency_node_id, mean, std_dev')
      .eq('test_definition_id', test.test_definition_id),

    // Profil enrichi avec tous les nouveaux champs
    supabase
      .from('profiles')
      .select(`
        id, test_definition_id, name, family, color, population_pct, avg_score,
        description, strengths, weaknesses, recommendations,
        tagline, celebrity_examples, coach_priority, coach_exercise, coach_trap,
        team_role, team_contribution, avg_compatibility, forces_details, faiblesses_details
      `)
      .eq('id', test.profile_id)
      .single(),

    // Centroïdes du profil (z-scores par nœud feuille)
    supabase
      .from('profile_centroids')
      .select('competency_node_id, value')
      .eq('profile_id', test.profile_id),

    // Données de l'étude statistique
    supabase
      .from('study_reference_data')
      .select('key, value')
      .eq('test_definition_id', test.test_definition_id),
  ])

  if (!testScores || !nodes || !normativeStats || !profileRaw) return null

  // --- Index pour accès O(1) ---
  const normByNode = new Map(normativeStats.map((n) => [n.competency_node_id, n]))
  const scoreByNode = new Map(
    (testScores ?? [])
      .filter((s) => s.entity_type === 'competency_node' && s.entity_id)
      .map((s) => [s.entity_id as string, { score: s.score, percentile: s.percentile }])
  )
  const centroidByNode = new Map((centroids ?? []).map((c) => [c.competency_node_id, c.value]))

  // --- Nœuds feuilles et domaines ---
  const leafNodes = nodes.filter((n) => n.is_leaf)
  const domainNodes = nodes.filter((n) => n.depth === 0 && !n.is_leaf).sort((a, b) => a.order_index - b.order_index)

  // --- Score global et percentile ---
  const globalScoreRow = testScores.find((s) => s.entity_type === 'global')
  const globalScore = test.score_global ?? globalScoreRow?.score ?? 0
  const globalPercentile = globalScoreRow?.percentile ?? 0

  // --- Z-scores des sous-compétences du client ---
  const leafZScores: LeafZScore[] = leafNodes.map((leaf) => {
    const norm = normByNode.get(leaf.id)
    const scoreData = scoreByNode.get(leaf.id)
    const score = scoreData?.score ?? 0
    const percentile = scoreData?.percentile ?? null
    const z = norm ? calcZ(score, norm.mean, norm.std_dev) : 0
    return {
      nodeId: leaf.id,
      name: leaf.name,
      sub_slug: leaf.slug,
      parentId: leaf.parent_id ?? null,
      z,
      score,
      percentile,
    }
  })

  // Map slug → score pour l'évaluation des insights conditionnels
  const scoresBySlug: Record<string, number> = {}
  for (const leaf of leafZScores) {
    scoresBySlug[leaf.sub_slug] = leaf.score
  }

  // --- Scores domaines du client ---
  const domainScores = domainNodes.map((d) => ({
    nodeId: d.id,
    name: d.name,
    score: scoreByNode.get(d.id)?.score ?? 0,
  }))

  // --- Scores centroïdes par domaine (convertis z → score brut puis moyennés) ---
  const centroidDomainScores = domainNodes.map((domain) => {
    const leaves = leafNodes.filter((l) => l.parent_id === domain.id)
    const converted = leaves
      .map((l) => {
        const norm = normByNode.get(l.id)
        const centroidZ = centroidByNode.get(l.id)
        if (!norm || centroidZ === undefined) return null
        // z → score brut : score = mean + z * std_dev
        return norm.mean + centroidZ * norm.std_dev
      })
      .filter((v): v is number => v !== null)

    const avg = converted.length > 0
      ? parseFloat((converted.reduce((a, b) => a + b, 0) / converted.length).toFixed(2))
      : 0

    return { name: domain.name, score: avg }
  })

  // --- Moyennes globales par domaine (mean des normative_stats) ---
  const globalAverageDomainScores = domainNodes.map((domain) => {
    const leaves = leafNodes.filter((l) => l.parent_id === domain.id)
    const means = leaves
      .map((l) => normByNode.get(l.id)?.mean)
      .filter((v): v is number => v !== undefined)

    const avg = means.length > 0
      ? parseFloat((means.reduce((a, b) => a + b, 0) / means.length).toFixed(2))
      : 0

    return { name: domain.name, score: avg }
  })

  // --- Parsing des données de l'étude ---
  const studyMap = new Map((studyDataRows ?? []).map((r) => [r.key, r.value]))

  const eliteMarkers = (studyMap.get('elite_markers') as EliteMarker[] | undefined) ?? []
  const globalPredictors = (studyMap.get('global_predictors') as GlobalPredictor[] | undefined) ?? []
  const scoresByLevel = (studyMap.get('scores_by_level') as ScoreByLevel[] | undefined) ?? []
  const nonDiscriminantSubs = (studyMap.get('non_discriminant_subs') as string[] | undefined) ?? []
  const conditionalInsightsDefs = (studyMap.get('conditional_insights') as ConditionalInsightDef[] | undefined) ?? []

  // --- Évaluation des insights conditionnels ---
  const activeInsights = evaluateInsights(conditionalInsightsDefs, scoresBySlug)

  // --- Profil enrichi avec valeurs par défaut pour les champs optionnels ---
  // Les champs réservés au coach sont masqués pour le client propriétaire du test
  const clientOnly = isOwner && !isCoach
  const profile: MentalProfile = {
    ...profileRaw,
    tagline: profileRaw.tagline ?? null,
    celebrity_examples: (profileRaw.celebrity_examples as MentalProfile['celebrity_examples']) ?? [],
    // Champs coach — non transmis au propriétaire du test (évite la fuite via payload RSC)
    coach_priority: clientOnly ? null : (profileRaw.coach_priority ?? null),
    coach_exercise: clientOnly ? null : (profileRaw.coach_exercise ?? null),
    coach_trap: clientOnly ? null : (profileRaw.coach_trap ?? null),
    team_role: profileRaw.team_role ?? null,
    team_contribution: profileRaw.team_contribution ?? null,
    avg_compatibility: profileRaw.avg_compatibility ?? null,
    forces_details: (profileRaw.forces_details as MentalProfile['forces_details']) ?? [],
    faiblesses_details: (profileRaw.faiblesses_details as MentalProfile['faiblesses_details']) ?? [],
  }

  return {
    profile,
    globalScore,
    globalPercentile,
    levelSlug: test.level_slug,
    leafZScores,
    domainScores,
    centroidDomainScores,
    globalAverageDomainScores,
    eliteMarkers,
    globalPredictors,
    scoresByLevel,
    nonDiscriminantSubs,
    activeInsights,
    teammates: [], // Fonctionnalité équipe — table team_members non encore créée
  }
}
