import type { ClientContext } from '@/types'

export const CONTEXT_COLORS: Record<ClientContext, string> = {
  sport: 'bg-[#E8F4F5] text-[#20808D]',
  corporate: 'bg-purple-100 text-[#944454]',
  wellbeing: 'bg-amber-100 text-[#FFC553]',
  coaching: 'bg-orange-100 text-[#A84B2F]',
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
