'use client'

import { useState, useEffect, useTransition, Fragment } from 'react'
import dynamic from 'next/dynamic'
import { AlertTriangle, Brain, Copy, Check, ChevronDown, ChevronUp, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  createCognitiveInvitationAction,
  getCognitiveSessionTrials,
  type CognitiveSessionWithDefinition,
  type PendingCognitiveSession,
  type TrialForHistogram,
} from '@/app/actions/cognitive-results'
import { getAllCognitivePresetsAction } from '@/app/actions/presets'
import { PresetSelector } from '@/components/cognitive/PresetSelector'
import type { CognitiveTestPreset, CognitiveTestResult } from '@/types'

// Recharts — import dynamique pour éviter les erreurs SSR
const RTHistogram = dynamic(
  () => import('@/components/cognitive/RTHistogram').then((m) => m.RTHistogram),
  { ssr: false }
)
const CognitiveEvolutionChart = dynamic(
  () =>
    import('@/components/cognitive/CognitiveEvolutionChart').then(
      (m) => m.CognitiveEvolutionChart
    ),
  { ssr: false }
)

// Tests disponibles pour l'envoi (seuls les trial-based ont un histogramme RT)
const COGNITIVE_TESTS = [
  { slug: 'pvt', name: 'PVT — Vigilance', hasRT: true },
  { slug: 'stroop', name: 'Stroop — Contrôle inhibiteur', hasRT: true },
  { slug: 'simon', name: 'Simon — Interférence spatiale', hasRT: true },
  { slug: 'digital_span', name: 'Digital Span — Mémoire de travail', hasRT: false },
  { slug: 'go-nogo-visual', name: 'Go/No-Go Visuel — Inhibition', hasRT: true },
  { slug: 'flanker', name: 'Flanker — Attention sélective', hasRT: true },
  { slug: 'stop-signal', name: 'Stop Signal — Contrôle inhibiteur', hasRT: true },
  { slug: 'mackworth-clock', name: 'Mackworth Clock — Vigilance soutenue', hasRT: true },
  { slug: 'spatial-span', name: 'Spatial Span — Mémoire visuospatiale', hasRT: false },
  { slug: 'n-back-2', name: '2-Back — Mémoire de travail', hasRT: true },
  { slug: 'visual-choice-4', name: 'Choix Visuel 4 — Temps de réaction', hasRT: true },
  { slug: 'visual-search', name: 'Recherche Visuelle — Attention', hasRT: true },
]

// Slugs pour lesquels une valeur élevée est un meilleur résultat
const HIGHER_IS_BETTER_SLUGS = ['digital_span', 'go-nogo-visual', 'mackworth-clock', 'spatial-span', 'n-back-2']

// Métrique clé à afficher par test dans le tableau récapitulatif
function getKeyMetric(
  slug: string,
  metrics: CognitiveTestResult | null
): { label: string; value: number | undefined; unit: string } {
  if (!metrics) return { label: '—', value: undefined, unit: '' }
  switch (slug) {
    case 'pvt':             return { label: 'RT médian',      value: metrics.median_rt,         unit: 'ms' }
    case 'stroop':          return { label: 'Effet Stroop',   value: metrics.stroop_effect_rt,  unit: 'ms' }
    case 'simon':           return { label: 'Effet Simon',    value: metrics.simon_effect_rt,   unit: 'ms' }
    case 'digital_span':    return { label: 'Span total',     value: metrics.total_span,        unit: 'chiffres' }
    case 'go-nogo-visual':  return { label: 'Précision',      value: metrics.accuracy,          unit: '%' }
    case 'flanker':         return { label: 'Effet Flanker',  value: metrics.flanker_effect_rt, unit: 'ms' }
    case 'stop-signal':     return { label: 'SSRT',           value: metrics.ssrt,              unit: 'ms' }
    case 'mackworth-clock': return { label: 'Précision',      value: metrics.accuracy,          unit: '%' }
    case 'spatial-span':    return { label: 'Span max',       value: metrics.max_span,          unit: 'cases' }
    case 'n-back-2':        return { label: 'Précision nette',value: metrics.accuracy,          unit: '%' }
    case 'visual-choice-4': return { label: 'RT moyen',       value: metrics.mean_rt,           unit: 'ms' }
    case 'visual-search':   return { label: 'RT moyen',       value: metrics.mean_rt,           unit: 'ms' }
    default:                return { label: '—',              value: undefined,                 unit: '' }
  }
}

