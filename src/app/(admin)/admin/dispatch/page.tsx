import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getDispatchesAction } from '@/app/actions/dispatches'
import type { DispatchWithDetails, DispatchStatus } from '@/types'

function formatElapsed(isoDate: string): string {
  const ms = Date.now() - new Date(isoDate).getTime()
  const minutes = Math.floor(ms / 60000)
  if (minutes < 60) return `${minutes}min`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
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

const STATUS_COLORS: Record<DispatchStatus, string> = {
  nouveau: 'bg-[#20808D] text-white',
  en_cours: 'bg-blue-500 text-white',
  dispatche: 'bg-[#FFC553] text-[#1A1A2E]',
  accepte: 'bg-green-500 text-white',
  en_session: 'bg-purple-500 text-white',
  termine: 'bg-gray-400 text-white',
  annule: 'bg-red-500 text-white',
}

function DispatchTable({ dispatches }: { dispatches: DispatchWithDetails[] }) {
  if (dispatches.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Aucun dispatch dans cette catégorie
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 border-b">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Client</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Context</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Demande</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Temps écoulé</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Statut</th>
            <th className="text-left px-4 py-3 font-medium text-muted-foreground">Expert</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {dispatches.map((d) => {
            const clientName = `${d.client_prenom ?? ''} ${d.client_nom}`.trim()
            const expertName = d.expert_nom
              ? `${d.expert_prenom ?? ''} ${d.expert_nom}`.trim()
              : '—'

            return (
              <tr key={d.id} className="bg-card hover:bg-accent/30 transition-colors">
                <td className="px-4 py-3 font-medium">{clientName}</td>
                <td className="px-4 py-3 text-muted-foreground capitalize">
                  {d.client_context ?? '—'}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatDate(d.created_at)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatElapsed(d.created_at)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[d.status]}`}
                  >
                    {STATUS_LABELS[d.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{expertName}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/dispatch/${d.id}`}
                    className="text-[#20808D] hover:underline text-xs font-medium"
                  >
                    Voir →
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default async function AdminDispatchPage() {
  const [pendingResult, activeResult, doneResult] = await Promise.all([
    getDispatchesAction('pending'),
    getDispatchesAction('active'),
    getDispatchesAction('done'),
  ])

  const pending = pendingResult.data
  const active = activeResult.data
  const done = doneResult.data

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#1A1A2E]">Dispatches Level 3</h1>
        <p className="text-muted-foreground">Gestion des missions experts</p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            En attente
            {pending.length > 0 && (
              <span className="ml-2 rounded-full bg-[#20808D] text-white text-xs px-1.5 py-0.5">
                {pending.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="active">
            En cours
            {active.length > 0 && (
              <span className="ml-2 rounded-full bg-blue-500 text-white text-xs px-1.5 py-0.5">
                {active.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="done">
            Terminés
            {done.length > 0 && (
              <span className="ml-2 rounded-full bg-gray-400 text-white text-xs px-1.5 py-0.5">
                {done.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          <DispatchTable dispatches={pending} />
        </TabsContent>

        <TabsContent value="active" className="mt-4">
          <DispatchTable dispatches={active} />
        </TabsContent>

        <TabsContent value="done" className="mt-4">
          <DispatchTable dispatches={done} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
