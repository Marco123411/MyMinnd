'use client'

import {
  LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Exercise, ExerciseQuestion, ExerciseResponseItem, ExerciseResponseRecord } from '@/types'

// ============================================================
// Utilitaires
// ============================================================

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

// ============================================================
// Affichage d'une réponse individuelle
// ============================================================

function ResponseItemDisplay({
  question,
  item,
}: {
  question: ExerciseQuestion | undefined
  item: ExerciseResponseItem
}) {
  const label = question?.label ?? item.question_id

  if (item.type === 'open') {
    return (
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
        <p className="text-sm italic text-foreground">« {item.value} »</p>
      </div>
    )
  }

  if (item.type === 'scale') {
    const val = Number(item.value)
    // F7 : utiliser min/max réels de la question
    const min = question?.min ?? 1
    const max = question?.max ?? 10
    const range = max - min
    const pct = range > 0 ? ((val - min) / range) * 100 : 0
    return (
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-[#7069F4] w-6 shrink-0">{val}</span>
          <div className="flex-1 h-2 bg-[#F1F0FE] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#7069F4] rounded-full"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground shrink-0">/{max}</span>
        </div>
      </div>
    )
  }

  if (item.type === 'mcq') {
    return (
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
        <Badge className="bg-[#7069F4] text-white border-0">{item.value}</Badge>
      </div>
    )
  }

  return null
}

// ============================================================
// Graphique d'évolution pour les questions scale
// ============================================================

interface ScaleEvolutionChartProps {
  question: ExerciseQuestion
  dataPoints: { date: string; value: number }[]
}

function ScaleEvolutionChart({ question, dataPoints }: ScaleEvolutionChartProps) {
  if (dataPoints.length < 2) return null

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-2">
        Évolution : {question.label}
      </p>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={dataPoints} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
          <YAxis domain={[0, question.max ?? 10]} tick={{ fontSize: 10 }} width={20} />
          <Tooltip formatter={(v) => [v, question.label]} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#7069F4"
            strokeWidth={2}
            dot={{ fill: '#7069F4', r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ============================================================
// ExerciseResponsesViewer — composant principal
// Reçoit les données en props depuis le composant parent (server component)
// F4 : pas de useEffect/fetch côté client — données chargées server-side
// ============================================================

export type ResponseWithExercise = ExerciseResponseRecord & { exercise: Exercise }

interface Props {
  data: ResponseWithExercise[] | null
  error?: string | null
}

export function ExerciseResponsesViewer({ data, error }: Props) {
  if (error) {
    return <p className="text-sm text-destructive py-4">{error}</p>
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="font-medium text-muted-foreground">Aucune réponse enregistrée</p>
        <p className="text-sm text-muted-foreground mt-1">
          Les réponses apparaîtront ici quand le client aura complété des exercices avec questions.
        </p>
      </div>
    )
  }

  // Regrouper les réponses par exercice
  const grouped = new Map<string, ResponseWithExercise[]>()
  for (const r of data) {
    const key = r.exercise_id
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(r)
  }

  return (
    <div className="space-y-6">
      {Array.from(grouped.entries()).map(([, responses]) => {
        const exercise = responses[0].exercise
        const questions = Array.isArray(exercise.questions) ? exercise.questions : []

        // Calculer les évolutions scale (si plusieurs réponses pour le même exercice)
        const scaleEvolutions = questions
          .filter(q => q.type === 'scale')
          .map(q => ({
            question: q,
            dataPoints: [...responses]
              .sort((a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime())
              .map(r => {
                const item = r.responses.find(ri => ri.question_id === q.id)
                return item ? { date: formatDate(r.completed_at), value: Number(item.value) } : null
              })
              .filter((p): p is { date: string; value: number } => p !== null),
          }))
          .filter(ev => ev.dataPoints.length >= 2)

        return (
          <Card key={exercise.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-sm font-semibold">{exercise.titre}</CardTitle>
                <Badge variant="outline" className="text-xs shrink-0 capitalize">
                  {exercise.categorie}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {responses.length} réponse{responses.length > 1 ? 's' : ''}
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Graphiques d'évolution (si plusieurs réponses) */}
              {scaleEvolutions.length > 0 && (
                <div className="space-y-4 pb-4 border-b">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Évolution
                  </p>
                  {scaleEvolutions.map(({ question, dataPoints }) => (
                    <ScaleEvolutionChart
                      key={question.id}
                      question={question}
                      dataPoints={dataPoints}
                    />
                  ))}
                </div>
              )}

              {/* Historique des réponses */}
              <div className="space-y-4">
                {responses.map(response => (
                  <div key={response.id} className="space-y-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      {formatDate(response.completed_at)}
                    </p>
                    <div className="pl-3 border-l-2 border-[#F1F0FE] space-y-3">
                      {response.responses.map(item => {
                        const q = questions.find(q => q.id === item.question_id)
                        return (
                          <ResponseItemDisplay key={item.question_id} question={q} item={item} />
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
