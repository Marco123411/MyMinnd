import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { getDispatchesAction } from '@/app/actions/dispatches'
import { getAdminDashboardStatsAction, getAdminDashboardChartsAction } from '@/app/actions/admin'
import { AdminDashboardCharts } from './AdminDashboardCharts'
import type { DispatchStatus } from '@/types'

function formatElapsed(isoDate: string): string {
  const ms = Date.now() - new Date(isoDate).getTime()
  const minutes = Math.max(0, Math.floor(ms / 60000))
  if (minutes < 60) return `${minutes}min`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`
}

const STATUS_LABELS: Record<DispatchStatus, string> = {
  nouveau: 'Nouveau',
  en_cours: 'En cours',
  dispatche: 'Dispatché',
  accepte: 'Accepté',
  en_session: 'En session',
  termine: 'Terminé',
  annule: 'Annulé',
}

const STATUS_VARIANTS: Record<DispatchStatus, string> = {
  nouveau: 'bg-[#20808D] text-white',
  en_cours: 'bg-blue-500 text-white',
  dispatche: 'bg-[#FFC553] text-[#1A1A2E]',
  accepte: 'bg-green-500 text-white',
  en_session: 'bg-purple-500 text-white',
  termine: 'bg-gray-400 text-white',
  annule: 'bg-red-500 text-white',
}

export default async function AdminPage() {
  const [statsResult, chartsResult, recentResult] = await Promise.all([
    getAdminDashboardStatsAction(),
    getAdminDashboardChartsAction(),
    getDispatchesAction(),
  ])

  const stats = statsResult.data
  const charts = chartsResult.data
  const recent = (recentResult.data ?? [])
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 5)

  const mrrEur = stats ? (stats.mrr_this_month / 100).toFixed(0) : '0'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#1A1A2E]">Dashboard Admin</h1>
        <p className="text-muted-foreground">Vue d&apos;ensemble de la plateforme MINND</p>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tests aujourd&apos;hui
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#20808D]">
              {(stats?.tests_today_profilage ?? 0) + (stats?.tests_today_cognitif ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.tests_today_profilage ?? 0} profilage · {stats?.tests_today_cognitif ?? 0} cognitif
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              MRR ce mois
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#FFC553]">{mrrEur} €</p>
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
            <p className="text-3xl font-bold text-[#1A1A2E]">
              {stats?.signups_this_week ?? 0}
            </p>
            <p className="text-xs text-muted-foreground mt-1">nouveaux utilisateurs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Dispatches en attente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-500">
              {stats?.dispatches_pending ?? 0}
            </p>
            <p className="text-xs text-muted-foreground mt-1">missions à dispatcher</p>
          </CardContent>
        </Card>
      </div>

      {/* Alertes */}
      {stats && (stats.alert_pending_2h > 0 || stats.alert_expert_4h > 0) && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-[#1A1A2E]">Alertes</h2>

          {stats.alert_pending_2h > 0 && (
            <div className="flex items-center justify-between rounded-lg border border-[#FFC553] bg-[#FFC553]/10 px-4 py-3">
              <div>
                <p className="font-medium text-[#1A1A2E]">
                  {stats.alert_pending_2h} dispatch{stats.alert_pending_2h > 1 ? 'es' : ''} en attente depuis plus de 2h
                </p>
                <p className="text-sm text-muted-foreground">
                  Ces clients attendent un expert depuis trop longtemps
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href="/admin/dispatch">Voir la file</Link>
              </Button>
            </div>
          )}

          {stats.alert_expert_4h > 0 && (
            <div className="flex items-center justify-between rounded-lg border border-red-300 bg-red-50 px-4 py-3">
              <div>
                <p className="font-medium text-red-700">
                  {stats.alert_expert_4h} expert{stats.alert_expert_4h > 1 ? 's' : ''} n&apos;ont pas répondu depuis plus de 4h
                </p>
                <p className="text-sm text-red-600">
                  Ces missions nécessitent un reassignement
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href="/admin/dispatch">Reassigner</Link>
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Graphiques */}
      {charts && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-[#1A1A2E]">Graphiques</h2>
          <AdminDashboardCharts charts={charts} />
        </div>
      )}

      {/* Dernières activités */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#1A1A2E]">Dernières activités</h2>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/dispatch">Voir tout</Link>
          </Button>
        </div>

        {recent.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Aucun dispatch pour le moment
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {recent.map((d) => {
              const clientName = `${d.client_prenom ?? ''} ${d.client_nom}`.trim()
              const expertName = d.expert_nom
                ? `${d.expert_prenom ?? ''} ${d.expert_nom}`.trim()
                : null

              return (
                <Link key={d.id} href={`/admin/dispatch/${d.id}`}>
                  <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 hover:bg-accent transition-colors">
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="font-medium text-sm">{clientName}</p>
                        <p className="text-xs text-muted-foreground">
                          {d.client_context ?? '—'}
                          {expertName ? ` · Expert : ${expertName}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        {formatElapsed(d.updated_at)}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_VARIANTS[d.status]}`}
                      >
                        {STATUS_LABELS[d.status]}
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
