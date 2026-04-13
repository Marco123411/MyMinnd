import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getCabinetSessionAction } from '@/app/actions/sessions'
import { getExercisesAction } from '@/app/actions/exercises'
import { CompteRenduForm } from './CompteRenduForm'

interface SessionDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function SessionDetailPage({ params }: SessionDetailPageProps) {
  const { id } = await params

  const [sessionResult, exercisesResult] = await Promise.all([
    getCabinetSessionAction(id),
    getExercisesAction(),
  ])

  if (sessionResult.error || !sessionResult.data) {
    notFound()
  }

  const session = sessionResult.data
  const exercises = exercisesResult.data ?? []

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/coach/sessions" className="hover:text-[#7069F4] flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" />
          Séances
        </Link>
        <span>/</span>
        <span className="text-[#141325] font-medium">
          Compte-rendu —{' '}
          {new Date(session.date_seance).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </span>
      </div>

      <CompteRenduForm session={session} exercises={exercises} />
    </div>
  )
}
