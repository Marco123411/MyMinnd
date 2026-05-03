/**
 * Moteur de scoring MINND
 * Calcule : scores feuilles, domaines, global, percentiles
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScoredNode {
  nodeId: string
  name: string
  score: number
  percentile: number | null
}

export interface ScoringResult {
  globalScore: number | null
  globalPercentile: number | null
  profileId: string | null
  leafScores: ScoredNode[]
  domainScores: ScoredNode[]
}

// ---------------------------------------------------------------------------
// Utilitaires mathématiques
// ---------------------------------------------------------------------------

/** Arrondit à 2 décimales (règle MINND NON-NÉGOCIABLE). */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Approximation de la CDF normale standard (Abramowitz & Stegun 26.2.17).
 * Erreur max : 7.5e-8
 */
function normalCDF(z: number): number {
  const a1 =  0.254829592
  const a2 = -0.284496736
  const a3 =  1.421413741
  const a4 = -1.453152027
  const a5 =  1.061405429
  const p  =  0.3275911

  const sign = z < 0 ? -1 : 1
  const x = Math.abs(z) / Math.sqrt(2)
  const t = 1.0 / (1.0 + p * x)
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x)
  return 0.5 * (1.0 + sign * y)
}

/** Convertit un z-score en percentile entier, clampé entre 1 et 99. */
function zToPercentile(z: number): number {
  return Math.min(99, Math.max(1, Math.round(normalCDF(z) * 100)))
}

// ---------------------------------------------------------------------------
// Moteur principal
// ---------------------------------------------------------------------------

/**
 * Calcule les scores complets d'un test (feuilles, domaines, global, percentiles, profil).
 * N'effectue aucune écriture en base — retourne seulement les résultats calculés.
 * Scoring complet activé pour tous les tests en MVP (un seul niveau).
 *
 * @param testId           UUID du test
 * @param testDefinitionId UUID de la définition du test
 * @param admin            Client Supabase avec service_role (pour lire les tables restreintes)
 */
export async function computeTestScores(
  testId: string,
  testDefinitionId: string,
  admin: SupabaseClient
): Promise<ScoringResult> {

  // ── 1. Mapping question_id → competency_node_id ──
  const { data: questions } = await admin
    .from('questions')
    .select('id, competency_node_id')
    .eq('test_definition_id', testDefinitionId)
    .eq('is_active', true)

  const questionNodeMap: Record<string, string> = {}
  for (const q of questions ?? []) {
    questionNodeMap[q.id] = q.competency_node_id
  }

  // ── 2. Réponses du test ──
  const { data: responses } = await admin
    .from('responses')
    .select('question_id, computed_score')
    .eq('test_id', testId)

  // ── 3. Regroupement computed_score par nœud feuille ──
  const leafScoreMap: Record<string, number[]> = {}
  for (const r of responses ?? []) {
    const nodeId = questionNodeMap[r.question_id]
    if (!nodeId) continue
    if (!leafScoreMap[nodeId]) leafScoreMap[nodeId] = []
    leafScoreMap[nodeId].push(r.computed_score)
  }

  // ── 4. Score feuille = moyenne des réponses (NON-NÉGOCIABLE) ──
  const leafAvgs: Record<string, number> = {}
  for (const [nodeId, scores] of Object.entries(leafScoreMap)) {
    leafAvgs[nodeId] = round2(scores.reduce((a, b) => a + b, 0) / scores.length)
  }

  // ── 5. Score global = moyenne de TOUTES les feuilles (pas des domaines) ──
  const allLeafScores = Object.values(leafAvgs)
  const globalScore = allLeafScores.length > 0
    ? round2(allLeafScores.reduce((a, b) => a + b, 0) / allLeafScores.length)
    : null

  // ── 6. Arbre de compétences (nœuds + noms) ──
  const { data: competencyNodes } = await admin
    .from('competency_tree')
    .select('id, parent_id, name, depth, is_leaf')
    .eq('test_definition_id', testDefinitionId)

  const nodeNameMap: Record<string, string> = {}
  for (const n of competencyNodes ?? []) {
    nodeNameMap[n.id] = n.name
  }

  // ── 7. Score domaine = moyenne des scores feuilles enfants (NON-NÉGOCIABLE) ──
  const domainAvgs: Record<string, number> = {}
  for (const node of (competencyNodes ?? []).filter((n) => n.depth === 0)) {
    const childLeafIds = (competencyNodes ?? [])
      .filter((n) => n.is_leaf && n.parent_id === node.id)
      .map((n) => n.id)
    const childScores = childLeafIds.map((id) => leafAvgs[id]).filter((s) => s !== undefined)
    if (childScores.length > 0) {
      domainAvgs[node.id] = round2(childScores.reduce((a, b) => a + b, 0) / childScores.length)
    }
  }

  // ── 8. Stats normatives (nécessaires pour les percentiles) ──
  const normativeMap: Record<string, { mean: number; std_dev: number }> = {}
  const { data: normStats } = await admin
    .from('normative_stats')
    .select('competency_node_id, mean, std_dev')
    .eq('test_definition_id', testDefinitionId)

  for (const s of normStats ?? []) {
    normativeMap[s.competency_node_id] = { mean: s.mean, std_dev: s.std_dev }
  }

  function calcPercentile(score: number, nodeId: string | null): number | null {
    if (nodeId === null) {
      // Percentile global : utilise la moyenne des stats normatives des feuilles
      const leafNorms = Object.values(normativeMap)
      if (leafNorms.length === 0) return null
      const avgMean   = leafNorms.reduce((a, b) => a + b.mean,    0) / leafNorms.length
      const avgStdDev = leafNorms.reduce((a, b) => a + b.std_dev, 0) / leafNorms.length
      if (avgStdDev === 0) return null
      return zToPercentile((score - avgMean) / avgStdDev)
    }
    const stat = normativeMap[nodeId]
    if (!stat || stat.std_dev === 0) return null
    return zToPercentile((score - stat.mean) / stat.std_dev)
  }

  // ── 9. Construction des résultats ──
  const leafScores: ScoredNode[] = Object.entries(leafAvgs).map(([nodeId, score]) => ({
    nodeId,
    name:       nodeNameMap[nodeId] ?? nodeId,
    score,
    percentile: calcPercentile(score, nodeId),
  }))

  const domainScores: ScoredNode[] = Object.entries(domainAvgs).map(([nodeId, score]) => ({
    nodeId,
    name:       nodeNameMap[nodeId] ?? nodeId,
    score,
    percentile: calcPercentile(score, nodeId),
  }))

  const globalPercentile = globalScore !== null ? calcPercentile(globalScore, null) : null

  return { globalScore, globalPercentile, profileId: null, leafScores, domainScores }
}
