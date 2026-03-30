import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ResultsRadar } from '@/components/test/ResultsRadar'
import { SubcompetenceBar } from '@/components/test/SubcompetenceBar'
import { Button } from '@/components/ui/button'
import type { TestLevelConfig } from '@/types'

interface PageProps {
  params: Promise<{ slug: string; testId: string }>
}

interface TestRow {
  id: string
  level_slug: string
  status: string
  score_global: number | null
  profile_id: string | null
  test_definition_id: string
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

export default async function ResultsPage({ params }: PageProps) {
  const { slug, testId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?returnUrl=/test/${slug}/results/${testId}`)

  const { data: testRow, error: testError } = await supabase
    .from('tests')
    .select('id, level_slug, status, score_global, profile_id, test_definition_id, test_definitions(id, name, levels)')
    .eq('id', testId)
    .eq('user_id', user.id)
    .single()

  if (testError || !testRow) redirect(`/test/${slug}`)

  const test = testRow as unknown as TestRow

  // Redirige si le test n'est pas encore terminé
  if (test.status !== 'completed') redirect(`/test/${slug}/pass/${testId}`)

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

  const isDiscovery = test.level_slug === 'discovery'

  // Profil mental (Complete / Expert uniquement)
  let profile: ProfileRow | null = null
  if (!isDiscovery && test.profile_id) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, name, family, color, description, strengths, weaknesses, recommendations')
      .eq('id', test.profile_id)
      .single()
    profile = profileData ?? null
  }

  // Prix du niveau Complete pour l'upsell
  const levels = definition.levels as TestLevelConfig[]
  const completeLevel = levels.find((l) => l.slug === 'complete')
  const completePrice = completeLevel
    ? completeLevel.price_cents === 0
      ? 'Gratuit'
      : `${completeLevel.price_cents / 100} €`
    : null

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      {/* En-tête résultats */}
      <div className="mb-10 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-[#20808D]">
          {definition.name}
        </p>
        <h1 className="mt-1 text-3xl font-bold text-[#1A1A2E]">Vos résultats</h1>
      </div>

      {/* Score global */}
      {globalScore !== undefined && (
        <div className="mb-10 flex flex-col items-center">
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-[#E8F4F5]">
            <span className="text-4xl font-bold text-[#20808D]">
              {globalScore.toFixed(1)}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Score global / 10</p>
        </div>
      )}

      {/* Radar chart */}
      {radarDomains.length > 0 && (
        <div className="mb-10">
          <h2 className="mb-4 text-lg font-semibold text-[#1A1A2E]">Profil par domaine</h2>
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
          <h2 className="text-2xl font-bold text-[#1A1A2E]">{profile.name}</h2>
          {profile.description && (
            <p className="mt-3 text-muted-foreground">{profile.description}</p>
          )}
          {(profile.strengths || profile.weaknesses) && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {profile.strengths && (
                <div>
                  <p className="mb-1 text-sm font-semibold text-[#1A1A2E]">Points forts</p>
                  <p className="text-sm text-muted-foreground">{profile.strengths}</p>
                </div>
              )}
              {profile.weaknesses && (
                <div>
                  <p className="mb-1 text-sm font-semibold text-[#1A1A2E]">Points de vigilance</p>
                  <p className="text-sm text-muted-foreground">{profile.weaknesses}</p>
                </div>
              )}
            </div>
          )}
          {profile.recommendations && (
            <div className="mt-4 rounded-lg bg-white/60 p-3">
              <p className="mb-1 text-sm font-semibold text-[#1A1A2E]">Recommandations</p>
              <p className="text-sm text-muted-foreground">{profile.recommendations}</p>
            </div>
          )}
        </div>
      )}

      {/* Détail par domaine — Complete / Expert uniquement */}
      {!isDiscovery && (
        <div className="mb-10 space-y-8">
          <h2 className="text-lg font-semibold text-[#1A1A2E]">Détail par compétence</h2>
          {domainNodes.map((domain) => {
            const leaves = competencyNodes
              .filter((n) => n.is_leaf && n.parent_id === domain.id)
              .sort((a, b) => a.order_index - b.order_index)

            return (
              <div key={domain.id}>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-[#1A1A2E]">{domain.name}</h3>
                  <span className="text-sm font-medium text-[#20808D]">
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
      )}

      {/* Upsell Discovery → Complete */}
      {isDiscovery && completeLevel && (
        <div className="rounded-xl border-2 border-[#20808D] bg-[#E8F4F5] p-6 text-center">
          <h2 className="text-xl font-bold text-[#1A1A2E]">Allez plus loin</h2>
          <p className="mt-2 text-muted-foreground">
            Accédez au profil MINND complet, au détail de vos compétences et à votre rapport PDF
            personnalisé.
          </p>
          {completePrice && (
            <p className="mt-3 text-2xl font-bold text-[#20808D]">{completePrice}</p>
          )}
          <Link href={`/test/${slug}`} className="mt-4 inline-block">
            <Button className="bg-[#20808D] hover:bg-[#186870]">Passer au niveau Complet</Button>
          </Link>
        </div>
      )}

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
