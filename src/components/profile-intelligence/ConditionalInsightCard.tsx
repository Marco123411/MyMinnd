import { Lightbulb } from 'lucide-react'
import type { ActiveInsight } from '@/types'

interface ConditionalInsightCardProps {
  insight: ActiveInsight
}

export function ConditionalInsightCard({ insight }: ConditionalInsightCardProps) {
  return (
    <div className="rounded-lg border-l-4 border-[#20808D] bg-[#E8F4F5] px-4 py-3">
      <div className="flex items-start gap-2">
        <Lightbulb className="h-4 w-4 mt-0.5 shrink-0 text-[#20808D]" />
        <div>
          <p className="text-sm font-semibold text-[#1A1A2E] mb-1">{insight.title}</p>
          <p className="text-sm text-[#1A1A2E]/80 leading-relaxed">{insight.text}</p>
        </div>
      </div>
    </div>
  )
}
