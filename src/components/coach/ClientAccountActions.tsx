'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { KeyRound, Mail } from 'lucide-react'
import { resetClientPasswordAction, updateClientEmailAction } from '@/app/actions/clients'

interface ClientAccountActionsProps {
  clientId: string
  currentEmail: string
}

export function ClientAccountActions({ clientId, currentEmail }: ClientAccountActionsProps) {
  const router = useRouter()
  const [isPendingReset, startReset] = useTransition()
  const [isPendingEmail, startEmail] = useTransition()

  const [resetMessage, setResetMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [emailMessage, setEmailMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function handleResetPassword() {
    setResetMessage(null)
    startReset(async () => {
      const result = await resetClientPasswordAction(clientId)
      if (result.error) {
        setResetMessage({ type: 'error', text: result.error })
      } else {
        setResetMessage({ type: 'success', text: 'Email de réinitialisation envoyé !' })
      }
    })
  }

  function handleEmailChange() {
    setEmailMessage(null)
    startEmail(async () => {
      const result = await updateClientEmailAction(clientId, newEmail)
      if (result.error) {
        setEmailMessage({ type: 'error', text: result.error })
      } else {
        setEmailMessage({ type: 'success', text: 'Email mis à jour !' })
        router.refresh()
        setTimeout(() => {
          setEmailDialogOpen(false)
          setNewEmail('')
          setEmailMessage(null)
        }, 1200)
      }
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Reset mot de passe */}
      <div className="flex flex-col gap-1">
        <Button
          size="sm"
          variant="outline"
          onClick={handleResetPassword}
          disabled={isPendingReset}
          className="gap-1.5 text-xs"
        >
          <KeyRound className="h-3.5 w-3.5" />
          {isPendingReset ? 'Envoi…' : 'Réinitialiser le MDP'}
        </Button>
        {resetMessage && (
          <p className={`text-xs ${resetMessage.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
            {resetMessage.text}
          </p>
        )}
      </div>

      {/* Changer l'email */}
      <Button
        size="sm"
        variant="outline"
        onClick={() => { setEmailDialogOpen(true); setEmailMessage(null) }}
        className="gap-1.5 text-xs"
      >
        <Mail className="h-3.5 w-3.5" />
        Changer l'email
      </Button>

      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Changer l'adresse email</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="text-sm text-muted-foreground">
              Email actuel : <span className="font-medium text-foreground">{currentEmail}</span>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-email">Nouvel email</Label>
              <Input
                id="new-email"
                type="email"
                placeholder="nouveau@email.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && newEmail) handleEmailChange() }}
              />
            </div>
            {emailMessage && (
              <p className={`text-xs ${emailMessage.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                {emailMessage.text}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleEmailChange}
              disabled={isPendingEmail || !newEmail.trim()}
              className="bg-[#20808D] hover:bg-[#1a6b77] text-white"
            >
              {isPendingEmail ? 'Mise à jour…' : 'Mettre à jour'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
