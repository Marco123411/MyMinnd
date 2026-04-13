'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { DashboardChartData } from '@/types'

const TIER_COLORS: Record<string, string> = {
  Gratuit: '#94a3b8',
  Pro: '#7069F4',
  Expert: '#FF9F40',
}

interface Props {
  charts: DashboardChartData
}

export function AdminDashboardCharts({ charts }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* MRR sur 6 mois */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Évolution MRR — 6 derniers mois
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={charts.mrrEvolution} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} unit=" €" />
              <Tooltip formatter={(v) => [`${v} €`, 'MRR']} />
              <Line
                type="monotone"
                dataKey="mrr"
                stroke="#7069F4"
                strokeWidth={2}
                dot={{ r: 4, fill: '#7069F4' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Répartition par tier */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Abonnés par tier
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={charts.tierDistribution}
                dataKey="count"
                nameKey="tier"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
              >
                {charts.tierDistribution.map((entry) => (
                  <Cell key={entry.tier} fill={TIER_COLORS[entry.tier] ?? '#ccc'} />
                ))}
              </Pie>
              <Tooltip formatter={(v, name) => [v, name]} />
              <Legend iconType="circle" iconSize={10} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tests par type sur 30 jours */}
      <Card className="lg:col-span-3">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Tests complétés par type — 30 derniers jours
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={charts.testsByDay.filter((_, i) => i % 2 === 0)}
              margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={4} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Legend iconType="square" iconSize={10} />
              <Bar dataKey="profilage" name="Profilage" stackId="a" fill="#7069F4" />
              <Bar dataKey="cognitif" name="Cognitif" stackId="a" fill="#3C3CD6" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
