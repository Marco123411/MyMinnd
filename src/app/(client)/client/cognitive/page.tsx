import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getClientCognitiveSessions, getMyPendingCognitiveSessions } from '@/app/actions/cognitive-results'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Brain, CheckCircle2 } from 'lucide-react'
import { CognitiveEvolutionChart } from '@/components/cognitive/CognitiveEvolutionChart'
import { BenchmarkBadge } from '@/components/cognitive/BenchmarkBadge'
import type { CognitiveTestResult } from '@/types'
import type { CognitiveSessionWithDefinition } from '@/app/actions/cognitive-results'

// Helper : récupère la zone benchmark d'une métrique depuis la session la plus récente
function getBenchmarkZone(
  session: CognitiveSessionWithDefinition,
  metric: string
): 'elite' | 'average' | 'poor' | null {
  return session.benchmark_results?.find((r) => r.metric === metric)?.zone ?? null
}

// ── Badge de preset ───────────────────────────────────────────────────────────

function PresetBadge({ presetName, isValidated }: { presetName: string | null; isValidated: boolean | null }) {
  if (!presetName) return null
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
      {isValidated ? (
        <CheckCircle2 className="h-3 w-3 text-green-600" />
      ) : (
        <AlertTriangle className="h-3 w-3 text-amber-500" />
      )}
      Version : {presetName}
      {!isValidated && (
        <span className="text-amber-600">(non validé scientifiquement)</span>
      )}
    </div>
  )
}

// ── Interprétations textuelles ────────────────────────────────────────────────

function interpretPVT(metrics: CognitiveTestResult): { label: string; color: string; detail: string } {
  const rt = metrics.median_rt
  const lapses = metrics.lapse_count ?? 0

  let label = '—'
  let color = 'bg-gray-100 text-gray-700'

  if (rt !== undefined) {
    if (rt < 250) { label = 'Excellente vigilance'; color = 'bg-[#F1F0FE] text-[#7069F4]' }
    else if (rt < 350) { label = 'Vigilance normale'; color = 'bg-amber-100 text-amber-700' }
    else if (rt < 500) { label = 'Vigilance réduite'; color = 'bg-orange-100 text-orange-700' }
    else { label = 'Fatigue importante détectée'; color = 'bg-red-100 text-red-700' }
  }

  const detail = lapses === 0
    ? 'Aucun lapse : attention soutenue excellente'
    : lapses <= 3
    ? `${lapses} lapse(s) : légère fatigue`
    : `${lapses} lapses : fatigue significative`

  return { label, color, detail }
}

function interpretStroop(metrics: CognitiveTestResult): { label: string; color: string } {
  const v = metrics.stroop_effect_rt
  if (v === undefined) return { label: '—', color: 'bg-gray-100 text-gray-700' }
  if (v < 50) return { label: 'Contrôle inhibiteur excellent', color: 'bg-[#F1F0FE] text-[#7069F4]' }
  if (v < 100) return { label: 'Contrôle inhibiteur normal', color: 'bg-amber-100 text-amber-700' }
  if (v < 150) return { label: 'Interférence modérée', color: 'bg-orange-100 text-orange-700' }
  return { label: 'Difficulté de contrôle inhibiteur', color: 'bg-red-100 text-red-700' }
}

function interpretSimon(metrics: CognitiveTestResult): { label: string; color: string } {
  const v = metrics.simon_effect_rt
  if (v === undefined) return { label: '—', color: 'bg-gray-100 text-gray-700' }
  if (v < 30) return { label: 'Traitement spatial excellent', color: 'bg-[#F1F0FE] text-[#7069F4]' }
  if (v < 60) return { label: 'Traitement spatial normal', color: 'bg-amber-100 text-amber-700' }
  if (v < 100) return { label: 'Interférence spatiale modérée', color: 'bg-orange-100 text-orange-700' }
  return { label: 'Interférence spatiale élevée', color: 'bg-red-100 text-red-700' }
}

