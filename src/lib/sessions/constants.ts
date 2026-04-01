import type { TriggerType } from '@/types'

export const TRIGGER_LABELS: Record<TriggerType, string> = {
  pre_entrainement: 'Pré-entraînement',
  pre_competition: 'Pré-compétition',
  quotidien: 'Quotidien',
  post_entrainement: 'Post-entraînement',
  libre: 'Libre',
}
