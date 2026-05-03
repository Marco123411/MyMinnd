'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Trash2, CheckCircle2, Circle, UserCheck, Clock, RefreshCw, ChevronDown, ChevronUp, Archive } from 'lucide-react'
import { removeEtapeAction, archiveProgrammeAction } from '@/app/actions/programmes'
import { AddExerciseDialog } from '@/components/coach/AddExerciseDialog'
import { AddEtapeDialog } from '@/components/coach/AddEtapeDialog'
import type { ProgrammeAvecEtapes } from '@/types'

interface ProgrammeEtapesListProps {
  programme: ProgrammeAvecEtapes
  exercises: Array<{ id: string; titre: string; format: string; description: string | null }>
  onUpdate?: () => void
}

function TypeBadge({ type }: { type: string }) {
  if (type === 'cabinet')    return <Badge variant="outline" className="text-[#7069F4] border-[#7069F4] text-xs gap-1"><UserCheck className="h-3 w-3" />Cabinet</Badge>
  if (type === 'autonomie')  return <Badge variant="outline" className="text-[#3C3CD6] border-[#3C3CD6] text-xs gap-1"><Clock className="h-3 w-3" />Autonome</Badge>
  if (type === 'recurrente') return <Badge variant="outline" className="text-amber-600 border-amber-400 text-xs gap-1"><RefreshCw className="h-3 w-3" />Routine</Badge>
  return null
}

export function ProgrammeEtapesList({ programme, exercises, onUpdate }: ProgrammeEtapesListProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  // Étapes dont la section exercices est dépliée
  const [expandedEtapes, setExpandedEtapes] = useState<Set<string>>(new Set())
  // Ajout d'un exercice depuis une étape donnée
  const [addingExercise, setAddingExercise] = useState<string | null>(null)

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
          Aucune étape pour l&apos;instant. Ajoutez une première étape.
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
                      {hasDrills && (
                        <span className="text-xs text-muted-foreground">
                          {drills.length} exercice{drills.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Toggle section exercices */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-[#7069F4]"
                      onClick={() => toggleEtape(etape.id)}
                      title={isExpanded ? 'Masquer les exercices' : 'Afficher les exercices'}
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

                {/* Section exercices (dépliable) */}
                {isExpanded && (
                  <div className="border-t px-3 pb-3 pt-3 space-y-3">
                    {drills.length > 0 ? (
                      <ul className="space-y-2">
                        {drills.map((drill) => (
                          <li key={drill.id} className="flex items-center justify-between gap-2 rounded border bg-white p-2 text-sm">
                            <span className="truncate">{drill.exercises?.titre ?? '—'}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground">Aucun exercice pour cette étape.</p>
                    )}
                    <AddExerciseDialog
                      etapeId={etape.id}
                      filterPhase="in"
                      exercises={exercises}
                      onAdded={() => { setAddingExercise(null); onUpdate?.() }}
                      open={addingExercise === etape.id}
                      onOpenChange={(v) => { if (!v) setAddingExercise(null); else setAddingExercise(etape.id) }}
                    />
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="pt-1">
        <AddEtapeDialog programmeId={programme.id} onAdded={onUpdate} />
      </div>
    </div>
  )
}
