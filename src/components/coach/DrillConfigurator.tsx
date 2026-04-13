'use client'

import { useEffect, useId, useState, useCallback } from 'react'
import { X, AlertTriangle, ChevronDown, ChevronUp, Info, FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import CognitiveLoadBar from '@/components/cognitive/CognitiveLoadBar'
import { computeCognitiveLoad, getCognitiveLoadZone } from '@/lib/cognitive/load'
import type { CognitiveTestDefinition } from '@/types'

interface DrillConfig {
  durationSec: number
  intensityPercent: number
  phase: 'pre' | 'in' | 'post'
  cognitiveLoadScore: number
}

interface DrillConfiguratorProps {
  isOpen: boolean
  onClose: () => void
  testDefinition: CognitiveTestDefinition
  initialConfig?: Partial<DrillConfig>
  onSave: (config: DrillConfig) => void
}

// Données de validation scientifique par slug — indépendant de la BDD
const SCIENCE_DATA: Record<string, { validatedSec: number; reference: string }> = {
  pvt:               { validatedSec: 600,  reference: 'Dinges & Powell, 1985 · Protocole standard : 10 min' },
  stroop:            { validatedSec: 300,  reference: 'Jensen & Rohwer, 1966 · Protocole standard : 5 min' },
  simon:             { validatedSec: 300,  reference: 'Simon & Rudell, 1967 · Protocole standard : 5 min' },
  digital_span:      { validatedSec: 300,  reference: 'Wechsler, 1955 · Protocole standard : 5 min' },
  'n-back-2':        { validatedSec: 1200, reference: 'Jaeggi et al., 2008 · Protocole standard : 20 min' },
  'stop-signal':     { validatedSec: 600,  reference: 'Logan et al., 1984 · Protocole standard : 10 min' },
  flanker:           { validatedSec: 300,  reference: 'Eriksen & Eriksen, 1974 · Protocole standard : 5 min' },
  'go-nogo-visual':  { validatedSec: 300,  reference: 'Donders, 1969 · Protocole standard : 5 min' },
  'mackworth-clock': { validatedSec: 1800, reference: 'Mackworth, 1948 · Protocole standard : 30 min' },
  'spatial-span':    { validatedSec: 300,  reference: 'Corsi, 1972 · Protocole standard : 5 min' },
}

const PHASE_LABELS: Record<'pre' | 'in' | 'post', string> = {
  pre:  'PRÉ',
  in:   'IN',
  post: 'POST',
}

const PHASE_COLORS: Record<'pre' | 'in' | 'post', string> = {
  pre:  '#20808D',
  in:   '#FFC553',
  post: '#944454',
}

function formatDuration(sec: number): string {
  const min = sec / 60
  return min < 1 ? `${sec}s` : `${min} min`
}

export default function DrillConfigurator({
  isOpen,
  onClose,
  testDefinition,
  initialConfig,
  onSave,
}: DrillConfiguratorProps) {
  const titleId = useId()

  const defaultDuration = initialConfig?.durationSec
    ?? testDefinition.default_duration_sec
    ?? 300

  const defaultIntensity = initialConfig?.intensityPercent
    ?? testDefinition.default_intensity_percent
    ?? 100

  // Phase: priorité à initialConfig, sinon première phase recommandée, sinon 'in'
  const firstRecommended = (testDefinition.phase_tags?.[0] ?? 'in') as 'pre' | 'in' | 'post'
  const defaultPhase: 'pre' | 'in' | 'post' = initialConfig?.phase ?? firstRecommended

  const [durationSec, setDurationSec] = useState(defaultDuration)
  const [customMinutes, setCustomMinutes] = useState('')
  const [intensityPercent, setIntensityPercent] = useState(defaultIntensity)
  const [phase, setPhase] = useState<'pre' | 'in' | 'post'>(defaultPhase)
  const [clsScore, setClsScore] = useState(0)
  const [showInstructions, setShowInstructions] = useState(false)

  // Calcul du CLS (signal optionnel pour annulation fetch en cas de démontage)
  const computeAndSetCLS = useCallback(
    (dur: number, intensity: number, signal?: AbortSignal) => {
      if (!testDefinition.intensity_configurable) {
        // Non-configurable: calcul pur local, pas d'appel API
        const score = computeCognitiveLoad({
          baseCognitiveLoad: testDefinition.base_cognitive_load ?? 5,
          durationSec: dur,
          intensityPercent: 100,
          intensityConfigurable: false,
        })
        setClsScore(score)
        return
      }

      // Configurable: appel API
      const params = new URLSearchParams({
        duration: String(dur),
        intensity: String(intensity),
        baseCognitiveLoad: String(testDefinition.base_cognitive_load ?? 5),
        intensityConfigurable: 'true',
      })
      fetch(`/api/cognitive/load-preview?${params}`, { signal })
        .then(r => {
          if (!r.ok) throw new Error(`API error ${r.status}`)
          return r.json()
        })
        .then((data: { cognitiveLoad?: number }) => {
          if (data.cognitiveLoad !== undefined) setClsScore(data.cognitiveLoad)
        })
        .catch(err => {
          if ((err as { name?: string }).name === 'AbortError') return
          // Fallback local si l'API est indisponible
          const score = computeCognitiveLoad({
            baseCognitiveLoad: testDefinition.base_cognitive_load ?? 5,
            durationSec: dur,
            intensityPercent: intensity,
            intensityConfigurable: true,
          })
          setClsScore(score)
        })
    },
    [testDefinition.base_cognitive_load, testDefinition.intensity_configurable]
  )

  // Recalcul CLS avec debounce 200ms + AbortController pour éviter mises à jour sur composant démonté
  useEffect(() => {
    if (!testDefinition.intensity_configurable) {
      computeAndSetCLS(durationSec, intensityPercent)
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(() => computeAndSetCLS(durationSec, intensityPercent, controller.signal), 200)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [durationSec, intensityPercent, computeAndSetCLS, testDefinition.intensity_configurable])

  // Reset quand le slide-over s'ouvre
  useEffect(() => {
    if (isOpen) {
      const dur = initialConfig?.durationSec ?? testDefinition.default_duration_sec ?? 300
      setDurationSec(dur)
      setCustomMinutes('')
      setIntensityPercent(initialConfig?.intensityPercent ?? testDefinition.default_intensity_percent ?? 100)
      setPhase(initialConfig?.phase ?? firstRecommended)
    }
  }, [isOpen, initialConfig, testDefinition.default_duration_sec, testDefinition.default_intensity_percent, firstRecommended])

  // Fermeture Escape
  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handleSave = () => {
    // Garantir un CLS valide (1-26) même si l'async n'est pas encore résolu
    const finalCls = clsScore > 0
      ? clsScore
      : computeCognitiveLoad({
          baseCognitiveLoad: testDefinition.base_cognitive_load ?? 5,
          durationSec,
          intensityPercent: testDefinition.intensity_configurable ? intensityPercent : 100,
          intensityConfigurable: testDefinition.intensity_configurable ?? false,
        })
    onSave({ durationSec, intensityPercent, phase, cognitiveLoadScore: finalCls })
    onClose()
  }

  const availableDurations = testDefinition.configurable_durations ?? (
    testDefinition.default_duration_sec ? [testDefinition.default_duration_sec] : [300]
  )

  const allPhases: ('pre' | 'in' | 'post')[] = ['pre', 'in', 'post']
  const recommendedPhases = (testDefinition.phase_tags ?? ['in']) as ('pre' | 'in' | 'post')[]

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-[250ms] ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panneau */}
      <div
        className={`fixed inset-y-0 right-0 z-50 flex w-[440px] max-w-full flex-col bg-white shadow-xl transform transition-transform duration-[250ms] ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-modal="true"
        role="dialog"
        aria-labelledby={titleId}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <p id={titleId} className="font-semibold text-[#141325]">
              {testDefinition.name}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Configurer le drill</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 hover:bg-muted transition-colors"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Contenu scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Sélecteur de durée */}
          {(() => {
            const science = SCIENCE_DATA[testDefinition.slug]
            const isPreset = availableDurations.includes(durationSec)
            const isValidated = science ? durationSec === science.validatedSec : false

            return (
              <div className="space-y-2">
                <label className="text-sm font-medium">Durée</label>

                {/* Pills presets */}
                <div className="flex flex-wrap gap-2">
                  {availableDurations.map(dur => (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => { setDurationSec(dur); setCustomMinutes('') }}
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                        durationSec === dur && isPreset
                          ? 'border-[#20808D] bg-[#E8F4F5] text-[#20808D]'
                          : 'border-border text-muted-foreground hover:border-[#20808D]/50'
                      }`}
                    >
                      {formatDuration(dur)}
                    </button>
                  ))}
                </div>

                {/* Durée personnalisée */}
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={120}
                    placeholder="Personnalisée"
                    value={customMinutes}
                    onChange={e => {
                      const val = e.target.value
                      setCustomMinutes(val)
                      const mins = parseInt(val, 10)
                      if (!isNaN(mins) && mins >= 1 && mins <= 120) {
                        setDurationSec(mins * 60)
                      }
                    }}
                    className="w-36 rounded-md border border-border px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#20808D]"
                  />
                  <span className="text-sm text-muted-foreground">min</span>
                  {!isPreset && customMinutes !== '' && (
                    <span className="text-xs text-[#20808D] font-medium">{formatDuration(durationSec)}</span>
                  )}
                </div>

                {/* Notice scientifique */}
                {science && isValidated && (
                  <div className="flex items-start gap-2 rounded-lg bg-[#E8F4F5] border border-[#20808D]/30 px-3 py-2">
                    <FlaskConical className="h-4 w-4 text-[#20808D] shrink-0 mt-0.5" />
                    <p className="text-xs text-[#20808D]">
                      Durée validée scientifiquement · <span className="font-medium">{science.reference}</span>
                    </p>
                  </div>
                )}
                {science && !isValidated && (
                  <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">
                      Cette durée n&apos;est pas celle du protocole scientifique validé.
                      Les résultats peuvent différer des normes de référence.{' '}
                      <span className="font-medium">Durée standard : {formatDuration(science.validatedSec)}</span>
                      {' '}({science.reference.split('·')[0].trim()})
                    </p>
                  </div>
                )}
                {!science && (
                  <div className="flex items-start gap-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
                    <Info className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-gray-500">
                      Aucune durée standard définie pour ce test dans la littérature. Choisissez selon vos objectifs.
                    </p>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Slider d'intensité (caché si non-configurable) */}
          {testDefinition.intensity_configurable && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Intensité</label>
                <span className="text-sm font-semibold text-[#20808D]">{intensityPercent}%</span>
              </div>
              <input
                type="range"
                min={10}
                max={100}
                step={10}
                value={intensityPercent}
                onChange={e => setIntensityPercent(Number(e.target.value))}
                className="w-full accent-[#20808D]"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>10%</span>
                <span>100%</span>
              </div>
            </div>
          )}

          {/* Preview CLS en temps réel */}
          {clsScore > 0 && (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Charge cognitive</span>
                <span className="text-xs text-muted-foreground">
                  Zone: {getCognitiveLoadZone(clsScore).toUpperCase()}
                </span>
              </div>
              <CognitiveLoadBar score={clsScore} />
            </div>
          )}

          {/* Sélecteur de phase */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Phase</label>
            <div className="flex gap-2">
              {allPhases.map(p => {
                const isRecommended = recommendedPhases.includes(p)
                const isSelected = phase === p
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPhase(p)}
                    className={`flex-1 rounded-lg border px-2 py-2 text-sm font-medium transition-colors ${
                      isSelected
                        ? 'text-white'
                        : 'border-border text-muted-foreground hover:border-current/50'
                    } ${!isRecommended && isSelected ? 'opacity-90' : ''}`}
                    style={isSelected
                      ? { backgroundColor: PHASE_COLORS[p], borderColor: PHASE_COLORS[p] }
                      : { color: isRecommended ? PHASE_COLORS[p] : undefined }
                    }
                    title={!isRecommended ? 'Phase non recommandée pour ce drill' : undefined}
                  >
                    <span className="flex items-center justify-center gap-1">
                      {!isRecommended && <AlertTriangle className="h-3 w-3" />}
                      {PHASE_LABELS[p]}
                    </span>
                  </button>
                )
              })}
            </div>
            {!recommendedPhases.includes(phase) && (
              <p className="flex items-center gap-1 text-xs text-amber-600">
                <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                Cette phase n&apos;est pas recommandée pour ce type de drill.
              </p>
            )}
          </div>

          {/* Instructions collapsibles */}
          {testDefinition.instructions_fr && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowInstructions(!showInstructions)}
                className="flex w-full items-center justify-between text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>Instructions du test</span>
                {showInstructions ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
              {showInstructions && (
                <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground leading-relaxed">
                  {testDefinition.instructions_fr}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer avec bouton Enregistrer */}
        <div className="border-t px-5 py-4 flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Annuler
          </Button>
          <Button
            onClick={handleSave}
            className="flex-1 bg-[#20808D] hover:bg-[#20808D]/90 text-white"
          >
            Enregistrer
          </Button>
        </div>
      </div>
    </>
  )
}