// Formate une date ISO en DD/MM/YYYY
function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Affiche toutes les métriques d'une session dans une grille
function MetricsGrid({ metrics, slug }: { metrics: CognitiveTestResult; slug: string }) {
  const entries = Object.entries(metrics).filter(([, v]) => typeof v === 'number')
  if (entries.length === 0) return null

  const labels: Record<string, string> = {
    median_rt: 'RT médian',
    mean_rt: 'RT moyen',
    mean_reciprocal_rt: '1/RT moyen',
    fastest_10pct_rt: 'RT 10% rapides',
    slowest_10pct_rt: 'RT 10% lents',
    lapse_count: 'Lapses',
    false_start_count: 'Anticipations',
    cv: 'CV (%)',
    mean_rt_congruent: 'RT congruent',
    mean_rt_incongruent: 'RT incongruent',
    stroop_effect_rt: 'Effet Stroop',
    accuracy_congruent: 'Précision cong.',
    accuracy_incongruent: 'Précision incong.',
    stroop_effect_accuracy: 'Effet précision',
    inverse_efficiency: 'Score IES',
    simon_effect_rt: 'Effet Simon',
    simon_effect_accuracy: 'Effet précision',
    span_forward: 'Empan avant',
    span_backward: 'Empan arrière',
    total_span: 'Span total',
    longest_sequence: 'Séquence max',
    global_accuracy: 'Précision globale',
    // Nouveaux drills
    accuracy: 'Précision',
    flanker_effect_rt: 'Effet Flanker',
    commission_errors: 'Erreurs commission',
    omission_errors: 'Erreurs omission',
    ssrt: 'SSRT',
    max_span: 'Span max',
    hit_rate: 'Taux détection',
    false_alarm_rate: 'Taux fausses alarmes',
    rcs: 'Régularité (RCS)',
    variation: 'Variation (CV)',
    speed: 'Score vitesse',
  }

  // Unités par métrique
  const units: Record<string, string> = {
    median_rt: 'ms', mean_rt: 'ms', mean_reciprocal_rt: 'ms',
    fastest_10pct_rt: 'ms', slowest_10pct_rt: 'ms', inverse_efficiency: 'ms',
    stroop_effect_rt: 'ms', simon_effect_rt: 'ms',
    mean_rt_congruent: 'ms', mean_rt_incongruent: 'ms',
    accuracy_congruent: '%', accuracy_incongruent: '%',
    stroop_effect_accuracy: '%', simon_effect_accuracy: '%', global_accuracy: '%',
    span_forward: 'chiff.', span_backward: 'chiff.', total_span: 'chiff.',
    longest_sequence: 'chiff.',
    // Nouveaux drills
    accuracy: '%', hit_rate: '%', false_alarm_rate: '%',
    flanker_effect_rt: 'ms', ssrt: 'ms',
    max_span: 'cases',
    variation: '%',
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {entries.map(([key, value]) => (
        <div key={key} className="rounded-lg bg-muted px-3 py-2">
          <p className="text-xs text-muted-foreground">{labels[key] ?? key}</p>
          <p className="text-sm font-semibold tabular-nums">
            {typeof value === 'number' ? Math.round(value * 10) / 10 : '—'}
            {units[key] ? <span className="text-xs font-normal text-muted-foreground ml-1">{units[key]}</span> : null}
          </p>
        </div>
      ))}
    </div>
  )
}

interface CognitiveTabProps {
  sessions: CognitiveSessionWithDefinition[]
  pendingSessions: PendingCognitiveSession[]
  clientId: string
  coachId: string
}

