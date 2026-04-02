import { CheckCircle2, Circle, Lock, UserCheck, Clock, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ProgrammeAvecEtapes } from '@/types'
import { computeProgrammeStats } from '@/lib/programme-utils'

interface ProgrammeProgressProps {
  programme: ProgrammeAvecEtapes
}

function EtapeIcon({ estComplete, estAccessible }: {
  estComplete: boolean
  estAccessible: boolean
}) {
  if (estComplete)   return <CheckCircle2 className="h-5 w-5 text-green-500" />
  if (estAccessible) return <Circle className="h-5 w-5 text-[#20808D]" />
  return <Lock className="h-5 w-5 text-muted-foreground opacity-40" />
}

export function ProgrammeProgress({ programme }: ProgrammeProgressProps) {
  const stats = computeProgrammeStats(programme)
  // Première étape non-complète = accessible ; toutes les suivantes sont verrouillées
  const firstIncompleteOrdre = programme.etapes.find((e) => !e.est_complete)?.ordre ?? Infinity

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-semibold text-[#1A1A2E]">
            {programme.nom}
          </CardTitle>
          <span className="text-sm font-medium text-[#20808D] shrink-0">
            {stats.etapes_completes}/{stats.total_etapes}
          </span>
        </div>
        {programme.description && (
          <p className="text-sm text-muted-foreground">{programme.description}</p>
        )}
        {/* Barre de progression globale */}
        <div className="mt-2">
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-[#20808D] transition-all duration-500"
              style={{ width: `${stats.taux_completion}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1 text-right">
            {stats.taux_completion}% complété
          </p>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <ol className="space-y-3">
          {programme.etapes.map((etape) => {
            const estAccessible = etape.ordre <= firstIncompleteOrdre
            return (
              <li
                key={etape.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  etape.est_complete
                    ? 'border-green-200 bg-green-50'
                    : estAccessible
                    ? 'border-[#20808D]/30 bg-[#E8F4F5]'
                    : 'border-border bg-muted/30 opacity-60'
                }`}
              >
                {/* Icône état */}
                <EtapeIcon
                  estComplete={etape.est_complete}
                  estAccessible={estAccessible}
                />

                {/* Contenu */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs text-muted-foreground">Étape {etape.ordre}</span>
                    {etape.type_seance === 'cabinet' && <UserCheck className="h-3 w-3 text-muted-foreground" />}
                    {etape.type_seance === 'autonomie' && <Clock className="h-3 w-3 text-muted-foreground" />}
                    {etape.type_seance === 'recurrente' && <RefreshCw className="h-3 w-3 text-muted-foreground" />}
                  </div>
                  <p className="text-sm font-medium text-[#1A1A2E] truncate">{etape.titre_display}</p>
                </div>

                {/* Badge complétion */}
                {etape.est_complete && (
                  <Badge className="bg-green-100 text-green-700 text-xs shrink-0">✓ Fait</Badge>
                )}
              </li>
            )
          })}
        </ol>
      </CardContent>
    </Card>
  )
}
