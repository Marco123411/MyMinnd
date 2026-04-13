'use client'

import { useState, useTransition } from 'react'
import { Dumbbell, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { addExerciseToEtapeAction } from '@/app/actions/programmes'

const FORMAT_LABELS: Record<string, string> = {
  video:         'Vidéo',
  document:      'Document',
  audio:         'Audio',
  questionnaire: 'Questionnaire',
  interactive:   'Interactif',
}

const FORMAT_COLORS: Record<string, string> = {
  video:         'bg-blue-100 text-blue-700',
  document:      'bg-gray-100 text-gray-600',
  audio:         'bg-purple-100 text-purple-700',
  questionnaire: 'bg-amber-100 text-amber-700',
  interactive:   'bg-teal-100 text-teal-700',
}

interface AddExerciseDialogProps {
  etapeId: string
  filterPhase?: 'pre' | 'in' | 'post'
  exercises: Array<{ id: string; titre: string; format: string; description: string | null }>
  onAdded?: () => void
  // Mode contrôlé (depuis boutons "+" des colonnes)
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function AddExerciseDialog({
  etapeId,
  filterPhase,
  exercises,
  onAdded,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: AddExerciseDialogProps) {
  const isControlled = controlledOpen !== undefined
  const [internalOpen, setInternalOpen] = useState(false)
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? (controlledOnOpenChange ?? (() => {})) : setInternalOpen

  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSelect(exerciseId: string) {
    if (!filterPhase) {
      setError('Aucune phase sélectionnée — utilisez les boutons "+" d\'une colonne.')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await addExerciseToEtapeAction({
        etape_id:    etapeId,
        exercise_id: exerciseId,
        phase:       filterPhase,
      })
      if (result.error) {
        setError(result.error)
      } else {
        setOpen(false)
        onAdded?.()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-[#7069F4] border-[#7069F4]"
            disabled={isPending}
          >
            <Dumbbell className="h-3.5 w-3.5" />
            <Plus className="h-3 w-3" />
            Exercice
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Ajouter un exercice
            {filterPhase && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                — phase {filterPhase.toUpperCase()}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {exercises.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Aucun exercice disponible dans la bibliothèque.
          </p>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {exercises.map(ex => (
              <button
                key={ex.id}
                type="button"
                disabled={isPending}
                onClick={() => handleSelect(ex.id)}
                className="w-full rounded-lg border p-3 text-left hover:border-[#7069F4] hover:bg-[#F1F0FE]/50 transition-colors disabled:opacity-50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{ex.titre}</p>
                    {ex.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {ex.description}
                      </p>
                    )}
                  </div>
                  {ex.format && (
                    <Badge className={`shrink-0 text-xs ${FORMAT_COLORS[ex.format] ?? 'bg-gray-100 text-gray-600'}`}>
                      {FORMAT_LABELS[ex.format] ?? ex.format}
                    </Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </DialogContent>
    </Dialog>
  )
}
