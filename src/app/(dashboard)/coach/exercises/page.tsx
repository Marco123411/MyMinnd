import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getExercisesAction } from '@/app/actions/exercises'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { CreateExerciseDialog } from '@/components/exercises/CreateExerciseDialog'
import type { ExerciseFormat } from '@/types'

const FORMAT_LABELS: Record<ExerciseFormat, string> = {
  video:         'Vidéo',
  document:      'Document',
  audio:         'Audio',
  questionnaire: 'Questionnaire',
  interactive:   'Interactif',
}

const FORMAT_COLORS: Record<ExerciseFormat, string> = {
  video:         'bg-blue-100 text-blue-700',
  document:      'bg-gray-100 text-gray-700',
  audio:         'bg-purple-100 text-purple-700',
  questionnaire: 'bg-yellow-100 text-yellow-700',
  interactive:   'bg-teal-100 text-teal-700',
}

async function getUserTier(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const admin = createAdminClient()
  const { data: me } = await admin
    .from('users')
    .select('subscription_tier, role')
    .eq('id', user.id)
    .single()
  return me?.subscription_tier === 'expert' || me?.role === 'admin'
}

export default async function ExercisesPage() {
  // Requêtes parallèles : exercices + tier utilisateur (F10)
  const [{ data: exercises }, isExpert] = await Promise.all([
    getExercisesAction(),
    getUserTier(),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A2E]">Bibliothèque d'exercices</h1>
          <p className="text-muted-foreground">Exercices disponibles pour vos séances</p>
        </div>
        <CreateExerciseDialog isExpert={isExpert} />
      </div>

      {!exercises || exercises.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aucun exercice disponible.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {exercises.map(exercise => {
            const questionCount = Array.isArray(exercise.questions) ? exercise.questions.length : 0
            return (
              <Card key={exercise.id} className="flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-snug">{exercise.titre}</CardTitle>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge className={`text-xs ${FORMAT_COLORS[exercise.format]}`}>
                        {FORMAT_LABELS[exercise.format]}
                      </Badge>
                      {exercise.is_custom && (
                        <Badge variant="outline" className="text-xs text-[#20808D] border-[#20808D]">
                          Personnalisé
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground capitalize">{exercise.categorie}</p>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-between gap-4">
                  {exercise.description && (
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {exercise.description}
                    </p>
                  )}
                  <div className="flex flex-col gap-2">
                    {questionCount > 0 && (
                      <p className="text-xs text-[#20808D] font-medium">
                        {questionCount} question{questionCount > 1 ? 's' : ''}
                      </p>
                    )}
                    {exercise.format === 'interactive' && (
                      <Button asChild className="bg-[#20808D] hover:bg-[#20808D]/90 text-white w-full">
                        <Link href={`/coach/exercises/${exercise.id}/run`}>
                          Lancer l'exercice
                        </Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
