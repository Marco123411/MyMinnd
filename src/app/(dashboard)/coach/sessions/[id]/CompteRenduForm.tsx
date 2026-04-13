'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SessionStatusBadge } from '@/components/sessions/SessionStatusBadge'
import { updateCabinetSessionAction } from '@/app/actions/sessions'
import type { CabinetSession, Exercise } from '@/types'

interface CompteRenduFormProps {
  session: CabinetSession
  exercises: Exercise[]
}

export function CompteRenduForm({ session, exercises }: CompteRenduFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [objectif, setObjectif] = useState(session.objectif)
  const [contenu, setContenu] = useState(session.contenu ?? '')
  const [observations, setObservations] = useState(session.observations ?? '')
  const [prochaine_etape, setProchaine_etape] = useState(session.prochaine_etape ?? '')
  const [duree_minutes, setDuree_minutes] = useState(session.duree_minutes?.toString() ?? '')
  const [selectedExercices, setSelectedExercices] = useState<string[]>(
    session.exercices_utilises.map((e) => e.exercise_id)
  )
  // Preserve existing consignes per exercise to avoid data loss on save
  const consignesMap = Object.fromEntries(
    session.exercices_utilises.map((e) => [e.exercise_id, e.consignes])
  )

  function toggleExercice(id: string) {
    setSelectedExercices((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    )
  }

  function handleSave(newStatut?: 'realisee' | 'annulee') {
    setError(null)

    startTransition(async () => {
      const result = await updateCabinetSessionAction(session.id, {
        objectif,
        contenu: contenu || undefined,
        observations: observations || undefined,
        prochaine_etape: prochaine_etape || undefined,
        duree_minutes: duree_minutes ? parseInt(duree_minutes, 10) : undefined,
        exercices_utilises: selectedExercices.map((id, idx) => ({
          exercise_id: id,
          ordre: idx,
          consignes: consignesMap[id] ?? '',
        })),
        statut: newStatut,
      })

      if (result.error) {
        setError(result.error)
        return
      }

      setSuccess(true)
      setTimeout(() => {
        router.push('/coach/sessions')
      }, 1000)
    })
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <CheckCircle className="h-12 w-12 text-green-500" />
        <p className="text-lg font-medium text-[#141325]">Séance enregistrée</p>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-lg">Compte-rendu de séance</CardTitle>
          <SessionStatusBadge statut={session.statut} />
        </div>
        <p className="text-sm text-gray-500">
          {new Date(session.date_seance).toLocaleString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Objectif */}
        <div className="space-y-1.5">
          <Label htmlFor="objectif">Objectif</Label>
          <Textarea
            id="objectif"
            value={objectif}
            onChange={(e) => setObjectif(e.target.value)}
            rows={2}
          />
        </div>

        {/* Exercices utilisés */}
        {exercises.length > 0 && (
          <div className="space-y-1.5">
            <Label>Exercices utilisés</Label>
            <div className="flex flex-wrap gap-2 p-3 border rounded-md bg-gray-50">
              {exercises.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => toggleExercice(ex.id)}
                  className="focus:outline-none"
                >
                  <Badge
                    variant={selectedExercices.includes(ex.id) ? 'default' : 'outline'}
                    className={`cursor-pointer transition-colors ${
                      selectedExercices.includes(ex.id)
                        ? 'bg-[#7069F4] hover:bg-[#1a6b78] text-white'
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    {ex.titre}
                  </Badge>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Contenu abordé */}
        <div className="space-y-1.5">
          <Label htmlFor="contenu">Contenu abordé</Label>
          <Textarea
            id="contenu"
            value={contenu}
            onChange={(e) => setContenu(e.target.value)}
            placeholder="Ce qui a été traité durant la séance…"
            rows={3}
          />
        </div>

        {/* Observations */}
        <div className="space-y-1.5">
          <Label htmlFor="observations">Observations</Label>
          <Textarea
            id="observations"
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            placeholder="Observations du coach…"
            rows={3}
          />
        </div>

        {/* Prochaine étape */}
        <div className="space-y-1.5">
          <Label htmlFor="prochaine_etape">Prochaine étape</Label>
          <Textarea
            id="prochaine_etape"
            value={prochaine_etape}
            onChange={(e) => setProchaine_etape(e.target.value)}
            placeholder="Actions pour la prochaine séance…"
            rows={2}
          />
        </div>

        {/* Durée effective */}
        <div className="space-y-1.5 max-w-[160px]">
          <Label htmlFor="duree">Durée effective (min)</Label>
          <Input
            id="duree"
            type="number"
            min="0"
            max="480"
            value={duree_minutes}
            onChange={(e) => setDuree_minutes(e.target.value)}
            placeholder="60"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {/* Actions */}
        {session.statut === 'planifiee' && (
          <div className="flex flex-wrap gap-3 pt-2 border-t">
            <Button
              onClick={() => handleSave('realisee')}
              disabled={isPending}
              className="bg-green-600 hover:bg-green-700 text-white gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              {isPending ? 'Enregistrement…' : 'Marquer comme réalisée'}
            </Button>
            <Button
              onClick={() => handleSave('annulee')}
              disabled={isPending}
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50 gap-2"
            >
              <XCircle className="h-4 w-4" />
              Annuler la séance
            </Button>
            <Button
              onClick={() => handleSave()}
              disabled={isPending}
              variant="outline"
            >
              Sauvegarder les notes
            </Button>
          </div>
        )}

        {session.statut !== 'planifiee' && (
          <div className="pt-2 border-t">
            <Button
              onClick={() => handleSave()}
              disabled={isPending}
              className="bg-[#7069F4] hover:bg-[#1a6b78] text-white"
            >
              {isPending ? 'Enregistrement…' : 'Sauvegarder'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
