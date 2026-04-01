import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { MentalProfile } from '@/types'

interface ProfileIdentityCardProps {
  profile: MentalProfile
  globalPercentile: number
}

export function ProfileIdentityCard({ profile, globalPercentile }: ProfileIdentityCardProps) {
  const bgColor = `${profile.color}14`

  return (
    <Card style={{ borderColor: profile.color, borderLeftWidth: 4 }}>
      <CardContent className="pt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          {/* Identité principale */}
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {/* Badge profil avec couleur */}
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold text-white"
                style={{ backgroundColor: profile.color }}
              >
                {profile.name}
              </span>
              {profile.family && (
                <Badge variant="outline" style={{ borderColor: profile.color, color: profile.color }}>
                  {profile.family}
                </Badge>
              )}
            </div>

            {profile.tagline && (
              <p className="text-base italic text-muted-foreground mb-3">{profile.tagline}</p>
            )}

            {profile.description && (
              <p className="text-sm text-[#1A1A2E] leading-relaxed">{profile.description}</p>
            )}
          </div>

          {/* Statistiques du profil */}
          <div
            className="rounded-xl p-4 shrink-0 sm:w-48 text-center"
            style={{ backgroundColor: bgColor }}
          >
            {profile.population_pct !== null && (
              <>
                <p className="text-2xl font-bold" style={{ color: profile.color }}>
                  {profile.population_pct}%
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  des athlètes
                  <br />
                  <span className="font-medium">(N sur 5 705)</span>
                </p>
              </>
            )}
            {profile.avg_score !== null && (
              <div className="mt-3 pt-3 border-t border-current/10">
                <p className="text-sm font-semibold" style={{ color: profile.color }}>
                  {profile.avg_score.toFixed(2)}/10
                </p>
                <p className="text-xs text-muted-foreground">score moyen du profil</p>
              </div>
            )}
            {globalPercentile > 0 && (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground">
                  Votre score : <span className="font-semibold">{globalPercentile}e percentile</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
