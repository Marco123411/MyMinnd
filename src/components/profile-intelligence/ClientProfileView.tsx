import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RadarChart } from '@/components/ui/radar-chart'
import { CelebrityExamplesList } from './CelebrityExamplesList'
import { ConditionalInsightCard } from './ConditionalInsightCard'
import type { ProfileIntelligenceData } from '@/types'

interface ClientProfileViewProps {
  data: ProfileIntelligenceData
}

// Supprime les références techniques (r=X.X) pour le texte client
function humanizeInsightText(text: string): string {
  return text.replace(/\s*\(corrélation\s+r=[0-9.]+\)/g, '').replace(/\s*\(r=[0-9.]+\)/g, '')
}

export function ClientProfileView({ data }: ClientProfileViewProps) {
  const { profile, globalScore, globalPercentile, leafZScores, domainScores, globalAverageDomainScores, scoresByLevel, activeInsights } = data

  const bgColor = `${profile.color}14`

  // Top 5 forces et axes (par percentile pour le client, pas z-score brut)
  const sortedByPercentile = [...leafZScores].sort((a, b) => (b.percentile ?? 0) - (a.percentile ?? 0))
  const forces = sortedByPercentile.slice(0, 5)
  const axes = sortedByPercentile.slice(-5).reverse()

  // Radar : client vs moyenne globale (2 séries)
  const radarData = domainScores.map((d) => ({
    subject: d.name,
    value: d.score,
    fullMark: 10 as const,
  }))
  const radarData2 = globalAverageDomainScores.map((d) => ({
    subject: d.name,
    value: d.score,
    fullMark: 10 as const,
  }))

  // Positionnement vs niveaux de compétition
  const sortedLevels = [...scoresByLevel].sort((a, b) => a.score - b.score)

  // Insights humanisés (max 3 pour le client)
  const clientInsights = activeInsights.slice(0, 3).map((i) => ({
    ...i,
    text: humanizeInsightText(i.text),
  }))

  return (
    <div className="space-y-8">
      {/* Section 1 : Profil */}
      <Card style={{ borderColor: profile.color, borderLeftWidth: 4 }}>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span
              className="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold text-white"
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
          <div className="flex items-center gap-4 mb-3">
            <div className="text-center">
              <p className="text-2xl font-bold" style={{ color: profile.color }}>
                {globalScore.toFixed(1)}/10
              </p>
              <p className="text-xs text-muted-foreground">Score global</p>
            </div>
            {globalPercentile > 0 && (
              <div className="text-center">
                <p className="text-xl font-bold text-[#1A1A2E]">{globalPercentile}e</p>
                <p className="text-xs text-muted-foreground">percentile</p>
              </div>
            )}
          </div>
          {profile.description && (
            <p className="text-sm text-[#1A1A2E] leading-relaxed">{profile.description}</p>
          )}
        </CardContent>
      </Card>

      {/* Section 2 : Radar client vs moyenne */}
      {radarData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Votre profil par domaine</CardTitle>
          </CardHeader>
          <CardContent>
            <RadarChart
              data={radarData}
              data2={radarData2}
              color={profile.color}
              color2="#94a3b8"
              height={280}
            />
            <div className="flex justify-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-4 rounded" style={{ backgroundColor: profile.color }} />
                Votre profil
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-4 rounded bg-gray-300" />
                Moyenne N=5 705
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sections 3 & 4 : Forces et axes */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-green-700">Mes forces</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {forces.map((leaf) => (
              <div key={leaf.nodeId} className="flex items-center justify-between">
                <span className="text-xs text-[#1A1A2E] truncate mr-2">{leaf.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {leaf.score.toFixed(1)}/10
                  {leaf.percentile !== null && (
                    <span className="ml-1 text-green-700">
                      · {leaf.percentile}e %ile
                    </span>
                  )}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[#944454]">Axes de progression</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {axes.map((leaf) => (
              <div key={leaf.nodeId} className="flex items-center justify-between">
                <span className="text-xs text-[#1A1A2E] truncate mr-2">{leaf.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {leaf.score.toFixed(1)}/10
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Section 5 : Positionnement vs niveaux */}
      {sortedLevels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Mon positionnement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sortedLevels.map((level) => {
                const isClosest = sortedLevels.reduce((prev, curr) =>
                  Math.abs(curr.score - globalScore) < Math.abs(prev.score - globalScore) ? curr : prev
                )
                const highlight = level.level === isClosest.level

                return (
                  <div key={level.level} className="flex items-center gap-3">
                    <span className={`w-24 shrink-0 text-xs ${highlight ? 'font-semibold text-[#20808D]' : 'text-muted-foreground'}`}>
                      {level.level}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-gray-100">
                      <div
                        className={`h-2 rounded-full transition-all ${highlight ? 'bg-[#20808D]' : 'bg-gray-300'}`}
                        style={{ width: `${(level.score / 10) * 100}%` }}
                      />
                    </div>
                    <span className={`text-xs shrink-0 ${highlight ? 'font-semibold text-[#20808D]' : 'text-muted-foreground'}`}>
                      {level.score.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0">n={level.n}</span>
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Votre score global : <span className="font-semibold text-[#20808D]">{globalScore.toFixed(2)}/10</span>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Section 6 : Athlètes qui me ressemblent */}
      {profile.celebrity_examples.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Athlètes qui vous ressemblent</CardTitle>
          </CardHeader>
          <CardContent>
            <CelebrityExamplesList
              celebrities={profile.celebrity_examples}
              profileColor={profile.color}
            />
          </CardContent>
        </Card>
      )}

      {/* Section 7 : Insights personnalisés */}
      {clientInsights.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[#1A1A2E] mb-3">Insights personnalisés</h3>
          <div className="space-y-2">
            {clientInsights.map((insight) => (
              <ConditionalInsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        </div>
      )}

      {/* Section 8 : Recommandations */}
      {profile.recommendations && (
        <Card style={{ backgroundColor: bgColor }}>
          <CardHeader>
            <CardTitle className="text-sm" style={{ color: profile.color }}>
              Recommandations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-[#1A1A2E] leading-relaxed">{profile.recommendations}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
