'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ContactRequestDialog } from './ContactRequestDialog'

export type ContactRequestCtaMode =
  | { kind: 'guest' }
  | { kind: 'no-pma' }
  | { kind: 'pending' }
  | { kind: 'not-eligible' }
  | { kind: 'eligible'; pmaTestId: string; profileName: string | null; globalScore: number | null; athleteSport: string | null }

interface ContactRequestCtaProps {
  expertId: string
  coachDisplayName: string
  mode: ContactRequestCtaMode
}

export function ContactRequestCta({ expertId, coachDisplayName, mode }: ContactRequestCtaProps) {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [justSent, setJustSent] = useState(false)

  if (mode.kind === 'not-eligible') {
    return (
      <div className="space-y-2">
        <Button className="w-full" disabled>
          Profil non disponible
        </Button>
        <p className="text-xs text-white/60 text-center">
          Ce praticien n&apos;accepte pas les demandes pour le moment.
        </p>
      </div>
    )
  }

  if (mode.kind === 'guest') {
    const redirectAfter = encodeURIComponent(`/marketplace/${expertId}`)
    return (
      <Button
        className="w-full bg-[#20808D] hover:bg-[#1a6b76] text-white"
        onClick={() => router.push(`/register/athlete?redirect_after=${redirectAfter}`)}
      >
        Demander un accompagnement
      </Button>
    )
  }

  if (mode.kind === 'no-pma') {
    return (
      <div className="space-y-2">
        <Button
          className="w-full bg-[#20808D] hover:bg-[#1a6b76] text-white"
          onClick={() => router.push('/test/pma/start')}
        >
          Passez d&apos;abord le test
        </Button>
        <p className="text-xs text-white/60 text-center">
          Complétez le PMA pour pouvoir contacter un praticien.
        </p>
      </div>
    )
  }

  if (mode.kind === 'pending' || justSent) {
    return (
      <Button className="w-full" disabled>
        Demande en attente
      </Button>
    )
  }

  // Eligible
  return (
    <>
      <Button
        className="w-full bg-[#20808D] hover:bg-[#1a6b76] text-white"
        onClick={() => setDialogOpen(true)}
      >
        Demander un accompagnement
      </Button>
      <ContactRequestDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        coachUserId={expertId}
        coachDisplayName={coachDisplayName}
        pmaTestId={mode.pmaTestId}
        athleteProfileName={mode.profileName}
        athleteGlobalScore={mode.globalScore}
        defaultSport={mode.athleteSport}
        onSuccess={() => setJustSent(true)}
      />
    </>
  )
}
