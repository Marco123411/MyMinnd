import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ResultsRadar } from '@/components/test/ResultsRadar'
import { SubcompetenceBar } from '@/components/test/SubcompetenceBar'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { CoachAnnotationPanel } from '@/components/coach/CoachAnnotationPanel'
import { PublishTestButton } from './PublishTestButton'
import type { TestLevelConfig } from '@/types'

interface PageProps {
  params: Promise<{ testId: string }>
}

interface TestRow {
  id: string
  level_slug: string
  status: string
  score_global: number | null
  profile_id: string | null
  test_definition_id: string
  results_released_at: string | null
  test_definitions: {
    id: string
    name: string
    levels: TestLevelConfig[]
  } | null
}

interface ProfileRow {
  id: string
  name: string
  family: string | null
  color: string
  description: string | null
  strengths: string | null
  weaknesses: string | null
  recommendations: string | null
}

interface CompetencyNode {
  id: string
  parent_id: string | null
  name: string
  depth: number
  is_leaf: boolean
  order_index: number
}

interface ScoreRow {
  entity_type: string
  entity_id: string | null
  score: number
  percentile: number | null
}

export default async function CoachTestResultsPage({ params }: PageProps) {
  const { testId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) notFound()

  // Filtre explicite sur coach_id en plus de la RLS (défense en profondeur)
  const { data: testRow, error: testError } = await supabase
    .from('tests')
    .select('id, level_slug, status, score_global, profile_id, test_definition_id, results_released_at, test_definitions(id, name, levels)')
    .eq('id', testId)
    .eq('coach_id', user.id)
    .single()

  if (testError || !testRow || testRow.status !== 'completed') notFound()

  const test = testRow as unknown as TestRow
  const definition = test.test_definitions
  if (!definition) notFound()

  const isDiscovery = test.level_slug === 'discovery'
  const isPublished = !!test.results_released_at

  // Inclure la requête profil dans le Promise.all pour éviter le waterfall séquentiel
  const [{ data: nodes }, { data: scores }, { data: notesRaw }, { data: profileData }] = await Promise.all([
    supabase
      .from('competency_tree')
      .select('id, parent_id, name, depth, is_leaf, order_index')
      .eq('test_definition_id', definition.id)
      .order('order_index'),
    supabase
      .from('test_scores')
      .select('entity_type, entity_id, score, percentile')
      .eq('test_id', testId),
    supabase
      .from('test_coach_notes')
      .select('node_id, note')
      .eq('test_id', testId)
      .eq('coach_id', user.id),
    !isDiscovery && test.profile_id
      ? supabase
          .from('profiles')
          .select('id, name, family, color, description, strengths, weaknesses, recommendations')
          .eq('id', test.profile_id)
          .single()
      : Promise.resolve({ data: null, error: null }),
  ])

  const competencyNodes = (nodes ?? []) as CompetencyNode[]
  const scoreRows = (scores ?? []) as ScoreRow[]
  const profile: ProfileRow | null = (profileData as ProfileRow | null) ?? null

  // Map node_id → note pour les annotations
  const notesMap: Record<string, string> = {}
  for (const row of notesRaw ?? []) {
    notesMap[row.node_id] = row.note
  }

  const getScore = (nodeId: string) =>
    scoreRows.find((s) => s.entity_id === nodeId)?.score ?? 0

  const getPercentile = (nodeId: string) =>
    scoreRows.find((s) => s.entity_id === nodeId)?.percentile ?? null

  const domainNodes = competencyNodes
    .filter((n) => n.depth === 0)
    .sort((a, b) => a.order_index - b.order_index)

  const radarDomains = domainNodes.map((d) => ({
    name: d.name,
    score: getScore(d.id),
  }))

  const globalScore = test.score_global ?? scoreRows.find((s) => s.entity_type === 'global')?.score

  // Formate la date de publication
  const publishedDate = test.results_released_at
    ? new Date(test.results_released_at).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      {/* Retour */}
      <div className="mb-8">
        <Link href="/coach/clients">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
            Retour aux clients
          </Button>
        </Link>
      </div>

      {/* En-tête */}
      <div className="mb-6 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-[#7069F4]">
          {definition.name}
        </p>
        <h1 className="mt-1 text-3xl font-bold text-[#141325]">Résultats du client</h1>
        <p className="mt-1 text-sm text-muted-foreground capitalize">{test.level_slug}</p>
      </div>

      {/* Bandeau état publication */}
      {isPublished ? (
        <div className="mb-8 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <p className="text-sm font-medium text-green-800">
            ✓ Résultats publiés le {publishedDate}. Votre client a été notifié par email.
          </p>
        </div>
      ) : (
        <div className="mb-8 rounded-lg border border-[#F1F0FE] bg-[#F1F0FE] px-4 py-3">
          <p className="text-sm text-[#7069F4]">
            Annotez les compétences ci-dessous, puis publiez les résultats pour que votre client puisse les consulter.
          </p>
        </div>
      )}

      {/* Score global */}
      {globalScore !== undefined && (
        <div className="mb-10 flex flex-col items-center">
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-[#F1F0FE]">
            <span className="text-4xl font-bold text-[#7069F4]">
              {globalScore.toFixed(1)}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Score global / 10</p>
        </div>
      )}

      {/* Radar */}
      {radarDomains.length > 0 && (
        <div className="mb-10">
          <h2 className="mb-4 text-lg font-semibold text-[#141325]">Profil par domaine</h2>
          <ResultsRadar domains={radarDomains} height={320} />
        </div>
      )}

      {/* Profil mental — Complete / Expert uniquement */}
      {profile && (
        <div
          className="mb-10 rounded-xl border-2 p-6"
          style={{ borderColor: profile.color, backgroundColor: `${profile.color}14` }}
        >
          <div className="mb-3 flex items-center gap-3">
            <div className="h-4 w-4 rounded-full" style={{ backgroundColor: profile.color }} />
            <span className="text-sm font-medium text-muted-foreground">{profile.family}</span>
          </div>
          <h2 className="text-2xl font-bold text-[#141325]">{profile.name}</h2>
          {profile.description && (
            <p className="mt-3 text-muted-foreground">{profile.description}</p>
          )}
          {(profile.strengths || profile.weaknesses) && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {profile.strengths && (
                <div>
                  <p className="mb-1 text-sm font-semibold text-[#141325]">Points forts</p>
                  <p className="text-sm text-muted-foreground">{profile.strengths}</p>
                </div>
              )}
              {profile.weaknesses && (
                <div>
                  <p className="mb-1 text-sm font-semibold text-[#141325]">Points de vigilance</p>
                  <p className="text-sm text-muted-foreground">{profile.weaknesses}</p>
                </div>
              )}
            </div>
          )}
          {profile.recommendations && (
            <div className="mt-4 rounded-lg bg-white/60 p-3">
              <p className="mb-1 text-sm font-semibold text-[#141325]">Recommandations</p>
              <p className="text-sm text-muted-foreground">{profile.recommendations}</p>
            </div>
          )}
        </div>
      )}

      {/* Détail par compétence avec annotations */}
      {!isDiscovery && (
        <div className="mb-10 space-y-8">
          <h2 className="text-lg font-semibold text-[#141325]">Détail par compétence</h2>
          {domainNodes.map((domain) => {
            const leaves = competencyNodes
              .filter((n) => n.is_leaf && n.parent_id === domain.id)
              .sort((a, b) => a.order_index - b.order_index)

            return (
              <div key={domain.id} className="rounded-xl border border-gray-100 p-5">
                {/* En-tête domaine */}
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-[#141325]">{domain.name}</h3>
                  <span className="text-sm font-medium text-[#7069F4]">
                    {getScore(domain.id).toFixed(1)}/10
                  </span>
                </div>

                {/* Annotation domaine */}
                <CoachAnnotationPanel
                  testId={testId}
                  nodeId={domain.id}
                  nodeName={domain.name}
                  initialNote={notesMap[domain.id] ?? ''}
                  disabled={isPublished}
                />

                {/* Sous-compétences */}
                {leaves.length > 0 && (
                  <div className="mt-4 space-y-4 border-t border-gray-100 pt-4 pl-2">
                    {leaves.map((leaf) => (
                      <div key={leaf.id}>
                        <SubcompetenceBar
                          name={leaf.name}
                          score={getScore(leaf.id)}
                          percentile={getPercentile(leaf.id)}
                        />
                        <CoachAnnotationPanel
                          testId={testId}
                          nodeId={leaf.id}
                          nodeName={leaf.name}
                          initialNote={notesMap[leaf.id] ?? ''}
                          disabled={isPublished}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Bouton publier */}
      {!isPublished && (
        <div className="sticky bottom-6 flex justify-center">
          <div className="rounded-xl bg-white px-6 py-4 shadow-lg border border-gray-100">
            <PublishTestButton testId={testId} />
          </div>
        </div>
      )}
    </div>
  )
}
