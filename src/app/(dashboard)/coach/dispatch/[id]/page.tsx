import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getDispatchAction } from '@/app/actions/dispatches'
import { createAdminClient } from '@/lib/supabase/server'
import { DispatchCoachClient } from './DispatchCoachClient'
import type { DispatchStatus } from '@/types'

interface Props {
  params: Promise<{ id: string }>
}

const STATUS_LABELS: Record<DispatchStatus, string> = {
  nouveau: 'Nouveau',
  en_cours: 'En cours',
  dispatche: 'Mission reçue',
  accepte: 'Acceptée — à contacter',
  en_session: 'En session',
  termine: 'Terminée',
  annule: 'Annulée',
}

export default async function CoachDispatchPage({ params }: Props) {
  const { id } = await params

  // getDispatchAction gère l'auth + la vérification expert_id assigné
  const { data: dispatch, error } = await getDispatchAction(id)
  if (!dispatch || error) notFound()

  const admin = createAdminClient()

  // Fetch données complémentaires en parallèle
  const [testScoresResult, clientAuthResult] = await Promise.all([
    admin
      .from('test_scores')
      .select('score, competency_tree ( name, depth )')
      .eq('test_id', dispatch.test_id)
      .eq('entity_type', 'competency_node'),
    admin.auth.admin.getUserById(dispatch.client_id),
  ])

  const domainScores = (testScoresResult.data ?? []).filter(
    (s) => {
      const node = s.competency_tree as unknown as { name: string; depth: number } | null
      return node && node.depth === 1
    }
  )

  const clientEmail = clientAuthResult.data?.user?.email ?? null
  const clientName = `${dispatch.client_prenom ?? ''} ${dispatch.client_nom}`.trim()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A2E]">Mission Expert</h1>
          <p className="text-muted-foreground">Demande Level 3</p>
        </div>
        <Badge
          className="text-sm"
          style={{ backgroundColor: '#20808D', color: 'white' }}
        >
          {STATUS_LABELS[dispatch.status]}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profil client */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Profil du client</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xl font-semibold">{clientName}</p>

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
                  <p className="text-4xl font-bold text-[#20808D]">
                    {dispatch.test_score_global.toFixed(1)}
                    <span className="text-lg text-muted-foreground"> / 10</span>
                  </p>
                </div>
              )}

              {dispatch.test_profile_name && (
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: dispatch.test_profile_color ?? '#20808D' }}
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
                <CardTitle className="text-base">Analyse par domaine</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {domainScores.map((s, i) => {
                  const node = s.competency_tree as unknown as { name: string; depth: number }
                  const score = typeof s.score === 'number' ? s.score : 0

                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{node.name}</span>
                        <span className="font-medium text-[#20808D]">
                          {score.toFixed(1)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-[#E8F4F5]">
                        <div
                          className="h-full rounded-full bg-[#20808D]"
                          style={{ width: `${((score - 1) / 9) * 100}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Actions expert */}
        <DispatchCoachClient dispatch={dispatch} clientEmail={clientEmail} />
      </div>
    </div>
  )
}
