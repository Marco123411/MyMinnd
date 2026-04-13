'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  expertAcceptAction,
  expertDeclineAction,
  markContactedAction,
  markSessionCompleteAction,
} from '@/app/actions/dispatches'
import type { DispatchWithDetails } from '@/types'

interface Props {
  dispatch: DispatchWithDetails
  clientEmail: string | null
}

export function DispatchCoachClient({ dispatch, clientEmail }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [declined, setDeclined] = useState(false)

  async function handleAccept() {
    setError(null)
    startTransition(async () => {
      const { error: err } = await expertAcceptAction(dispatch.id)
      if (err) {
        setError(err)
      } else {
        router.refresh()
      }
    })
  }

  async function handleDecline() {
    if (!confirm('Confirmer le déclin de cette mission ? Elle sera réassignée.')) return
    setError(null)
    startTransition(async () => {
      const { error: err } = await expertDeclineAction(dispatch.id)
      if (err) {
        setError(err)
      } else {
        setDeclined(true)
        router.refresh()
      }
    })
  }

  async function handleMarkContacted() {
    setError(null)
    startTransition(async () => {
      const { error: err } = await markContactedAction(dispatch.id)
      if (err) {
        setError(err)
      } else {
        router.refresh()
      }
    })
  }

  async function handleSessionComplete() {
    if (!confirm('Confirmer la fin de session ? Le paiement de 49€ sera initié.')) return
    setError(null)
    startTransition(async () => {
      const { error: err } = await markSessionCompleteAction(dispatch.id)
      if (err) {
        setError(err)
      } else {
        router.refresh()
      }
    })
  }

  if (declined) {
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <p className="text-muted-foreground">Mission déclinée. Elle sera réassignée par l'équipe MINND.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {dispatch.status === 'dispatche' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Répondre à la mission</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Consultez le profil du client ci-dessous, puis acceptez ou déclinez la mission.
              Vous avez 4 heures pour répondre.
            </p>
            <div className="flex gap-3">
              <Button
                onClick={handleAccept}
                disabled={isPending}
                className="bg-[#7069F4] hover:bg-[#7069F4]/90 text-white"
              >
                Accepter la mission
              </Button>
              <Button
                onClick={handleDecline}
                disabled={isPending}
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50"
              >
                Décliner
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {dispatch.status === 'accepte' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mission acceptée</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {clientEmail && (
              <div className="rounded-lg bg-[#F1F0FE] px-4 py-3">
                <p className="text-sm font-medium text-[#7069F4]">Contactez le client sous 24h</p>
                <p className="text-sm text-[#141325] mt-1">
                  Email :{' '}
                  <a
                    href={`mailto:${clientEmail}`}
                    className="font-medium underline"
                  >
                    {clientEmail}
                  </a>
                </p>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Après avoir pris contact avec le client, marquez le contact comme effectué.
            </p>
            <Button
              onClick={handleMarkContacted}
              disabled={isPending}
              variant="outline"
            >
              Marquer contact effectué
            </Button>
          </CardContent>
        </Card>
      )}

      {dispatch.status === 'en_session' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Session en cours</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Une fois votre session d'analyse (30-45 min) terminée avec le client, cliquez sur
              "Session terminée". Votre paiement de 49 € sera traité par l'équipe MINND.
            </p>
            <Button
              onClick={handleSessionComplete}
              disabled={isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Session terminée
            </Button>
          </CardContent>
        </Card>
      )}

      {dispatch.status === 'termine' && (
        <Card>
          <CardContent className="py-6">
            <p className="font-medium text-green-600">Mission terminée ✓</p>
            <p className="text-sm text-muted-foreground mt-1">
              Votre paiement de 49 € est en cours de traitement.
            </p>
          </CardContent>
        </Card>
      )}

      {dispatch.status === 'annule' && (
        <Card>
          <CardContent className="py-6">
            <p className="font-medium text-red-500">Mission annulée</p>
          </CardContent>
        </Card>
      )}

      {error && (
        <p className="text-sm text-red-500 font-medium">{error}</p>
      )}
    </div>
  )
}
