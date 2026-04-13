import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { SessionStatusBadge } from '@/components/sessions/SessionStatusBadge'
import type { SessionHistoryItem } from '@/types'

const TYPE_LABELS: Record<SessionHistoryItem['type'], string> = {
  cabinet: 'Cabinet',
  autonomie: 'Autonomie',
  recurrente: 'Récurrente',
}

const TYPE_COLORS: Record<SessionHistoryItem['type'], string> = {
  cabinet: 'bg-[#7069F4] text-white',
  autonomie: 'bg-[#3C3CD6] text-white',
  recurrente: 'bg-[#FF9F40] text-[#141325]',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

interface SessionTimelineProps {
  items: SessionHistoryItem[]
}

export function SessionTimeline({ items }: SessionTimelineProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-sm">Aucune séance enregistrée pour ce client.</p>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Ligne verticale */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-[#F1F0FE]" />

      <div className="space-y-4">
        {items.map((item, index) => {
          const key = item.cabinet?.id ?? item.autonomous?.id ?? item.execution?.id ?? index

          let title = ''
          let objectif = ''
          let statut: string | null = null
          let href: string | null = null
          let exerciceCount = 0

          if (item.type === 'cabinet' && item.cabinet) {
            title = formatDate(item.cabinet.date_seance)
            objectif = item.cabinet.objectif
            statut = item.cabinet.statut
            href = `/coach/sessions/${item.cabinet.id}`
            exerciceCount = item.cabinet.exercices_utilises?.length ?? 0
          } else if (item.type === 'autonomie' && item.autonomous) {
            title = item.autonomous.titre
            objectif = item.autonomous.objectif
            statut = item.autonomous.statut
            exerciceCount = item.autonomous.exercices?.length ?? 0
          } else if (item.type === 'recurrente' && item.execution) {
            title = item.execution.template.titre
            objectif = item.execution.template.description ?? ''
            statut = item.execution.completed ? 'terminee' : 'en_cours'
            exerciceCount = item.execution.template.exercices?.length ?? 0
          }

          return (
            <div key={key} className="relative flex gap-4 pl-10">
              {/* Point sur la timeline */}
              <div className="absolute left-3 top-3 w-2.5 h-2.5 rounded-full bg-[#7069F4] ring-2 ring-white" />

              <div className="flex-1 bg-white border border-gray-100 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={`text-xs font-medium ${TYPE_COLORS[item.type]}`}>
                      {TYPE_LABELS[item.type]}
                    </Badge>
                    <span className="text-sm text-gray-500">{formatDate(item.date)}</span>
                  </div>
                  {statut && (
                    <SessionStatusBadge statut={statut as Parameters<typeof SessionStatusBadge>[0]['statut']} />
                  )}
                </div>

                <div className="mt-2">
                  {href ? (
                    <Link href={href} className="font-medium text-[#141325] hover:text-[#7069F4] transition-colors">
                      {title}
                    </Link>
                  ) : (
                    <p className="font-medium text-[#141325]">{title}</p>
                  )}
                  {objectif && (
                    <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{objectif}</p>
                  )}
                </div>

                {exerciceCount > 0 && (
                  <p className="text-xs text-gray-400 mt-2">
                    {exerciceCount} exercice{exerciceCount > 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
