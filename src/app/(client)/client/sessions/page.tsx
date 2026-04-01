import { getMyAutonomousSessionsAction, getMyRecurringTemplatesAction } from '@/app/actions/sessions'
import { ClientSessionsClient } from './ClientSessionsClient'

export default async function ClientSessionsPage() {
  const [autonomousResult, templatesResult] = await Promise.all([
    getMyAutonomousSessionsAction(),
    getMyRecurringTemplatesAction(),
  ])

  return (
    <ClientSessionsClient
      autonomousSessions={autonomousResult.data}
      templates={templatesResult.data}
    />
  )
}