function interpretSpan(metrics: CognitiveTestResult): { label: string; color: string } {
  const v = metrics.total_span
  if (v === undefined) return { label: '—', color: 'bg-gray-100 text-gray-700' }
  if (v >= 14) return { label: 'Mémoire de travail excellente', color: 'bg-[#F1F0FE] text-[#7069F4]' }
  if (v >= 10) return { label: 'Mémoire de travail dans la norme', color: 'bg-amber-100 text-amber-700' }
  if (v >= 7) return { label: 'Mémoire de travail à renforcer', color: 'bg-orange-100 text-orange-700' }
  return { label: 'Mémoire de travail faible', color: 'bg-red-100 text-red-700' }
}

// ── Carte de résultat par test ────────────────────────────────────────────────

function PVTCard({ sessions }: { sessions: CognitiveSessionWithDefinition[] }) {
  const last = sessions[0]
  const metrics = last.computed_metrics
  if (!metrics) return null

  const interp = interpretPVT(metrics)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          Temps de Réaction (PVT)
          <Badge className={interp.color}>{interp.label}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="text-3xl font-bold font-mono text-[#7069F4]">
            {metrics.median_rt !== undefined ? `${Math.round(metrics.median_rt)} ms` : '—'}
            <span className="text-sm font-normal text-muted-foreground ml-2">RT médian</span>
          </div>
          {getBenchmarkZone(last, 'median_rt') && (
            <BenchmarkBadge zone={getBenchmarkZone(last, 'median_rt')!} size="sm" />
          )}
        </div>
        <p className="text-xs text-muted-foreground">{interp.detail}</p>
        <PresetBadge presetName={last.preset_name} isValidated={last.is_preset_validated} />
        {sessions.length >= 2 && (
          <CognitiveEvolutionChart
            sessions={sessions}
            metricKey="median_rt"
            metricLabel="RT médian"
            unit="ms"
            lowerIsBetter
          />
        )}
      </CardContent>
    </Card>
  )
}

