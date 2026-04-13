// Bibliothèque de scoring cognitif — calcule les métriques pour chaque type de test
// Champs : nommage exact selon spec étape 19 + step 28 + step 31

import type { CognitiveBenchmark } from '@/types'

// Type minimal requis par les fonctions de scoring (sous-ensemble de CognitiveTrial)
export type TrialRecord = {
  stimulus_type: string | null
  stimulus_data: Record<string, unknown> | null
  reaction_time_ms: number | null
  is_correct: boolean | null
  is_anticipation: boolean | null
  is_lapse: boolean | null
}

// ── Helpers statistiques ──────────────────────────────────────────────────────

function avg(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length
}

// F8: Sample std (n-1) — estimateur non biaisé
function std(arr: number[]): number {
  if (arr.length < 2) return 0
  const m = avg(arr)
  return Math.sqrt(arr.reduce((sum, v) => sum + (v - m) ** 2, 0) / (arr.length - 1))
}

// ── Approximation norminv (Beasley-Springer-Moro) ────────────────────────────
// Utilisée pour le calcul de d' (N-Back) — non exportée (usage interne uniquement)

function approxNorminv(p: number): number {
  const pc = Math.max(0.001, Math.min(0.999, p))
  const a = [0, -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239]
  const b = [0, -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1]
  const c = [0, -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
  const d = [0, 7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416]
  const pLow = 0.02425, pHigh = 1 - pLow
  let q: number
  if (pc < pLow) {
    q = Math.sqrt(-2 * Math.log(pc))
    return (((((c[1]*q+c[2])*q+c[3])*q+c[4])*q+c[5])*q+c[6]) / ((((d[1]*q+d[2])*q+d[3])*q+d[4])*q+1)
  } else if (pc <= pHigh) {
    q = pc - 0.5; const r = q*q
    return (((((a[1]*r+a[2])*r+a[3])*r+a[4])*r+a[5])*r+a[6])*q / (((((b[1]*r+b[2])*r+b[3])*r+b[4])*r+b[5])*r+1)
  } else {
    q = Math.sqrt(-2 * Math.log(1 - pc))
    return -(((((c[1]*q+c[2])*q+c[3])*q+c[4])*q+c[5])*q+c[6]) / ((((d[1]*q+d[2])*q+d[3])*q+d[4])*q+1)
  }
}

// ── Helpers métriques communes (step 28) ─────────────────────────────────────

// Reaction Consistency Score : 1.0 = parfaitement constant. Utilise std/mean normalisé.
// Exporté pour réutilisation en step 31 (scoring V2) et frontend.
export function computeRCS(rts: number[]): number {
  const mean = avg(rts)
  if (mean === 0) return 0
  return parseFloat(Math.max(0, 1 - std(rts) / mean).toFixed(3))
}

// Coefficient de variation en % = (std / mean) * 100
export function computeVariation(rts: number[]): number {
  const mean = avg(rts)
  if (mean === 0) return 0
  return parseFloat(((std(rts) / mean) * 100).toFixed(1))
}

// Score composite vitesse-précision.
// accuracy : décimal 0.0–1.0 ; meanRt : en ms.
// Ex: accuracy=0.97, rt=650ms → speed = 97 / 0.65 ≈ 149
export function computeSpeed(accuracy: number, meanRt: number): number {
  if (meanRt === 0) return 0
  return parseFloat(((accuracy * 100) / (meanRt / 1000)).toFixed(1))
}

// ── PVT (Psychomotor Vigilance Task) ─────────────────────────────────────────

export function scorePVT(trials: TrialRecord[]): Record<string, number> {
  // F7: filtrer rt > 0 pour éviter la division par zéro dans le reciprocal
  const valid = trials
    .filter((t) => !t.is_anticipation && t.reaction_time_ms !== null && t.reaction_time_ms > 0)
    .map((t) => t.reaction_time_ms as number)
    .sort((a, b) => a - b)

  const n = valid.length
  if (n === 0) return {}

  const m = avg(valid)
  const top10 = valid.slice(0, Math.ceil(n * 0.1))
  const bottom10 = valid.slice(-Math.ceil(n * 0.1))

  // F7: tous les rt > 0 (filtrés ci-dessus) — pas de garde supplémentaire nécessaire
  const reciprocalMean = 1000 / (valid.reduce((a, b) => a + 1000 / b, 0) / n)

  // F6: médiane correcte pour n pair — moyenne des deux valeurs centrales
  const median = n % 2 === 1
    ? valid[Math.floor(n / 2)]
    : (valid[n / 2 - 1] + valid[n / 2]) / 2

  const correctCount = trials.filter((t) => t.is_correct).length
  const accuracyDecimal = trials.length > 0 ? correctCount / trials.length : 0

  return {
    median_rt: median,
    mean_rt: Math.round(m),
    mean_reciprocal_rt: +reciprocalMean.toFixed(2),
    fastest_10pct_rt: Math.round(avg(top10)),
    slowest_10pct_rt: Math.round(avg(bottom10)),
    lapse_count: trials.filter((t) => t.is_lapse).length,
    false_start_count: trials.filter((t) => t.is_anticipation).length,
    cv: +(m > 0 ? (std(valid) / m) * 100 : 0).toFixed(1),
    // Step 28
    rcs: computeRCS(valid),
    variation: computeVariation(valid),
    speed: computeSpeed(accuracyDecimal, m),
  }
}

// ── Stroop ────────────────────────────────────────────────────────────────────

export function scoreStroop(trials: TrialRecord[]): Record<string, number> {
  if (trials.length === 0) return {}

  const correct = trials.filter((t) => t.is_correct)
  const cong = correct.filter((t) => t.stimulus_type === 'congruent' && t.reaction_time_ms !== null)
  const incong = correct.filter((t) => t.stimulus_type === 'incongruent' && t.reaction_time_ms !== null)

  const congRts = cong.map((t) => t.reaction_time_ms as number)
  const incongRts = incong.map((t) => t.reaction_time_ms as number)

  const meanCong = avg(congRts)
  const meanIncong = avg(incongRts)

  const totalCong = trials.filter((t) => t.stimulus_type === 'congruent').length
  const totalIncong = trials.filter((t) => t.stimulus_type === 'incongruent').length
  const correctCong = trials.filter((t) => t.stimulus_type === 'congruent' && t.is_correct).length
  const correctIncong = trials.filter((t) => t.stimulus_type === 'incongruent' && t.is_correct).length

  const accCong = totalCong > 0 ? +(correctCong / totalCong * 100).toFixed(1) : 0
  const accIncong = totalIncong > 0 ? +(correctIncong / totalIncong * 100).toFixed(1) : 0

  // Inverse efficiency : RT / (accuracy/100) — pénalise les erreurs rapides
  const ieScore = accCong > 0 && accIncong > 0
    ? Math.round(((meanCong / (accCong / 100)) + (meanIncong / (accIncong / 100))) / 2)
    : 0

  const allRts = [...congRts, ...incongRts]
  const globalAccuracy = trials.length > 0 ? correct.length / trials.length : 0

  return {
    mean_rt_congruent: Math.round(meanCong),
    mean_rt_incongruent: Math.round(meanIncong),
    stroop_effect_rt: Math.round(meanIncong - meanCong),
    accuracy_congruent: accCong,
    accuracy_incongruent: accIncong,
    stroop_effect_accuracy: +(accCong - accIncong).toFixed(1),
    inverse_efficiency: ieScore,
    // Step 28
    mean_rt: Math.round(avg(allRts)),
    rcs: computeRCS(allRts),
    variation: computeVariation(allRts),
    speed: computeSpeed(globalAccuracy, avg(allRts)),
  }
}

// ── Simon ─────────────────────────────────────────────────────────────────────

export function scoreSimon(trials: TrialRecord[]): Record<string, number> {
  if (trials.length === 0) return {}

  const correct = trials.filter((t) => t.is_correct)
  const cong = correct.filter((t) => t.stimulus_type === 'congruent' && t.reaction_time_ms !== null)
  const incong = correct.filter((t) => t.stimulus_type === 'incongruent' && t.reaction_time_ms !== null)

  const congRts = cong.map((t) => t.reaction_time_ms as number)
  const incongRts = incong.map((t) => t.reaction_time_ms as number)

  const meanCong = avg(congRts)
  const meanIncong = avg(incongRts)

  const totalCong = trials.filter((t) => t.stimulus_type === 'congruent').length
  const totalIncong = trials.filter((t) => t.stimulus_type === 'incongruent').length
  const correctCong = trials.filter((t) => t.stimulus_type === 'congruent' && t.is_correct).length
  const correctIncong = trials.filter((t) => t.stimulus_type === 'incongruent' && t.is_correct).length

  const accCong = totalCong > 0 ? +(correctCong / totalCong * 100).toFixed(1) : 0
  const accIncong = totalIncong > 0 ? +(correctIncong / totalIncong * 100).toFixed(1) : 0

  const allRts = [...congRts, ...incongRts]
  const globalAccuracy = trials.length > 0 ? correct.length / trials.length : 0

  return {
    mean_rt_congruent: Math.round(meanCong),
    mean_rt_incongruent: Math.round(meanIncong),
    simon_effect_rt: Math.round(meanIncong - meanCong),
    accuracy_congruent: accCong,
    accuracy_incongruent: accIncong,
    simon_effect_accuracy: +(accCong - accIncong).toFixed(1),
    // Step 28
    mean_rt: Math.round(avg(allRts)),
    rcs: computeRCS(allRts),
    variation: computeVariation(allRts),
    speed: computeSpeed(globalAccuracy, avg(allRts)),
  }
}

// ── Digital Span ──────────────────────────────────────────────────────────────

export function scoreDigitalSpan(trials: TrialRecord[]): Record<string, number> {
  if (trials.length === 0) return {}

  // stimulus_data contient { mode: 'forward'|'backward', span: number }
  const forward = trials.filter(
    (t) => (t.stimulus_data as { mode?: string } | null)?.mode === 'forward'
  )
  const backward = trials.filter(
    (t) => (t.stimulus_data as { mode?: string } | null)?.mode === 'backward'
  )

  const maxCorrectSpan = (subset: TrialRecord[]) => {
    const correct = subset.filter((t) => t.is_correct)
    return correct.length > 0
      ? Math.max(...correct.map((t) => (t.stimulus_data as { span?: number } | null)?.span ?? 0))
      : 0
  }

  const spanForward = maxCorrectSpan(forward)
  const spanBackward = maxCorrectSpan(backward)
  const correctCount = trials.filter((t) => t.is_correct).length
  const globalAccuracyDecimal = trials.length > 0 ? correctCount / trials.length : 0

  return {
    span_forward: spanForward,
    span_backward: spanBackward,
    total_span: spanForward + spanBackward,
    longest_sequence: Math.max(spanForward, spanBackward),
    global_accuracy: +(globalAccuracyDecimal * 100).toFixed(1),
    // Note : pas de `speed` pour Digital Span — ce test n'a pas de RT, la formule speed serait invalide.
  }
}

// ── Go/No-Go Visuel ───────────────────────────────────────────────────────────

export function scoreGoNoGo(trials: TrialRecord[]): Record<string, number> {
  if (trials.length === 0) return {}

  // Go trials = stimulus_type 'go', No-Go = 'nogo'
  const goTrials = trials.filter((t) => t.stimulus_type === 'go' && t.reaction_time_ms !== null)
  const goRts = goTrials.map((t) => t.reaction_time_ms as number)

  const totalGo = trials.filter((t) => t.stimulus_type === 'go').length
  const totalNogo = trials.filter((t) => t.stimulus_type === 'nogo').length
  const correctGo = trials.filter((t) => t.stimulus_type === 'go' && t.is_correct).length
  const correctNogo = trials.filter((t) => t.stimulus_type === 'nogo' && t.is_correct).length

  // Commission errors = réponses incorrectes sur No-Go (false alarms)
  const commissionErrors = totalNogo - correctNogo
  const omissionErrors = totalGo - correctGo

  const totalCorrect = correctGo + correctNogo
  const accuracyDecimal = trials.length > 0 ? totalCorrect / trials.length : 0
  const meanRt = avg(goRts)

  // Guard : si aucun Go trial n'a de RT (tous timeouts), on omet les métriques RT
  if (goRts.length === 0) {
    return {
      accuracy: +(accuracyDecimal * 100).toFixed(1),
      commission_errors: commissionErrors,
      omission_errors: omissionErrors,
    }
  }

  return {
    mean_rt: Math.round(meanRt),
    accuracy: +(accuracyDecimal * 100).toFixed(1),
    commission_errors: commissionErrors,
    omission_errors: omissionErrors,
    rcs: computeRCS(goRts),
    variation: computeVariation(goRts),
    speed: computeSpeed(accuracyDecimal, meanRt),
  }
}

// ── Flanker (Eriksen) ─────────────────────────────────────────────────────────

export function scoreFlanker(trials: TrialRecord[]): Record<string, number> {
  if (trials.length === 0) return {}

  const correct = trials.filter((t) => t.is_correct)
  const cong = correct.filter((t) => t.stimulus_type === 'congruent' && t.reaction_time_ms !== null)
  const incong = correct.filter((t) => t.stimulus_type === 'incongruent' && t.reaction_time_ms !== null)

  const congRts = cong.map((t) => t.reaction_time_ms as number)
  const incongRts = incong.map((t) => t.reaction_time_ms as number)

  const meanCong = avg(congRts)
  const meanIncong = avg(incongRts)

  const allRts = [...congRts, ...incongRts]
  const accuracyDecimal = trials.length > 0 ? correct.length / trials.length : 0

  return {
    mean_rt_congruent: Math.round(meanCong),
    mean_rt_incongruent: Math.round(meanIncong),
    flanker_effect_rt: Math.round(meanIncong - meanCong),
    accuracy: +(accuracyDecimal * 100).toFixed(1),
    mean_rt: Math.round(avg(allRts)),
    rcs: computeRCS(allRts),
    variation: computeVariation(allRts),
    speed: computeSpeed(accuracyDecimal, avg(allRts)),
  }
}

// ── Stop Signal ───────────────────────────────────────────────────────────────

export function scoreStopSignal(trials: TrialRecord[]): Record<string, number> {
  if (trials.length === 0) return {}

  const goTrials = trials.filter(
    (t) => t.stimulus_type === 'go' && t.reaction_time_ms !== null
  )
  const stopTrials = trials.filter((t) => t.stimulus_type === 'stop')

  const goRts = goTrials.map((t) => t.reaction_time_ms as number)
  const meanRtGo = avg(goRts)

  const correctGo = goTrials.filter((t) => t.is_correct).length
  const correctStop = stopTrials.filter((t) => t.is_correct).length
  const accuracyDecimal = trials.length > 0
    ? (correctGo + correctStop) / trials.length
    : 0

  // SSRT méthode staircase : mean_rt_go - mean_SSD
  // Le SSD courant est stocké dans stimulus_data.ssd de chaque stop trial
  const ssds = stopTrials
    .map((t) => (t.stimulus_data as { ssd?: number } | null)?.ssd)
    .filter((ssd): ssd is number => ssd !== undefined)

  // Guard : SSRT requiert des Go trials avec RT ET des Stop trials avec SSD
  if (goRts.length === 0 || ssds.length === 0) {
    return {
      accuracy: +(accuracyDecimal * 100).toFixed(1),
    }
  }

  const meanSSD = avg(ssds)
  const ssrt = Math.max(0, Math.round(meanRtGo - meanSSD))

  return {
    mean_rt: Math.round(meanRtGo),
    accuracy: +(accuracyDecimal * 100).toFixed(1),
    ssrt,
    mean_ssd: Math.round(meanSSD),
    rcs: computeRCS(goRts),
    variation: computeVariation(goRts),
  }
}

// ── Mackworth Clock ───────────────────────────────────────────────────────────

export function scoreMackworth(trials: TrialRecord[]): Record<string, number> {
  if (trials.length === 0) return {}

  // Chaque trial = un événement détectable (double-saut)
  // stimulus_type 'target' = saut à détecter, 'standard' = mouvement normal
  const targets = trials.filter((t) => t.stimulus_type === 'target')
  const detectedRts = targets
    .filter((t) => t.is_correct && t.reaction_time_ms !== null)
    .map((t) => t.reaction_time_ms as number)

  const accuracyDecimal = targets.length > 0
    ? targets.filter((t) => t.is_correct).length / targets.length
    : 0

  // Vigilance decrement : comparaison Q1 vs Q4 — une valeur positive = déclin
  const q1Size = Math.ceil(targets.length / 4)
  const q1Targets = targets.slice(0, q1Size)
  const q4Targets = targets.slice(-q1Size)
  const q1Acc = q1Targets.length > 0 ? q1Targets.filter((t) => t.is_correct).length / q1Targets.length : 0
  const q4Acc = q4Targets.length > 0 ? q4Targets.filter((t) => t.is_correct).length / q4Targets.length : 0
  const vigilanceDecrement = parseFloat(((q1Acc - q4Acc) * 100).toFixed(1))

  return {
    mean_rt: detectedRts.length > 0 ? Math.round(avg(detectedRts)) : 0,
    accuracy: +(accuracyDecimal * 100).toFixed(1),
    vigilance_decrement: vigilanceDecrement,
    rcs: computeRCS(detectedRts),
    variation: computeVariation(detectedRts),
  }
}

// ── Spatial Span ──────────────────────────────────────────────────────────────

export function scoreSpatialSpan(trials: TrialRecord[]): Record<string, number> {
  if (trials.length === 0) return {}

  // stimulus_data contient { span: number } (longueur de la séquence)
  const correctTrials = trials.filter((t) => t.is_correct)
  const maxSpan = correctTrials.length > 0
    ? Math.max(...correctTrials.map(
        (t) => (t.stimulus_data as { span?: number } | null)?.span ?? 0
      ))
    : 0

  const accuracyDecimal = trials.length > 0 ? correctTrials.length / trials.length : 0

  return {
    max_span: maxSpan,
    global_accuracy: +(accuracyDecimal * 100).toFixed(1),
    // Note : pas de `speed` pour Spatial Span — ce test n'a pas de RT, la formule speed serait invalide.
  }
}

// ── 2-Back (N-Back) ───────────────────────────────────────────────────────────

export function scoreNBack(trials: TrialRecord[]): Record<string, number> {
  if (trials.length === 0) return {}

  // target trials = stimulus_type 'target', lure/standard = 'non_target'
  const targetTrials = trials.filter((t) => t.stimulus_type === 'target')
  const nonTargetTrials = trials.filter((t) => t.stimulus_type === 'non_target')

  const hits = targetTrials.filter((t) => t.is_correct).length
  const falseAlarms = nonTargetTrials.filter((t) => !t.is_correct).length

  // Précision nette = (hits - false alarms) / total targets, clampé à [0, 100]
  const hitRate = targetTrials.length > 0 ? hits / targetTrials.length : 0
  const faRate = nonTargetTrials.length > 0 ? falseAlarms / nonTargetTrials.length : 0
  const netAccuracy = Math.max(0, hitRate - faRate)

  // Correction log-linéaire 1/(2N) — évite +/-∞ quand hitRate ou faRate vaut 0 ou 1
  const hitRateAdj = (hits + 0.5) / (targetTrials.length + 1)
  const faRateAdj  = (falseAlarms + 0.5) / (nonTargetTrials.length + 1)

  const validRts = trials
    .filter((t) => t.is_correct && t.reaction_time_ms !== null && t.reaction_time_ms > 0)
    .map((t) => t.reaction_time_ms as number)
  const meanRt = avg(validRts)

  return {
    mean_rt: Math.round(meanRt),
    accuracy: +(netAccuracy * 100).toFixed(1),
    hit_rate: +(hitRate * 100).toFixed(1),
    false_alarm_rate: +(faRate * 100).toFixed(1),
    d_prime: parseFloat((approxNorminv(hitRateAdj) - approxNorminv(faRateAdj)).toFixed(2)),
    rcs: computeRCS(validRts),
    variation: computeVariation(validRts),
    speed: computeSpeed(netAccuracy, meanRt),
  }
}

// ── Choix Visuel 4 options ────────────────────────────────────────────────────

export function scoreVisualChoice(trials: TrialRecord[]): Record<string, number> {
  if (trials.length === 0) return {}

  const correct = trials.filter((t) => t.is_correct)
  const validRts = correct
    .filter((t) => t.reaction_time_ms !== null && t.reaction_time_ms > 0)
    .map((t) => t.reaction_time_ms as number)

  const accuracyDecimal = trials.length > 0 ? correct.length / trials.length : 0
  const meanRt = avg(validRts)

  return {
    mean_rt: Math.round(meanRt),
    accuracy: +(accuracyDecimal * 100).toFixed(1),
    rcs: computeRCS(validRts),
    variation: computeVariation(validRts),
    speed: computeSpeed(accuracyDecimal, meanRt),
  }
}

// ── Recherche Visuelle ────────────────────────────────────────────────────────

export function scoreVisualSearch(trials: TrialRecord[]): Record<string, number> {
  if (trials.length === 0) return {}

  const correct = trials.filter((t) => t.is_correct)
  const validRts = correct
    .filter((t) => t.reaction_time_ms !== null && t.reaction_time_ms > 0)
    .map((t) => t.reaction_time_ms as number)

  const accuracyDecimal = trials.length > 0 ? correct.length / trials.length : 0
  const meanRt = avg(validRts)

  return {
    mean_rt: Math.round(meanRt),
    accuracy: +(accuracyDecimal * 100).toFixed(1),
    variation: computeVariation(validRts),
    speed: computeSpeed(accuracyDecimal, meanRt),
  }
}

// ── Benchmarking (step 31) ────────────────────────────────────────────────────

// Évalue une valeur mesurée par rapport aux seuils Elite/Average/Poor d'un benchmark
export function evaluateBenchmark(
  value: number,
  benchmark: CognitiveBenchmark
): 'elite' | 'average' | 'poor' {
  if (benchmark.direction === 'lower_is_better') {
    if (benchmark.elite_max !== null && value <= benchmark.elite_max) return 'elite'
    if (benchmark.average_max !== null && value <= benchmark.average_max) return 'average'
    return 'poor'
  } else {
    if (benchmark.elite_max !== null && value >= benchmark.elite_max) return 'elite'
    if (benchmark.average_min !== null && value >= benchmark.average_min) return 'average'
    return 'poor'
  }
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

export function scoreSession(slug: string, trials: TrialRecord[]): Record<string, number> {
  switch (slug) {
    case 'pvt':             return scorePVT(trials)
    case 'stroop':          return scoreStroop(trials)
    case 'simon':           return scoreSimon(trials)
    case 'digital_span':    return scoreDigitalSpan(trials)
    case 'go-nogo-visual':  return scoreGoNoGo(trials)
    case 'flanker':         return scoreFlanker(trials)
    case 'stop-signal':     return scoreStopSignal(trials)
    case 'mackworth-clock': return scoreMackworth(trials)
    case 'spatial-span':    return scoreSpatialSpan(trials)
    case 'n-back-2':        return scoreNBack(trials)
    case 'visual-choice-4': return scoreVisualChoice(trials)
    case 'visual-search':   return scoreVisualSearch(trials)
    default:
      throw new Error(`Scoring non défini pour le slug cognitif : "${slug}"`)
  }
}
