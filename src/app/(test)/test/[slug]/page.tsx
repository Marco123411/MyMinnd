import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { TestDefinition, TestLevelConfig } from '@/types'
import { TestStartButton } from './TestStartButton'

interface PageProps {
  params: Promise<{ slug: string }>
}

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

  // Compte les questions par niveau (en parallèle)
  const [{ count: discoveryCount }, { count: totalCount }] = await Promise.all([
    supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('test_definition_id', definition.id)
      .eq('level_required', 'discovery')
      .eq('is_active', true),
    supabase
      .from('questions')
      .select('*', { count: 'exact', head: true })
      .eq('test_definition_id', definition.id)
      .eq('is_active', true),
  ])

  const levels = definition.levels as TestLevelConfig[]

  const levelDetails = [
    {
      config: levels.find((l) => l.slug === 'discovery'),
      questionCount: discoveryCount ?? 0,
      slug: 'discovery',
    },
    {
      config: levels.find((l) => l.slug === 'complete'),
      questionCount: totalCount ?? 0,
      slug: 'complete',
    },
    {
      config: levels.find((l) => l.slug === 'expert'),
      questionCount: totalCount ?? 0,
      slug: 'expert',
    },
  ].filter((l) => l.config)

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-[#141325]">{definition.name}</h1>
        {definition.description && (
          <p className="mt-3 text-lg text-muted-foreground">{definition.description}</p>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {levelDetails.map(({ config, questionCount, slug: levelSlug }) => {
          if (!config) return null
          // Paiement désactivé en phase de test — tous les niveaux sont accessibles
          const priceLabel = config.price_cents === 0 ? 'Gratuit' : `${config.price_cents / 100} €`

          return (
            <div
              key={levelSlug}
              className="flex flex-col rounded-xl border-2 border-gray-200 p-6 transition-shadow hover:shadow-md"
            >
              <div className="mb-4 flex-1">
                <h2 className="text-xl font-bold text-[#141325]">{config.name}</h2>
                <p className="mt-1 text-2xl font-bold text-[#7069F4]">{priceLabel}</p>
                <p className="mt-3 text-sm text-muted-foreground">
                  {questionCount} questions • ~{Math.round(questionCount * 0.5)} min
                </p>
              </div>

              <TestStartButton
                testDefinitionId={definition.id}
                levelSlug={levelSlug}
                testSlug={slug}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
