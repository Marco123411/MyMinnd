'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Mail, RotateCcw, CheckCircle2, UserX } from 'lucide-react'
import { inviteClientAction, resendInviteAction } from '@/app/actions/clients'
import type { InvitationStatus } from '@/types'

interface InvitationActionsProps {
  clientId: string
  status: InvitationStatus
  hasUserAccount: boolean
}

export function InvitationActions({
  clientId,
  status,
  hasUserAccount,
}: InvitationActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function handleInvite() {
    setMessage(null)
    startTransition(async () => {
      const result = await inviteClientAction(clientId)
      if (result.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({ type: 'success', text: 'Invitation envoyée !' })
        // F5 FIX : force le rechargement des données serveur pour mettre à jour le badge
        router.refresh()
      }
    })
  }

  function handleResend() {
    setMessage(null)
    startTransition(async () => {
      const result = await resendInviteAction(clientId)
      if (result.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({ type: 'success', text: 'Invitation renvoyée !' })
        router.refresh()
      }
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {/* Badge statut */}
        {status === 'none' && !hasUserAccount && (
          <Badge variant="outline" className="text-gray-500 gap-1">
            <UserX className="h-3 w-3" />
            Non invité
          </Badge>
        )}
        {status === 'pending' && !hasUserAccount && (
          <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 gap-1">
            <Mail className="h-3 w-3" />
            Invitation envoyée
          </Badge>
        )}
        {(status === 'accepted' || hasUserAccount) && (
          <Badge className="bg-green-100 text-green-700 gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Compte actif
          </Badge>
        )}

        {/* Bouton action */}
        {status === 'none' && !hasUserAccount && (
          <Button
            size="sm"
            onClick={handleInvite}
            disabled={isPending}
            className="bg-[#20808D] hover:bg-[#1a6b77] text-white gap-1"
          >
            <Mail className="h-3.5 w-3.5" />
            {isPending ? 'Envoi…' : 'Inviter'}
          </Button>
        )}
        {status === 'pending' && !hasUserAccount && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleResend}
            disabled={isPending}
            className="gap-1"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {isPending ? 'Envoi…' : 'Renvoyer'}
          </Button>
        )}
      </div>

      {message && (
        <p className={`text-xs ${message.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
