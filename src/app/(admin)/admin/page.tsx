import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getAdminDashboardStatsAction, getAdminDashboardChartsAction } from '@/app/actions/admin'
import { AdminDashboardCharts } from './AdminDashboardCharts'

export default async function AdminPage() {
  const [statsResult, chartsResult] = await Promise.all([
    getAdminDashboardStatsAction(),
    getAdminDashboardChartsAction(),
  ])

  const stats = statsResult.data
  const charts = chartsResult.data

  const mrrEur = stats ? (stats.mrr_this_month / 100).toFixed(0) : '0'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#141325]">Dashboard Admin</h1>
        <p className="text-muted-foreground">Vue d&apos;ensemble de la plateforme MINND</p>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tests aujourd&apos;hui
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#7069F4]">
              {stats?.tests_today_profilage ?? 0}
            </p>
            <p className="text-xs text-muted-foreground mt-1">profilage</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              MRR ce mois
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#FF9F40]">{mrrEur} €</p>
            <p className="text-xs text-muted-foreground mt-1">abonnements actifs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Inscriptions cette semaine
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#141325]">
              {stats?.signups_this_week ?? 0}
            </p>
            <p className="text-xs text-muted-foreground mt-1">nouveaux utilisateurs</p>
          </CardContent>
        </Card>
      </div>

      {/* Graphiques */}
      {charts && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-[#141325]">Graphiques</h2>
          <AdminDashboardCharts charts={charts} />
        </div>
      )}
    </div>
  )
}
