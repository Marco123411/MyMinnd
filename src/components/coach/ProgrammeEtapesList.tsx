'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Trash2, CheckCircle2, Circle, UserCheck, Clock, RefreshCw, Brain, ChevronDown, ChevronUp, Archive, Loader2 } from 'lucide-react'
import { removeEtapeAction, updateDrillAction, deleteDrillAction, archiveProgrammeAction } from '@/app/actions/programmes'
import PhaseColumnView from '@/components/coach/PhaseColumnView'
import DrillConfigurator from '@/components/coach/DrillConfigurator'
import { AddDrillDialog } from '@/components/coach/AddDrillDialog'
import { AddExerciseDialog } from '@/components/coach/AddExerciseDialog'
import { AddEtapeDialog } from '@/components/coach/AddEtapeDialog'
import type { ProgrammeAvecEtapes, ProgramExercise, CognitiveTestDefinition } from '@/types'
import { computeCognitiveLoad } from '@/lib/cognitive/load'

interface ProgrammeEtapesListProps {
  programme: ProgrammeAvecEtapes
  cognitiveTests: CognitiveTestDefinition[]
  exercises: Array<{ id: string; titre: string; format: string; description: string | null }>
  onUpdate?: () => void
}

function TypeBadge({ type }: { type: string }) {
  if (type === 'cabinet')    return <Badge variant="outline" className="text-[#7069F4] border-[#7069F4] text-xs gap-1"><UserCheck className="h-3 w-3" />Cabinet</Badge>
  if (type === 'autonomie')  return <Badge variant="outline" className="text-[#3C3CD6] border-[#3C3CD6] text-xs gap-1"><Clock className="h-3 w-3" />Autonome</Badge>
  if (type === 'recurrente') return <Badge variant="outline" className="text-amber-600 border-amber-400 text-xs gap-1"><RefreshCw className="h-3 w-3" />Routine</Badge>
  if (type === 'cognitif')   return <Badge variant="outline" className="text-[#20808D] border-[#20808D] text-xs gap-1"><Brain className="h-3 w-3" />Cognitif</Badge>
  return null
}

