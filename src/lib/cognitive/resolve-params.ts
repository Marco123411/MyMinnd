import type { CognitiveTestDefinition, ProgramExercise, ResolvedTestParams } from '@/types'

/**
 * Résout les paramètres d'un test cognitif depuis deux sources :
 * - Source A (autonome) : valeurs par défaut du test_definition
 * - Source B (depuis programme) : override de program_exercise
 */
export function resolveTestParams(
  testDef: CognitiveTestDefinition,
  programExercise?: ProgramExercise | null
): ResolvedTestParams {
  const rawDuration =
    programExercise?.configured_duration_sec ??
    testDef.default_duration_sec ??
    300
  const rawIntensity =
    programExercise?.configured_intensity_percent ??
    testDef.default_intensity_percent ??
    100
  return {
    durationSec: Math.max(10, rawDuration),
    intensityPercent: Math.max(10, Math.min(100, rawIntensity)),
    phaseContext: programExercise?.phase ?? null,
    programExerciseId: programExercise?.id ?? null,
  }
}