export function CognitiveTab({ sessions, pendingSessions, clientId }: CognitiveTabProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [trialsMap, setTrialsMap] = useState<Record<string, TrialForHistogram[]>>({})
  const [isPending, startTransition] = useTransition()

  // État modal d'envoi
  const [sendOpen, setSendOpen] = useState(false)
  const [selectedSlug, setSelectedSlug] = useState<string>('')
  const [selectedPresetId, setSelectedPresetId] = useState<string>('')
  // Tous les presets chargés une seule fois à l'ouverture du dialog (pas à chaque changement de slug)
  const [allPresets, setAllPresets] = useState<Record<string, CognitiveTestPreset[]>>({})
  const [presetsLoading, setPresetsLoading] = useState(false)
  const [sendLoading, setSendLoading] = useState(false)
  const [sendResult, setSendResult] = useState<{ url: string } | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const presetsForTest = allPresets[selectedSlug] ?? []

  // Charger tous les presets une seule fois à l'ouverture du dialog
  useEffect(() => {
    if (!sendOpen) return
    setPresetsLoading(true)
    getAllCognitivePresetsAction()
      .then(({ data }) => setAllPresets(data))
      .catch(() => { /* presets non disponibles — silencieux, non bloquant */ })
      .finally(() => setPresetsLoading(false))
  }, [sendOpen])

  // Réinitialiser le preset sélectionné quand le test change
  useEffect(() => {
    setSelectedPresetId('')
  }, [selectedSlug])

  // Grouper les sessions par (test_slug + preset_id) — les presets différents ne sont pas comparables
  const sessionsBySlugAndPreset = sessions.reduce<Record<string, CognitiveSessionWithDefinition[]>>(
    (acc, s) => {
      const key = `${s.test_slug}__${s.preset_id ?? 'default'}`
      if (!acc[key]) acc[key] = []
      acc[key].push(s)
      return acc
    },
    {}
  )

  // Grouper par test slug (pour le tableau récapitulatif — dernière session par test)
  const sessionsBySlug = sessions.reduce<Record<string, CognitiveSessionWithDefinition[]>>(
    (acc, s) => {
      if (!acc[s.test_slug]) acc[s.test_slug] = []
      acc[s.test_slug].push(s)
      return acc
    },
    {}
  )

  // Dernière session par test (pour le tableau récapitulatif)
  const lastBySlug = Object.fromEntries(
    Object.entries(sessionsBySlug).map(([slug, list]) => [slug, list[0]])
  )

  function toggleDetail(sessionId: string, testSlug: string) {
    if (expandedId === sessionId) {
      setExpandedId(null)
      return
    }
    setExpandedId(sessionId)
    // Charger les trials si pas encore chargés et test RT-based
    const hasRT = COGNITIVE_TESTS.find((t) => t.slug === testSlug)?.hasRT
    if (hasRT && !trialsMap[sessionId]) {
      startTransition(async () => {
        const { data } = await getCognitiveSessionTrials(sessionId)
        setTrialsMap((prev) => ({ ...prev, [sessionId]: data }))
      })
    }
  }

  async function handleSend() {
    if (!selectedSlug) return
    setSendLoading(true)
    setSendError(null)
    const result = await createCognitiveInvitationAction(clientId, selectedSlug, selectedPresetId || undefined)
    setSendLoading(false)
    if (result.error) {
      setSendError(result.error)
    } else if (result.data) {
      setSendResult({ url: `${window.location.origin}${result.data.inviteUrl}` })
    }
  }

  function handleCopy(url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function resetSendModal() {
    setSelectedSlug('')
    setSelectedPresetId('')
    setAllPresets({})
    setSendResult(null)
    setSendError(null)
    setSendLoading(false)
    setCopied(false)
  }

  return (
    <div className="space-y-6">

      {/* En-tête avec bouton d'envoi */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <Brain className="h-4 w-4" />
          Tests cognitifs
        </h3>
        <Dialog
          open={sendOpen}
          onOpenChange={(open) => {
            setSendOpen(open)
            if (!open) resetSendModal()
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-2">
              <Send className="h-3.5 w-3.5" />
              Envoyer un test
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Envoyer un test cognitif</DialogTitle>
            </DialogHeader>

            {sendResult ? (
              // État succès : afficher le lien
              <div className="space-y-4 pt-2">
                <p className="text-sm text-muted-foreground">
                  Lien à partager avec le client :
                </p>
                <code className="block rounded bg-muted px-3 py-2 text-xs break-all">
                  {sendResult.url}
                </code>
                <Button
                  className="w-full gap-2"
                  variant="outline"
                  onClick={() => handleCopy(sendResult.url)}
                >
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copié !' : 'Copier le lien'}
                </Button>
              </div>
            ) : (
              // Sélection du test
              <div className="space-y-4 pt-2">
                <Select value={selectedSlug} onValueChange={setSelectedSlug}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un test…" />
                  </SelectTrigger>
                  <SelectContent>
                    {COGNITIVE_TESTS.map((t) => (
                      <SelectItem key={t.slug} value={t.slug}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedSlug && (
                  presetsLoading ? (
                    <p className="text-xs text-muted-foreground">Chargement des versions…</p>
                  ) : presetsForTest.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Version du test</p>
                      <PresetSelector
                        presets={presetsForTest}
                        value={selectedPresetId}
                        onChange={setSelectedPresetId}
                      />
                    </div>
                  ) : null
                )}

                {sendError && (
                  <p className="text-sm text-red-500">{sendError}</p>
                )}

                <Button
                  className="w-full bg-[#7069F4] hover:bg-[#5B54D6] text-white"
                  disabled={!selectedSlug || sendLoading}
                  onClick={handleSend}
                >
                  {sendLoading ? 'Génération…' : 'Générer le lien'}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Tests en attente */}
      {pendingSessions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            En attente
          </p>
          {pendingSessions.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-[#141325]">{s.test_name}</p>
                {s.preset_name && (
                  <p className="text-xs text-muted-foreground">{s.preset_name}</p>
                )}
              </div>
              <Badge variant="outline" className="text-amber-600 border-amber-300 shrink-0">
                {s.status === 'in_progress' ? 'En cours' : 'En attente'}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* Tableau récapitulatif */}
      {sessions.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Aucun test cognitif passé. Envoyez un test pour commencer.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Test</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Métrique clé</TableHead>
                <TableHead>Valeur</TableHead>
                <TableHead>Évolution</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(lastBySlug).map(([slug, session]) => {
                const keyMetric = getKeyMetric(slug, session.computed_metrics)
                // Sessions du même preset que la dernière passation (pour évolution comparable)
                const samePresetKey = `${slug}__${session.preset_id ?? 'default'}`
                const allForPreset = sessionsBySlugAndPreset[samePresetKey] ?? []
                // Delta sur le même preset uniquement — comparer des presets différents est invalide
                const prev = allForPreset[1]
                const prevMetric = prev ? getKeyMetric(slug, prev.computed_metrics) : null

                let delta: number | null = null
                if (keyMetric.value !== undefined && prevMetric?.value !== undefined) {
                  delta = keyMetric.value - prevMetric.value
                }

                const isExpanded = expandedId === session.id

                // Hausse = amélioration pour les tests de précision/span (pas les tests RT)
                const lowerIsBetter = !HIGHER_IS_BETTER_SLUGS.includes(slug)
                const deltaIsGood = delta !== null && (lowerIsBetter ? delta < 0 : delta > 0)

                return (
                  <Fragment key={session.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleDetail(session.id, slug)}
                    >
                      <TableCell className="font-medium">
                        {session.test_name}
                        {session.preset_slug && (
                          <Badge variant="outline" className="ml-2 text-xs font-normal">
                            {session.preset_name ?? session.preset_slug}
                          </Badge>
                        )}
                        {session.is_preset_validated === false && (
                          <AlertTriangle className="inline h-3 w-3 text-amber-500 ml-1" />
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(session.completed_at)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {keyMetric.label}
                      </TableCell>
                      <TableCell>
                        {keyMetric.value !== undefined ? (
                          <Badge variant="outline" className="font-mono">
                            {Math.round(keyMetric.value)} {keyMetric.unit}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {delta !== null && delta !== 0 && (
                          <span
                            className={`text-xs font-medium ${
                              deltaIsGood ? 'text-green-600' : 'text-red-500'
                            }`}
                          >
                            {delta > 0 ? '+' : ''}{Math.round(delta)} {keyMetric.unit}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {session.programme_etape_id ? (
                          <Badge variant="outline" className="text-[#20808D] border-[#20808D] text-xs">Programme</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground text-xs">Manuel</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                    </TableRow>

                    {/* Ligne de détail expandable */}
                    {isExpanded && (
                      <TableRow key={`${session.id}-detail`}>
                        <TableCell colSpan={7} className="bg-muted/30 px-4 py-4">
                          <div className="space-y-4">

                            {/* Toutes les métriques */}
                            {session.computed_metrics && (
                              <MetricsGrid metrics={session.computed_metrics} slug={slug} />
                            )}

                            {/* Histogramme RT */}
                            {COGNITIVE_TESTS.find((t) => t.slug === slug)?.hasRT && (
                              <div>
                                {isPending && !trialsMap[session.id] ? (
                                  <p className="text-xs text-muted-foreground">Chargement…</p>
                                ) : trialsMap[session.id]?.length ? (
                                  <RTHistogram
                                    trials={trialsMap[session.id]}
                                    title="Distribution des temps de réaction"
                                  />
                                ) : null}
                              </div>
                            )}

                            {/* Évolution longitudinale — uniquement sessions du même preset */}
                            {allForPreset.length >= 2 && (
                              <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                                  Évolution longitudinale
                                </p>
                                <CognitiveEvolutionChart
                                  sessions={allForPreset}
                                  metricKey={
                                    slug === 'digital_span'    ? 'total_span'
                                    : slug === 'stroop'        ? 'stroop_effect_rt'
                                    : slug === 'simon'         ? 'simon_effect_rt'
                                    : slug === 'flanker'       ? 'flanker_effect_rt'
                                    : slug === 'stop-signal'   ? 'ssrt'
                                    : slug === 'spatial-span'  ? 'max_span'
                                    : slug === 'go-nogo-visual' || slug === 'mackworth-clock' || slug === 'n-back-2' ? 'accuracy'
                                    : 'mean_rt'
                                  }
                                  metricLabel={keyMetric.label}
                                  unit={keyMetric.unit}
                                  lowerIsBetter={slug !== 'digital_span'}
                                  isValidated={session.is_preset_validated ?? undefined}
                                  presetName={session.preset_name ?? undefined}
                                />
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
