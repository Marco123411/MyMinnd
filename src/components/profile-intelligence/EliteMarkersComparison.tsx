import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { EliteMarker, ScoreByLevel } from '@/types'

interface EliteMarkersComparisonProps {
  eliteMarkers: EliteMarker[]
  scoresBySlug: Record<string, number>
  scoresByLevel: ScoreByLevel[]
}

// Calcule les repères départemental et international pour un marqueur
// Les niveaux globaux sont Dép=6.31, Int=6.75 ; le delta indique l'écart moyen
// On centre autour de la moyenne nationale (6.55) ± delta/2 comme approximation
function getMarkerBounds(delta: number) {
  const baseline = 6.55
  const dep = Math.max(1, parseFloat((baseline - delta / 2).toFixed(2)))
  const intl = Math.min(10, parseFloat((baseline + delta / 2).toFixed(2)))
  return { dep, intl }
}

export function EliteMarkersComparison({
  eliteMarkers,
  scoresBySlug,
  scoresByLevel,
}: EliteMarkersComparisonProps) {
  const depLevel = scoresByLevel.find((l) => l.level === 'Départemental')
  const intlLevel = scoresByLevel.find((l) => l.level === 'International')

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Marqueurs de l&apos;athlète de haut niveau</CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Les 6 sous-compétences qui distinguent le plus les athlètes
          {depLevel && intlLevel
            ? ` Départementaux (${depLevel.score}) des Internationaux (${intlLevel.score})`
            : ' départementaux des internationaux'}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {eliteMarkers.map((marker) => {
          const clientScore = scoresBySlug[marker.sub_slug] ?? null
          const { dep, intl } = getMarkerBounds(marker.delta)

          // Position en % sur une échelle 0-10
          const depPct = (dep / 10) * 100
          const intlPct = (intl / 10) * 100
          const clientPct = clientScore !== null ? (clientScore / 10) * 100 : null

          const isAboveIntl = clientScore !== null && clientScore >= intl
          const isBelowDep = clientScore !== null && clientScore < dep

          return (
            <div key={marker.sub_slug}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-[#141325]">{marker.label}</span>
                {clientScore !== null && (
                  <span
                    className={`text-xs font-semibold ${
                      isAboveIntl ? 'text-[#7069F4]' : isBelowDep ? 'text-orange-600' : 'text-[#141325]'
                    }`}
                  >
                    {clientScore.toFixed(1)}/10
                  </span>
                )}
              </div>

              {/* Barre avec repères */}
              <div className="relative h-3 w-full rounded-full bg-gray-100">
                {/* Zone Dép → Int (fond coloré) */}
                <div
                  className="absolute h-3 rounded-full bg-[#F1F0FE]"
                  style={{
                    left: `${depPct}%`,
                    width: `${intlPct - depPct}%`,
                  }}
                />

                {/* Repère Départemental */}
                <div
                  className="absolute top-0 h-3 w-0.5 bg-gray-400"
                  style={{ left: `${depPct}%` }}
                  title={`Moy. Dép.: ${dep}`}
                />

                {/* Repère International */}
                <div
                  className="absolute top-0 h-3 w-0.5 bg-[#7069F4]"
                  style={{ left: `${intlPct}%` }}
                  title={`Moy. Int.: ${intl}`}
                />

                {/* Score du client */}
                {clientPct !== null && (
                  <div
                    className={`absolute top-0.5 h-2 w-2 rounded-full -translate-x-1/2 ${
                      isAboveIntl
                        ? 'bg-[#7069F4]'
                        : isBelowDep
                        ? 'bg-orange-500'
                        : 'bg-[#FF9F40]'
                    }`}
                    style={{ left: `${clientPct}%` }}
                  />
                )}
              </div>

              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-muted-foreground">Dép. ~{dep.toFixed(1)}</span>
                <span className="text-[10px] text-muted-foreground">Int. ~{intl.toFixed(1)}</span>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
