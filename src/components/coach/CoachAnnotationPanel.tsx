'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { upsertCoachNoteAction, deleteCoachNoteAction } from '@/app/actions/coach-notes'

interface CoachAnnotationPanelProps {
  testId: string
  nodeId: string
  nodeName: string
  initialNote: string
  disabled: boolean
}

export function CoachAnnotationPanel({
  testId,
  nodeId,
  initialNote,
  disabled,
}: CoachAnnotationPanelProps) {
  const [value, setValue] = useState(initialNote)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef(initialNote)

  // Cleanup debounce timer on unmount to avoid state updates on an unmounted component
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const save = useCallback(
    async (text: string) => {
      setStatus('saving')
      if (text.trim() === '') {
        const { error } = await deleteCoachNoteAction(testId, nodeId)
        setStatus(error ? 'error' : 'saved')
      } else {
        const { error } = await upsertCoachNoteAction(testId, nodeId, text)
        setStatus(error ? 'error' : 'saved')
      }
      lastSavedRef.current = text
    },
    [testId, nodeId]
  )

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    setValue(text)
    setStatus('saving')

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      save(text)
    }, 800)
  }

  const handleBlur = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    // Évite une requête inutile si la valeur n'a pas changé depuis la dernière sauvegarde
    if (value !== lastSavedRef.current) {
      save(value)
    }
  }

  return (
    <div className="mt-2">
      <div className="relative">
        <textarea
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled}
          rows={3}
          placeholder={
            disabled
              ? 'Résultats publiés — annotations en lecture seule.'
              : 'Ajoutez un commentaire sur cette compétence…'
          }
          className={`w-full resize-none rounded-md border px-3 py-2 text-sm outline-none transition-colors focus:border-[#20808D] focus:ring-1 focus:ring-[#20808D] ${
            disabled
              ? 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-500'
              : 'border-gray-200 bg-white text-[#1A1A2E] hover:border-gray-300'
          }`}
        />
      </div>

      {/* Indicateur de statut */}
      {!disabled && status !== 'idle' && (
        <p
          className={`mt-1 text-xs ${
            status === 'saving'
              ? 'text-gray-400'
              : status === 'saved'
              ? 'text-[#20808D]'
              : 'text-red-500'
          }`}
        >
          {status === 'saving' && 'Enregistrement…'}
          {status === 'saved' && 'Enregistré ✓'}
          {status === 'error' && 'Erreur lors de l\'enregistrement'}
        </p>
      )}
    </div>
  )
}
