import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ScoreDisplay } from '@/components/ui/score-display'
import type { ClientWithLastTest, ClientContext } from '@/types'

const CONTEXT_COLORS: Record<ClientContext, string> = {
  sport: 'bg-[#E8F4F5] text-[#20808D]',
  corporate: 'bg-purple-100 text-[#944454]',
  wellbeing: 'bg-amber-100 text-[#FFC553]',
  coaching: 'bg-orange-100 text-[#A84B2F]',
}

interface ClientCardProps {
  client: ClientWithLastTest
}

export function ClientCard({ client }: ClientCardProps) {
  const contextColor = CONTEXT_COLORS[client.context] ?? 'bg-gray-100 text-gray-600'
  const subtitle = client.context === 'sport'
    ? client.sport
    : client.context === 'corporate'
      ? client.entreprise
      : null

  return (
    <Link href={`/coach/clients/${client.id}`} className="block">
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="flex items-center justify-between gap-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#E8F4F5] text-sm font-semibold text-[#20808D]">
              {client.nom.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-medium text-[#1A1A2E]">{client.nom}</p>
              {subtitle && (
                <p className="text-xs text-muted-foreground">{subtitle}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge className={`text-xs ${contextColor}`}>{client.context}</Badge>
            {client.statut !== 'actif' && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                {client.statut}
              </Badge>
            )}
            {client.lastTestScore !== null && (
              <ScoreDisplay score={client.lastTestScore} size="sm" />
            )}
            {client.profileName && (
              <Badge
                style={{ backgroundColor: client.profileColor ?? '#20808D', color: '#fff' }}
                className="text-xs"
              >
                {client.profileName}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
