'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, Play, RotateCcw, Clock, UserCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SessionStatusBadge } from '@/components/sessions/SessionStatusBadge'
import {
  updateAutonomousSessionStatutAction,
  executeRecurringTemplateAction,
} from '@/app/actions/sessions'
import type { AutonomousSessionEnrichi, ExerciceEnrichi, ExerciseResponseItem, RecurringTemplate, RecurringExecution, CabinetSession } from '@/types'
import { saveExerciseResponseAction, saveClientInteractiveExerciseResultAction } from '@/app/actions/exercises'
import { BonhommePerformance } from '@/components/exercises/BonhommePerformance'
import { FigurePerformance } from '@/components/exercises/FigurePerformance'

type TemplateWithExecutions = RecurringTemplate & { executions: RecurringExecution[] }

interface ClientSessionsClientProps {
  autonomousSessions: AutonomousSessionEnrichi[]
  templates: TemplateWithExecutions[]
  cabinetSessions: CabinetSession[]
}

type ResponseMap = Record<string, ExerciseResponseItem>

// Détermine le type d'exercice interactif MINND à partir du titre
function interactiveTypeFromTitle(titre: string): 'bonhomme_performance' | 'figure_performance' | null {
  const t = titre.toLowerCase()
  if (t.includes('bonhomme')) return 'bonhomme_performance'
  if (t.includes('figure'))   return 'figure_performance'
  return null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function countThisWeek(executions: RecurringExecution[]): number {
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  return executions.filter((e) => new Date(e.started_at) >= weekAgo).length
}

// Affichage interactif des exercices d'une séance en cours
function ExerciseDisplay({
  exercices,
  sessionId,
}: {
  exercices: ExerciceEnrichi[]
  sessionId: string
}) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [responses, setResponses] = useState<ResponseMap>({})
  const [isPending, startTransition] = useTransition()
  const [saveError, setSaveError] = useState<string | null>(null)

  if (exercices.length === 0) {
    return <p className="text-sm text-gray-500">Aucun exercice dans cette séance.</p>
  }

  // Tous les exercices terminés — le client peut cliquer sur "Terminer"
  if (currentIndex >= exercices.length) {
    return (
      <p className="text-sm text-green-700 font-medium bg-green-50 border border-green-200 rounded px-3 py-2">
        ✓ Tous les exercices sont complétés. Cliquez sur &ldquo;Terminer&rdquo; pour valider la séance.
      </p>
    )
  }

  const current = exercices[currentIndex]
  const exercise = current.exercise
  const questions = exercise?.questions ?? []
  const hasQuestions = questions.length > 0
  const isInteractive = exercise?.format === 'interactive'
  const interactiveType = exercise ? interactiveTypeFromTitle(exercise.titre) : null
  const isLastExercise = currentIndex === exercices.length - 1

  function goNext() {
    setCurrentIndex((i) => i + 1)
    setResponses({})
    setSaveError(null)
  }

  function handlePrev() {
    setCurrentIndex((i) => i - 1)
    setResponses({})
    setSaveError(null)
  }

  function handleResponseChange(questionId: string, type: ExerciseResponseItem['type'], value: string | number) {
    setResponses((prev) => ({
      ...prev,
      [questionId]: { question_id: questionId, type, value },
    }))
  }

  function handleQuestionnaireNext() {
    if (!hasQuestions || !exercise) { goNext(); return }
    const responseList = Object.values(responses)
    startTransition(async () => {
      const result = await saveExerciseResponseAction(exercise.id, responseList, sessionId, 'autonomous')
      if (result.error) { setSaveError(result.error); return }
      goNext()
    })
  }

  function handleInteractiveSave(data: Record<string, unknown>) {
    if (!interactiveType) return
    startTransition(async () => {
      const result = await saveClientInteractiveExerciseResultAction(interactiveType, data, sessionId)
      if (result.error) { setSaveError(result.error); return }
      goNext()
    })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Exercice {currentIndex + 1} / {exercices.length}
      </p>

      {/* Exercice interactif MINND natif (Bonhomme / Figure) */}
      {isInteractive && interactiveType ? (
        <div className="space-y-3">
          {current.consignes && (
            <div className="px-3 py-2 rounded-lg bg-[#E8F4F5] text-sm text-gray-700 border border-[#20808D]/20">
              <span className="text-xs font-medium text-[#20808D] uppercase tracking-wide block mb-0.5">Consignes</span>
              {current.consignes}
            </div>
          )}
          {interactiveType === 'bonhomme_performance' && (
            <BonhommePerformance
              onSave={(data) => handleInteractiveSave(data as unknown as Record<string, unknown>)}
              isPending={isPending}
            />
          )}
          {interactiveType === 'figure_performance' && (
            <FigurePerformance
              onSave={(data) => handleInteractiveSave(data as unknown as Record<string, unknown>)}
              isPending={isPending}
            />
          )}
          {saveError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{saveError}</p>
          )}
        </div>
      ) : (
        /* Exercice questionnaire ou sans questions */
        <div className="p-4 border rounded-lg bg-[#E8F4F5] space-y-3">
          <p className="font-semibold text-[#1A1A2E]">
            {exercise?.titre ?? `Exercice ${currentIndex + 1}`}
          </p>
          {exercise?.description && (
            <p className="text-sm text-gray-600">{exercise.description}</p>
          )}
          {current.consignes && (
            <div className="border-t border-[#20808D]/20 pt-3">
              <p className="text-xs font-medium text-[#20808D] uppercase tracking-wide mb-1">Consignes</p>
              <p className="text-sm text-gray-700">{current.consignes}</p>
            </div>
          )}
          {hasQuestions && (
            <div className="border-t border-[#20808D]/20 pt-3 space-y-4">
              {questions.map((q) => {
                const val = responses[q.id]?.value
                if (q.type === 'open') return (
                  <div key={q.id} className="space-y-1.5">
                    <Label className="text-sm font-medium text-[#1A1A2E]">{q.label}</Label>
                    <Textarea value={(val as string) ?? ''} onChange={(e) => handleResponseChange(q.id, 'open', e.target.value)} placeholder="Votre réponse..." rows={3} className="bg-white" />
                  </div>
                )
                if (q.type === 'scale') {
                  const min = q.min ?? 1; const max = q.max ?? 10; const num = (val as number) ?? min
                  return (
                    <div key={q.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium text-[#1A1A2E]">{q.label}</Label>
                        <span className="text-sm font-bold text-[#20808D]">{num}</span>
                      </div>
                      <input type="range" min={min} max={max} value={num} onChange={(e) => handleResponseChange(q.id, 'scale', parseInt(e.target.value, 10))} className="w-full accent-[#20808D]" />
                      <div className="flex justify-between text-xs text-gray-400"><span>{min}</span><span>{max}</span></div>
                    </div>
                  )
                }
                if (q.type === 'mcq' && q.options) return (
                  <div key={q.id} className="space-y-2">
                    <Label className="text-sm font-medium text-[#1A1A2E]">{q.label}</Label>
                    <div className="space-y-1.5">
                      {q.options.map((opt) => (
                        <label key={opt} className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name={q.id} value={opt} checked={val === opt} onChange={() => handleResponseChange(q.id, 'mcq', opt)} className="accent-[#20808D]" />
                          <span className="text-sm text-gray-700">{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )
                return null
              })}
            </div>
          )}
        </div>
      )}

      {!isInteractive && saveError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{saveError}</p>
      )}

      {/* Navigation (questionnaire et exercices sans questions uniquement — les interactifs ont leur propre bouton Valider) */}
      {!isInteractive && (
        <div className="flex gap-2">
          {currentIndex > 0 && (
            <Button variant="outline" size="sm" onClick={handlePrev} disabled={isPending}>
              Précédent
            </Button>
          )}
          {!isLastExercise && (
            <Button size="sm" onClick={handleQuestionnaireNext} disabled={isPending} className="bg-[#20808D] hover:bg-[#1a6b78] text-white">
              {isPending ? 'Enregistrement…' : hasQuestions ? 'Valider et continuer' : 'Exercice suivant'}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

// Modal pour terminer une séance
function TerminerModal({
  sessionId,
  onClose,
  onSuccess,
}: {
  sessionId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState('')
  const [duree, setDuree] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await updateAutonomousSessionStatutAction(sessionId, {
        statut: 'terminee',
        feedback_client: feedback || undefined,
        duree_realisee: duree ? parseInt(duree, 10) : undefined,
      })

      if (result.error) {
        setError(result.error)
        return
      }
      onSuccess()
    })
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Terminer la séance</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="feedback">Votre ressenti (optionnel)</Label>
            <Textarea
              id="feedback"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Comment s'est passée la séance ?"
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="duree">Durée réalisée (minutes)</Label>
            <Input
              id="duree"
              type="number"
              min="1"
              value={duree}
              onChange={(e) => setDuree(e.target.value)}
              placeholder="Ex: 30"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-green-600 hover:bg-green-700 text-white gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              {isPending ? 'Enregistrement…' : 'Terminer'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function ClientSessionsClient({
  autonomousSessions,
  templates,
  cabinetSessions,
}: ClientSessionsClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [terminerSessionId, setTerminerSessionId] = useState<string | null>(null)
  const [executingTemplateId, setExecutingTemplateId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  function handleCommencer(sessionId: string) {
    setActionError(null)
    startTransition(async () => {
      const result = await updateAutonomousSessionStatutAction(sessionId, { statut: 'en_cours' })
      if (result.error) {
        setActionError(result.error)
        return
      }
      setActiveSessionId(sessionId)
      router.refresh()
    })
  }

  function handleLancerTemplate(templateId: string) {
    setActionError(null)
    setExecutingTemplateId(templateId)
    startTransition(async () => {
      const result = await executeRecurringTemplateAction({ template_id: templateId })
      setExecutingTemplateId(null)
      if (result.error) {
        setActionError(result.error)
        return
      }
      router.refresh()
    })
  }

  const activeSession = autonomousSessions.find((s) => s.id === activeSessionId)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#1A1A2E]">Mes séances</h1>
        <p className="text-gray-500 text-sm mt-0.5">Retrouvez vos séances en autonomie et vos routines</p>
      </div>

      {actionError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{actionError}</p>
      )}

      {/* Session active */}
      {activeSession && (
        <Card className="border-[#20808D] border-2">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base text-[#20808D]">
                En cours — {activeSession.titre}
              </CardTitle>
              <Button
                size="sm"
                onClick={() => setTerminerSessionId(activeSession.id)}
                className="bg-green-600 hover:bg-green-700 text-white gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                Terminer
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">{activeSession.objectif}</p>
            <ExerciseDisplay exercices={activeSession.exercices} sessionId={activeSession.id} />
          </CardContent>
        </Card>
      )}

      {/* Séances cabinet (coach-client) */}
      {cabinetSessions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[#1A1A2E]">Séances avec votre coach</h2>
          <div className="space-y-3">
            {cabinetSessions.map((s) => (
              <Card key={s.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <UserCheck className="h-4 w-4 text-[#20808D] shrink-0" />
                        <p className="font-medium text-[#1A1A2E] truncate">{s.objectif}</p>
                      </div>
                      <p className="text-xs text-gray-400">{formatDate(s.date_seance)}</p>
                      {s.observations && (
                        <p className="text-sm text-gray-500 mt-2 line-clamp-2">{s.observations}</p>
                      )}
                      {s.prochaine_etape && (
                        <p className="text-sm text-[#20808D] mt-1 italic line-clamp-1">
                          Prochaine étape : {s.prochaine_etape}
                        </p>
                      )}
                    </div>
                    <SessionStatusBadge statut={s.statut} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Séances en autonomie */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[#1A1A2E]">Séances en autonomie</h2>

        {autonomousSessions.length === 0 ? (
          <p className="text-sm text-gray-400">Aucune séance assignée pour le moment.</p>
        ) : (
          <div className="space-y-3">
            {autonomousSessions.map((s) => {
              const isLate = s.date_cible && new Date(s.date_cible) < new Date() && s.statut === 'a_faire'

              return (
                <Card key={s.id} className={s.statut === 'manquee' ? 'opacity-60' : ''}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-medium text-[#1A1A2E] truncate">{s.titre}</p>
                          {isLate && (
                            <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">
                              En retard
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 line-clamp-2">{s.objectif}</p>
                        {s.date_cible && (
                          <p className="text-xs text-gray-400 mt-1">
                            Date cible : {formatDate(s.date_cible)}
                          </p>
                        )}
                        {s.feedback_client && s.statut === 'terminee' && (
                          <p className="text-xs italic text-gray-500 mt-2">
                            &ldquo;{s.feedback_client}&rdquo;
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <SessionStatusBadge statut={s.statut} />

                        {s.statut === 'a_faire' && (
                          <Button
                            size="sm"
                            onClick={() => handleCommencer(s.id)}
                            disabled={isPending}
                            className="bg-[#20808D] hover:bg-[#1a6b78] text-white gap-1.5"
                          >
                            <Play className="h-3.5 w-3.5" />
                            Commencer
                          </Button>
                        )}

                        {s.statut === 'en_cours' && s.id !== activeSessionId && (
                          <Button
                            size="sm"
                            onClick={() => setActiveSessionId(s.id)}
                            variant="outline"
                            className="gap-1.5"
                          >
                            <Play className="h-3.5 w-3.5" />
                            Reprendre
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* Templates récurrents */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-[#1A1A2E]">Mes routines</h2>

        {templates.length === 0 ? (
          <p className="text-sm text-gray-400">Aucune routine assignée pour le moment.</p>
        ) : (
          <div className="space-y-3">
            {templates.map((t) => {
              const weekCount = countThisWeek(t.executions)

              return (
                <Card key={t.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-medium text-[#1A1A2E]">{t.titre}</p>
                          {weekCount > 0 && (
                            <Badge className="bg-[#E8F4F5] text-[#20808D] border-[#20808D]/20 text-xs">
                              {weekCount}× cette semaine
                            </Badge>
                          )}
                        </div>
                        {t.description && (
                          <p className="text-sm text-gray-500">{t.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                          {t.duree_estimee && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {t.duree_estimee} min
                            </span>
                          )}
                          <span>{t.executions.length} exécution{t.executions.length !== 1 ? 's' : ''}</span>
                        </div>

                        {/* Historique récent */}
                        {t.executions.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {t.executions.slice(0, 5).map((e) => (
                              <span
                                key={e.id}
                                className="text-xs bg-gray-100 text-gray-500 rounded px-1.5 py-0.5"
                              >
                                {new Date(e.started_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <Button
                        size="sm"
                        onClick={() => handleLancerTemplate(t.id)}
                        disabled={isPending && executingTemplateId === t.id}
                        className="bg-[#FFC553] hover:bg-[#e6b04a] text-[#1A1A2E] gap-1.5"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        {isPending && executingTemplateId === t.id ? 'Lancement…' : 'Lancer'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* Modal terminer séance */}
      {terminerSessionId && (
        <TerminerModal
          sessionId={terminerSessionId}
          onClose={() => setTerminerSessionId(null)}
          onSuccess={() => {
            setTerminerSessionId(null)
            setActiveSessionId(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
