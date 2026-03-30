import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { MentalProfile, TestLevelSlug } from '@/types'

interface ProfileCardProps {
  profile: MentalProfile | null
  levelSlug: TestLevelSlug
  testSlug?: string
  showUpsell?: boolean
}

export function ProfileCard({ profile, levelSlug, testSlug, showUpsell }: ProfileCardProps) {
  const isDiscovery = levelSlug === 'discovery'

  // Upsell pour les tests Discovery sans profil
  if (isDiscovery || !profile) {
    if (!showUpsell) return null
    return (
      <div className="rounded-xl border-2 border-[#20808D] bg-[#E8F4F5] p-6 text-center">
        <h3 className="text-lg font-bold text-[#1A1A2E]">Débloquez votre profil mental</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Passez au test Complet pour découvrir votre profil MINND détaillé, vos forces, axes
          d&apos;amélioration et recommandations personnalisées.
        </p>
        {testSlug && (
          <Link href={`/test/${testSlug}`} className="mt-4 inline-block">
            <Button className="bg-[#20808D] hover:bg-[#186870]">
              Passer au test Complet
            </Button>
          </Link>
        )}
      </div>
    )
  }

  return (
    <div
      className="rounded-xl border-2 p-6"
      style={{ borderColor: profile.color, backgroundColor: `${profile.color}14` }}
    >
      <div className="mb-3 flex items-center gap-3">
        <div className="h-4 w-4 rounded-full" style={{ backgroundColor: profile.color }} />
        {profile.family && (
          <span className="text-sm font-medium text-muted-foreground">{profile.family}</span>
        )}
      </div>

      <h2 className="text-2xl font-bold text-[#1A1A2E]">{profile.name}</h2>

      {profile.description && (
        <p className="mt-3 text-sm text-muted-foreground">{profile.description}</p>
      )}

      {(profile.strengths || profile.weaknesses) && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {profile.strengths && (
            <div>
              <p className="mb-1 text-sm font-semibold text-[#1A1A2E]">Points forts</p>
              <p className="text-sm text-muted-foreground">{profile.strengths}</p>
            </div>
          )}
          {profile.weaknesses && (
            <div>
              <p className="mb-1 text-sm font-semibold text-[#1A1A2E]">Points de vigilance</p>
              <p className="text-sm text-muted-foreground">{profile.weaknesses}</p>
            </div>
          )}
        </div>
      )}

      {profile.recommendations && (
        <div className="mt-4 rounded-lg bg-white/60 p-3">
          <p className="mb-1 text-sm font-semibold text-[#1A1A2E]">Recommandations</p>
          <p className="text-sm text-muted-foreground">{profile.recommendations}</p>
        </div>
      )}
    </div>
  )
}
