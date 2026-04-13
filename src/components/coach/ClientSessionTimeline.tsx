'use client'

import type React from 'react'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  CalendarDays,
  UserCheck,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  ChevronRight,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { deleteSessionAction } from '@/app/actions/sessions'
import type { ProgrammeTimelineItem } from '@/app/actions/sessions'

interface ClientSessionTimelineProps {
  items: ProgrammeTimelineItem[]
  clientCrmId: string
}

function StatutBadge({ type, statut }: { type: ProgrammeTimelineItem['type']; statut: string }) {
  if (type === 'cabinet') {
    if (statut === 'planifiee') return <Badge variant="outline" className="text-blue-600 border-blue-300">Planifiée</Badge>
    if (statut === 'realisee')  return <Badge className="bg-green-100 text-green-700">Réalisée</Badge>
    if (statut === 'annulee')   return <Badge variant="outline" className="text-gray-400">Annulée</Badge>
  }
  if (type === 'autonomie') {
    if (statut === 'a_faire')   return <Badge variant="outline" className="text-blue-600 border-blue-300">À faire</Badge>
    if (statut === 'en_cours')  return <Badge variant="outline" className="text-amber-600 border-amber-300">En cours</Badge>
    if (statut === 'terminee')  return <Badge className="bg-green-100 text-green-700">Terminée</Badge>
    if (statut === 'en_retard') return <Badge variant="outline" className="text-orange-600 border-orange-300"><AlertTriangle className="h-3 w-3 mr-1" />En retard</Badge>
    if (statut === 'manquee')   return <Badge variant="outline" className="text-red-500 border-red-300"><XCircle className="h-3 w-3 mr-1" />Manquée</Badge>
  }
  if (type === 'recurrente') {
    if (statut === 'completee') return <Badge className="bg-green-100 text-green-700">Exécutée</Badge>
    return <Badge variant="outline" className="text-[#7069F4]-600 border-teal-300">Active</Badge>
  }
  return null
}

function TypeIcon({ type }: { type: ProgrammeTimelineItem['type'] }) {
  if (type === 'cabinet')    return <UserCheck className="h-4 w-4 text-[#7069F4]" />
  if (type === 'autonomie')  return <Clock className="h-4 w-4 text-[#3C3CD6]" />
  if (type === 'recurrente') return <RefreshCw className="h-4 w-4 text-[#FF9F40]" />
  return <CalendarDays className="h-4 w-4 text-muted-foreground" />
}

function getTypeLabel(type: ProgrammeTimelineItem['type']): string {
  if (type === 'cabinet')    return 'Séance cabinet'
  if (type === 'autonomie')  return 'Séance autonome'
  if (type === 'recurrente') return 'Routine'
  return ''
}

export function ClientSessionTimeline({ items: initialItems, clientCrmId }: ClientSessionTimelineProps) {
  const [items, setItems] = useState(initialItems)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleDelete(e: React.MouseEvent, item: ProgrammeTimelineItem) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Supprimer "${item.titre}" ?`)) return
    setDeletingId(item.id)
    startTransition(async () => {
      const { error } = await deleteSessionAction(item.id, item.type, clientCrmId)
      if (!error) {
        setItems((prev) => prev.filter((s) => s.id !== item.id))
      }
      setDeletingId(null)
    })
  }

  if (items.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Aucune séance planifiée pour ce client.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const isClickable = item.type === 'autonomie' && item.statut === 'terminee'
        const isDeleting = deletingId === item.id
        const Wrapper = isClickable
          ? ({ children }: { children: React.ReactNode }) => (
              <Link href={`/coach/clients/${clientCrmId}/sessions/${item.id}`}>
                {children}
              </Link>
            )
          : ({ children }: { children: React.ReactNode }) => <>{children}</>
        return (
        <Wrapper key={`${item.type}-${item.id}`}>
        <Card
          key={`${item.type}-${item.id}`}
          className={cn(
            'border border-border',
            isClickable && 'hover:border-[#7069F4]/50 hover:bg-[#F1F0FE]/30 transition-colors cursor-pointer',
            isDeleting && 'opacity-50',
          )}
        >
          <CardContent className="pt-4 pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <TypeIcon type={item.type} />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground mb-0.5">
                    {getTypeLabel(item.type)}
                  </p>
                  <p className="font-medium text-sm text-[#141325] truncate">{item.titre}</p>
                  {item.objectif && item.objectif !== item.titre && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{item.objectif}</p>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <div className="flex items-center gap-2">
                  <StatutBadge type={item.type} statut={item.statut} />
                  {isClickable && <ChevronRight className="h-3.5 w-3.5 text-[#7069F4]" />}
                  <button
                    onClick={(e) => handleDelete(e, item)}
                    disabled={isPending}
                    className="p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors"
                    aria-label="Supprimer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(item.date).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>

            {item.exercices_total > 0 && (
              <div className="mt-3">
                {(() => {
                  const pct = Math.min(
                    Math.round((item.exercices_completes / item.exercices_total) * 100),
                    100,
                  )
                  return (
                    <>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          {item.exercices_completes}/{item.exercices_total} exercice{item.exercices_total > 1 ? 's' : ''}
                        </span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            pct === 100 ? 'bg-green-500' : 'bg-[#7069F4]',
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </>
                  )
                })()}
              </div>
            )}
          </CardContent>
        </Card>
        </Wrapper>
        )
      })}
    </div>
  )
}
