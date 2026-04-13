'use client'

import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useDroppable } from '@dnd-kit/core'
import { Plus, GripVertical, Settings, Trash2 } from 'lucide-react'
import CognitiveLoadBadge from '@/components/cognitive/CognitiveLoadBadge'
import SessionLoadSummary from '@/components/cognitive/SessionLoadSummary'
import type { ProgramExercise } from '@/types'

interface PhaseColumnViewProps {
  exercises: ProgramExercise[]
  onPhaseChange: (id: string, newPhase: 'pre' | 'in' | 'post') => void
  onConfigureClick: (exercise: ProgramExercise) => void
  onDeleteClick: (id: string) => void
  onAddClick: (phase: 'pre' | 'in' | 'post') => void
}

const PHASE_CONFIG = {
  pre:  { label: 'PRÉ',  color: '#20808D', bg: '#E8F4F5' },
  in:   { label: 'IN',   color: '#FFC553', bg: '#FFF9E6' },
  post: { label: 'POST', color: '#944454', bg: '#F5E8EC' },
} as const

// Référence stable pour éviter la réinitialisation de DndContext à chaque render
const POINTER_ACTIVATION_CONSTRAINT = { distance: 8 } as const

// --- Drill card (sortable) ---
function SortableDrillCard({
  exercise,
  onConfigureClick,
  onDeleteClick,
}: {
  exercise: ProgramExercise
  onConfigureClick: (ex: ProgramExercise) => void
  onDeleteClick: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: exercise.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const isCognitive = exercise.cognitive_test_id !== null
  const displayName = isCognitive
    ? (exercise.cognitive_test_definitions?.name ?? 'Drill cognitif')
    : (exercise.exercises?.titre ?? 'Exercice')
  const durationMin = exercise.configured_duration_sec
    ? exercise.configured_duration_sec / 60
    : null

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border bg-white p-3 shadow-sm space-y-1.5"
    >
      <div className="flex items-start gap-2">
        {/* Drag handle */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label="Déplacer"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{displayName}</p>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            {isCognitive && durationMin !== null && (
              <span className="text-xs text-muted-foreground">{durationMin} min</span>
            )}
            {isCognitive && exercise.configured_intensity_percent !== null &&
              exercise.cognitive_test_definitions?.intensity_configurable && (
              <span className="text-xs text-muted-foreground">
                {exercise.configured_intensity_percent}%
              </span>
            )}
            {isCognitive && exercise.cognitive_load_score !== null && (
              <CognitiveLoadBadge score={exercise.cognitive_load_score} />
            )}
            {!isCognitive && exercise.exercises?.format && (
              <span className="text-xs text-muted-foreground capitalize">
                {exercise.exercises.format}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onConfigureClick(exercise)}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Configurer"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDeleteClick(exercise.id)}
            className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-500 transition-colors"
            aria-label="Supprimer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

// --- Drill card fantôme (pendant le drag) ---
function DragGhostCard({ exercise }: { exercise: ProgramExercise }) {
  const displayName = exercise.cognitive_test_id !== null
    ? (exercise.cognitive_test_definitions?.name ?? 'Drill cognitif')
    : (exercise.exercises?.titre ?? 'Exercice')
  return (
    <div className="rounded-lg border bg-white p-3 shadow-lg opacity-90 rotate-1 w-64">
      <p className="text-sm font-medium truncate">{displayName}</p>
      {exercise.cognitive_test_id !== null && exercise.cognitive_load_score !== null && (
        <CognitiveLoadBadge score={exercise.cognitive_load_score} />
      )}
    </div>
  )
}

// --- Colonne droppable ---
function PhaseColumn({
  phase,
  exercises,
  isOver,
  onAddClick,
  onConfigureClick,
  onDeleteClick,
}: {
  phase: 'pre' | 'in' | 'post'
  exercises: ProgramExercise[]
  isOver: boolean
  onAddClick: (phase: 'pre' | 'in' | 'post') => void
  onConfigureClick: (ex: ProgramExercise) => void
  onDeleteClick: (id: string) => void
}) {
  const { label, color, bg } = PHASE_CONFIG[phase]
  const { setNodeRef } = useDroppable({ id: `column-${phase}` })

  return (
    <div className="flex flex-col gap-2 flex-1">
      {/* Column header */}
      <div
        className="flex items-center justify-between rounded-t-lg px-3 py-2"
        style={{ backgroundColor: bg }}
      >
        <span className="text-sm font-semibold" style={{ color }}>
          {label}
        </span>
        <button
          type="button"
          onClick={() => onAddClick(phase)}
          className="rounded-full p-0.5 transition-colors hover:opacity-70"
          style={{ color }}
          aria-label={`Ajouter drill en ${label}`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Droppable area */}
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[120px] rounded-b-lg border-2 border-dashed transition-colors p-2 space-y-2 ${
          isOver
            ? 'border-current bg-muted/30'
            : 'border-transparent bg-muted/10'
        }`}
        style={isOver ? { borderColor: color } : undefined}
      >
        <SortableContext
          items={exercises.map(e => e.id)}
          strategy={verticalListSortingStrategy}
        >
          {exercises.map(exercise => (
            <SortableDrillCard
              key={exercise.id}
              exercise={exercise}
              onConfigureClick={onConfigureClick}
              onDeleteClick={onDeleteClick}
            />
          ))}
        </SortableContext>

        {exercises.length === 0 && (
          <div className="flex items-center justify-center h-16 text-xs text-muted-foreground">
            Déposez un drill ici
          </div>
        )}
      </div>
    </div>
  )
}

// --- Composant principal ---
export default function PhaseColumnView({
  exercises,
  onPhaseChange,
  onConfigureClick,
  onDeleteClick,
  onAddClick,
}: PhaseColumnViewProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: POINTER_ACTIVATION_CONSTRAINT })
  )

  const byPhase = {
    pre:  exercises.filter(e => e.phase === 'pre'),
    in:   exercises.filter(e => e.phase === 'in'),
    post: exercises.filter(e => e.phase === 'post'),
    // Exercices sans phase (outils PM classiques) — non affichés dans les colonnes
    unphased: exercises.filter(e => e.phase === null),
  }

  const activeExercise = activeId ? exercises.find(e => e.id === activeId) : null

  function findPhaseForExercise(id: string): 'pre' | 'in' | 'post' | null {
    for (const phase of ['pre', 'in', 'post'] as const) {
      if (byPhase[phase].some(e => e.id === id)) return phase
    }
    return null
  }

  function findPhaseForColumn(colId: string): 'pre' | 'in' | 'post' | null {
    if (colId === 'column-pre') return 'pre'
    if (colId === 'column-in') return 'in'
    if (colId === 'column-post') return 'post'
    return null
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragOver(event: DragOverEvent) {
    setOverId(event.over ? String(event.over.id) : null)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    setOverId(null)

    if (!over) return

    const sourcePhase = findPhaseForExercise(String(active.id))
    if (!sourcePhase) return

    // Déterminer la phase cible : colonne ou autre item
    let targetPhase = findPhaseForColumn(String(over.id))
    if (!targetPhase) {
      targetPhase = findPhaseForExercise(String(over.id))
    }

    if (targetPhase && targetPhase !== sourcePhase) {
      onPhaseChange(String(active.id), targetPhase)
    }
  }

  const currentOverPhase = overId
    ? (findPhaseForColumn(overId) ?? findPhaseForExercise(overId))
    : null

  return (
    <div className="space-y-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {/* 3 colonnes */}
        <div className="grid grid-cols-3 gap-4">
          {(['pre', 'in', 'post'] as const).map(phase => (
            <PhaseColumn
              key={phase}
              phase={phase}
              exercises={byPhase[phase]}
              isOver={currentOverPhase === phase}
              onAddClick={onAddClick}
              onConfigureClick={onConfigureClick}
              onDeleteClick={onDeleteClick}
            />
          ))}
        </div>

        {/* Overlay fantôme pendant le drag */}
        <DragOverlay>
          {activeExercise && <DragGhostCard exercise={activeExercise} />}
        </DragOverlay>
      </DndContext>

      {/* Charge totale de la session */}
      <SessionLoadSummary exercises={exercises} />
    </div>
  )
}
