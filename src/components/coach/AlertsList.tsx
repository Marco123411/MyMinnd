import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export interface CoachAlert {
  id: string
  type: 'no_retest' | 'pending_test'
  clientNom: string
  clientId: string
  message: string
}

interface AlertsListProps {
  alerts: CoachAlert[]
}

export function AlertsList({ alerts }: AlertsListProps) {
  if (alerts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Aucune alerte pour le moment.</p>
    )
  }

  return (
    <ul className="space-y-2">
      {alerts.map((alert) => (
        <li key={alert.id} className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#FF9F40]" />
          <div className="flex-1 text-sm">
            <span className="font-medium">{alert.clientNom}</span>
            {' — '}
            {alert.message}
          </div>
          <Badge variant="outline" className="shrink-0 text-xs">
            {alert.type === 'no_retest' ? 'Sans re-test' : 'En attente'}
          </Badge>
          <Link
            href={`/coach/clients/${alert.clientId}`}
            className="shrink-0 text-xs text-[#7069F4] hover:underline"
          >
            Voir
          </Link>
        </li>
      ))}
    </ul>
  )
}
