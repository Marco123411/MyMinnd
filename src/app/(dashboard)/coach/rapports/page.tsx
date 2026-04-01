import { getCoachReportsSummary, getCoachAlerts, getCoachPendingTests } from '@/app/actions/reports'
import RapportsPageClient from './RapportsPageClient'

export default async function RapportsPage() {
  // Chargement parallèle des données — pas de dépendance entre les 3 actions
  const [summaryResult, alertsResult, pendingResult] = await Promise.all([
    getCoachReportsSummary(),
    getCoachAlerts(),
    getCoachPendingTests(),
  ])

  const error = summaryResult.error ?? alertsResult.error ?? pendingResult.error

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1A1A2E]">Rapports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Vue transversale sur tous vos clients et leurs résultats
        </p>
      </div>

      {error ? (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
          Erreur lors du chargement des données : {error}
        </div>
      ) : (
        <RapportsPageClient
          reports={summaryResult.data ?? []}
          alerts={alertsResult.data ?? { inactifs: 0, pendingOld: 0, pdfMissing: 0 }}
          pendingTests={pendingResult.data ?? []}
        />
      )}
    </div>
  )
}
