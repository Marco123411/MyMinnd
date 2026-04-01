'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RotateCcw, Plus, X, ChevronUp, ChevronDown } from 'lucide-react'
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
import { createRecurringTemplateAction } from '@/app/actions/sessions'
import { TRIGGER_LABELS } from '@/lib/sessions/constants'
import type { ClientSelectOption, Exercise, ExerciceOrdonné, TriggerType } from '@/types'

interface CreateRecurringTemplateModalProps {
  clients: ClientSelectOption[]
  exercises: Exercise[]
}

export function CreateRecurringTemplateModal({
  clients,
  exercises,
}: CreateRecurringTemplateModalProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedClientId, setSelectedClientId] = useState('')
  const [titre, setTitre] = useState('')
  const [description, setDescription] = useState('')
  const [dureeEstimee, setDureeEstimee] = useState('')
  const [triggerType, setTriggerType] = useState<TriggerType | ''>('')
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
      setDescription('')
      setDureeEstimee('')
      setTriggerType('')
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
      const result = await createRecurringTemplateAction({
        client_id: selectedClientId,
        titre,
        description: description || undefined,
        exercices: orderedExercices.map(({ exercise_id, ordre, consignes }) => ({
          exercise_id,
          ordre,
          consignes,
        })),
        duree_estimee: dureeEstimee ? parseInt(dureeEstimee, 10) : null,
        trigger_type: triggerType || null,
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
        <Button className="bg-[#FFC553] hover:bg-[#e6b04a] text-[#1A1A2E] gap-2">
          <RotateCcw className="h-4 w-4" />
          Créer un template
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Créer un template récurrent</DialogTitle>
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
              placeholder="Ex: Activation Pré-Match"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Description (contexte d&apos;utilisation)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Quand utiliser ce template…"
              rows={2}
            />
          </div>

          {/* Type de déclenchement */}
          <div className="space-y-1.5">
            <Label>Type de déclenchement</Label>
            <Select value={triggerType} onValueChange={(v) => setTriggerType(v as TriggerType)}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un type" />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(TRIGGER_LABELS) as [TriggerType, string][]).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Durée estimée */}
          <div className="space-y-1.5">
            <Label htmlFor="duree">Durée estimée (minutes)</Label>
            <Input
              id="duree"
              type="number"
              min="1"
              max="240"
              value={dureeEstimee}
              onChange={(e) => setDureeEstimee(e.target.value)}
              placeholder="Ex: 20"
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
                      className="cursor-pointer hover:bg-[#E8F4F5] gap-1"
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
              <Label>Exercices du template ({orderedExercices.length})</Label>
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
              disabled={isPending || !selectedClientId || !titre}
              className="bg-[#FFC553] hover:bg-[#e6b04a] text-[#1A1A2E]"
            >
              {isPending ? 'Création…' : 'Créer le template'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
