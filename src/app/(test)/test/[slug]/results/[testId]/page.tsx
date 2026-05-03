import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ResultsRadar } from '@/components/test/ResultsRadar'
import { SubcompetenceBar } from '@/components/test/SubcompetenceBar'
import { Button } from '@/components/ui/button'

interface PageProps {
  params: Promise<{ slug: string; testId: string }>
}

interface TestRow {
  id: string
  status: string
  score_global: number | null
  profile_id: string | null
  test_definition_id: string
  test_definitions: {
    id: string
    name: string
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

export default async function ResultsPage({ params }: PageProps) {
  const { slug, testId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?returnUrl=/test/${slug}/results/${testId}`)

  const { data: testRow, error: testError } = await supabase
    .from('tests')
    .select('id, status, score_global, profile_id, test_definition_id, results_released_at, test_definitions(id, name)')
    .eq('id', testId)
    .eq('user_id', user.id)
    .single()

  if (testError || !testRow) redirect(`/test/${slug}`)

  const test = testRow as unknown as TestRow & { results_released_at: string | null }

  // Redirige si le test n'est pas encore terminé
  if (test.status !== 'completed') redirect(`/test/${slug}/pass/${testId}`)

  // Si les résultats ne sont pas encore publiés par le coach, rediriger vers la page d'attente
  if (!test.results_released_at) redirect(`/test/${slug}/merci/${testId}`)

  const definition = test.test_definitions
  if (!definition) redirect(`/test/${slug}`)

  const { data: nodes } = await supabase
    .from('competency_tree')
    .select('id, parent_id, name, depth, is_leaf, order_index')
    .eq('test_definition_id', definition.id)
    .order('order_index')

  const { data: scores } = await supabase
    .from('test_scores')
    .select('entity_type, entity_id, score, percentile')
    .eq('test_id', testId)

  const competencyNodes = (nodes ?? []) as CompetencyNode[]
  const scoreRows = (scores ?? []) as ScoreRow[]

  const getScore = (nodeId: string) =>
    scoreRows.find((s) => s.entity_id === nodeId)?.score ?? 0

  const getPercentile = (nodeId: string) =>
    scoreRows.find((s) => s.entity_id === nodeId)?.percentile ?? null

  // Données du radar (domaines de profondeur 0)
  const domainNodes = competencyNodes
    .filter((n) => n.depth === 0)
    .sort((a, b) => a.order_index - b.order_index)

  const radarDomains = domainNodes.map((d) => ({
    name: d.name,
    score: getScore(d.id),
  }))

  const globalScore = test.score_global ?? scoreRows.find((s) => s.entity_type === 'global')?.score

  // Profil mental
  let profile: ProfileRow | null = null
  if (test.profile_id) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, name, family, color, description, strengths, weaknesses, recommendations')
      .eq('id', test.profile_id)
      .single()
    profile = profileData ?? null
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      {/* En-tête résultats */}
      <div className="mb-10 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-[#7069F4]">
          {definition.name}
        </p>
        <h1 className="mt-1 text-3xl font-bold text-[#141325]">Vos résultats</h1>
      </div>

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

      {/* Radar chart */}
      {radarDomains.length > 0 && (
        <div className="mb-10">
          <h2 className="mb-4 text-lg font-semibold text-[#141325]">Profil par domaine</h2>
          <ResultsRadar domains={radarDomains} height={320} />
        </div>
      )}

      {/* Carte profil mental — Complete / Expert uniquement */}
      {profile && (
        <div
          className="mb-10 rounded-xl border-2 p-6"
          style={{ borderColor: profile.color, backgroundColor: `${profile.color}14` }}
        >
          <div className="mb-3 flex items-center gap-3">
            <div
              className="h-4 w-4 rounded-full"
              style={{ backgroundColor: profile.color }}
            />
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

      {/* Détail par domaine */}
      <div className="mb-10 space-y-8">
        <h2 className="text-lg font-semibold text-[#141325]">Détail par compétence</h2>
        {domainNodes.map((domain) => {
          const leaves = competencyNodes
            .filter((n) => n.is_leaf && n.parent_id === domain.id)
            .sort((a, b) => a.order_index - b.order_index)

          return (
            <div key={domain.id}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-[#141325]">{domain.name}</h3>
                <span className="text-sm font-medium text-[#7069F4]">
                  {getScore(domain.id).toFixed(1)}/10
                </span>
              </div>
              <div className="space-y-3 pl-2">
                {leaves.map((leaf) => (
                  <SubcompetenceBar
                    key={leaf.id}
                    name={leaf.name}
                    score={getScore(leaf.id)}
                    percentile={getPercentile(leaf.id)}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Retour tableau de bord */}
      <div className="mt-10 text-center">
        <Link href="/client">
          <Button variant="ghost" className="text-muted-foreground">
            Retour au tableau de bord
          </Button>
        </Link>
      </div>
    </div>
  )
}
