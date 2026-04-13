import Link from 'next/link'
import { CheckCircle2, Circle, Lock, UserCheck, Clock, RefreshCw, Brain, ArrowRight, Dumbbell } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ProgrammeAvecEtapes, ProgramExercise } from '@/types'
import { computeProgrammeStats } from '@/lib/programme-utils'

interface ProgrammeProgressProps {
  programme: ProgrammeAvecEtapes
}

const PHASE_LABELS: Record<'pre' | 'in' | 'post', string> = {
  pre:  'PRÉ',
  in:   'IN',
  post: 'POST',
}

const PHASE_COLORS: Record<'pre' | 'in' | 'post', string> = {
  pre:  'bg-[#E8F4F5] text-[#20808D]',
  in:   'bg-[#FFF9E6] text-[#A07A00]',
  post: 'bg-[#F5E8EC] text-[#944454]',
}

function EtapeIcon({ estComplete, estAccessible }: {
  estComplete: boolean
  estAccessible: boolean
}) {
  if (estComplete)   return <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
  if (estAccessible) return <Circle className="h-5 w-5 text-[#7069F4] shrink-0" />
  return <Lock className="h-5 w-5 text-muted-foreground opacity-40 shrink-0" />
}

function DrillCard({ drill, accessible }: { drill: ProgramExercise; accessible: boolean }) {
  const def = drill.cognitive_test_definitions
  const ex  = drill.exercises

  // Exercice PM classique (video, document, questionnaire…)
  if (!def && ex) {
    if (!accessible) {
      return (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 p-2.5 opacity-50">
          <Dumbbell className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground truncate">{ex.titre}</p>
          </div>
          <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </div>
      )
    }
    return (
      <Link
        href={`/client/exercises/${ex.id}`}
        className="flex items-center gap-2 rounded-lg border border-[#7069F4]/30 bg-[#F1F0FE]/50 p-2.5 hover:bg-[#F1F0FE] hover:border-[#7069F4] transition-colors group"
      >
        <Dumbbell className="h-4 w-4 text-[#7069F4] shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-[#141325] truncate">{ex.titre}</p>
          {drill.phase && (
            <span className={`inline-block rounded text-[10px] px-1.5 py-0.5 font-semibold mt-0.5 ${PHASE_COLORS[drill.phase as 'pre' | 'in' | 'post']}`}>
              {PHASE_LABELS[drill.phase as 'pre' | 'in' | 'post']}
            </span>
          )}
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-[#7069F4] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </Link>
    )
  }

  // Drill cognitif
  if (!def) return null

  const phase = drill.phase as 'pre' | 'in' | 'post' | null
  const durationMin = drill.configured_duration_sec ? drill.configured_duration_sec / 60 : null

  if (!accessible) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 p-2.5 opacity-50">
        <Brain className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground truncate">{def.name}</p>
        </div>
        <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </div>
    )
  }

  return (
    <Link
      href={`/test/program/${drill.id}`}
      className="flex items-center gap-2 rounded-lg border border-[#20808D]/30 bg-[#E8F4F5]/50 p-2.5 hover:bg-[#E8F4F5] hover:border-[#20808D] transition-colors group"
    >
      <Brain className="h-4 w-4 text-[#20808D] shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-[#141325] truncate">{def.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {phase && (
            <span className={`rounded text-[10px] px-1.5 py-0.5 font-semibold ${PHASE_COLORS[phase]}`}>
              {PHASE_LABELS[phase]}
            </span>
          )}
          {durationMin !== null && (
            <span className="text-[10px] text-muted-foreground">{durationMin} min</span>
          )}
          {drill.cognitive_load_score !== null && (
            <span className="text-[10px] text-muted-foreground">CLS {drill.cognitive_load_score}</span>
          )}
        </div>
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-[#20808D] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  )
}

export function ProgrammeProgress({ programme }: ProgrammeProgressProps) {
  const stats = computeProgrammeStats(programme)
  const firstIncompleteOrdre = programme.etapes.find((e) => !e.est_complete)?.ordre ?? Infinity

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-semibold text-[#141325]">
            {programme.nom}
          </CardTitle>
          <span className="text-sm font-medium text-[#7069F4] shrink-0">
            {stats.etapes_completes}/{stats.total_etapes}
          </span>
        </div>
        {programme.description && (
          <p className="text-sm text-muted-foreground">{programme.description}</p>
        )}
        <div className="mt-2">
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-[#7069F4] transition-all duration-500"
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
            const drills = (etape.program_exercises ?? []).sort((a, b) => {
              const phaseOrder = { pre: 0, in: 1, post: 2 }
              return (phaseOrder[a.phase as 'pre' | 'in' | 'post'] ?? 1) - (phaseOrder[b.phase as 'pre' | 'in' | 'post'] ?? 1)
            })

            return (
              <li
                key={etape.id}
                className={`rounded-lg border transition-colors ${
                  etape.est_complete
                    ? 'border-green-200 bg-green-50'
                    : estAccessible
                    ? 'border-[#7069F4]/30 bg-[#F1F0FE]'
                    : 'border-border bg-muted/30 opacity-60'
                }`}
              >
                {/* En-tête de l'étape */}
                <div className="flex items-center gap-3 p-3">
                  <EtapeIcon estComplete={etape.est_complete} estAccessible={estAccessible} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-xs text-muted-foreground">Étape {etape.ordre}</span>
                      {etape.type_seance === 'cabinet'    && <UserCheck className="h-3 w-3 text-muted-foreground" />}
                      {etape.type_seance === 'autonomie'  && <Clock className="h-3 w-3 text-muted-foreground" />}
                      {etape.type_seance === 'recurrente' && <RefreshCw className="h-3 w-3 text-muted-foreground" />}
                    </div>
                    <p className="text-sm font-medium text-[#141325] truncate">{etape.titre_display}</p>
                  </div>
                  {etape.est_complete && (
                    <Badge className="bg-green-100 text-green-700 text-xs shrink-0">✓ Fait</Badge>
                  )}
                </div>

                {/* Exercices et drills cognitifs de cette étape */}
                {drills.length > 0 && (
                  <div className="px-3 pb-3 space-y-2">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium mb-1">
                      {drills.length} activité{drills.length > 1 ? 's' : ''}
                    </div>
                    {drills.map((drill) => (
                      <DrillCard key={drill.id} drill={drill} accessible={estAccessible} />
                    ))}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      </CardContent>
    </Card>
  )
}