function StroopCard({ sessions }: { sessions: CognitiveSessionWithDefinition[] }) {
  const last = sessions[0]
  const metrics = last.computed_metrics
  if (!metrics) return null

  const interp = interpretStroop(metrics)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          Contrôle Inhibiteur (Stroop)
          <Badge className={interp.color}>{interp.label}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="text-3xl font-bold font-mono text-[#7069F4]">
            {metrics.stroop_effect_rt !== undefined ? `${Math.round(metrics.stroop_effect_rt)} ms` : '—'}
            <span className="text-sm font-normal text-muted-foreground ml-2">Effet Stroop</span>
          </div>
          {getBenchmarkZone(last, 'stroop_effect_rt') && (
            <BenchmarkBadge zone={getBenchmarkZone(last, 'stroop_effect_rt')!} size="sm" />
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Différence de RT entre conditions incongruentes et congruentes
        </p>
        <PresetBadge presetName={last.preset_name} isValidated={last.is_preset_validated} />
        {sessions.length >= 2 && (
          <CognitiveEvolutionChart
            sessions={sessions}
            metricKey="stroop_effect_rt"
            metricLabel="Effet Stroop"
            unit="ms"
            lowerIsBetter
          />
        )}
      </CardContent>
    </Card>
  )
}

function SimonCard({ sessions }: { sessions: CognitiveSessionWithDefinition[] }) {
  const last = sessions[0]
  const metrics = last.computed_metrics
  if (!metrics) return null

  const interp = interpretSimon(metrics)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          Interférence Spatiale (Simon)
          <Badge className={interp.color}>{interp.label}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="text-3xl font-bold font-mono text-[#7069F4]">
            {metrics.simon_effect_rt !== undefined ? `${Math.round(metrics.simon_effect_rt)} ms` : '—'}
            <span className="text-sm font-normal text-muted-foreground ml-2">Effet Simon</span>
          </div>
          {getBenchmarkZone(last, 'simon_effect_rt') && (
            <BenchmarkBadge zone={getBenchmarkZone(last, 'simon_effect_rt')!} size="sm" />
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Différence de RT entre positions incongruentes et congruentes
        </p>
        <PresetBadge presetName={last.preset_name} isValidated={last.is_preset_validated} />
        {sessions.length >= 2 && (
          <CognitiveEvolutionChart
            sessions={sessions}
            metricKey="simon_effect_rt"
            metricLabel="Effet Simon"
            unit="ms"
            lowerIsBetter
          />
        )}
      </CardContent>
    </Card>
  )
}

function DigitalSpanCard({ sessions }: { sessions: CognitiveSessionWithDefinition[] }) {
  const last = sessions[0]
  const metrics = last.computed_metrics
  if (!metrics) return null

  const interp = interpretSpan(metrics)

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          Mémoire de Travail (Digital Span)
          <Badge className={interp.color}>{interp.label}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="text-3xl font-bold font-mono text-[#7069F4]">
            {metrics.total_span !== undefined ? `${metrics.total_span} chiffres` : '—'}
            <span className="text-sm font-normal text-muted-foreground ml-2">Span total</span>
          </div>
          {getBenchmarkZone(last, 'total_span') && (
            <BenchmarkBadge zone={getBenchmarkZone(last, 'total_span')!} size="sm" />
          )}
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Avant : </span>
            <span className="font-medium">{metrics.span_forward ?? '—'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Arrière : </span>
            <span className="font-medium">{metrics.span_backward ?? '—'}</span>
          </div>
        </div>
        <PresetBadge presetName={last.preset_name} isValidated={last.is_preset_validated} />
        {sessions.length >= 2 && (
          <CognitiveEvolutionChart
            sessions={sessions}
            metricKey="total_span"
            metricLabel="Span total"
            unit="chiffres"
            lowerIsBetter={false}
          />
        )}
      </CardContent>
    </Card>
  )
}

// ── Page principale ───────────────────────────────────────────────────────────

// F15: suppression du double getUser() — getClientCognitiveSessions vérifie l'auth en interne
export default async function ClientCognitivePage() {
  const [{ data: sessions, error }, { data: pendingSessions }] = await Promise.all([
    getClientCognitiveSessions(),
    getMyPendingCognitiveSessions(),
  ])
  if (error === 'Non authentifié') redirect('/login')

  // Grouper par slug de test
  const bySlug = sessions.reduce<Record<string, CognitiveSessionWithDefinition[]>>(
    (acc, s) => {
      if (!acc[s.test_slug]) acc[s.test_slug] = []
      acc[s.test_slug].push(s)
      return acc
    },
    {}
  )

  const hasSessions = sessions.length > 0

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center gap-2">
        <Brain className="h-5 w-5 text-[#7069F4]" />
        <h1 className="text-xl font-bold text-[#141325]">Mes résultats cognitifs</h1>
      </div>

      {/* Tests assignés par le coach, non encore complétés */}
      {(pendingSessions ?? []).length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Tests à faire
          </h2>
          {(pendingSessions ?? []).map((s) => (
            <Link key={s.id} href={`/test/cognitive/${s.test_slug}`}>
              <Card className="border-[#7069F4]/40 hover:border-[#7069F4] hover:bg-[#F1F0FE]/30 transition-colors cursor-pointer">
                <CardContent className="pt-4 pb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm text-[#141325]">{s.test_name}</p>
                    {s.preset_name && (
                      <p className="text-xs text-muted-foreground mt-0.5">{s.preset_name}</p>
                    )}
                  </div>
                  <Badge className="bg-[#7069F4] text-white shrink-0">
                    {s.status === 'in_progress' ? 'Continuer' : 'Commencer'}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {!hasSessions ? (
        <Card>
          <CardContent className="py-12 text-center space-y-3">
            <Brain className="h-12 w-12 text-[#7069F4] mx-auto opacity-40" />
            <p className="font-medium text-[#141325]">Aucun test cognitif passé</p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Votre coach vous enverra un lien pour commencer vos évaluations cognitives.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {bySlug['pvt'] && <PVTCard sessions={bySlug['pvt']} />}
          {bySlug['stroop'] && <StroopCard sessions={bySlug['stroop']} />}
          {bySlug['simon'] && <SimonCard sessions={bySlug['simon']} />}
          {bySlug['digital_span'] && <DigitalSpanCard sessions={bySlug['digital_span']} />}
        </div>
      )}
    </div>
  )
}
