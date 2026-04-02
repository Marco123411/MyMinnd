'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Plus } from 'lucide-react'
import { addEtapeAction } from '@/app/actions/programmes'
import type { CabinetSession, AutonomousSession, RecurringTemplate, TypeSeance } from '@/types'

interface AddEtapeDialogProps {
  programmeId: string
  cabinetSessions: CabinetSession[]
  autonomousSessions: AutonomousSession[]
  recurringTemplates: RecurringTemplate[]
  onAdded?: () => void
}

export function AddEtapeDialog({
  programmeId,
  cabinetSessions,
  autonomousSessions,
  recurringTemplates,
  onAdded,
}: AddEtapeDialogProps) {
  const [open, setOpen] = useState(false)
  const [typeSeance, setTypeSeance] = useState<TypeSeance | ''>('')
  const [selectedId, setSelectedId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!typeSeance || !selectedId) return
    setError(null)

    startTransition(async () => {
      const result = await addEtapeAction({
        programme_id:          programmeId,
        type_seance:           typeSeance,
        cabinet_session_id:    typeSeance === 'cabinet'    ? selectedId : null,
        autonomous_session_id: typeSeance === 'autonomie'  ? selectedId : null,
        recurring_template_id: typeSeance === 'recurrente' ? selectedId : null,
      })

      if (result.error) {
        setError(result.error)
      } else {
        setOpen(false)
        setTypeSeance('')
        setSelectedId('')
        onAdded?.()
      }
    })
  }

  // Options de séances selon le type sélectionné
  const options = typeSeance === 'cabinet'
    ? cabinetSessions.map((s) => ({ id: s.id, label: `${s.objectif} — ${new Date(s.date_seance).toLocaleDateString('fr-FR')}` }))
    : typeSeance === 'autonomie'
    ? autonomousSessions.map((s) => ({ id: s.id, label: s.titre }))
    : typeSeance === 'recurrente'
    ? recurringTemplates.map((t) => ({ id: t.id, label: t.titre }))
    : []

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-[#20808D] border-[#20808D]">
          <Plus className="h-3.5 w-3.5" />
          Ajouter une étape
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter une étape au programme</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Type de séance</Label>
            <Select value={typeSeance} onValueChange={(v) => { setTypeSeance(v as TypeSeance); setSelectedId('') }}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un type…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cabinet">Séance cabinet</SelectItem>
                <SelectItem value="autonomie">Séance autonome</SelectItem>
                <SelectItem value="recurrente">Routine récurrente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {typeSeance && (
            <div className="space-y-1.5">
              <Label>Séance à ajouter</Label>
              {options.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucune séance de ce type disponible pour ce client.
                </p>
              ) : (
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une séance…" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button
              type="submit"
              disabled={isPending || !typeSeance || !selectedId}
              className="bg-[#20808D] hover:bg-[#1a6b77] text-white"
            >
              {isPending ? 'Ajout…' : "Ajouter l'étape"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
