'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { TestHistoryTimeline } from '@/components/client/TestHistoryTimeline'
import { Button } from '@/components/ui/button'
import type { ClientHistoryData } from '@/app/actions/client-data'

// Lazy-load heavy Recharts components — only needed conditionally
const LineChart = dynamic(
  () => import('@/components/client/LineChart').then((m) => ({ default: m.LineChart })),
  { ssr: false },
)
const ComparisonView = dynamic(
  () => import('@/components/client/ComparisonView').then((m) => ({ default: m.ComparisonView })),
  { ssr: false },
)

interface HistoryClientProps {
  data: ClientHistoryData
}

export function HistoryClient({ data }: HistoryClientProps) {
  const [openComparisonId, setOpenComparisonId] = useState<string | null>(null)

  return (
    <div className="space-y-8">
      {/* Timeline globale */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
          Tous les tests
        </h2>
        <TestHistoryTimeline tests={data.tests} />
      </section>

      {/* Évolution par type de test */}
      {data.byDefinition
        .filter((group) => group.tests.length >= 2)
        .map((group) => (
          <section key={group.definitionId} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Évolution — {group.definitionName}
              </h2>
              {group.comparisonData && openComparisonId !== group.definitionId && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-[#7069F4] text-[#7069F4] text-xs"
                  onClick={() => setOpenComparisonId(group.definitionId)}
                >
                  Comparer T1 / T2
                </Button>
              )}
            </div>

            {/* Graphique d'évolution */}
            {group.lineData.length >= 2 && (
              <LineChart data={group.lineData} />
            )}

            {/* Vue comparaison */}
            {group.comparisonData && openComparisonId === group.definitionId && (
              <ComparisonView
                t1={group.comparisonData.t1}
                t2={group.comparisonData.t2}
                onClose={() => setOpenComparisonId(null)}
              />
            )}
          </section>
        ))}
    </div>
  )
}
