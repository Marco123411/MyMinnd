import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { LeafZScore, ForceDetail } from '@/types'

interface ZScoreForcesFaiblessesProps {
  leafZScores: LeafZScore[]
  profileForces: ForceDetail[]
  profileFaiblesses: ForceDetail[]
}

// Largeur de barre en % à partir d'un z-score (plafonnée à 100%)
function barWidth(z: number): number {
  return Math.min(100, Math.abs(z) / 1.5 * 100)
}

export function ZScoreForcesFaiblesses({
  leafZScores,
  profileForces,
  profileFaiblesses,
}: ZScoreForcesFaiblessesProps) {
  const sorted = [...leafZScores].sort((a, b) => b.z - a.z)
  const forces = sorted.slice(0, 5)
  const axes = sorted.slice(-5).reverse()

  const profileForceSlugs = new Set(profileForces.map((f) => f.sub_slug))
  const profileFaibleSlugs = new Set(profileFaiblesses.map((f) => f.sub_slug))

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {/* Forces identifiées */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-green-700">Forces identifiées</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {forces.map((leaf) => (
            <div key={leaf.nodeId}>
              <div className="flex items-center justify-between mb-1 gap-2">
                <span className="text-xs font-medium text-[#1A1A2E] truncate">{leaf.name}</span>
                <span className="text-xs font-semibold text-green-700 shrink-0">
                  z=+{leaf.z.toFixed(2)}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-green-100">
                <div
                  className="h-1.5 rounded-full bg-green-500 transition-all"
                  style={{ width: `${barWidth(leaf.z)}%` }}
                />
              </div>
              {profileForceSlugs.has(leaf.sub_slug) && (
                <p className="text-[10px] text-green-600 mt-0.5">Force typique du profil</p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Axes de travail */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-orange-700">Axes de travail</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {axes.map((leaf) => (
            <div key={leaf.nodeId}>
              <div className="flex items-center justify-between mb-1 gap-2">
                <span className="text-xs font-medium text-[#1A1A2E] truncate">{leaf.name}</span>
                <span className="text-xs font-semibold text-orange-700 shrink-0">
                  z={leaf.z.toFixed(2)}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-orange-100">
                <div
                  className="h-1.5 rounded-full bg-orange-500 transition-all"
                  style={{ width: `${barWidth(leaf.z)}%` }}
                />
              </div>
              {profileFaibleSlugs.has(leaf.sub_slug) && (
                <p className="text-[10px] text-orange-600 mt-0.5">Axe typique du profil</p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
