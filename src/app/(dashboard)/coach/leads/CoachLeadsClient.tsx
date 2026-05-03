'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, Clock, AlertCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  acceptContactRequestAction,
  declineContactRequestAction,
} from '@/app/actions/contact-requests'

export interface CoachLead {
  id: string
  athleteName: string
  athletePhoto: string | null
  profileName: string | null
  profileColor: string | null
  globalScore: number | null
  testId: string | null
  sport: string | null
  level: string | null
  objective: string | null
  message: string | null
  coachResponseMessage: string | null
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  createdAt: string
  respondedAt: string | null
  expiresAt: string
}

interface CoachLeadsClientProps {
  leads: CoachLead[]
}

const STATUS_TABS = [
  { value: 'pending', label: 'En attente' },
  { value: 'accepted', label: 'Acceptées' },
  { value: 'declined', label: 'Refusées' },
  { value: 'expired', label: 'Expirées' },
] as const

type StatusTab = (typeof STATUS_TABS)[number]['value']

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function CoachLeadsClient({ leads }: CoachLeadsClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<StatusTab>('pending')
  const [declineTarget, setDeclineTarget] = useState<CoachLead | null>(null)
  const [declineMessage, setDeclineMessage] = useState('')
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const filtered = leads.filter((l) => l.status === activeTab)

  async function handleAccept(lead: CoachLead) {
    setProcessingId(lead.id)
    setError(null)
    const result = await acceptContactRequestAction(lead.id)
    if (result.error) {
      setError(result.error)
      setProcessingId(null)
      return
    }
    router.refresh()
    setProcessingId(null)
  }

  async function confirmDecline() {
    if (!declineTarget) return
    setProcessingId(declineTarget.id)
    setError(null)
    const result = await declineContactRequestAction(declineTarget.id, {
      coach_response_message: declineMessage.trim() || undefined,
    })
    if (result.error) {
      setError(result.error)
      setProcessingId(null)
      return
    }
    setDeclineTarget(null)
    setDeclineMessage('')
    router.refresh()
    setProcessingId(null)
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as StatusTab)}>
        <TabsList>
          {STATUS_TABS.map((t) => {
            const count = leads.filter((l) => l.status === t.value).length
            return (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
                {count > 0 && (
                  <span className="ml-2 text-xs text-muted-foreground">({count})</span>
                )}
              </TabsTrigger>
            )
          })}
        </TabsList>
      </Tabs>

      {error && (
        <Card className="p-3 bg-destructive/10 border-destructive/30 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </Card>
      )}

      {filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">
          Aucune demande dans cette catégorie.
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((lead) => (
            <Card key={lead.id} className="p-5">
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="shrink-0">
                  {lead.athletePhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={lead.athletePhoto}
                      alt={lead.athleteName}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-[#E8F4F5] flex items-center justify-center">
                      <span className="text-base font-bold text-[#20808D]">
                        {lead.athleteName
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Contenu */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3 mb-1">
                    <div>
                      <h3 className="font-semibold text-[#1A1A2E]">{lead.athleteName}</h3>
                      <p className="text-xs text-muted-foreground">
                        Demande du {formatDate(lead.createdAt)}
                      </p>
                    </div>
                    {lead.profileName && (
                      <Badge
                        className="shrink-0"
                        style={{
                          backgroundColor: lead.profileColor ?? '#20808D',
                          color: '#FFFFFF',
                        }}
                      >
                        {lead.profileName}
                      </Badge>
                    )}
                  </div>

                  {/* Meta infos */}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground mb-3">
                    {lead.globalScore !== null && (
                      <span>
                        Score : <strong>{lead.globalScore.toFixed(1)}/10</strong>
                      </span>
                    )}
                    {lead.sport && <span>Sport : {lead.sport}</span>}
                    {lead.level && <span>Niveau : {lead.level}</span>}
                  </div>

                  {lead.objective && (
                    <div className="rounded-md bg-[#F4F4F5] p-3 mb-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                        Objectif
                      </p>
                      <p className="text-sm text-[#1A1A2E]">« {lead.objective} »</p>
                    </div>
                  )}

                  {lead.message && (
                    <div className="rounded-md bg-[#F4F4F5] p-3 mb-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                        Message
                      </p>
                      <p className="text-sm text-[#1A1A2E]">{lead.message}</p>
                    </div>
                  )}

                  {/* Statut / actions */}
                  {lead.status === 'pending' && (
                    <div className="flex flex-wrap gap-2 items-center pt-1">
                      <Button
                        size="sm"
                        className="bg-[#20808D] hover:bg-[#1a6b76] gap-1.5"
                        onClick={() => handleAccept(lead)}
                        disabled={processingId === lead.id}
                      >
                        <Check className="h-4 w-4" />
                        Accepter
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => setDeclineTarget(lead)}
                        disabled={processingId === lead.id}
                      >
                        <X className="h-4 w-4" />
                        Décliner
                      </Button>
                      {lead.testId && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            router.push(`/coach/tests/${lead.testId}/results`)
                          }
                        >
                          Voir le profil PMA
                        </Button>
                      )}
                      <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Expire le {formatDate(lead.expiresAt)}
                      </span>
                    </div>
                  )}

                  {lead.status === 'accepted' && (
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      <Check className="h-3 w-3 mr-1" />
                      Acceptée{lead.respondedAt && ` le ${formatDate(lead.respondedAt)}`}
                    </Badge>
                  )}

                  {lead.status === 'declined' && (
                    <div>
                      <Badge variant="secondary" className="bg-gray-100 text-gray-700">
                        <X className="h-3 w-3 mr-1" />
                        Déclinée{lead.respondedAt && ` le ${formatDate(lead.respondedAt)}`}
                      </Badge>
                      {lead.coachResponseMessage && (
                        <p className="text-xs text-muted-foreground mt-2 italic">
                          Message envoyé : « {lead.coachResponseMessage} »
                        </p>
                      )}
                    </div>
                  )}

                  {lead.status === 'expired' && (
                    <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                      <Clock className="h-3 w-3 mr-1" />
                      Expirée
                    </Badge>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal décliner */}
      <Dialog open={!!declineTarget} onOpenChange={(o) => !o && setDeclineTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Décliner cette demande</DialogTitle>
            <DialogDescription>
              {declineTarget && `Vous déclinez la demande de ${declineTarget.athleteName}.`}
              Vous pouvez ajouter un message optionnel qui lui sera envoyé.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={declineMessage}
            onChange={(e) => setDeclineMessage(e.target.value)}
            placeholder="Message optionnel (raison, suggestion, etc.)"
            rows={4}
            maxLength={1000}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeclineTarget(null)}
              disabled={processingId !== null}
            >
              Annuler
            </Button>
            <Button
              onClick={confirmDecline}
              disabled={processingId !== null}
              variant="destructive"
            >
              {processingId ? 'Envoi…' : 'Confirmer le refus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
