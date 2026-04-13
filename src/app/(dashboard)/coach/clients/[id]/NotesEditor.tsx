'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { updateClientNotesAction } from '@/app/actions/clients'

interface NotesEditorProps {
  clientId: string
  initialNotes: string
  initialObjectifs: string
}

export function NotesEditor({ clientId, initialNotes, initialObjectifs }: NotesEditorProps) {
  const [notes, setNotes] = useState(initialNotes)
  const [objectifs, setObjectifs] = useState(initialObjectifs)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setIsSaving(true)
    setError(null)
    try {
      const result = await updateClientNotesAction(clientId, notes, objectifs)
      if (result.error) {
        setError(result.error)
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur inattendue est survenue')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label>Objectifs</Label>
        <Textarea
          value={objectifs}
          onChange={(e) => { setObjectifs(e.target.value); setSaved(false) }}
          rows={4}
          placeholder="Objectifs du client…"
        />
      </div>

      <div className="space-y-1">
        <Label>Notes privées</Label>
        <Textarea
          value={notes}
          onChange={(e) => { setNotes(e.target.value); setSaved(false) }}
          rows={6}
          placeholder="Notes privées (visibles uniquement par vous)…"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-[#7069F4] text-white hover:bg-[#7069F4]/90"
        >
          {isSaving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
        {saved && <span className="text-sm text-[#7069F4]">✓ Enregistré</span>}
      </div>
    </div>
  )
}
