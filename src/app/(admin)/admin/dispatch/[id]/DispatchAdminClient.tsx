'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  assignExpertAction,
  updateDispatchNotesAction,
  reassignDispatchAction,
  cancelDispatchAction,
} from '@/app/actions/dispatches'
import type { DispatchWithDetails, AvailableExpert, DispatchStatus } from '@/types'

interface Props {
  dispatch: DispatchWithDetails
  experts: AvailableExpert[]
}

const STATUS_LABELS: Record<DispatchStatus, string> = {
  nouveau: 'Nouveau',
  en_cours: 'En cours',
  dispatche: 'Dispatché',
  accepte: 'Accepté',
  en_session: 'En session',
  termine: 'Terminé',
  annule: 'Annulé',
}

const TIMELINE_STEPS: DispatchStatus[] = [
  'nouveau',
  'en_cours',
  'dispatche',
  'accepte',
  'en_session',
  'termine',
]

function getStepIndex(status: DispatchStatus): number {
  if (status === 'annule') return -1
  return TIMELINE_STEPS.indexOf(status)
}

function formatDateFr(isoDate: string | null): string {
  if (!isoDate) return '—'
  return new Date(isoDate).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function DispatchAdminClient({ dispatch, experts }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedExpertId, setSelectedExpertId] = useState<string>('')
  const [notes, setNotes] = useState(dispatch.notes_admin ?? '')
  const [error, setError] = useState<string | null>(null)

  const currentStepIndex = getStepIndex(dispatch.status)
  const isTerminated = dispatch.status === 'termine' || dispatch.status === 'annule'

  // Alertes timeout
  const now = Date.now()
  const dispatchedAt = dispatch.dispatched_at ? new Date(dispatch.dispatched_at).getTime() : null
  const isExpertLate =
    dispatch.status === 'dispatche' &&
    dispatchedAt !== null &&
    now - dispatchedAt > 4 * 60 * 60 * 1000

  async function handleAssignExpert() {
    if (!selectedExpertId) return
    setError(null)
    startTransition(async () => {
      const { error: err } = await assignExpertAction(dispatch.id, selectedExpertId)
      if (err) {
        setError(err)
      } else {
        router.refresh()
      }
    })
  }

  async function handleSaveNotes() {
    setError(null)
    startTransition(async () => {
      const { error: err } = await updateDispatchNotesAction(dispatch.id, notes)
      if (err) setError(err)
    })
  }

  async function handleReassign() {
    setError(null)
    startTransition(async () => {
      const { error: err } = await reassignDispatchAction(dispatch.id)
      if (err) {
        setError(err)
      } else {
        router.refresh()
      }
    })
  }

  async function handleCancel() {
    if (!confirm('Confirmer l\'annulation de ce dispatch ?')) return
    setError(null)
    startTransition(async () => {
      const { error: err } = await cancelDispatchAction(dispatch.id)
      if (err) {
        setError(err)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Alerte expert non-répondant */}
      {isExpertLate && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3">
          <p className="font-medium text-red-700">
            L'expert n'a pas répondu depuis plus de 4 heures
          </p>
          <p className="text-sm text-red-600 mb-2">Un reassignement est recommandé.</p>
          <Button
            size="sm"
            variant="outline"
            onClick={handleReassign}
            disabled={isPending}
          >
            Reassigner maintenant
          </Button>
        </div>
      )}

      {/* Timeline statut */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Progression</CardTitle>
        </CardHeader>
        <CardContent>
          {dispatch.status === 'annule' ? (
            <p className="text-red-500 font-medium">Mission annulée</p>
          ) : (
            <div className="flex items-center gap-1">
              {TIMELINE_STEPS.map((step, i) => (
                <div key={step} className="flex items-center gap-1 flex-1 min-w-0">
                  <div
                    className={`flex-1 h-1 rounded ${
                      i <= currentStepIndex ? 'bg-[#20808D]' : 'bg-gray-200'
                    }`}
                  />
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-3 h-3 rounded-full border-2 ${
                        i <= currentStepIndex
                          ? 'bg-[#20808D] border-[#20808D]'
                          : 'bg-white border-gray-300'
                      }`}
                    />
                    <span className="text-[10px] text-muted-foreground mt-0.5 whitespace-nowrap">
                      {STATUS_LABELS[step]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Créé le : </span>
              <span>{formatDateFr(dispatch.created_at)}</span>
            </div>
            {dispatch.dispatched_at && (
              <div>
                <span className="text-muted-foreground">Dispatché le : </span>
                <span>{formatDateFr(dispatch.dispatched_at)}</span>
              </div>
            )}
            {dispatch.accepted_at && (
              <div>
                <span className="text-muted-foreground">Accepté le : </span>
                <span>{formatDateFr(dispatch.accepted_at)}</span>
              </div>
            )}
            {dispatch.contacted_at && (
              <div>
                <span className="text-muted-foreground">Contacté le : </span>
                <span>{formatDateFr(dispatch.contacted_at)}</span>
              </div>
            )}
            {dispatch.completed_at && (
              <div>
                <span className="text-muted-foreground">Terminé le : </span>
                <span>{formatDateFr(dispatch.completed_at)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sélection expert (si pas encore dispatché ou si reassignement) */}
      {!isTerminated && (dispatch.status === 'nouveau' || dispatch.status === 'en_cours') && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assigner un expert</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={selectedExpertId} onValueChange={setSelectedExpertId}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un expert..." />
              </SelectTrigger>
              <SelectContent>
                {experts.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.prenom ?? ''} {e.nom}
                    <span className="ml-2 text-xs text-muted-foreground capitalize">
                      ({e.subscription_tier})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleAssignExpert}
              disabled={!selectedExpertId || isPending}
              className="bg-[#20808D] hover:bg-[#20808D]/90 text-white"
            >
              Dispatcher vers cet expert
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Boutons de progression manuelle */}
      {!isTerminated && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {dispatch.status === 'dispatche' && (
              <Button size="sm" variant="outline" onClick={handleReassign} disabled={isPending}>
                Forcer reassignement
              </Button>
            )}
            <Button
              size="sm"
              variant="destructive"
              onClick={handleCancel}
              disabled={isPending}
            >
              Annuler la mission
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Notes admin */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notes internes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes internes (non visibles par le client ni l'expert)..."
            rows={4}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#20808D]"
          />
          <Button size="sm" variant="outline" onClick={handleSaveNotes} disabled={isPending}>
            Enregistrer les notes
          </Button>
        </CardContent>
      </Card>

      {error && (
        <p className="text-sm text-red-500 font-medium">{error}</p>
      )}
    </div>
  )
}
