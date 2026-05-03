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
import { PlanCabinetSessionModal } from '@/components/sessions/PlanCabinetSessionModal'
import { AssignAutonomousSessionModal } from '@/components/sessions/AssignAutonomousSessionModal'
import { CreateRecurringTemplateModal } from '@/components/sessions/CreateRecurringTemplateModal'
import { InvitationActions } from '@/components/coach/InvitationActions'
import { ClientAccountActions } from '@/components/coach/ClientAccountActions'
import { ClientDocumentsSection } from '@/components/coach/ClientDocumentsSection'
import { getClientSessionTimelineAction } from '@/app/actions/sessions'
import { getClientProgrammesAction } from '@/app/actions/programmes'
import { ProgrammeEtapesList } from '@/components/coach/ProgrammeEtapesList'
import { CreateProgrammeDialog } from '@/components/coach/CreateProgrammeDialog'
import { getExercisesAction } from '@/app/actions/exercises'
import { ProfileIntelligenceTab } from './ProfileIntelligenceTab'
import { ClientSessionTimeline } from '@/components/coach/ClientSessionTimeline'
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
  sport: 'bg-[#F1F0FE] text-[#7069F4]',
  corporate: 'bg-purple-100 text-[#3C3CD6]',
  wellbeing: 'bg-amber-100 text-amber-700',
  coaching: 'bg-orange-100 text-[#EC638B]',
}

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Parallélisation : auth + fetch client simultanément
  const supabase = await createClient()
  const [{ data: client, error }, { data: { user } }] = await Promise.all([
    getClientAction(id),
    supabase.auth.getUser(),
  ])

  if (error || !client) notFound()

  const coachId = user?.id ?? ''

  // Admin client nécessaire pour lire invitation_token (révoqué pour authenticated)
  const admin = createAdminClient()

  // Requêtes parallèles : dernier test complété + définitions + historique + coach + réponses exercices
  const [
    { data: lastTest },
    { data: testDefinitionsRaw },
    { data: testHistory },
    { data: coachData },
    { data: exercises },
    { data: timeline },
    { data: programmes },
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

    // Exercices disponibles pour les modals de séance
    getExercisesAction(),

    // Timeline unifiée enrichie (exercices_total, exercices_completes par séance)
    client.user_id
      ? getClientSessionTimelineAction(client.user_id)
      : Promise.resolve({ data: null }),

    // Programmes actifs du client (module Programme)
    client.user_id
      ? getClientProgrammesAction(client.user_id)
      : Promise.resolve({ data: [] }),
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

  // Générer des URLs signées courte durée (1h) pour les documents — ne pas stocker de tokens en base
  const documentsWithUrls = await Promise.all(
    (client.documents ?? []).map(async (doc) => {
      const { data: signed } = await supabase.storage
        .from('dossiers')
        .createSignedUrl(doc.path, 60 * 60)
      return { ...doc, url: signed?.signedUrl ?? '' }
    })
  )

  return (
    <div className="space-y-6">
      {/* En-tête client */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#F1F0FE] text-2xl font-bold text-[#7069F4]">
                {client.nom.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#141325]">{client.nom}</h1>
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
                {/* Statut d'invitation et bouton d'action */}
                <div className="mt-2">
                  <InvitationActions
                    clientId={id}
                    status={client.invitation_status}
                    hasUserAccount={!!client.user_id}
                    hasEmail={!!client.email}
                  />
                </div>
                {client.manually_validated_at && (
                  <div className="mt-1">
                    <Badge variant="outline" className="text-xs text-[#20808D] border-[#20808D] bg-[#E8F4F5]">
                      Validé manuellement le {new Date(client.manually_validated_at).toLocaleDateString('fr-FR')}
                    </Badge>
                  </div>
                )}
                {/* Actions de gestion du compte (reset MDP, changement email) */}
                {client.user_id && client.email && (
                  <div className="mt-2">
                    <ClientAccountActions
                      clientId={id}
                      currentEmail={client.email}
                    />
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
                  <Button variant="outline" type="submit" className="text-[#7069F4]">
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
          <TabsTrigger value="documents">
            Documents
            {client.documents && client.documents.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 text-xs">{client.documents.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Profil — Intelligence Layer étape 25 */}
        <TabsContent value="profil" className="mt-4">
          {!client.user_id ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Ce client n&apos;a pas encore de compte MINND lié.
              </CardContent>
            </Card>
          ) : (
            <ProfileIntelligenceTab
              lastTestId={lastTest?.id ?? null}
              levelSlug={lastTest?.level_slug ?? null}
              hasProfile={!!profile}
            />
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

        {/* Séances — programme actif + historique cabinet, autonomie et récurrentes */}
        <TabsContent value="seances" className="mt-4 space-y-6">

          {/* Section Programme */}
          {client.user_id && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-[#141325]">Programme actif</h3>
                <CreateProgrammeDialog clientId={client.user_id} />
              </div>

              {programmes && programmes.length > 0 ? (
                <div className="space-y-4">
                  {programmes.map((prog) => (
                    <div key={prog.id} className="border rounded-lg p-4 space-y-3">
                      <ProgrammeEtapesList
                        programme={prog}
                        exercises={(exercises ?? []).map(ex => ({
                          id:          ex.id,
                          titre:       ex.titre,
                          format:      ex.format,
                          description: ex.description ?? null,
                        }))}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aucun programme actif. Créez un programme pour structurer le parcours de ce client.
                </p>
              )}
            </section>
          )}

          {/* Séparateur */}
          {client.user_id && <div className="border-t" />}

          {/* Historique des séances */}
          <section>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-sm">Historique des séances</CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    {timeline && (
                      <span className="text-xs text-gray-400">
                        {timeline.length} séance{timeline.length !== 1 ? 's' : ''}
                      </span>
                    )}
                    {client.user_id && (
                      <>
                        <PlanCabinetSessionModal
                          clients={[{ id: client.user_id, nom: client.nom, prenom: '' }]}
                          exercises={exercises ?? []}
                        />
                        <AssignAutonomousSessionModal
                          clients={[{ id: client.user_id, nom: client.nom, prenom: '' }]}
                          exercises={exercises ?? []}
                        />
                        <CreateRecurringTemplateModal
                          clients={[{ id: client.user_id, nom: client.nom, prenom: '' }]}
                          exercises={exercises ?? []}
                        />
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!client.user_id ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    Ce client n&apos;a pas encore de compte — invitez-le pour activer le suivi des séances.
                  </p>
                ) : (
                  <ClientSessionTimeline items={timeline ?? []} clientCrmId={id} />
                )}
              </CardContent>
            </Card>
          </section>

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

        {/* Documents */}
        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <ClientDocumentsSection
                clientId={id}
                documents={documentsWithUrls}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
