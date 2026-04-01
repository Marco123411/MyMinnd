import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCognitiveSessionWithDefinitionAction } from '@/app/actions/cognitive'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { CognitiveTestResult } from '@/types'

interface PageProps {
  params: Promise<{ slug: string; sessionId: string }>
}

// Affiche une valeur numérique arrondie ou "—" si absente
function MetricCard({
  label,
  value,
  unit,
}: {
  label: string
  value: number | undefined
  unit: string
}) {
  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader className="pb-1 pt-4 px-4">
        <CardTitle className="text-xs text-gray-500 font-normal uppercase tracking-wide">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-white font-mono">
            {value !== undefined ? Math.round(value) : '—'}
          </span>
          <span className="text-sm text-gray-500">{unit}</span>
        </div>
      </CardContent>
    </Card>
  )
}

export default async function CognitiveResultsPage({ params }: PageProps) {
  const { slug, sessionId } = await params

  // Vérifier que l'utilisateur est connecté
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data, error } = await getCognitiveSessionWithDefinitionAction(sessionId)
  if (error || !data) notFound()

  const { session, definition } = data

  // La session doit être terminée
  if (session.status !== 'completed') {
    redirect(`/test/cognitive/${slug}/${sessionId}`)
  }

  const metrics = session.computed_metrics as CognitiveTestResult | null

  return (
    <div className="min-h-screen bg-gray-950 px-4 py-12">
      <div className="max-w-2xl mx-auto space-y-8">

        {/* En-tête */}
        <div className="text-center space-y-2">
          <Badge className="bg-green-900/40 text-green-400 border-green-800/40">
            Test terminé
          </Badge>
          <h1 className="text-2xl font-bold text-white font-display">
            {definition.name}
          </h1>
          <p className="text-gray-500 text-sm">
            Résultats de ta passation
          </p>
        </div>

        {/* Résultats ou état de chargement */}
        {metrics === null ? (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="py-10 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-[#20808D] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-gray-400">Résultats en cours de calcul…</p>
              <p className="text-xs text-gray-600">
                Les métriques seront disponibles dans quelques instants.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">

            {/* Métriques communes */}
            {(metrics.median_rt !== undefined || metrics.mean_rt !== undefined) && (
              <div>
                <p className="text-xs text-gray-600 uppercase tracking-wide mb-3">
                  Performance globale
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {metrics.median_rt !== undefined && (
                    <MetricCard label="RT médian" value={metrics.median_rt} unit="ms" />
                  )}
                  {metrics.mean_rt !== undefined && (
                    <MetricCard label="RT moyen" value={metrics.mean_rt} unit="ms" />
                  )}
                  {metrics.global_accuracy !== undefined && (
                    <MetricCard label="Précision" value={metrics.global_accuracy} unit="%" />
                  )}
                  {metrics.cv !== undefined && (
                    <MetricCard label="Variabilité (CV)" value={metrics.cv} unit="%" />
                  )}
                </div>
              </div>
            )}

            {/* Métriques PVT */}
            {slug === 'pvt' &&
              (metrics.lapse_count !== undefined || metrics.false_start_count !== undefined) && (
                <div>
                  <p className="text-xs text-gray-600 uppercase tracking-wide mb-3">
                    Vigilance
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {metrics.lapse_count !== undefined && (
                      <MetricCard label="Lapses (> 500ms)" value={metrics.lapse_count} unit="" />
                    )}
                    {metrics.false_start_count !== undefined && (
                      <MetricCard label="Anticipations" value={metrics.false_start_count} unit="" />
                    )}
                  </div>
                </div>
              )}

            {/* Métriques Stroop */}
            {slug === 'stroop' && metrics.stroop_effect_rt !== undefined && (
              <div>
                <p className="text-xs text-gray-600 uppercase tracking-wide mb-3">
                  Contrôle inhibiteur
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard
                    label="Effet Stroop"
                    value={metrics.stroop_effect_rt}
                    unit="ms"
                  />
                  {metrics.mean_rt_congruent !== undefined && (
                    <MetricCard
                      label="RT congruent"
                      value={metrics.mean_rt_congruent}
                      unit="ms"
                    />
                  )}
                  {metrics.mean_rt_incongruent !== undefined && (
                    <MetricCard
                      label="RT incongruent"
                      value={metrics.mean_rt_incongruent}
                      unit="ms"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Métriques Simon */}
            {slug === 'simon' && metrics.simon_effect_rt !== undefined && (
              <div>
                <p className="text-xs text-gray-600 uppercase tracking-wide mb-3">
                  Interférence spatiale
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <MetricCard label="Effet Simon" value={metrics.simon_effect_rt} unit="ms" />
                  {metrics.mean_rt_congruent !== undefined && (
                    <MetricCard
                      label="RT congruent"
                      value={metrics.mean_rt_congruent}
                      unit="ms"
                    />
                  )}
                  {metrics.mean_rt_incongruent !== undefined && (
                    <MetricCard
                      label="RT incongruent"
                      value={metrics.mean_rt_incongruent}
                      unit="ms"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Métriques Digital Span */}
            {slug === 'digital_span' &&
              (metrics.span_forward !== undefined || metrics.span_backward !== undefined) && (
                <div>
                  <p className="text-xs text-gray-600 uppercase tracking-wide mb-3">
                    Mémoire de travail
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {metrics.span_forward !== undefined && (
                      <MetricCard label="Empan avant" value={metrics.span_forward} unit="chiffres" />
                    )}
                    {metrics.span_backward !== undefined && (
                      <MetricCard
                        label="Empan arrière"
                        value={metrics.span_backward}
                        unit="chiffres"
                      />
                    )}
                  </div>
                </div>
              )}

            <p className="text-xs text-gray-600 text-center">
              L&apos;analyse détaillée et les percentiles sont disponibles dans ton espace client.
            </p>
          </div>
        )}

        {/* CTA */}
        <div className="flex flex-col gap-3">
          <Button
            asChild
            className="w-full bg-[#20808D] hover:bg-[#186870] text-white font-semibold h-12 rounded-xl"
          >
            <Link href="/client">Retour à l&apos;accueil</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
