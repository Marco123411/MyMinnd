'use client'

import { useEffect, useState } from 'react'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { TestTimer } from '@/components/cognitive/TestTimer'

interface CognitiveTestShellProps {
  children: React.ReactNode
  title: string
  progressValue: number // 0–100
  progressLabel: string
  onAbandon: () => void
  durationSec?: number // affiche TestTimer mm:ss quand fourni (mode programme)
}

export function CognitiveTestShell({
  children,
  title,
  progressValue,
  progressLabel,
  onAbandon,
  durationSec,
}: CognitiveTestShellProps) {
  const [showAbandonDialog, setShowAbandonDialog] = useState(false)

  // Proposer le plein écran au montage
  useEffect(() => {
    if (document.fullscreenEnabled && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {
        // L'utilisateur peut refuser — on continue normalement
      })
    }

    return () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }
    }
  }, [])

  // Touche Échap → ouvrir la confirmation d'abandon
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowAbandonDialog(true)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="fixed inset-0 flex flex-col bg-gray-950 text-white">
      {/* Timer mm:ss visible en mode programme */}
      {durationSec !== undefined && (
        <TestTimer durationSec={durationSec} onExpire={() => {}} />
      )}

      {/* Barre de progression en haut */}
      <div className="flex-shrink-0 px-4 pt-3 pb-2 space-y-1">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>{title}</span>
          <span>{progressLabel}</span>
        </div>
        <Progress
          value={progressValue}
          className="h-1.5 bg-gray-800 [&>div]:bg-[#7069F4]"
        />
      </div>

      {/* Zone de test principale */}
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        {children}
      </div>

      {/* Bouton abandonner — discret en bas à droite */}
      <div className="flex-shrink-0 flex justify-end px-4 pb-3">
        <Button
          variant="ghost"
          size="sm"
          className="text-gray-600 hover:text-gray-400 text-xs"
          onClick={() => setShowAbandonDialog(true)}
        >
          Abandonner
        </Button>
      </div>

      {/* Dialog de confirmation */}
      <Dialog open={showAbandonDialog} onOpenChange={setShowAbandonDialog}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle>Abandonner ce test ?</DialogTitle>
            <DialogDescription className="text-gray-400">
              Votre progression sera perdue et la session sera marquée comme abandonnée.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              className="text-gray-400"
              onClick={() => setShowAbandonDialog(false)}
            >
              Continuer le test
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowAbandonDialog(false)
                onAbandon()
              }}
            >
              Abandonner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
