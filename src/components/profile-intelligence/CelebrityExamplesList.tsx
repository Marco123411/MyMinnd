'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { CelebrityExample } from '@/types'

interface CelebrityExamplesListProps {
  celebrities: CelebrityExample[]
  profileColor?: string
}

export function CelebrityExamplesList({ celebrities, profileColor = '#7069F4' }: CelebrityExamplesListProps) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (celebrities.length === 0) return null

  return (
    <div className="space-y-2">
      {celebrities.map((celebrity) => {
        const isOpen = expanded === celebrity.name
        return (
          <div
            key={celebrity.name}
            className="rounded-lg border bg-white overflow-hidden"
          >
            <button
              className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
              onClick={() => setExpanded(isOpen ? null : celebrity.name)}
            >
              <div className="flex items-center gap-2">
                {/* Avatar initiales */}
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: profileColor }}
                >
                  {celebrity.name.charAt(0)}
                </div>
                <span className="text-sm font-medium text-[#141325]">{celebrity.name}</span>
                <Badge variant="secondary" className="text-[10px] py-0">{celebrity.sport}</Badge>
              </div>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
            </button>
            {isOpen && (
              <div className="px-3 pb-3 pt-0">
                <p className="text-xs text-muted-foreground leading-relaxed pl-9">
                  {celebrity.reason}
                </p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
