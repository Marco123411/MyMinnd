'use client'

import Link from 'next/link'
import { Lock, Share2, ArrowRight } from 'lucide-react'
import { RadarChart } from '@/components/ui/radar-chart'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ShareProfileDialog } from './ShareProfileDialog'

export interface TeaserForceOrAxis {
  name: string
  score: number
}

export interface TeaserDomainScore {
  name: string
  score: number
}

export interface TeaserCelebrity {
  name: string
  sport?: string | null
  reason?: string | null
}

export interface TeaserProfile {
  id: string
  name: string
  family: string | null
  color: string
  tagline: string | null
  description: string | null
  celebrity_examples: TeaserCelebrity[] | null
  slug: string | null
}

export interface ProfileTeaserProps {
  profile: TeaserProfile | null
  globalScore: number | null
  globalPercentile: number | null
  top3Forces: TeaserForceOrAxis[]
  top3Axes: TeaserForceOrAxis[]
  domainScores: TeaserDomainScore[]
  testDefinitionName: string
}

export function ProfileTeaser({
  profile,
  globalScore,
  globalPercentile,
  top3Forces,
  top3Axes,
  domainScores,
  testDefinitionName,
}: ProfileTeaserProps) {
  const radarData = domainScores.map((d) => ({
    subject: d.name,
    value: d.score,
    fullMark: 10 as const,
  }))

  const topPercent =
    globalPercentile !== null ? Math.max(1, 100 - globalPercentile) : null

  return (
    <div className="relative pb-24">
      {/* Section 1 — Profil mental (déverrouillé) */}
      {profile && (
        <Card
          className="p-6 sm:p-8 mb-6 border-2"
          style={{ borderLeftColor: profile.color, borderLeftWidth: '6px' }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <Badge
                variant="outline"
                className="mb-2"
                style={{ borderColor: profile.color, color: profile.color }}
              >
                Votre profil mental
              </Badge>
              <h2 className="text-2xl sm:text-3xl font-bold text-[#1A1A2E]">
                {profile.name}
              </h2>
              {profile.family && (
                <p className="text-sm text-muted-foreground mt-1">{profile.family}</p>
              )}
              {profile.tagline && (
                <p className="mt-3 text-base sm:text-lg italic text-[#1A1A2E]">
                  « {profile.tagline} »
                </p>
              )}
            </div>
            {profile.slug && (
              <ShareProfileDialog
                profileName={profile.name}
                profileSlug={profile.slug}
                globalScore={globalScore}
              >
                <Button variant="outline" size="sm" className="shrink-0 gap-1.5">
                  <Share2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Partager</span>
                </Button>
              </ShareProfileDialog>
            )}
          </div>

          {profile.description && (
            <p className="mt-4 text-sm text-[#1A1A2E] leading-relaxed line-clamp-4">
              {profile.description}
            </p>
          )}

          {profile.celebrity_examples && profile.celebrity_examples.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Athlètes du même profil
              </p>
              <div className="flex flex-wrap gap-2">
                {profile.celebrity_examples.slice(0, 5).map((athlete) => (
                  <Badge key={athlete.name} variant="secondary" className="bg-[#E8F4F5]">
                    {athlete.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Section 2 — Score global (déverrouillé) */}
      {globalScore !== null && (
        <Card className="p-6 mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Score global
          </p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <span className="text-5xl font-bold text-[#20808D]">
              {globalScore.toFixed(1)}
            </span>
            <span className="text-xl text-muted-foreground self-end mb-2">/10</span>
          </div>
          {topPercent !== null && (
            <Badge className="mt-3 bg-[#FFC553] text-[#1A1A2E] hover:bg-[#FFC553]">
              Top {topPercent}% des {testDefinitionName}
            </Badge>
          )}
        </Card>
      )}

      {/* Section 3 — Top 3 forces + Top 3 axes (déverrouillé) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <Card className="p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[#20808D] mb-4">
            Vos 3 forces principales
          </h3>
          <ul className="space-y-3">
            {top3Forces.map((f) => (
              <li key={f.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-[#1A1A2E] truncate">
                    {f.name}
                  </span>
                  <span className="text-sm font-bold text-[#20808D] ml-2 shrink-0">
                    {f.score.toFixed(1)}
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#20808D] transition-all"
                    style={{ width: `${Math.min(100, f.score * 10)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[#944454] mb-4">
            Axes de progression
          </h3>
          <ul className="space-y-3">
            {top3Axes.map((a) => (
              <li key={a.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-[#1A1A2E] truncate">
                    {a.name}
                  </span>
                  <span className="text-sm font-bold text-[#944454] ml-2 shrink-0">
                    {a.score.toFixed(1)}
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#944454] transition-all"
                    style={{ width: `${Math.min(100, a.score * 10)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Section 4 — Radar simplifié (6 domaines PMA) (déverrouillé) */}
      {radarData.length > 0 && (
        <Card className="p-5 mb-6">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Profil par domaine
          </h3>
          <RadarChart data={radarData} height={280} />
        </Card>
      )}

      {/* Section 5 — Sections verrouillées (floutées) */}
      <div className="relative mb-6">
        <div
          className="filter blur-md pointer-events-none select-none"
          aria-hidden
          inert
        >
          <Card className="p-5 mb-4">
            <h3 className="text-base font-semibold mb-3">Vos 31 compétences détaillées</h3>
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>Compétence mentale {i + 1}</span>
                  <span>—</span>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5 mb-4">
            <h3 className="text-base font-semibold mb-3">Insights personnalisés</h3>
            <p className="text-sm text-muted-foreground">
              Analyse conditionnelle basée sur vos scores…
            </p>
          </Card>
          <Card className="p-5">
            <h3 className="text-base font-semibold mb-3">Recommandations d&apos;outils mentaux</h3>
            <p className="text-sm text-muted-foreground">
              Exercices et protocoles adaptés à votre profil…
            </p>
          </Card>
        </div>

        {/* Overlay cadenas */}
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <Card className="p-6 max-w-sm text-center shadow-xl border-2 border-[#20808D]">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#E8F4F5]">
              <Lock className="h-6 w-6 text-[#20808D]" />
            </div>
            <h3 className="text-lg font-bold text-[#1A1A2E] mb-2">
              Contenu verrouillé
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Débloquez votre analyse complète avec un préparateur mental certifié MINND.
            </p>
            <Button asChild className="bg-[#20808D] hover:bg-[#1a6b76]">
              <Link href="/marketplace">
                Trouver un préparateur <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
          </Card>
        </div>
      </div>

      {/* Section 6 — CTA sticky en bas */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t shadow-lg p-4 sm:hidden">
        <Button
          asChild
          className="w-full h-12 bg-[#20808D] hover:bg-[#1a6b76] text-base"
        >
          <Link href="/marketplace">
            Trouver un préparateur mental <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* Section 6 — CTA desktop (non-sticky, après overlay) */}
      <Card className="hidden sm:block p-8 bg-gradient-to-r from-[#20808D] to-[#1a6b76] text-white text-center">
        <h3 className="text-2xl font-bold mb-2">Débloquez votre analyse complète</h3>
        <p className="text-base mb-4 text-white/90">
          Votre préparateur recevra vos résultats et pourra vous accompagner.
        </p>
        <Button
          asChild
          size="lg"
          className="bg-[#FFC553] text-[#1A1A2E] hover:bg-[#e6b14b] h-12 px-8"
        >
          <Link href="/marketplace">
            Trouver un préparateur mental <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </Button>
      </Card>
    </div>
  )
}
