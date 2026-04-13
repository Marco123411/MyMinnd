'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { completeClientOnboardingAction } from '@/app/actions/auth'
import { clientOnboardingSchema, type ClientOnboardingFormData } from '@/lib/validations/auth'
import type { ClientContext } from '@/types'

interface OnboardingClientProps {
  prenom: string
}

// Options de contexte affichées sous forme de cartes cliquables
const CONTEXT_OPTIONS: { value: ClientContext; label: string; description: string; emoji: string }[] = [
  { value: 'sport', label: 'Athlète / Sport', description: 'Performance sportive et mentale', emoji: '🏆' },
  { value: 'corporate', label: 'Entreprise / Corporate', description: 'Leadership et performance pro', emoji: '💼' },
  { value: 'wellbeing', label: 'Bien-être / Santé', description: 'Équilibre et mieux-être', emoji: '🌿' },
  { value: 'coaching', label: 'Développement personnel', description: 'Croissance et transformation', emoji: '🧠' },
]

export function OnboardingClient({ prenom }: OnboardingClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedContext, setSelectedContext] = useState<ClientContext | null>(null)
  const [sport, setSport] = useState('')
  const [entreprise, setEntreprise] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!selectedContext) {
      setError('Veuillez choisir votre contexte.')
      return
    }

    // Validation via le schéma Zod (cohérent avec la validation serveur)
    const parsed = clientOnboardingSchema.safeParse({
      context: selectedContext,
      sport: sport.trim() || undefined,
      entreprise: entreprise.trim() || undefined,
    })

    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }

    startTransition(async () => {
      const result = await completeClientOnboardingAction(parsed.data as ClientOnboardingFormData)
      if (result.error) {
        setError(result.error)
      } else {
        setStep(2)
      }
    })
  }

  // Étape 2 — Confirmation, le coach prend la main
  if (step === 2) {
    return (
      <div className="space-y-6 text-center">
        <div className="space-y-2">
          <div className="text-5xl">✅</div>
          <h2 className="text-2xl font-bold text-[#141325]">
            Bienvenue {prenom} !
          </h2>
          <p className="text-muted-foreground">
            Votre profil est configuré. Votre coach va bientôt vous envoyer votre première évaluation.
          </p>
        </div>

        <div className="pt-2">
          <Button
            className="w-full bg-[#7069F4] hover:bg-[#1a6b77] text-white h-12 text-base font-semibold"
            onClick={() => { window.location.href = '/client' }}
          >
            Accéder à mon espace
          </Button>
        </div>
      </div>
    )
  }

  // Étape 1 — Choix du contexte
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-1 text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-widest">Étape 1 sur 2</p>
        <h2 className="text-2xl font-bold text-[#141325]">
          Bonjour {prenom} !
        </h2>
        <p className="text-muted-foreground text-sm">
          Dans quel contexte souhaitez-vous développer votre performance mentale ?
        </p>
      </div>

      {/* Cartes de contexte */}
      <div className="grid grid-cols-2 gap-3">
        {CONTEXT_OPTIONS.map((option) => (
          <Card
            key={option.value}
            className={`cursor-pointer transition-all border-2 hover:border-[#7069F4] ${
              selectedContext === option.value
                ? 'border-[#7069F4] bg-[#F1F0FE]'
                : 'border-border'
            }`}
            onClick={() => {
              setSelectedContext(option.value)
              setError(null)
            }}
          >
            <CardContent className="p-4 space-y-1">
              <div className="text-2xl">{option.emoji}</div>
              <p className="font-semibold text-[#141325] text-sm leading-tight">{option.label}</p>
              <p className="text-xs text-muted-foreground">{option.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Champs conditionnels */}
      {selectedContext === 'sport' && (
        <div className="space-y-1">
          <Label htmlFor="sport">Votre discipline</Label>
          <Input
            id="sport"
            placeholder="Ex : Badminton, Football, Natation…"
            value={sport}
            onChange={(e) => setSport(e.target.value)}
            disabled={isPending}
          />
        </div>
      )}
      {selectedContext === 'corporate' && (
        <div className="space-y-1">
          <Label htmlFor="entreprise">Votre entreprise</Label>
          <Input
            id="entreprise"
            placeholder="Ex : ACME Corp"
            value={entreprise}
            onChange={(e) => setEntreprise(e.target.value)}
            disabled={isPending}
          />
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">{error}</p>
      )}

      <Button
        type="submit"
        className="w-full bg-[#7069F4] hover:bg-[#1a6b77] text-white h-12 text-base"
        disabled={isPending || !selectedContext}
      >
        {isPending ? 'Enregistrement…' : 'Continuer →'}
      </Button>
    </form>
  )
}
