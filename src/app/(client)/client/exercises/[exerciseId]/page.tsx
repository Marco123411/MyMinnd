import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getExerciseAction } from '@/app/actions/exercises'
import { ExerciseResponseForm } from '@/components/exercises/ExerciseResponseForm'

interface Props {
  params: Promise<{ exerciseId: string }>
}

export default async function ClientExerciseResponsePage({ params }: Props) {
  const { exerciseId } = await params
  const { data: exercise, error } = await getExerciseAction(exerciseId)

  if (error || !exercise) notFound()
  if (!exercise.questions || exercise.questions.length === 0) notFound()

  return (
    <div className="space-y-4">
      {/* Retour */}
      <Link
        href="/client/exercises"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux exercices
      </Link>

      {/* Formulaire de réponse */}
      <ExerciseResponseForm exercise={exercise} />
    </div>
  )
}
