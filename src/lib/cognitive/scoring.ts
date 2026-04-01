// Bibliothèque de scoring cognitif — calcule les métriques pour chaque type de test
// Champs : nommage exact selon spec étape 19

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

  return {
    median_rt: median,
    mean_rt: Math.round(m),
    mean_reciprocal_rt: +reciprocalMean.toFixed(2),
    fastest_10pct_rt: Math.round(avg(top10)),
    slowest_10pct_rt: Math.round(avg(bottom10)),
    lapse_count: trials.filter((t) => t.is_lapse).length,
    false_start_count: trials.filter((t) => t.is_anticipation).length,
    cv: +(m > 0 ? (std(valid) / m) * 100 : 0).toFixed(1),
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

  return {
    mean_rt_congruent: Math.round(meanCong),
    mean_rt_incongruent: Math.round(meanIncong),
    stroop_effect_rt: Math.round(meanIncong - meanCong),
    accuracy_congruent: accCong,
    accuracy_incongruent: accIncong,
    stroop_effect_accuracy: +(accCong - accIncong).toFixed(1),
    inverse_efficiency: ieScore,
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

  return {
    mean_rt_congruent: Math.round(meanCong),
    mean_rt_incongruent: Math.round(meanIncong),
    simon_effect_rt: Math.round(meanIncong - meanCong),
    accuracy_congruent: accCong,
    accuracy_incongruent: accIncong,
    simon_effect_accuracy: +(accCong - accIncong).toFixed(1),
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

  return {
    span_forward: spanForward,
    span_backward: spanBackward,
    total_span: spanForward + spanBackward,
    longest_sequence: Math.max(spanForward, spanBackward),
    global_accuracy: trials.length > 0
      ? +(trials.filter((t) => t.is_correct).length / trials.length * 100).toFixed(1)
      : 0,
  }
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

export function scoreSession(slug: string, trials: TrialRecord[]): Record<string, number> {
  try {
    switch (slug) {
      case 'pvt': return scorePVT(trials)
      case 'stroop': return scoreStroop(trials)
      case 'simon': return scoreSimon(trials)
      case 'digital_span': return scoreDigitalSpan(trials)
      default: return {}
    }
  } catch {
    return {}
  }
}
