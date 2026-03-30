import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getClientAction } from '@/app/actions/clients'
import { getClientTestsForCoach } from '@/app/actions/tests-invite'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScoreDisplay } from '@/components/ui/score-display'
import { RadarChart } from '@/components/ui/radar-chart'
import { NotesEditor } from './NotesEditor'
import { SendTestModal } from '@/components/coach/SendTestModal'
import { TestHistoryCoach } from '@/components/coach/TestHistoryCoach'
import { Pencil } from 'lucide-react'
import type { ClientContext, TestLevelConfig, SubscriptionTier } from '@/types'

interface TestDefinitionForModal {
  id: string
  slug: string
  name: string
  levels: TestLevelConfig[]
}

const CONTEXT_LABELS: Record<ClientContext, string> = {
  sport: 'Sport',
  corporate: 'Corporate',
  wellbeing: 'Bien-être',
  coaching: 'Coaching',
}

const CONTEXT_COLORS: Record<ClientContext, string> = {
  sport: 'bg-[#E8F4F5] text-[#20808D]',
  corporate: 'bg-purple-100 text-[#944454]',
  wellbeing: 'bg-amber-100 text-amber-700',
  coaching: 'bg-orange-100 text-[#A84B2F]',
}

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: client, error } = await getClientAction(id)

  if (error || !client) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const coachId = user?.id ?? ''

  // Admin client nécessaire pour lire invitation_token (révoqué pour authenticated)
  const admin = createAdminClient()

  // Requêtes parallèles : dernier test complété + définitions + historique + nom du coach
  const [
    { data: lastTest },
    { data: testDefinitionsRaw },
    { data: testHistory },
    { data: coachData },
  ] = await Promise.all([
    // Dernier test complété pour le radar/score
    client.user_id
      ? supabase
          .from('tests')
          .select(`
            id,
            score_global,
            completed_at,
            level_slug,
            profiles ( name, color ),
            test_definitions ( name )
          `)
          .eq('coach_id', coachId)
          .eq('user_id', client.user_id)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),

    // Définitions de tests actives pour le modal
    admin
      .from('test_definitions')
      .select('id, slug, name, levels')
      .eq('is_active', true)
      .order('name'),

    // Historique complet via admin (inclut les pending, invite_url construite côté serveur)
    getClientTestsForCoach(id),

    // Données du coach (nom pour emails, subscription_tier pour SendTestModal)
    admin.from('users').select('nom, subscription_tier').eq('id', coachId).single(),
  ])

  // Scores par domaine du dernier test (dépend de lastTest.id)
  let radarData: { subject: string; value: number; fullMark: number }[] = []
  if (lastTest?.id) {
    const { data: domainScores } = await supabase
      .from('test_scores')
      .select(`
        score,
        competency_tree ( name, depth )
      `)
      .eq('test_id', lastTest.id)
      .eq('entity_type', 'competency_node')

    if (domainScores) {
      radarData = domainScores
        .filter((s) => {
          const node = Array.isArray(s.competency_tree) ? s.competency_tree[0] : s.competency_tree
          return (node as { depth: number } | null)?.depth === 0
        })
        .map((s) => {
          const node = Array.isArray(s.competency_tree) ? s.competency_tree[0] : s.competency_tree
          return {
            subject: (node as { name: string } | null)?.name ?? '',
            value: s.score,
            fullMark: 10,
          }
        })
    }
  }

  const profile = lastTest
    ? (Array.isArray(lastTest.profiles) ? lastTest.profiles[0] : lastTest.profiles) as { name: string; color: string } | null
    : null

  // Normalise les test_definitions pour le modal (sous-ensemble des champs requis)
  const testDefinitions: TestDefinitionForModal[] = (testDefinitionsRaw ?? []).map((d) => ({
    id: d.id,
    slug: d.slug,
    name: d.name,
    levels: d.levels as TestLevelConfig[],
  }))

  const coachTier = (coachData?.subscription_tier ?? 'free') as SubscriptionTier

  return (
    <div className="space-y-6">
      {/* En-tête client */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#E8F4F5] text-2xl font-bold text-[#20808D]">
                {client.nom.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#1A1A2E]">{client.nom}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge className={CONTEXT_COLORS[client.context]}>
                    {CONTEXT_LABELS[client.context]}
                  </Badge>
                  {client.sport && <span className="text-sm text-muted-foreground">{client.sport}</span>}
                  {client.entreprise && <span className="text-sm text-muted-foreground">{client.entreprise}</span>}
                  {client.niveau && (
                    <Badge variant="outline" className="text-xs">{client.niveau}</Badge>
                  )}
                  <Badge
                    variant={client.statut === 'actif' ? 'default' : 'outline'}
                    className={client.statut === 'actif' ? 'bg-green-100 text-green-700' : 'text-muted-foreground'}
                  >
                    {client.statut}
                  </Badge>
                </div>
                {client.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {client.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex shrink-0 flex-wrap gap-2">
              {testDefinitions.length > 0 && (
                <SendTestModal
                  clientId={id}
                  clientName={client.nom}
                  clientContext={client.context}
                  clientEmail={client.email ?? null}
                  testDefinitions={testDefinitions}
                  coachTier={coachTier}
                />
              )}
              <Button variant="outline" asChild>
                <Link href={`/coach/clients/${id}/edit`}>
                  <Pencil className="mr-1 h-4 w-4" />
                  Modifier
                </Link>
              </Button>
              {client.statut === 'actif' ? (
                <form action={async () => {
                  'use server'
                  const { archiveClientAction } = await import('@/app/actions/clients')
                  await archiveClientAction(id, 'archive')
                }}>
                  <Button variant="outline" type="submit" className="text-muted-foreground">
                    Archiver
                  </Button>
                </form>
              ) : (
                <form action={async () => {
                  'use server'
                  const { archiveClientAction } = await import('@/app/actions/clients')
                  await archiveClientAction(id, 'actif')
                }}>
                  <Button variant="outline" type="submit" className="text-[#20808D]">
                    Réactiver
                  </Button>
                </form>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Onglets */}
      <Tabs defaultValue="profil">
        <TabsList>
          <TabsTrigger value="profil">Profil</TabsTrigger>
          <TabsTrigger value="tests">
            Tests
            {testHistory && testHistory.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-xs">{testHistory.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="seances">Séances</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>

        {/* Profil */}
        <TabsContent value="profil" className="mt-4 space-y-4">
          {!client.user_id || !lastTest ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                {!client.user_id
                  ? 'Ce client n\'a pas encore de compte MINND lié.'
                  : 'Aucun test complété pour ce client.'}
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Card>
                  <CardHeader><CardTitle className="text-sm">Score global</CardTitle></CardHeader>
                  <CardContent>
                    {lastTest.score_global !== null ? (
                      <ScoreDisplay score={lastTest.score_global} size="lg" />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-sm">Profil MINND</CardTitle></CardHeader>
                  <CardContent>
                    {profile ? (
                      <Badge style={{ backgroundColor: profile.color, color: '#fff' }} className="text-sm">
                        {profile.name}
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">Non disponible</span>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-sm">Dernier test</CardTitle></CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {lastTest.completed_at
                      ? new Date(lastTest.completed_at).toLocaleDateString('fr-FR')
                      : '—'}
                  </CardContent>
                </Card>
              </div>

              {radarData.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">Radar des domaines</CardTitle></CardHeader>
                  <CardContent>
                    <RadarChart data={radarData} height={280} />
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Tests */}
        <TabsContent value="tests" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Historique des tests</CardTitle>
            </CardHeader>
            <CardContent>
              <TestHistoryCoach
                tests={testHistory ?? []}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Séances */}
        <TabsContent value="seances" className="mt-4">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-2xl">🚧</p>
              <p className="mt-2 font-medium">Bientôt disponible</p>
              <p className="text-sm text-muted-foreground">La gestion des séances sera disponible dans une prochaine mise à jour.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notes */}
        <TabsContent value="notes" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <NotesEditor
                clientId={id}
                initialNotes={client.notes_privees ?? ''}
                initialObjectifs={client.objectifs ?? ''}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
