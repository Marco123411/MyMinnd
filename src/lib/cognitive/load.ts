// Cognitive Load Score (CLS) — pure math, zero dependencies
// Formule : CLS = base × durationFactor × intensityFactor, clampé 1-26

export interface CognitiveLoadInput {
  baseCognitiveLoad: number     // 1–10, depuis cognitive_test_definitions
  durationSec: number           // durée configurée (ou default_duration_sec)
  intensityPercent: number      // 10–100 si configurable, 100 si non-configurable
  intensityConfigurable: boolean
}

/**
 * Calcule le Cognitive Load Score (CLS) pour un drill cognitif.
 * Valeurs de référence :
 *   PVT 5min (non-configurable, base=4)  → 6 (LOW)
 *   Stroop 3min 60% (base=6)             → 8 (MODERATE)
 *   2-Back 30min 100% (base=8)           → 21 (HIGH)
 */
export function computeCognitiveLoad(input: CognitiveLoadInput): number {
  const { baseCognitiveLoad, durationSec, intensityPercent, intensityConfigurable } = input

  // Facteur durée : 1.0 (1 min) → 2.0 (30 min), échelle log
  // Math.max(durationMinutes, 1) → les tests < 1 min sont traités comme 1 min
  const durationMinutes = durationSec / 60
  const durationFactor = 1 + Math.log10(Math.max(durationMinutes, 1)) / Math.log10(30)

  // Facteur intensité :
  //  - Non-configurable → 1.0 (régime standard, pas d'ajustement)
  //  - Configurable     → 0.5 (10%) … 1.3 (100%), linéaire
  const intensityFactor = intensityConfigurable
    ? 0.5 + (intensityPercent / 100) * 0.8
    : 1.0

  const rawScore = baseCognitiveLoad * durationFactor * intensityFactor
  return Math.round(Math.min(26, Math.max(1, rawScore)))
}

// Seuils de zone — exportés pour partage avec les composants UI
export const CLS_LOW_MAX  = 7
export const CLS_MOD_MAX  = 17
export const CLS_MIN      = 1
export const CLS_MAX      = 26

export function getCognitiveLoadZone(score: number): 'low' | 'moderate' | 'high' {
  if (score <= CLS_LOW_MAX) return 'low'
  if (score <= CLS_MOD_MAX) return 'moderate'
  return 'high'
}

export function getCognitiveLoadColor(zone: 'low' | 'moderate' | 'high'): string {
  switch (zone) {
    case 'low':      return '#20808D' // teal
    case 'moderate': return '#FFC553' // gold
    case 'high':     return '#944454' // mauve
  }
}

// --- Charge cumulée de session ---

export interface ExerciseWithLoad {
  cognitive_load_score: number | null
}

export interface SessionLoadSummaryData {
  total: number
  average: number
  zone: 'low' | 'moderate' | 'high'
  breakdown: { low: number; moderate: number; high: number }
}

export function computeSessionLoad(exercises: ExerciseWithLoad[]): SessionLoadSummaryData {
  const scored = exercises.filter(
    (ex): ex is { cognitive_load_score: number } => ex.cognitive_load_score !== null
  )

  if (scored.length === 0) {
    return { total: 0, average: 0, zone: 'low', breakdown: { low: 0, moderate: 0, high: 0 } }
  }

  const total = scored.reduce((sum, ex) => sum + ex.cognitive_load_score, 0)
  const average = total / scored.length
  const zone = getCognitiveLoadZone(Math.round(average))

  const breakdown = scored.reduce(
    (acc, ex) => {
      acc[getCognitiveLoadZone(ex.cognitive_load_score)]++
      return acc
    },
    { low: 0, moderate: 0, high: 0 }
  )

  return { total, average: Math.round(average * 10) / 10, zone, breakdown }
}
