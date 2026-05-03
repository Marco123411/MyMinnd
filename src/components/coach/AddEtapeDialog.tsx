'use client'

import { useState, useTransition } from 'react'
import type React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Plus, UserCheck, Clock, RefreshCw, ChevronLeft } from 'lucide-react'
import { createAndAddEtapeAction } from '@/app/actions/programmes'
import type { TypeSeance } from '@/types'

interface AddEtapeDialogProps {
  programmeId: string
  onAdded?: () => void
}

const TYPE_CARDS = [
  {
    type: 'cabinet' as TypeSeance,
    label: 'Cabinet',
    sub: 'Séance avec le coach',
    Icon: UserCheck,
    color: '#7069F4',
    borderClass: 'border-[#7069F4]',
    bgClass: 'bg-[#F1F0FE]',
  },
  {
    type: 'autonomie' as TypeSeance,
    label: 'Autonome',
    sub: 'Travail du client seul',
    Icon: Clock,
    color: '#3C3CD6',
    borderClass: 'border-[#3C3CD6]',
    bgClass: 'bg-[#EDEDFC]',
  },
  {
    type: 'recurrente' as TypeSeance,
    label: 'Routine',
    sub: 'Habitude récurrente',
    Icon: RefreshCw,
    color: '#FF9F40',
    borderClass: 'border-amber-400',
    bgClass: 'bg-amber-50',
  },
]

function CabinetForm({
  data,
  onChange,
}: {
  data: Record<string, string>
  onChange: (k: string, v: string) => void
}) {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="objectif">
          Objectif <span className="text-red-500">*</span>
        </Label>
        <Input
          id="objectif"
          value={data.objectif ?? ''}
          onChange={(e) => onChange('objectif', e.target.value)}
          placeholder="Ex : Améliorer la concentration..."
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="date_seance">
          Date <span className="text-red-500">*</span>
        </Label>
        <Input
          id="date_seance"
          type="date"
          value={data.date_seance ?? ''}
          onChange={(e) => onChange('date_seance', e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="contenu">
          Contenu <span className="text-xs text-muted-foreground">(optionnel)</span>
        </Label>
        <Textarea
          id="contenu"
          value={data.contenu ?? ''}
          onChange={(e) => onChange('contenu', e.target.value)}
          placeholder="Déroulé de la séance..."
          rows={3}
        />
      </div>
    </>
  )
}

function AutonomeForm({
  data,
  onChange,
}: {
  data: Record<string, string>
  onChange: (k: string, v: string) => void
}) {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="titre">
          Titre <span className="text-red-500">*</span>
        </Label>
        <Input
          id="titre"
          value={data.titre ?? ''}
          onChange={(e) => onChange('titre', e.target.value)}
          placeholder="Ex : Session cardio..."
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="objectif">
          Objectif <span className="text-red-500">*</span>
        </Label>
        <Input
          id="objectif"
          value={data.objectif ?? ''}
          onChange={(e) => onChange('objectif', e.target.value)}
          placeholder="Ex : Endurance fondamentale..."
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="date_cible">
          Date cible <span className="text-xs text-muted-foreground">(optionnel)</span>
        </Label>
        <Input
          id="date_cible"
          type="date"
          value={data.date_cible ?? ''}
          onChange={(e) => onChange('date_cible', e.target.value)}
        />
      </div>
    </>
  )
}

function RecurrenteForm({
  data,
  onChange,
}: {
  data: Record<string, string>
  onChange: (k: string, v: string) => void
}) {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="titre">
          Titre <span className="text-red-500">*</span>
        </Label>
        <Input
          id="titre"
          value={data.titre ?? ''}
          onChange={(e) => onChange('titre', e.target.value)}
          placeholder="Ex : Méditation quotidienne..."
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="description">
          Description <span className="text-xs text-muted-foreground">(optionnel)</span>
        </Label>
        <Textarea
          id="description"
          value={data.description ?? ''}
          onChange={(e) => onChange('description', e.target.value)}
          placeholder="Instructions, fréquence..."
          rows={3}
        />
      </div>
    </>
  )
}

export function AddEtapeDialog({ programmeId, onAdded }: AddEtapeDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedType, setSelectedType] = useState<TypeSeance | null>(null)
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function reset() {
    setStep(1)
    setSelectedType(null)
    setFormData({})
    setError(null)
  }

  function handleOpenChange(v: boolean) {
    setOpen(v)
    if (!v) reset()
  }

  function handleSelectType(type: TypeSeance) {
    setSelectedType(type)
    setFormData({})
    setError(null)
    setStep(2)
  }

  function handleFieldChange(key: string, value: string) {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedType) return
    setError(null)

    startTransition(async () => {
      const result = await createAndAddEtapeAction(selectedType, {
        programme_id: programmeId,
        ...formData,
      })

      if (result.error) {
        setError(result.error)
      } else {
        setOpen(false)
        reset()
        router.refresh()
        onAdded?.()
      }
    })
  }

  const selectedCard = TYPE_CARDS.find((c) => c.type === selectedType)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-[#7069F4] border-[#7069F4]">
          <Plus className="h-3.5 w-3.5" />
          Ajouter une étape
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? (
              'Ajouter une étape'
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Retour au choix du type"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span style={{ color: selectedCard?.color }}>{selectedCard?.label}</span>
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        {step === 1 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
            {TYPE_CARDS.map(({ type, label, sub, Icon, color, borderClass, bgClass }) => (
              <button
                key={type}
                type="button"
                onClick={() => handleSelectType(type)}
                className={`rounded-lg border-2 p-4 text-center transition-all hover:shadow-md focus:outline-none ${borderClass} ${bgClass}`}
              >
                <Icon className="h-6 w-6 mx-auto mb-2" style={{ color }} />
                <p className="font-medium text-sm" style={{ color }}>{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
              </button>
            ))}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {selectedType === 'cabinet' && (
              <CabinetForm data={formData} onChange={handleFieldChange} />
            )}
            {selectedType === 'autonomie' && (
              <AutonomeForm data={formData} onChange={handleFieldChange} />
            )}
            {selectedType === 'recurrente' && (
              <RecurrenteForm data={formData} onChange={handleFieldChange} />
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="bg-[#7069F4] hover:bg-[#5a54e0] text-white"
              >
                {isPending ? 'Création…' : 'Créer et ajouter au programme'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
