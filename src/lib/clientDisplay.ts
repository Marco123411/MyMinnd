import type { ClientContext } from '@/types'

export const CONTEXT_COLORS: Record<ClientContext, string> = {
  sport: 'bg-[#F1F0FE] text-[#7069F4]',
  corporate: 'bg-purple-100 text-[#3C3CD6]',
  wellbeing: 'bg-amber-100 text-[#FF9F40]',
  coaching: 'bg-orange-100 text-[#EC638B]',
}

export function getClientSubtitle(client: {
  context: ClientContext
  sport: string | null
  entreprise: string | null
}): string | null {
  if (client.context === 'sport') return client.sport
  if (client.context === 'corporate') return client.entreprise
  return null
}
