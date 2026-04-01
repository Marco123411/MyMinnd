import { Badge } from '@/components/ui/badge'
import type { LeafZScore } from '@/types'

interface DomainGroup {
  id: string
  name: string
  domainScore: number
  leaves: LeafZScore[]
}

interface SubcompetenceDetailListProps {
  leafZScores: LeafZScore[]
  domainNodes: { id: string; name: string; score: number }[]
  nodeParentMap: Record<string, string> // nodeId → parentId
  nonDiscriminantSubs: string[]
  showZScores?: boolean // true pour le coach, false pour le client
}

// Couleur de la barre selon le percentile (même logique que SubcompetenceBar)
function getPercentileColor(percentile: number | null): string {
  if (percentile === null) return 'bg-[#FFC553]'
  if (percentile < 25) return 'bg-red-500'
  if (percentile < 50) return 'bg-orange-500'
  if (percentile < 75) return 'bg-green-500'
  return 'bg-[#20808D]'
}

export function SubcompetenceDetailList({
  leafZScores,
  domainNodes,
  nodeParentMap,
  nonDiscriminantSubs,
  showZScores = false,
}: SubcompetenceDetailListProps) {
  // Grouper les feuilles par domaine
  const groups: DomainGroup[] = domainNodes.map((domain) => ({
    id: domain.id,
    name: domain.name,
    domainScore: domain.score,
    leaves: leafZScores.filter((leaf) => nodeParentMap[leaf.nodeId] === domain.id),
  }))

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.id}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#1A1A2E]">{group.name}</h3>
            <span className="text-sm font-medium text-[#20808D]">
              {group.domainScore.toFixed(1)}/10
            </span>
          </div>

          <div className="space-y-2.5 pl-2">
            {group.leaves.map((leaf) => {
              const isNonDiscriminant = nonDiscriminantSubs.includes(leaf.sub_slug)
              const barColor = getPercentileColor(leaf.percentile)
              const widthPct = (leaf.score / 10) * 100

              return (
                <div key={leaf.nodeId}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs text-[#1A1A2E] truncate">{leaf.name}</span>
                      {isNonDiscriminant && (
                        <Badge
                          variant="secondary"
                          className="text-[9px] py-0 px-1.5 shrink-0"
                        >
                          trait personnel
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-medium text-[#1A1A2E]">
                        {leaf.score.toFixed(1)}/10
                      </span>
                      {leaf.percentile !== null && (
                        <span className="text-[10px] text-muted-foreground">
                          {leaf.percentile}e p.
                        </span>
                      )}
                      {showZScores && (
                        <span className={`text-[10px] font-medium ${leaf.z >= 0 ? 'text-green-600' : 'text-orange-600'}`}>
                          z={leaf.z >= 0 ? '+' : ''}{leaf.z.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="h-1.5 w-full rounded-full bg-gray-100">
                    <div
                      className={`h-1.5 rounded-full transition-all ${barColor}`}
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
