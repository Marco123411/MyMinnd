import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getDispatchAction, getAvailableExpertsAction } from '@/app/actions/dispatches'
import { createAdminClient } from '@/lib/supabase/server'
import { DispatchAdminClient } from './DispatchAdminClient'
import type { DispatchStatus } from '@/types'

interface Props {
  params: Promise<{ id: string }>
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
  nouveau: 'bg-[#7069F4]',
  en_cours: 'bg-blue-500',
  dispatche: 'bg-[#FF9F40]',
  accepte: 'bg-green-500',
  en_session: 'bg-purple-500',
  termine: 'bg-gray-400',
  annule: 'bg-red-500',
}

export default async function AdminDispatchDetailPage({ params }: Props) {
  const { id } = await params

  const [dispatchResult, expertsResult] = await Promise.all([
    getDispatchAction(id),
    getAvailableExpertsAction(),
  ])

  if (!dispatchResult.data) notFound()

  const dispatch = dispatchResult.data
  const experts = expertsResult.data

  // Fetch test domain scores for display
  const admin = createAdminClient()
  const { data: testScores } = await admin
    .from('test_scores')
    .select('score, percentile, competency_tree ( name, depth )')
    .eq('test_id', dispatch.test_id)
    .eq('entity_type', 'competency_node')

  const domainScores = (testScores ?? []).filter((s) => {
    const node = s.competency_tree as unknown as { name: string; depth: number } | null
    return node && node.depth === 1
  })

  const clientName = `${dispatch.client_prenom ?? ''} ${dispatch.client_nom}`.trim()
  const expertName = dispatch.expert_nom
    ? `${dispatch.expert_prenom ?? ''} ${dispatch.expert_nom}`.trim()
    : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#141325]">{clientName}</h1>
          <p className="text-muted-foreground">Dispatch Level 3 · {dispatch.id.slice(0, 8)}...</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-medium text-white ${STATUS_COLORS[dispatch.status]}`}
        >
          {STATUS_LABELS[dispatch.status]}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Colonne gauche : infos client + test */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Profil client</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="capitalize">
                  {dispatch.client_context ?? '—'}
                </Badge>
                {dispatch.client_sport && (
                  <Badge variant="outline">{dispatch.client_sport}</Badge>
                )}
              </div>

              {dispatch.test_score_global !== null && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Score global</p>
                  <p className="text-4xl font-bold text-[#7069F4]">
                    {dispatch.test_score_global.toFixed(1)}
                    <span className="text-lg text-muted-foreground"> / 10</span>
                  </p>
                </div>
              )}

              {dispatch.test_profile_name && (
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: dispatch.test_profile_color ?? '#7069F4' }}
                  />
                  <span className="font-medium">{dispatch.test_profile_name}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scores par domaine */}
          {domainScores.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Scores par domaine</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {domainScores.map((s, i) => {
                  const node = s.competency_tree as unknown as { name: string; depth: number }
                  const score = typeof s.score === 'number' ? s.score : 0

                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{node.name}</span>
                        <span className="font-medium">{score.toFixed(1)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-[#7069F4]"
                          style={{ width: `${((score - 1) / 9) * 100}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}

          {expertName && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Expert assigné</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-medium">{expertName}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Colonne droite : gestion dispatch */}
        <DispatchAdminClient dispatch={dispatch} experts={experts} />
      </div>
    </div>
  )
}