export function ProgrammeEtapesList({ programme, cognitiveTests, exercises, onUpdate }: ProgrammeEtapesListProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  // Étapes dont la section drills cognitifs est dépliée
  const [expandedEtapes, setExpandedEtapes] = useState<Set<string>>(new Set())
  // Drill en cours de configuration
  const [configuringDrill, setConfiguringDrill] = useState<ProgramExercise | null>(null)
  // Ajout d'un drill depuis une colonne de phase spécifique
  const [addingDrill, setAddingDrill] = useState<{ etapeId: string; phase: 'pre' | 'in' | 'post' } | null>(null)

  function toggleEtape(etapeId: string) {
    setExpandedEtapes(prev => {
      const next = new Set(prev)
      if (next.has(etapeId)) next.delete(etapeId)
      else next.add(etapeId)
      return next
    })
  }

  function handleRemoveEtape(etapeId: string) {
    setError(null)
    startTransition(async () => {
      const result = await removeEtapeAction(etapeId, programme.id)
      if (result.error) setError(result.error)
      else onUpdate?.()
    })
  }

  function handlePhaseChange(drillId: string, newPhase: 'pre' | 'in' | 'post') {
    startTransition(async () => {
      await updateDrillAction({ drill_id: drillId, phase: newPhase })
      onUpdate?.()
    })
  }

  function handleDeleteDrill(drillId: string) {
    startTransition(async () => {
      await deleteDrillAction(drillId)
      onUpdate?.()
    })
  }

  function handleSaveDrillConfig(config: {
    durationSec: number
    intensityPercent: number
    phase: 'pre' | 'in' | 'post'
    cognitiveLoadScore: number
  }) {
    if (!configuringDrill) return
    startTransition(async () => {
      await updateDrillAction({
        drill_id:                     configuringDrill.id,
        phase:                        config.phase,
        configured_duration_sec:      config.durationSec,
        configured_intensity_percent: config.intensityPercent,
        cognitive_load_score:         config.cognitiveLoadScore,
      })
      setConfiguringDrill(null)
      onUpdate?.()
    })
  }

  const stats = {
    total:     programme.etapes.length,
    completes: programme.etapes.filter((e) => e.est_complete).length,
  }

  return (
    <div className="space-y-3">
      {/* En-tête programme */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-[#141325]">{programme.nom}</h4>
          {programme.description && (
            <p className="text-sm text-muted-foreground">{programme.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {stats.completes}/{stats.total} étape{stats.total > 1 ? 's' : ''}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs text-muted-foreground hover:text-amber-600"
            disabled={isPending}
            onClick={() => {
              if (!confirm(`Archiver le programme "${programme.nom}" ?`)) return
              startTransition(async () => {
                await archiveProgrammeAction(programme.id)
                onUpdate?.()
              })
            }}
          >
            <Archive className="h-3.5 w-3.5" />
            Archiver
          </Button>
        </div>
      </div>

      {/* Barre de progression */}
      {stats.total > 0 && (
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-[#7069F4] transition-all"
            style={{ width: `${Math.round((stats.completes / stats.total) * 100)}%` }}
          />
        </div>
      )}

      {/* Liste des étapes */}
      {programme.etapes.length === 0 ? (
        <p className="text-sm text-muted-foreground py-3 text-center">
          Aucune étape pour l'instant. Ajoutez une première étape.
        </p>
      ) : (
        <ol className="space-y-3">
          {programme.etapes.map((etape) => {
            const drills = etape.program_exercises ?? []
            const hasDrills = drills.length > 0
            const isExpanded = expandedEtapes.has(etape.id)

            return (
              <li key={etape.id} className="rounded-lg border bg-card">
                {/* Ligne principale de l'étape */}
                <div className="flex items-center gap-3 p-3">
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono text-muted-foreground w-5 text-right">
                      {etape.ordre}.
                    </span>
                    {etape.est_complete ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{etape.titre_display}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <TypeBadge type={etape.type_seance} />
                      {etape.type_seance === 'cognitif' && etape.cognitive_session && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          {etape.cognitive_session.completed_at ? (
                            <CheckCircle2 className="h-3 w-3 text-green-500" />
                          ) : (
                            <Loader2 className="h-3 w-3 text-amber-500" />
                          )}
                          {etape.cognitive_session.completed_at ? 'Complété' : 'En attente'}
                        </span>
                      )}
                      {hasDrills && (
                        <span className="flex items-center gap-1 text-xs text-[#20808D]">
                          <Brain className="h-3 w-3" />
                          {drills.length} drill{drills.length > 1 ? 's' : ''} cognitif{drills.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Toggle section drills */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-[#20808D]"
                      onClick={() => toggleEtape(etape.id)}
                      title={isExpanded ? 'Masquer les drills' : 'Afficher les drills cognitifs'}
                    >
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-red-500 shrink-0"
                      onClick={() => handleRemoveEtape(etape.id)}
                      disabled={isPending}
                      aria-label="Supprimer cette étape"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Section drills cognitifs (dépliable) */}
                {isExpanded && (
                  <div className="border-t px-3 pb-3 pt-3 space-y-3">
                    <PhaseColumnView
                      exercises={drills}
                      onPhaseChange={(id, phase) => handlePhaseChange(id, phase)}
                      onConfigureClick={(drill) => setConfiguringDrill(drill)}
                      onDeleteClick={(id) => handleDeleteDrill(id)}
                      onAddClick={(phase) => setAddingDrill({ etapeId: etape.id, phase })}
                    />
                    {/* Dialog contrôlé : cognitif → drills cognitifs, autres → exercices bibliothèque */}
                    {etape.type_seance === 'cognitif' ? (
                      <AddDrillDialog
                        etapeId={etape.id}
                        filterPhase={addingDrill?.etapeId === etape.id ? addingDrill.phase : undefined}
                        cognitiveTests={cognitiveTests}
                        onAdded={() => { setAddingDrill(null); onUpdate?.() }}
                        open={addingDrill?.etapeId === etape.id}
                        onOpenChange={(v) => { if (!v) setAddingDrill(null) }}
                      />
                    ) : (
                      <AddExerciseDialog
                        etapeId={etape.id}
                        filterPhase={addingDrill?.etapeId === etape.id ? addingDrill.phase : undefined}
                        exercises={exercises}
                        onAdded={() => { setAddingDrill(null); onUpdate?.() }}
                        open={addingDrill?.etapeId === etape.id}
                        onOpenChange={(v) => { if (!v) setAddingDrill(null) }}
                      />
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="pt-1">
        <AddEtapeDialog programmeId={programme.id} cognitiveTests={cognitiveTests} onAdded={onUpdate} />
      </div>

      {/* DrillConfigurator slide-over global */}
      {configuringDrill?.cognitive_test_definitions && (
        <DrillConfigurator
          isOpen={!!configuringDrill}
          onClose={() => setConfiguringDrill(null)}
          testDefinition={configuringDrill.cognitive_test_definitions}
          initialConfig={{
            phase:            configuringDrill.phase ?? 'in',
            durationSec:      configuringDrill.configured_duration_sec ?? configuringDrill.cognitive_test_definitions.default_duration_sec ?? 300,
            intensityPercent: configuringDrill.configured_intensity_percent ?? configuringDrill.cognitive_test_definitions.default_intensity_percent ?? 100,
            cognitiveLoadScore: configuringDrill.cognitive_load_score ?? computeCognitiveLoad({
              baseCognitiveLoad: configuringDrill.cognitive_test_definitions.base_cognitive_load ?? 5,
              durationSec: configuringDrill.configured_duration_sec ?? 300,
              intensityPercent: configuringDrill.configured_intensity_percent ?? 100,
              intensityConfigurable: configuringDrill.cognitive_test_definitions.intensity_configurable ?? false,
            }),
          }}
          onSave={handleSaveDrillConfig}
        />
      )}
    </div>
  )
}
