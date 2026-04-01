import type { ClientWithLastTest } from '@/types'

export const STATUS_PENDING_TEST = 'En attente de test' as const

// Dérive le statut d'affichage d'un client (non stocké en base)
export function getDisplayStatus(client: ClientWithLastTest): string {
  if (client.statut === 'archive') return 'Archivé'
  if (client.statut === 'en_pause') return 'En pause'
  if (client.pendingTestsCount > 0 && client.lastTestScore === null) return STATUS_PENDING_TEST
  if (client.lastTestScore === null) return 'Nouveau'
  return 'Actif'
}
