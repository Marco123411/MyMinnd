import { notFound, redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { resolveTestParams } from '@/lib/cognitive/resolve-params'
import { ProgramDrillBriefing } from './ProgramDrillBriefing'
import type { CognitiveTestDefinition, ProgramExercise } from '@/types'

interface PageProps {
  params: Promise<{ exId: string }>
}

export default async function ProgramExercisePage({ params }: PageProps) {
  const { exId } = await params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Charger program_exercise avec définition de test et vérification ownership via programme
  const { data, error } = await admin
    .from('program_exercises')
    .select(`
      *,
      cognitive_test_definitions (*),
      programme_etapes!inner (
        programme_id,
        programmes!inner ( client_id )
      )
    `)
    .eq('id', exId)
    .single()

  if (error || !data) notFound()

  // Vérifier que le client connecté est bien le propriétaire du programme
  const programme = (data.programme_etapes as { programme_id: string; programmes: { client_id: string } }).programmes
  if (programme.client_id !== user.id) notFound()

  const testDef = data.cognitive_test_definitions as CognitiveTestDefinition | null
  if (!testDef) notFound()

  const programExercise = {
    id: data.id as string,
    programme_etape_id: data.programme_etape_id as string,
    cognitive_test_id: data.cognitive_test_id as string | null,
    phase: data.phase as 'pre' | 'in' | 'post' | null,
    configured_duration_sec: data.configured_duration_sec as number | null,
    configured_intensity_percent: data.configured_intensity_percent as number | null,
    cognitive_load_score: data.cognitive_load_score as number | null,
    display_order: data.display_order as number,
    created_at: data.created_at as string,
    completed_at: (data.completed_at as string | null) ?? null,
    exercise_id: null,
    cognitive_test_definitions: testDef,
  } satisfies ProgramExercise

  const resolvedParams = resolveTestParams(testDef, programExercise)

  return (
    <ProgramDrillBriefing
      params={resolvedParams}
      testDef={testDef}
      programExercise={programExercise}
    />
  )
}
