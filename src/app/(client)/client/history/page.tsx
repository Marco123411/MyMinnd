import { getClientHistory } from '@/app/actions/client-data'
import { HistoryClient } from './HistoryClient'

export default async function HistoryPage() {
  const data = await getClientHistory()

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-[#1A1A2E]">Mon historique</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Suivez votre progression dans le temps
        </p>
      </div>

      <HistoryClient data={data} />
    </div>
  )
}
