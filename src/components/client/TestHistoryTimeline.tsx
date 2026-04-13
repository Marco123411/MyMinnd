'use client'

import { useRouter } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { ScoreDisplay } from '@/components/ui/score-display'
import type { TestLevelSlug } from '@/types'

export interface TestHistoryItem {
  id: string
  completed_at: string
  level_slug: TestLevelSlug
  score_global: number | null
  definition_name: string
  profile_name: string | null
  profile_color: string | null
}

interface TestHistoryTimelineProps {
  tests: TestHistoryItem[]
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

const levelLabels: Record<TestLevelSlug, string> = {
  discovery: 'Discovery',
  complete: 'Complet',
  expert: 'Expert',
}

export function TestHistoryTimeline({ tests }: TestHistoryTimelineProps) {
  const router = useRouter()

  if (tests.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground py-8">
        Vous n&apos;avez pas encore passé de test.
      </p>
    )
  }

  return (
    <div className="space-y-0">
      {tests.map((test, i) => (
        <div key={test.id}>
          <button
            type="button"
            onClick={() => router.push(`/client/results/${test.id}`)}
            className="w-full flex items-center gap-3 py-4 text-left hover:bg-muted/50 transition-colors rounded-lg px-2"
          >
            {/* Indicateur timeline */}
            <div className="flex flex-col items-center self-stretch">
              <div
                className="h-3 w-3 rounded-full border-2 shrink-0 mt-1"
                style={{
                  borderColor: test.profile_color ?? '#7069F4',
                  backgroundColor: test.profile_color ? `${test.profile_color}33` : '#F1F0FE',
                }}
              />
              {i < tests.length - 1 && (
                <div className="w-0.5 flex-1 bg-border mt-1" />
              )}
            </div>

            {/* Contenu */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-foreground">{test.definition_name}</span>
                <span className="text-xs text-muted-foreground rounded-full border px-2 py-0.5">
                  {levelLabels[test.level_slug]}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{formatDate(test.completed_at)}</p>
              {test.profile_name && (
                <div className="flex items-center gap-1.5 mt-1">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: test.profile_color ?? '#7069F4' }}
                  />
                  <span className="text-xs text-muted-foreground">{test.profile_name}</span>
                </div>
              )}
            </div>

            {/* Score */}
            <div className="shrink-0 flex items-center gap-2">
              {test.score_global !== null ? (
                <ScoreDisplay score={test.score_global} size="sm" />
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </button>
        </div>
      ))}
    </div>
  )
}
