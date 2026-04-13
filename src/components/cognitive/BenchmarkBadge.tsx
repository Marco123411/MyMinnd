import { Star, TrendingDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface BenchmarkBadgeProps {
  zone: 'elite' | 'average' | 'poor'
  size?: 'sm' | 'md'
  context?: 'sport' | 'corporate' | 'wellbeing'
}

const labels: Record<'sport' | 'corporate' | 'wellbeing', Record<BenchmarkBadgeProps['zone'], string>> = {
  sport:     { elite: 'Élite',        average: 'Moyen',    poor: 'À développer' },
  corporate: { elite: 'Optimal',      average: 'Standard', poor: 'À améliorer'  },
  wellbeing: { elite: 'Excellent',    average: 'Normal',   poor: 'À renforcer'  },
}

const styles: Record<BenchmarkBadgeProps['zone'], string> = {
  elite:   'bg-[#20808D] text-white hover:bg-[#20808D]',
  average: 'bg-[#FFC553] text-black hover:bg-[#FFC553]',
  poor:    'bg-[#944454] text-white hover:bg-[#944454]',
}

export function BenchmarkBadge({
  zone,
  size = 'sm',
  context = 'sport',
}: BenchmarkBadgeProps) {
  const label = labels[context][zone]
  const iconSize = size === 'sm' ? 10 : 12
  const textClass = size === 'sm' ? 'text-[10px]' : 'text-xs'

  return (
    <Badge className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 font-medium border-0 ${styles[zone]} ${textClass}`}>
      {zone === 'elite' && <Star size={iconSize} className="fill-current" />}
      {zone === 'poor'  && <TrendingDown size={iconSize} />}
      {label}
    </Badge>
  )
}
