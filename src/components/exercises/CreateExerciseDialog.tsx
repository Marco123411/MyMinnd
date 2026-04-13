'use client'

import { useState } from 'react'
import { Plus, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ExerciseFormBuilder } from './ExerciseFormBuilder'

interface CreateExerciseDialogProps {
  isExpert: boolean
}

export function CreateExerciseDialog({ isExpert }: CreateExerciseDialogProps) {
  const [open, setOpen] = useState(false)

  if (!isExpert) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Lock className="h-4 w-4" />
        <span>La création d'exercices est réservée au tier Expert</span>
      </div>
    )
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="bg-[#7069F4] hover:bg-[#7069F4]/90 text-white"
      >
        <Plus className="h-4 w-4 mr-2" />
        Créer un exercice
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Créer un exercice personnalisé</DialogTitle>
            <DialogDescription>
              Ajoutez des questions structurées à votre exercice (ouvertes, notations, choix multiples).
            </DialogDescription>
          </DialogHeader>
          <ExerciseFormBuilder
            onSuccess={() => setOpen(false)}
            onCancel={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
