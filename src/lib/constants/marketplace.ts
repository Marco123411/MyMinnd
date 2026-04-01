import type { ClientContext, ExpertPublicCible } from '@/types'

export const MARKETPLACE_CONTEXTES: { value: ClientContext; label: string }[] = [
  { value: 'sport', label: 'Sport' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'wellbeing', label: 'Bien-être' },
  { value: 'coaching', label: 'Coaching' },
]

export const MARKETPLACE_PUBLIC_CIBLE: { value: ExpertPublicCible; label: string }[] = [
  { value: 'amateur', label: 'Amateur' },
  { value: 'semi-pro', label: 'Semi-pro' },
  { value: 'professionnel', label: 'Professionnel' },
  { value: 'elite', label: 'Élite' },
  { value: 'jeunes', label: 'Jeunes' },
]

export const MARKETPLACE_SPECIALITES = [
  'Gestion du stress',
  'Confiance en soi',
  'Imagerie mentale',
  'Concentration',
  'Récupération',
  'Leadership',
  "Cohésion d'équipe",
  'Gestion des émotions',
]
