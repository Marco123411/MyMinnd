'use client'

import { useEffect, useId, useState } from 'react'
import Link from 'next/link'
import { X, Send, Calendar, FileDown, User, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RadarChart, type RadarDataPoint } from '@/components/ui/radar-chart'
import { ScoreDisplay } from '@/components/ui/score-display'
import { getClientRadarData } from '@/app/actions/clients'
import { getDisplayStatus, STATUS_PENDING_TEST } from '@/lib/clientStatus'
import { CONTEXT_COLORS, getClientSubtitle } from '@/lib/clientDisplay'
import type { ClientWithLastTest } from '@/types'

interface ClientSlideOverProps {
  client: ClientWithLastTest | null
  isOpen: boolean
  onClose: () => void
}

export function ClientSlideOver({ client, isOpen, onClose }: ClientSlideOverProps) {
  const titleId = useId()
  const [radarData, setRadarData] = useState<RadarDataPoint[] | null>(null)
  const [loadingRadar, setLoadingRadar] = useState(false)

  // Charge les données radar — cancellation pattern pour éviter les races
  useEffect(() => {
    if (!isOpen || !client || client.lastTestScore === null) {
      setRadarData(null)
      return
    }
    let cancelled = false
    setLoadingRadar(true)
    getClientRadarData(client.id)
      .then(({ data }) => {
        if (!cancelled) {
          setRadarData(data)
          setLoadingRadar(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoadingRadar(false)
      })
    return () => { cancelled = true }
  }, [isOpen, client?.id, client?.lastTestScore])

  // Fermeture par touche Escape
  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const displayStatus = client ? getDisplayStatus(client) : ''
  const isPending = displayStatus === STATUS_PENDING_TEST
  const subtitle = client ? getClientSubtitle(client) : null

  return (
    <>
      {/* Overlay semi-transparent */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-[250ms] ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panneau slide-over */}
      <div
        className={`fixed inset-y-0 right-0 z-50 flex w-[440px] max-w-full flex-col bg-white shadow-xl transform transition-transform duration-[250ms] ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-modal="true"
        role="dialog"
        aria-labelledby={titleId}
      >
        {client && (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 border-b px-5 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E8F4F5] text-sm font-semibold text-[#20808D]">
                {client.nom.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p id={titleId} className="truncate font-semibold text-[#1A1A2E]">{client.nom}</p>
                <div className="mt-0.5 flex items-center gap-2">
                  {subtitle && (
                    <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
                  )}
                  <Badge className={`text-xs ${CONTEXT_COLORS[client.context]}`}>
                    {client.context}
                  </Badge>
                  {isPending && (
                    <Badge className="text-xs bg-amber-100 text-amber-700 border border-amber-200">
                      En attente
                    </Badge>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-md p-1 text-muted-foreground hover:bg-gray-100 hover:text-foreground"
                aria-label="Fermer le panneau"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Contenu scrollable */}
            <div className="flex-1 overflow-y-auto space-y-5 px-5 py-4">
              {/* Score global */}
              <div className="rounded-lg bg-[#E8F4F5] p-4 text-center">
                {isPending ? (
                  <div className="flex flex-col items-center gap-1 py-2 text-sm text-muted-foreground">
                    <Clock className="h-5 w-5 text-amber-500" />
                    Aucun test complété
                  </div>
                ) : client.lastTestScore !== null ? (
                  <>
                    <ScoreDisplay score={client.lastTestScore} size="md" />
                    {client.profileName && (
                      <Badge
                        className="mt-2 text-xs"
                        style={{ backgroundColor: client.profileColor ?? '#20808D', color: '#fff' }}
                      >
                        {client.profileName}
                      </Badge>
                    )}
                  </>
                ) : (
                  <p className="py-2 text-sm text-muted-foreground">Aucun test complété</p>
                )}
              </div>

              {/* Mini radar (200×200) */}
              {!isPending && client.lastTestScore !== null && (
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Profil par domaines</p>
                  {loadingRadar ? (
                    <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
                      Chargement...
                    </div>
                  ) : radarData ? (
                    <RadarChart data={radarData} height={200} />
                  ) : null}
                </div>
              )}

              {/* Dernier test */}
              {!isPending && client.lastTestDate && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Dernier test</p>
                  <p className="text-sm text-[#1A1A2E]">
                    {new Date(client.lastTestDate).toLocaleDateString('fr-FR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                    {client.lastTestScore !== null && (
                      <span className="ml-2 text-muted-foreground">
                        · {client.lastTestScore.toFixed(1)}/10
                        {client.profileName && ` · ${client.profileName}`}
                      </span>
                    )}
                  </p>
                </div>
              )}

              {/* Notes privées (lecture seule) */}
              {client.notes_privees && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Notes privées</p>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-[#1A1A2E]">
                    {client.notes_privees}
                  </p>
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div className="border-t px-5 py-4 space-y-2">
              {isPending ? (
                <Button asChild className="w-full bg-[#20808D] text-white hover:bg-[#20808D]/90">
                  <Link href={`/coach/clients/${client.id}`}>
                    <User className="mr-2 h-4 w-4" />
                    Voir la fiche complète
                  </Link>
                </Button>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/coach/clients/${client.id}`}>
                        <Send className="mr-2 h-4 w-4" />
                        Envoyer un test
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" disabled>
                      <Calendar className="mr-2 h-4 w-4" />
                      Créer séance
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/coach/clients/${client.id}`}>
                        <FileDown className="mr-2 h-4 w-4" />
                        Rapport PDF
                      </Link>
                    </Button>
                    <Button asChild className="bg-[#20808D] text-white hover:bg-[#20808D]/90" size="sm">
                      <Link href={`/coach/clients/${client.id}`}>
                        <User className="mr-2 h-4 w-4" />
                        Fiche complète
                      </Link>
                    </Button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
