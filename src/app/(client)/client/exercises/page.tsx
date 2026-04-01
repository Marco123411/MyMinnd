import Link from 'next/link'
import { Dumbbell, ChevronRight } from 'lucide-react'
import { getClientExercisesAction } from '@/app/actions/exercises'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default async function ClientExercisesPage() {
  const { data: exercises, error } = await getClientExercisesAction()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#1A1A2E]">Mes exercices</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Répondez aux questionnaires assignés par votre coach
        </p>
      </div>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : !exercises || exercises.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-3">
            <Dumbbell className="h-8 w-8 text-muted-foreground opacity-50" />
            <div>
              <p className="font-medium text-muted-foreground">Aucun exercice disponible</p>
              <p className="text-sm text-muted-foreground mt-1">
                Votre coach vous enverra des exercices à compléter
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {exercises.map(exercise => {
            const questionCount = exercise.questions.length
            return (
              <Link key={exercise.id} href={`/client/exercises/${exercise.id}`}>
                <Card className="hover:border-[#20808D] transition-colors cursor-pointer">
                  <CardContent className="flex items-center justify-between gap-4 py-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-[#1A1A2E] truncate">
                        {exercise.titre}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-muted-foreground capitalize">{exercise.categorie}</p>
                        <span className="text-xs text-muted-foreground">·</span>
                        <Badge
                          variant="outline"
                          className="text-xs text-[#20808D] border-[#20808D]"
                        >
                          {questionCount} question{questionCount > 1 ? 's' : ''}
                        </Badge>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
