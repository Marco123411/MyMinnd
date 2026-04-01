import type { FigureScores } from '@/types'

// Définition partagée des facteurs de la Figure de Performance
// Source unique pour FigurePerformance et FigureEvolutionDashboard
export const FIGURE_FACTORS: {
  key: keyof FigureScores
  label: string
  color: string
  angle: number  // degrés, 0 = haut, sens horaire
}[] = [
  { key: 'psycho',    label: 'Psychologique', color: '#3C3CD6', angle: 270 },
  { key: 'physique',  label: 'Physique',       color: '#72C7D7', angle: 330 },
  { key: 'technique', label: 'Technique',      color: '#E8A735', angle: 30  },
  { key: 'tactique',  label: 'Tactique',       color: '#EC638B', angle: 90  },
  { key: 'social',    label: 'Social',         color: '#8B7CF6', angle: 150 },
  { key: 'materiel',  label: 'Matériel',       color: '#5AAE72', angle: 210 },
]
