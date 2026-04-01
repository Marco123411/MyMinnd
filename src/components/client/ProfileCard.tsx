import type { MentalProfile, TestLevelSlug } from '@/types'

interface ProfileCardProps {
  profile: MentalProfile | null
  levelSlug: TestLevelSlug
}

export function ProfileCard({ profile, levelSlug }: ProfileCardProps) {
  const isDiscovery = levelSlug === 'discovery'

  // Pas de profil disponible pour ce niveau → rien à afficher
  if (isDiscovery || !profile) {
    return null
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
