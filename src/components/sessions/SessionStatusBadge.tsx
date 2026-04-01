import { Badge } from '@/components/ui/badge'
import type { CabinetSessionStatut, AutonomousSessionStatut } from '@/types'

type AnyStatut = CabinetSessionStatut | AutonomousSessionStatut

const STATUT_LABELS: Record<AnyStatut, string> = {
  planifiee: 'Planifiée',
  realisee: 'Réalisée',
  annulee: 'Annulée',
  a_faire: 'À faire',
  en_cours: 'En cours',
  terminee: 'Terminée',
  en_retard: 'En retard',
  manquee: 'Manquée',
}

const STATUT_CLASSES: Record<AnyStatut, string> = {
  planifiee: 'bg-blue-100 text-blue-800 border-blue-200',
  realisee: 'bg-green-100 text-green-800 border-green-200',
  annulee: 'bg-gray-100 text-gray-600 border-gray-200',
  a_faire: 'bg-blue-100 text-blue-800 border-blue-200',
  en_cours: 'bg-orange-100 text-orange-800 border-orange-200',
  terminee: 'bg-green-100 text-green-800 border-green-200',
  en_retard: 'bg-red-100 text-red-800 border-red-200',
  manquee: 'bg-gray-100 text-gray-500 border-gray-200',
}

interface SessionStatusBadgeProps {
  statut: AnyStatut
}

export function SessionStatusBadge({ statut }: SessionStatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={`text-xs font-medium ${STATUT_CLASSES[statut]}`}
    >
      {STATUT_LABELS[statut]}
    </Badge>
  )
}
