import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { TestDefinition, TestLevelConfig } from '@/types'
import { TestStartButton } from './TestStartButton'

interface PageProps {
  params: Promise<{ slug: string }>
}

// Niveau MVP unique : on lance toujours "complete", fallback sur le premier niveau disponible
const DEFAULT_LEVEL = 'complete'

export default async function TestLandingPage({ params }: PageProps) {
  const { slug } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?returnUrl=/test/${slug}`)

  const { data: testDef, error } = await supabase
    .from('test_definitions')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (error || !testDef) redirect('/client')

  const definition = testDef as TestDefinition

  const { count: totalCount } = await supabase
    .from('questions')
    .select('*', { count: 'exact', head: true })
    .eq('test_definition_id', definition.id)
    .eq('is_active', true)

  const levels = definition.levels as TestLevelConfig[]
  const levelConfig = levels.find((l) => l.slug === DEFAULT_LEVEL) ?? levels[0]
  const levelSlug = levelConfig?.slug ?? DEFAULT_LEVEL
  const questionCount = totalCount ?? 0

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-[#141325]">{definition.name}</h1>
        {definition.description && (
          <p className="mt-3 text-lg text-muted-foreground">{definition.description}</p>
        )}
      </div>

      <div className="flex flex-col rounded-xl border-2 border-gray-200 p-6 transition-shadow hover:shadow-md">
        <div className="mb-4 flex-1 text-center">
          <p className="text-sm text-muted-foreground">
            {questionCount} questions • ~{Math.round(questionCount * 0.5)} min
          </p>
        </div>

        <TestStartButton
          testDefinitionId={definition.id}
          levelSlug={levelSlug}
          testSlug={slug}
        />
      </div>
    </div>
  )
}
