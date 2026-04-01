import {
  getCabinetSessionsAction,
  getAutonomousSessionsAction,
  getRecurringTemplatesAction,
  getSessionsObservanceMetrics,
  getClientsForSelectAction,
} from '@/app/actions/sessions'
import { getExercisesAction } from '@/app/actions/exercises'
import { SessionsPageClient } from './SessionsPageClient'

export default async function SessionsPage() {
  const [
    cabinetResult,
    autonomousResult,
    templatesResult,
    metricsResult,
    clientsResult,
    exercisesResult,
  ] = await Promise.all([
    getCabinetSessionsAction(),
    getAutonomousSessionsAction(),
    getRecurringTemplatesAction(),
    getSessionsObservanceMetrics(),
    getClientsForSelectAction(),
    getExercisesAction(),
  ])

  return (
    <SessionsPageClient
      cabinetUpcoming={cabinetResult.upcoming}
      cabinetPast={cabinetResult.past}
      autonomousSessions={autonomousResult.data}
      templates={templatesResult.data}
      metrics={metricsResult.data}
      clients={clientsResult.data}
      exercises={exercisesResult.data ?? []}
    />
  )
}
