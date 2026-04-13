'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { publishTestResultsAction } from '@/app/actions/coach-notes'

interface PublishTestButtonProps {
  testId: string
}

export function PublishTestButton({ testId }: PublishTestButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePublish = async () => {
    setPublishing(true)
    setError(null)
    const { error: publishError } = await publishTestResultsAction(testId)
    setPublishing(false)

    if (publishError) {
      setError(publishError)
      return
    }

    setOpen(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#7069F4] hover:bg-[#5B54D6]">
          Publier les résultats
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publier les résultats</DialogTitle>
          <DialogDescription>
            Une fois publiés, votre client pourra consulter ses résultats et vos annotations.
            Cette action est irréversible.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={publishing}>
            Annuler
          </Button>
          <Button
            onClick={handlePublish}
            disabled={publishing}
            className="bg-[#7069F4] hover:bg-[#5B54D6]"
          >
            {publishing ? 'Publication…' : 'Confirmer la publication'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
