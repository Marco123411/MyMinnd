import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { createAdminClient } from '@/lib/supabase/server'
import { InteractiveExerciseRenderer } from '@/components/exercises/InteractiveExerciseRenderer'
import { ChevronLeft } from 'lucide-react'
import type { Exercise } from '@/types'

// Mapping titre → exerciseType slug
const EXERCISE_TYPE_MAP: Record<string, string> = {
  'Le Bonhomme de Performance': 'bonhomme_performance',
  'La Figure de Performance':   'figure_performance',
}

interface Props {
  params:      Promise<{ id: string }>
  searchParams: Promise<{ clientId?: string }>
}

export default async function RunExercisePage({ params, searchParams }: Props) {
  const { id }       = await params
  const { clientId } = await searchParams

  const admin = createAdminClient()
  const { data: exercise } = await admin
    .from('exercises')
    .select('*')
    .eq('id', id)
    .single()

  if (!exercise) notFound()
  if ((exercise as Exercise).format !== 'interactive') redirect('/coach/exercises')

  const ex = exercise as Exercise
  const exerciseType = EXERCISE_TYPE_MAP[ex.titre] ?? ex.titre.toLowerCase().replace(/\s+/g, '_')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={clientId ? `/coach/clients/${clientId}` : '/coach/exercises'}>
            <ChevronLeft className="w-4 h-4 mr-1" />
            Retour
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A2E]">{ex.titre}</h1>
          {ex.description && (
            <p className="text-muted-foreground text-sm">{ex.description}</p>
          )}
        </div>
      </div>

      <InteractiveExerciseRenderer
        exerciseType={exerciseType}
        clientId={clientId}
      />
    </div>
  )
}
