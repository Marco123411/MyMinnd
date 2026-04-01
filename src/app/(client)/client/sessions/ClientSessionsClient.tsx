'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, Play, RotateCcw, Clock } from 'lucide-react'
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
import type { AutonomousSession, RecurringTemplate, RecurringExecution, ExerciceOrdonné } from '@/types'

type TemplateWithExecutions = RecurringTemplate & { executions: RecurringExecution[] }

interface ClientSessionsClientProps {
  autonomousSessions: AutonomousSession[]
  templates: TemplateWithExecutions[]
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

// Affichage séquentiel des exercices d'une séance en cours
function ExerciseDisplay({ exercices }: { exercices: ExerciceOrdonné[] }) {
  const [currentIndex, setCurrentIndex] = useState(0)

  if (exercices.length === 0) {
    return <p className="text-sm text-gray-500">Aucun exercice dans cette séance.</p>
  }

  const current = exercices[currentIndex]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>Exercice {currentIndex + 1} / {exercices.length}</span>
      </div>

      <div className="p-4 border rounded-lg bg-[#E8F4F5]">
        <p className="font-semibold text-[#1A1A2E]">Exercice {currentIndex + 1}</p>
        {current.consignes && (
          <p className="text-sm text-gray-600 mt-2">{current.consignes}</p>
        )}
      </div>

      <div className="flex gap-2">
        {currentIndex > 0 && (
          <Button variant="outline" size="sm" onClick={() => setCurrentIndex((i) => i - 1)}>
            Précédent
          </Button>
        )}
        {currentIndex < exercices.length - 1 && (
          <Button
            size="sm"
            className="bg-[#20808D] hover:bg-[#1a6b78] text-white"
            onClick={() => setCurrentIndex((i) => i + 1)}
          >
            Exercice suivant
          </Button>
        )}
      </div>
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
            <ExerciseDisplay exercices={activeSession.exercices} />
          </CardContent>
        </Card>
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
