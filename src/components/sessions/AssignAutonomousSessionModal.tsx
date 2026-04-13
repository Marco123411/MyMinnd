'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardList, Plus, X, ChevronUp, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { createAutonomousSessionAction } from '@/app/actions/sessions'
import type { ClientSelectOption, Exercise, ExerciceOrdonné } from '@/types'

interface AssignAutonomousSessionModalProps {
  clients: ClientSelectOption[]
  exercises: Exercise[]
}

export function AssignAutonomousSessionModal({
  clients,
  exercises,
}: AssignAutonomousSessionModalProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedClientId, setSelectedClientId] = useState('')
  const [titre, setTitre] = useState('')
  const [objectif, setObjectif] = useState('')
  const [dateCible, setDateCible] = useState('')
  const [orderedExercices, setOrderedExercices] = useState<
    Array<ExerciceOrdonné & { titre: string }>
  >([])

  function addExercice(ex: Exercise) {
    if (orderedExercices.some((e) => e.exercise_id === ex.id)) return
    setOrderedExercices((prev) => [
      ...prev,
      { exercise_id: ex.id, ordre: prev.length, consignes: '', titre: ex.titre },
    ])
  }

  function removeExercice(exerciseId: string) {
    setOrderedExercices((prev) =>
      prev
        .filter((e) => e.exercise_id !== exerciseId)
        .map((e, i) => ({ ...e, ordre: i }))
    )
  }

  function moveExercice(index: number, direction: 'up' | 'down') {
    setOrderedExercices((prev) => {
      const next = [...prev]
      const target = direction === 'up' ? index - 1 : index + 1
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next.map((e, i) => ({ ...e, ordre: i }))
    })
  }

  function updateConsignes(exerciseId: string, consignes: string) {
    setOrderedExercices((prev) =>
      prev.map((e) => (e.exercise_id === exerciseId ? { ...e, consignes } : e))
    )
  }

  function handleOpenChange(open: boolean) {
    setIsOpen(open)
    if (!open) {
      setSelectedClientId('')
      setTitre('')
      setObjectif('')
      setDateCible('')
      setOrderedExercices([])
      setError(null)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (orderedExercices.length === 0) {
      setError('Ajoutez au moins un exercice.')
      return
    }

    startTransition(async () => {
      const result = await createAutonomousSessionAction({
        client_id: selectedClientId,
        titre,
        objectif,
        exercices: orderedExercices.map(({ exercise_id, ordre, consignes }) => ({
          exercise_id,
          ordre,
          consignes,
        })),
        date_cible: dateCible || null,
      })

      if (result.error) {
        setError(result.error)
        return
      }

      handleOpenChange(false)
      router.refresh()
    })
  }

  const availableExercices = exercises.filter(
    (ex) => !orderedExercices.some((e) => e.exercise_id === ex.id)
  )

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="bg-[#3C3CD6] hover:bg-[#7d3a47] text-white gap-2">
          <ClipboardList className="h-4 w-4" />
          Assigner une séance
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assigner une séance en autonomie</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Client */}
          <div className="space-y-1.5">
            <Label>Client *</Label>
            <Select value={selectedClientId} onValueChange={setSelectedClientId} required>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nom} {c.prenom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Titre */}
          <div className="space-y-1.5">
            <Label htmlFor="titre">Titre *</Label>
            <Input
              id="titre"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Ex: Routine matinale de préparation"
              required
            />
          </div>

          {/* Objectif */}
          <div className="space-y-1.5">
            <Label htmlFor="objectif">Objectif *</Label>
            <Textarea
              id="objectif"
              value={objectif}
              onChange={(e) => setObjectif(e.target.value)}
              placeholder="Objectif de la séance…"
              rows={2}
              required
            />
          </div>

          {/* Exercices disponibles */}
          <div className="space-y-1.5">
            <Label>Ajouter des exercices</Label>
            {availableExercices.length > 0 ? (
              <div className="flex flex-wrap gap-2 p-3 border rounded-md bg-gray-50 max-h-28 overflow-y-auto">
                {availableExercices.map((ex) => (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => addExercice(ex)}
                    className="focus:outline-none"
                  >
                    <Badge
                      variant="outline"
                      className="cursor-pointer hover:bg-[#F1F0FE] gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      {ex.titre}
                    </Badge>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 p-2">Tous les exercices ont été ajoutés.</p>
            )}
          </div>

          {/* Exercices ordonnés */}
          {orderedExercices.length > 0 && (
            <div className="space-y-2">
              <Label>Exercices de la séance ({orderedExercices.length})</Label>
              <div className="space-y-2">
                {orderedExercices.map((ex, index) => (
                  <div key={ex.exercise_id} className="border rounded-md p-3 bg-white space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium flex-1">
                        <span className="text-gray-400 mr-2">{index + 1}.</span>
                        {ex.titre}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveExercice(index, 'up')}
                          disabled={index === 0}
                          className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveExercice(index, 'down')}
                          disabled={index === orderedExercices.length - 1}
                          className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeExercice(ex.exercise_id)}
                          className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <Textarea
                      value={ex.consignes}
                      onChange={(e) => updateConsignes(ex.exercise_id, e.target.value)}
                      placeholder="Consignes pour cet exercice…"
                      rows={1}
                      className="text-sm resize-none"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Date cible */}
          <div className="space-y-1.5">
            <Label htmlFor="date_cible">Date cible (optionnelle)</Label>
            <Input
              id="date_cible"
              type="date"
              value={dateCible}
              onChange={(e) => setDateCible(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isPending || !selectedClientId || !titre || !objectif}
              className="bg-[#3C3CD6] hover:bg-[#7d3a47] text-white"
            >
              {isPending ? 'Enregistrement…' : 'Assigner'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
