import { getMyAutonomousSessionsAction, getMyRecurringTemplatesAction, getMyCabinetSessionsAction } from '@/app/actions/sessions'
import { ClientSessionsClient } from './ClientSessionsClient'

export default async function ClientSessionsPage() {
  const [autonomousResult, templatesResult, cabinetResult] = await Promise.all([
    getMyAutonomousSessionsAction(),
    getMyRecurringTemplatesAction(),
    getMyCabinetSessionsAction(),
  ])

  return (
    <ClientSessionsClient
      autonomousSessions={autonomousResult.data}
      templates={templatesResult.data}
      cabinetSessions={cabinetResult.data ?? []}
    />
  )
}
