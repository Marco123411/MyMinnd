'use client'

import { useState, useTransition } from 'react'
import { Plus, Brain } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import DrillConfigurator from '@/components/coach/DrillConfigurator'
import { addDrillToEtapeAction } from '@/app/actions/programmes'
import type { CognitiveTestDefinition } from '@/types'

const CATEGORY_LABELS: Record<string, string> = {
  attention:  'Attention',
  inhibition: 'Inhibition',
  memory:     'Mémoire',
  decision:   'Décision',
  wellbeing:  'Bien-être',
}

const CATEGORY_COLORS: Record<string, string> = {
  attention:  'bg-blue-100 text-blue-700',
  inhibition: 'bg-amber-100 text-amber-700',
  memory:     'bg-purple-100 text-purple-700',
  decision:   'bg-green-100 text-green-700',
  wellbeing:  'bg-teal-100 text-teal-700',
}

interface AddDrillDialogProps {
  etapeId: string
  filterPhase?: 'pre' | 'in' | 'post'
  cognitiveTests: CognitiveTestDefinition[]
  onAdded?: () => void
  // Mode contrôlé (depuis les boutons "+" par colonne)
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function AddDrillDialog({
  etapeId,
  filterPhase,
  cognitiveTests,
  onAdded,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: AddDrillDialogProps) {
  const isControlled = controlledOpen !== undefined
  const [internalOpen, setInternalOpen] = useState(false)
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? (controlledOnOpenChange ?? (() => {})) : setInternalOpen
  const [selectedTest, setSelectedTest] = useState<CognitiveTestDefinition | null>(null)
  const [configuratorOpen, setConfiguratorOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Filtrer par phase si spécifié
  const filtered = filterPhase
    ? cognitiveTests.filter(t => t.phase_tags?.includes(filterPhase))
    : cognitiveTests

  function handleSelectTest(test: CognitiveTestDefinition) {
    setSelectedTest(test)
    setOpen(false)
    setConfiguratorOpen(true)
  }

  function handleSaveDrill(config: {
    durationSec: number
    intensityPercent: number
    phase: 'pre' | 'in' | 'post'
    cognitiveLoadScore: number
  }) {
    if (!selectedTest) return
    setError(null)

    startTransition(async () => {
      const result = await addDrillToEtapeAction({
        etape_id:                     etapeId,
        cognitive_test_id:            selectedTest.id,
        phase:                        config.phase,
        configured_duration_sec:      config.durationSec,
        configured_intensity_percent: config.intensityPercent,
        cognitive_load_score:         config.cognitiveLoadScore,
      })

      if (result.error) {
        setError(result.error)
      } else {
        setSelectedTest(null)
        onAdded?.()
      }
    })
  }

  return (
    <>
      {/* Dialogue de sélection du test */}
      <Dialog open={open} onOpenChange={setOpen}>
        {!isControlled && (
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-[#20808D] border-[#20808D]"
              disabled={isPending}
            >
              <Brain className="h-3.5 w-3.5" />
              <Plus className="h-3 w-3" />
              Drill cognitif
            </Button>
          </DialogTrigger>
        )}
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Choisir un drill cognitif</DialogTitle>
          </DialogHeader>

          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Aucun drill disponible pour cette phase.
            </p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {filtered.map(test => (
                <button
                  key={test.id}
                  type="button"
                  onClick={() => handleSelectTest(test)}
                  className="w-full rounded-lg border p-3 text-left hover:border-[#20808D] hover:bg-[#E8F4F5]/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{test.name}</p>
                      {test.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {test.description}
                        </p>
                      )}
                    </div>
                    {test.cognitive_category && (
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[test.cognitive_category] ?? ''}`}>
                        {CATEGORY_LABELS[test.cognitive_category] ?? test.cognitive_category}
                      </span>
                    )}
                  </div>
                  {test.phase_tags && test.phase_tags.length > 0 && (
                    <div className="mt-1.5 flex gap-1">
                      {test.phase_tags.map(tag => (
                        <span key={tag} className="rounded text-xs px-1.5 py-0.5 bg-muted text-muted-foreground uppercase font-mono">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </DialogContent>
      </Dialog>

      {/* Configurateur (slide-over) */}
      {selectedTest && (
        <DrillConfigurator
          isOpen={configuratorOpen}
          onClose={() => { setConfiguratorOpen(false); setSelectedTest(null) }}
          testDefinition={selectedTest}
          initialConfig={filterPhase ? { phase: filterPhase } : undefined}
          onSave={handleSaveDrill}
        />
      )}
    </>
  )
}
