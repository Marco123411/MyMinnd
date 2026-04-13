'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog'
import { Mail, RotateCcw, CheckCircle2, UserX, ShieldCheck } from 'lucide-react'
import { inviteClientAction, resendInviteAction, manuallyValidateClientAction } from '@/app/actions/clients'
import type { InvitationStatus } from '@/types'

interface InvitationActionsProps {
  clientId: string
  status: InvitationStatus
  hasUserAccount: boolean
  hasEmail?: boolean
}

export function InvitationActions({
  clientId,
  status,
  hasUserAccount,
  hasEmail = false,
}: InvitationActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isValidating, startValidationTransition] = useTransition()
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  function handleInvite() {
    setMessage(null)
    startTransition(async () => {
      const result = await inviteClientAction(clientId)
      if (result.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({ type: 'success', text: 'Invitation envoyée !' })
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

  function handleManualValidation() {
    setMessage(null)
    startValidationTransition(async () => {
      const result = await manuallyValidateClientAction(clientId)
      setDialogOpen(false)
      if (result.error) {
        setMessage({ type: 'error', text: result.error })
      } else {
        setMessage({ type: 'success', text: 'Compte activé — email de création de mot de passe envoyé.' })
        router.refresh()
      }
    })
  }

  const isAccountActive = status === 'accepted' || hasUserAccount

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 flex-wrap">
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
        {isAccountActive && (
          <Badge className="bg-green-100 text-green-700 gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Compte actif
          </Badge>
        )}

        {/* Bouton invitation classique */}
        {status === 'none' && !hasUserAccount && (
          <Button
            size="sm"
            onClick={handleInvite}
            disabled={isPending || isValidating}
            className="bg-[#7069F4] hover:bg-[#5b55d6] text-white gap-1"
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
            disabled={isPending || isValidating}
            className="gap-1"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {isPending ? 'Envoi…' : 'Renvoyer'}
          </Button>
        )}

        {/* Bouton validation manuelle — visible si compte non actif ET email disponible */}
        {!isAccountActive && hasEmail && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                disabled={isPending || isValidating}
                className="gap-1 border-[#20808D] text-[#20808D] hover:bg-[#E8F4F5]"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                {isValidating ? 'Activation…' : 'Activer manuellement'}
              </Button>
            </DialogTrigger>
            <DialogContent showCloseButton={false}>
              <DialogHeader>
                <DialogTitle>Activer le compte manuellement</DialogTitle>
                <DialogDescription>
                  Vous allez activer ce compte sans passer par le flux d&apos;invitation
                  email classique. Le client recevra un email pour créer son mot de passe
                  et pourra se connecter immédiatement.
                  <br /><br />
                  <strong className="text-foreground">Cette action est irréversible.</strong>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" disabled={isValidating}>Annuler</Button>
                </DialogClose>
                <Button
                  onClick={handleManualValidation}
                  disabled={isValidating}
                  className="bg-[#20808D] hover:bg-[#1a6b77] text-white"
                >
                  {isValidating ? 'Activation…' : 'Activer le compte'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
