/**
 * Interpolation linéaire d'un paramètre selon le pourcentage d'intensité.
 * range[0] = valeur à 10% d'intensité, range[1] = valeur à 100% d'intensité
 *
 * Exemples :
 *   interpolate(60, [0.7, 0.3]) → 0.47 (ratio congruent Stroop à 60%)
 *   interpolate(60, [2500, 1000]) → 1667 (ISI ms à 60%)
 */
export function interpolate(
  intensityPercent: number,
  range: [number, number]
): number {
  const t = Math.max(0, Math.min(1, (intensityPercent - 10) / 90)) // clamped 0.0 to 1.0
  return Math.round(range[0] + t * (range[1] - range[0]))
}

/**
 * Calcule le nombre de trials selon la durée et l'ISI.
 * avgTrialDuration = ISI + 500ms (stimulus moyen + feedback)
 */
export function computeTrialCount(durationSec: number, isiMs: number): number {
  const totalMs = durationSec * 1000
  const avgTrialDuration = isiMs + 500
  return Math.floor(totalMs / avgTrialDuration)
}
