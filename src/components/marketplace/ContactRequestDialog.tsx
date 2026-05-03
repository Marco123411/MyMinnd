'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createContactRequestAction } from '@/app/actions/contact-requests'
import type { ContactRequestLevel } from '@/lib/validations/contact-requests'

interface ContactRequestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  coachUserId: string
  coachDisplayName: string
  pmaTestId: string
  athleteProfileName: string | null
  athleteGlobalScore: number | null
  defaultSport?: string | null
  onSuccess?: () => void
}

const LEVEL_OPTIONS: { value: ContactRequestLevel; label: string }[] = [
  { value: 'amateur', label: 'Amateur' },
  { value: 'semi-pro', label: 'Semi-pro' },
  { value: 'professionnel', label: 'Professionnel' },
  { value: 'elite', label: 'Élite' },
]

export function ContactRequestDialog({
  open,
  onOpenChange,
  coachUserId,
  coachDisplayName,
  pmaTestId,
  athleteProfileName,
  athleteGlobalScore,
  defaultSport,
  onSuccess,
}: ContactRequestDialogProps) {
  const router = useRouter()
  const [sport, setSport] = useState(defaultSport ?? '')
  const [level, setLevel] = useState<ContactRequestLevel | ''>('')
  const [objective, setObjective] = useState('')
  const [message, setMessage] = useState('')
  const [consent, setConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!level) {
      setError('Veuillez choisir un niveau')
      return
    }
    if (!consent) {
      setError('Vous devez accepter le partage de vos résultats')
      return
    }

    setLoading(true)
    const result = await createContactRequestAction({
      coach_user_id: coachUserId,
      test_id: pmaTestId,
      sport,
      level,
      objective,
      message: message.trim() || undefined,
      // Guard UI + zod + check DB → triple defense against placebo consent.
      consent_share_results: true,
    })

    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    setLoading(false)
    onOpenChange(false)
    if (onSuccess) onSuccess()
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Demander un accompagnement</DialogTitle>
          <DialogDescription>
            Envoyez votre demande à <strong>{coachDisplayName}</strong>. Vos résultats PMA seront
            partagés.
          </DialogDescription>
        </DialogHeader>

        {/* Résumé athlète */}
        <div className="rounded-lg bg-[#E8F4F5] p-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#20808D] mb-1">
            Vos résultats partagés
          </p>
          <div className="text-[#1A1A2E]">
            {athleteProfileName && (
              <>
                Profil : <strong>{athleteProfileName}</strong>
              </>
            )}
            {athleteProfileName && athleteGlobalScore !== null && ' · '}
            {athleteGlobalScore !== null && (
              <>
                Score : <strong>{athleteGlobalScore.toFixed(1)}/10</strong>
              </>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sport">Sport *</Label>
            <Input
              id="sport"
              placeholder="Ex : Tennis"
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              disabled={loading}
              required
              maxLength={100}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="level">Niveau *</Label>
            <Select
              value={level}
              onValueChange={(v) => setLevel(v as ContactRequestLevel)}
              disabled={loading}
            >
              <SelectTrigger id="level">
                <SelectValue placeholder="Choisissez votre niveau" />
              </SelectTrigger>
              <SelectContent>
                {LEVEL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="objective">
              Pourquoi cherchez-vous un préparateur mental ? *
            </Label>
            <Textarea
              id="objective"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              disabled={loading}
              required
              maxLength={500}
              rows={4}
              placeholder="Décrivez votre objectif en quelques phrases…"
            />
            <p className="text-xs text-muted-foreground text-right">
              {objective.length}/500
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="message">Message personnel (optionnel)</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={loading}
              maxLength={1000}
              rows={3}
            />
          </div>

          <div className="flex items-start gap-2 rounded-md border p-3">
            <Checkbox
              id="consent"
              checked={consent}
              onCheckedChange={(v) => setConsent(v === true)}
              disabled={loading}
            />
            <Label htmlFor="consent" className="text-sm font-normal cursor-pointer">
              J&apos;accepte que mes résultats de test (profil mental, score global, forces/axes)
              soient partagés avec ce praticien.
            </Label>
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              className="bg-[#20808D] hover:bg-[#1a6b76]"
              disabled={loading || !consent}
            >
              {loading ? 'Envoi…' : 'Envoyer la demande'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
