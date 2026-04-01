'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ScoreDisplay } from '@/components/ui/score-display'
import { getDisplayStatus, STATUS_PENDING_TEST } from '@/lib/clientStatus'
import { CONTEXT_COLORS, getClientSubtitle } from '@/lib/clientDisplay'
import type { ClientWithLastTest } from '@/types'

interface ClientCardProps {
  client: ClientWithLastTest
  onClick?: () => void
}

export function ClientCard({ client, onClick }: ClientCardProps) {
  const contextColor = CONTEXT_COLORS[client.context] ?? 'bg-gray-100 text-gray-600'
  const subtitle = getClientSubtitle(client)
  const displayStatus = getDisplayStatus(client)
  const isPending = displayStatus === STATUS_PENDING_TEST

  return (
    <div
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={onClick ? 'cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[#20808D] rounded-lg' : undefined}
    >
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="flex items-center justify-between gap-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E8F4F5] text-sm font-semibold text-[#20808D]">
              {client.nom.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-medium text-[#1A1A2E]">{client.nom}</p>
              {isPending ? (
                <p className="text-xs text-amber-600">Invitation envoyée</p>
              ) : subtitle ? (
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge className={`text-xs ${contextColor}`}>{client.context}</Badge>
            {isPending ? (
              <Badge className="text-xs bg-amber-100 text-amber-700 border border-amber-200">
                En attente de test
              </Badge>
            ) : client.statut !== 'actif' ? (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                {displayStatus}
              </Badge>
            ) : null}
            {!isPending && client.lastTestScore !== null && (
              <ScoreDisplay score={client.lastTestScore} size="sm" />
            )}
            {!isPending && client.profileName && (
              <Badge
                style={{ backgroundColor: client.profileColor ?? '#20808D', color: '#fff' }}
                className="text-xs"
              >
                {client.profileName}
              </Badge>
            )}
            {isPending && (
              <span className="text-muted-foreground text-sm">—</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
