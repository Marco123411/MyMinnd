'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Trash2, CheckCircle2, Circle, UserCheck, Clock, RefreshCw } from 'lucide-react'
import { removeEtapeAction } from '@/app/actions/programmes'
import type { ProgrammeAvecEtapes } from '@/types'

interface ProgrammeEtapesListProps {
  programme: ProgrammeAvecEtapes
  onUpdate?: () => void
}

function TypeBadge({ type }: { type: string }) {
  if (type === 'cabinet')    return <Badge variant="outline" className="text-[#20808D] border-[#20808D] text-xs gap-1"><UserCheck className="h-3 w-3" />Cabinet</Badge>
  if (type === 'autonomie')  return <Badge variant="outline" className="text-[#944454] border-[#944454] text-xs gap-1"><Clock className="h-3 w-3" />Autonome</Badge>
  if (type === 'recurrente') return <Badge variant="outline" className="text-amber-600 border-amber-400 text-xs gap-1"><RefreshCw className="h-3 w-3" />Routine</Badge>
  return null
}

export function ProgrammeEtapesList({ programme, onUpdate }: ProgrammeEtapesListProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleRemove(etapeId: string) {
    setError(null)
    startTransition(async () => {
      const result = await removeEtapeAction(etapeId, programme.id)
      if (result.error) {
        setError(result.error)
      } else {
        onUpdate?.()
      }
    })
  }

  const stats = {
    total:     programme.etapes.length,
    completes: programme.etapes.filter((e) => e.est_complete).length,
  }

  return (
    <div className="space-y-3">
      {/* En-tête programme */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-[#1A1A2E]">{programme.nom}</h4>
          {programme.description && (
            <p className="text-sm text-muted-foreground">{programme.description}</p>
          )}
        </div>
        <span className="text-sm text-muted-foreground">
          {stats.completes}/{stats.total} étape{stats.total > 1 ? 's' : ''}
        </span>
      </div>

      {/* Barre de progression */}
      {stats.total > 0 && (
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-[#20808D] transition-all"
            style={{ width: `${Math.round((stats.completes / stats.total) * 100)}%` }}
          />
        </div>
      )}

      {/* Liste des étapes */}
      {programme.etapes.length === 0 ? (
        <p className="text-sm text-muted-foreground py-3 text-center">
          Aucune étape ajoutée. Créez des séances puis ajoutez-les au programme.
        </p>
      ) : (
        <ol className="space-y-2">
          {programme.etapes.map((etape) => (
            <li
              key={etape.id}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card"
            >
              {/* Numéro + icône complétion */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-mono text-muted-foreground w-5 text-right">
                  {etape.ordre}.
                </span>
                {etape.est_complete ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
              </div>

              {/* Titre + type */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{etape.titre_display}</p>
                <TypeBadge type={etape.type_seance} />
              </div>

              {/* Bouton supprimer */}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-red-500 shrink-0"
                onClick={() => handleRemove(etape.id)}
                disabled={isPending}
                aria-label="Supprimer cette étape"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ol>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
