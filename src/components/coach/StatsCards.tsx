import { Card, CardContent } from '@/components/ui/card'
import { Users, Send, TrendingUp } from 'lucide-react'

interface StatsCardsProps {
  clientsActifs: number
  testsEnvoyesMois: number
  tauxCompletion: number
}

export function StatsCards({ clientsActifs, testsEnvoyesMois, tauxCompletion }: StatsCardsProps) {
  const stats = [
    {
      label: 'Clients actifs',
      value: clientsActifs,
      icon: Users,
      suffix: '',
    },
    {
      label: 'Tests ce mois',
      value: testsEnvoyesMois,
      icon: Send,
      suffix: '',
    },
    {
      label: 'Taux de complétion',
      value: tauxCompletion,
      icon: TrendingUp,
      suffix: '%',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E8F4F5]">
              <stat.icon className="h-5 w-5 text-[#20808D]" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="text-2xl font-bold text-[#1A1A2E]">
                {stat.value}
                {stat.suffix}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
