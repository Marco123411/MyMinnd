import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Clock, CheckCircle2, MessageSquare } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ExerciseResponsesViewer } from '@/components/exercises/ExerciseResponsesViewer'
import { getAutonomousSessionResultsForCoachAction } from '@/app/actions/exercises'
import type { BonhommeScores, FigureScores, FigureNotes, InteractiveExerciseResult } from '@/types'
import { FIGURE_FACTORS } from '@/lib/exercises/constants'

function StatutBadge({ statut }: { statut: string }) {
  if (statut === 'terminee')  return <Badge className="bg-green-100 text-green-700">Terminée</Badge>
  if (statut === 'en_cours')  return <Badge variant="outline" className="text-amber-600 border-amber-300">En cours</Badge>
  if (statut === 'a_faire')   return <Badge variant="outline" className="text-blue-600 border-blue-300">À faire</Badge>
  if (statut === 'en_retard') return <Badge variant="outline" className="text-orange-600 border-orange-300">En retard</Badge>
  if (statut === 'manquee')   return <Badge variant="outline" className="text-red-500 border-red-300">Manquée</Badge>
  return null
}

// Affichage en lecture seule des scores Bonhomme de Performance
function BonhommeResultDisplay({ data }: { data: Record<string, unknown> }) {
  const scores = data as unknown as BonhommeScores & { global_score?: number }
  const DIMS = [
    { key: 'mental', label: 'Mental' },
    { key: 'strategique', label: 'Stratégique' },
    { key: 'tactique', label: 'Tactique' },
    { key: 'physique', label: 'Physique' },
    { key: 'hygiene', label: 'Hygiène de vie' },
    { key: 'technique', label: 'Technique' },
    { key: 'relationnel', label: 'Relationnel' },
  ] as const

  return (
    <div className="space-y-2">
      {scores.global_score !== undefined && (
        <p className="text-sm font-semibold text-[#20808D]">
          Score global : {Math.round(scores.global_score)}/100
        </p>
      )}
      {DIMS.map(({ key, label }) => {
        const val = Number(scores[key] ?? 0)
        return (
          <div key={key} className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-[#20808D] rounded-full" style={{ width: `${val}%` }} />
            </div>
            <span className="text-xs font-medium w-8 text-right">{val}</span>
          </div>
        )
      })}
    </div>
  )
}

// Affichage en lecture seule des scores Figure de Performance
function FigureResultDisplay({ data }: { data: Record<string, unknown> }) {
  const scores = (data as { scores?: FigureScores; notes?: FigureNotes; global_score?: number })
  const figScores = scores.scores ?? {}
  const figNotes  = scores.notes  ?? {}

  return (
    <div className="space-y-2">
      {scores.global_score !== undefined && (
        <p className="text-sm font-semibold text-[#20808D]">
          Score global : {Math.round(scores.global_score)}/100
        </p>
      )}
      {FIGURE_FACTORS.map((f) => {
        const val  = Number((figScores as Record<string, unknown>)[f.key] ?? 0)
        const note = (figNotes as Record<string, unknown>)[f.key] as string | undefined
        return (
          <div key={f.key} className="space-y-0.5">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-20 shrink-0">{f.label}</span>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${val}%`, backgroundColor: f.color }} />
              </div>
              <span className="text-xs font-medium w-8 text-right">{val}</span>
            </div>
            {note && <p className="text-xs italic text-muted-foreground pl-[6.5rem] line-clamp-2">{note}</p>}
          </div>
        )
      })}
    </div>
  )
}

function InteractiveResultCard({ result }: { result: InteractiveExerciseResult }) {
  const title = result.exercise_type === 'bonhomme_performance'
    ? 'Le Bonhomme de Performance'
    : 'La Figure de Performance'

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {new Date(result.created_at).toLocaleString('fr-FR', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}
        </p>
      </CardHeader>
      <CardContent>
        {result.exercise_type === 'bonhomme_performance' && (
          <BonhommeResultDisplay data={result.data} />
        )}
        {result.exercise_type === 'figure_performance' && (
          <FigureResultDisplay data={result.data} />
        )}
      </CardContent>
    </Card>
  )
}

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>
}) {
  const { id: clientCrmId, sessionId } = await params
  const { session, exerciseResponses, interactiveResults, error } =
    await getAutonomousSessionResultsForCoachAction(sessionId, clientCrmId)

  if (error || !session) notFound()

  const hasResults = exerciseResponses.length > 0 || interactiveResults.length > 0

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6">
      {/* Retour */}
      <Link href={`/coach/clients/${clientCrmId}?tab=seances`}>
        <Button variant="ghost" size="sm" className="gap-1.5 -ml-2">
          <ArrowLeft className="h-4 w-4" />
          Retour à la fiche client
        </Button>
      </Link>

      {/* En-tête de séance */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#1A1A2E]">{session.titre}</h1>
          {session.objectif && (
            <p className="text-sm text-muted-foreground mt-1">{session.objectif}</p>
          )}
        </div>
        <StatutBadge statut={session.statut} />
      </div>

      {/* Métadonnées */}
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
        {session.date_cible && (
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            Date cible : {new Date(session.date_cible).toLocaleDateString('fr-FR', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
          </span>
        )}
        {session.exercices.length > 0 && (
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            {session.exercices.length} exercice{session.exercices.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Feedback client */}
      {session.feedback_client && (
        <Card className="border-[#20808D]/30 bg-[#E8F4F5]/50">
          <CardContent className="pt-4 flex gap-3">
            <MessageSquare className="h-4 w-4 text-[#20808D] shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-[#20808D] uppercase tracking-wide mb-1">
                Ressenti du client
              </p>
              <p className="text-sm italic text-foreground">« {session.feedback_client} »</p>
              {session.duree_realisee && (
                <p className="text-xs text-muted-foreground mt-1">
                  Durée réalisée : {session.duree_realisee} min
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Résultats exercices interactifs */}
      {interactiveResults.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Exercices interactifs
          </h2>
          {interactiveResults.map((r) => (
            <InteractiveResultCard key={r.id} result={r} />
          ))}
        </div>
      )}

      {/* Réponses exercices questionnaire */}
      {exerciseResponses.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Réponses aux exercices
          </h2>
          <ExerciseResponsesViewer data={exerciseResponses} />
        </div>
      )}

      {/* Aucun résultat */}
      {!hasResults && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Aucun résultat enregistré pour cette séance.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
