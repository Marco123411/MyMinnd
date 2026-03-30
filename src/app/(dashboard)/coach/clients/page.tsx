import { getClientsAction } from '@/app/actions/clients'
import { ClientsPageClient } from './ClientsPageClient'

export default async function ClientsPage() {
  const { data: clients } = await getClientsAction()

  return <ClientsPageClient initialClients={clients} />
}
