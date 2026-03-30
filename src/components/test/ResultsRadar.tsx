import { RadarChart } from '@/components/ui/radar-chart'

interface Domain {
  name: string
  score: number
}

interface ResultsRadarProps {
  domains: Domain[]
  height?: number
  className?: string
}

export function ResultsRadar({ domains, height = 300, className }: ResultsRadarProps) {
  const data = domains.map((d) => ({
    subject: d.name,
    value: Math.round(d.score * 10) / 10,
    fullMark: 10,
  }))

  return <RadarChart data={data} height={height} className={className} />
}
