'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarPlus, X } from 'lucide-react'
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
import { createCabinetSessionAction } from '@/app/actions/sessions'
import type { ClientSelectOption, Exercise } from '@/types'

interface PlanCabinetSessionModalProps {
  clients: ClientSelectOption[]
  exercises: Exercise[]
}

export function PlanCabinetSessionModal({ clients, exercises }: PlanCabinetSessionModalProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedClientId, setSelectedClientId] = useState('')
  const [dateSeance, setDateSeance] = useState('')
  const [objectif, setObjectif] = useState('')
  const [contenu, setContenu] = useState('')
  const [selectedExercices, setSelectedExercices] = useState<string[]>([])

  function toggleExercice(id: string) {
    setSelectedExercices((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    )
  }

  function handleOpenChange(open: boolean) {
    setIsOpen(open)
    if (!open) {
      setSelectedClientId('')
      setDateSeance('')
      setObjectif('')
      setContenu('')
      setSelectedExercices([])
      setError(null)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const result = await createCabinetSessionAction({
        client_id: selectedClientId,
        date_seance: dateSeance,
        objectif,
        contenu: contenu || undefined,
        exercices_utilises: selectedExercices,
      })

      if (result.error) {
        setError(result.error)
        return
      }

      handleOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="bg-[#20808D] hover:bg-[#1a6b78] text-white gap-2">
          <CalendarPlus className="h-4 w-4" />
          Planifier une séance
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Planifier une séance cabinet</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Client */}
          <div className="space-y-1.5">
            <Label htmlFor="client">Client *</Label>
            <Select value={selectedClientId} onValueChange={setSelectedClientId} required>
              <SelectTrigger id="client">
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

          {/* Date et heure */}
          <div className="space-y-1.5">
            <Label htmlFor="date">Date et heure *</Label>
            <Input
              id="date"
              type="datetime-local"
              value={dateSeance}
              onChange={(e) => setDateSeance(e.target.value)}
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
              placeholder="Objectif principal de la séance…"
              rows={2}
              required
            />
          </div>

          {/* Exercices */}
          {exercises.length > 0 && (
            <div className="space-y-1.5">
              <Label>Exercices à utiliser</Label>
              <div className="flex flex-wrap gap-2 p-3 border rounded-md bg-gray-50 max-h-32 overflow-y-auto">
                {exercises.map((ex) => (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => toggleExercice(ex.id)}
                    className="focus:outline-none"
                  >
                    <Badge
                      variant={selectedExercices.includes(ex.id) ? 'default' : 'outline'}
                      className={`cursor-pointer transition-colors ${
                        selectedExercices.includes(ex.id)
                          ? 'bg-[#20808D] hover:bg-[#1a6b78] text-white'
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      {ex.titre}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Notes préparatoires */}
          <div className="space-y-1.5">
            <Label htmlFor="contenu">Notes préparatoires</Label>
            <Textarea
              id="contenu"
              value={contenu}
              onChange={(e) => setContenu(e.target.value)}
              placeholder="Notes de préparation…"
              rows={2}
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
              disabled={isPending || !selectedClientId || !dateSeance || !objectif}
              className="bg-[#20808D] hover:bg-[#1a6b78] text-white"
            >
              {isPending ? 'Enregistrement…' : 'Planifier'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
