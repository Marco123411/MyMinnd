import { Lightbulb } from 'lucide-react'
import type { ActiveInsight } from '@/types'

interface ConditionalInsightCardProps {
  insight: ActiveInsight
}

export function ConditionalInsightCard({ insight }: ConditionalInsightCardProps) {
  return (
    <div className="rounded-lg border-l-4 border-[#7069F4] bg-[#F1F0FE] px-4 py-3">
      <div className="flex items-start gap-2">
        <Lightbulb className="h-4 w-4 mt-0.5 shrink-0 text-[#7069F4]" />
        <div>
          <p className="text-sm font-semibold text-[#141325] mb-1">{insight.title}</p>
          <p className="text-sm text-[#141325]/80 leading-relaxed">{insight.text}</p>
        </div>
      </div>
    </div>
  )
}
