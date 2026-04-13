'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { TeammateCompatibility } from '@/types'

interface ProfileCompatibilityMiniProps {
  teammates: TeammateCompatibility[]
}

// Couleur du score de compatibilité (1-10)
function compatColor(score: number): string {
  if (score >= 7) return 'bg-[#F1F0FE] text-[#7069F4]'
  if (score >= 4) return 'bg-orange-100 text-orange-700'
  return 'bg-red-100 text-red-700'
}

export function ProfileCompatibilityMini({ teammates }: ProfileCompatibilityMiniProps) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (teammates.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Compatibilité d&apos;équipe</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {teammates.map((teammate) => {
          const isOpen = expanded === teammate.clientName
          return (
            <div key={teammate.clientName} className="rounded-lg border overflow-hidden">
              <button
                className="flex w-full items-center justify-between p-3 text-left hover:bg-gray-50 transition-colors"
                onClick={() => setExpanded(isOpen ? null : teammate.clientName)}
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white shrink-0"
                    style={{ backgroundColor: teammate.profileColor }}>
                    {teammate.clientName.charAt(0)}
                  </div>
                  <span className="text-sm font-medium text-[#141325]">{teammate.clientName}</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] py-0"
                    style={{ borderColor: teammate.profileColor, color: teammate.profileColor }}
                  >
                    {teammate.profileName}
                  </Badge>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${compatColor(teammate.score)}`}>
                  {teammate.score}/10
                </span>
              </button>

              {isOpen && (
                <div className="border-t bg-gray-50 px-3 py-2.5 space-y-1.5 text-xs text-[#141325]">
                  {teammate.synergie && (
                    <p><span className="font-semibold text-[#7069F4]">Synergie : </span>{teammate.synergie}</p>
                  )}
                  {teammate.friction && (
                    <p><span className="font-semibold text-orange-600">Friction : </span>{teammate.friction}</p>
                  )}
                  {teammate.conseil && (
                    <p><span className="font-semibold text-[#141325]">Conseil : </span>{teammate.conseil}</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
