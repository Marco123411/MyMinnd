'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import { Plus } from 'lucide-react'
import { createProgrammeAction } from '@/app/actions/programmes'

interface CreateProgrammeDialogProps {
  clientId: string
  onCreated?: () => void
}

export function CreateProgrammeDialog({ clientId, onCreated }: CreateProgrammeDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [nom, setNom] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await createProgrammeAction({ client_id: clientId, nom, description: description || null })
      if (result.error) {
        setError(result.error)
      } else {
        setOpen(false)
        setNom('')
        setDescription('')
        router.refresh()
        onCreated?.()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-[#7069F4] hover:bg-[#1a6b77] text-white gap-2">
          <Plus className="h-4 w-4" />
          Nouveau programme
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Créer un programme</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="prog-nom">Nom du programme</Label>
            <Input
              id="prog-nom"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Ex : Confiance en compétition — 6 semaines"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="prog-desc">Description (optionnel)</Label>
            <Textarea
              id="prog-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Objectifs du programme, contexte..."
              rows={3}
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isPending} className="bg-[#7069F4] hover:bg-[#1a6b77] text-white">
              {isPending ? 'Création…' : 'Créer le programme'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
