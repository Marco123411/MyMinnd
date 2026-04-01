import { ClientNav } from './ClientNav'
import { getClientNavVisibility } from '@/app/actions/client-data'

export async function ClientNavWrapper() {
  const visibility = await getClientNavVisibility()
  return <ClientNav visibility={visibility} />
}
