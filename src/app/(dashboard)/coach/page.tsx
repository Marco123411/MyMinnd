import Link from 'next/link'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatsCards } from '@/components/coach/StatsCards'
import { AlertsList, type CoachAlert } from '@/components/coach/AlertsList'
import { Badge } from '@/components/ui/badge'
import { UserPlus } from 'lucide-react'

export default async function CoachPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: userData },
    { count: clientsActifs },
    { count: testsEnvoyesMois },
    { count: testsCompletesMois },
  ] = await Promise.all([
    user
      ? supabase.from('users').select('nom, prenom').eq('id', user.id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('coach_id', user?.id ?? '')
      .eq('statut', 'actif'),
    supabase
      .from('tests')
      .select('id', { count: 'exact', head: true })
      .eq('coach_id', user?.id ?? '')
      .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    supabase
      .from('tests')
      .select('id', { count: 'exact', head: true })
      .eq('coach_id', user?.id ?? '')
      .eq('status', 'completed')
      .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
  ])

  const displayName = userData
    ? [(userData as { prenom?: string; nom?: string }).prenom, (userData as { nom?: string }).nom].filter(Boolean).join(' ')
    : user?.email ?? 'Coach'

  const tauxCompletion =
    testsEnvoyesMois && testsEnvoyesMois > 0
      ? Math.round(((testsCompletesMois ?? 0) / testsEnvoyesMois) * 100)
      : 0

  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  // Étape 1 : clients actifs (nécessaire pour filtrer les tests par user_id ensuite)
  const { data: clientsData } = await supabase
    .from('clients')
    .select('id, nom, user_id')
    .eq('coach_id', user?.id ?? '')
    .eq('statut', 'actif')

  // IDs et user_ids des clients du coach pour les deux axes de recherche
  const clientIds = (clientsData ?? []).map((c) => c.id)
  const clientUserIds = (clientsData ?? []).map((c) => c.user_id).filter(Boolean) as string[]

  // Admin client : bypass RLS pour voir tous les tests des clients (peu importe coach_id)
  const admin = createAdminClient()

  // Étape 2 : requêtes parallèles
  const [
    { data: recentTestRows },
    { data: pendingTests },
    { data: recentResults },
  ] = await Promise.all([
    // Tests complétés dans les 3 derniers mois pour ces clients
    // Croise par client_id (tests assignés par coach) ET user_id (tests auto-démarrés)
    // Utilise le client admin pour bypasser la RLS (tests_select_coach ne suffit pas pour les tests sans coach_id)
    clientIds.length > 0 || clientUserIds.length > 0
      ? admin
          .from('tests')
          .select('client_id, user_id')
          .eq('status', 'completed')
          .gte('completed_at', threeMonthsAgo.toISOString())
          .or(
            [
              clientIds.length > 0 ? `client_id.in.(${clientIds.join(',')})` : null,
              clientUserIds.length > 0 ? `user_id.in.(${clientUserIds.join(',')})` : null,
            ]
              .filter(Boolean)
              .join(',')
          )
      : Promise.resolve({ data: [] as { client_id: string | null; user_id: string | null }[] }),
    // Tests en attente depuis plus de 7 jours
    supabase
      .from('tests')
      .select('id, user_id')
      .eq('coach_id', user?.id ?? '')
      .in('status', ['pending', 'in_progress'])
      .lt('created_at', sevenDaysAgo.toISOString())
      .limit(10),
    // Derniers résultats (filtre coach_id pour la vue coach uniquement)
    supabase
      .from('tests')
      .select(`
        id,
        completed_at,
        score_global,
        user_id,
        test_definitions ( name ),
        profiles ( name, color )
      `)
      .eq('coach_id', user?.id ?? '')
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(5),
  ])

  // Calcul des alertes en mémoire
  // Un client est "testé récemment" si un test récent le référence par client_id OU par user_id
  const recentClientIdSet = new Set(
    (recentTestRows ?? []).map((t) => t.client_id).filter(Boolean)
  )
  const recentUserIdSet = new Set(
    (recentTestRows ?? []).map((t) => t.user_id).filter(Boolean)
  )
  const pendingUserIdSet = new Set(
    (pendingTests ?? []).map((t) => t.user_id).filter(Boolean)
  )

  // Map user_id → client pour les tests pending
  const clientByUserId = new Map(
    (clientsData ?? []).filter((c) => c.user_id).map((c) => [c.user_id, c])
  )

  const alerts: CoachAlert[] = []

  // Clients sans re-test depuis 3 mois
  // Exclut si un test récent les référence par client_id OU par user_id
  ;(clientsData ?? [])
    .filter((c) => !recentClientIdSet.has(c.id) && !(c.user_id && recentUserIdSet.has(c.user_id)))
    .slice(0, 5)
    .forEach((c) => {
      alerts.push({
        id: `noretest-${c.id}`,
        type: 'no_retest',
        clientNom: c.nom,
        clientId: c.id,
        message: 'Aucun re-test depuis plus de 3 mois',
      })
    })

  // Tests en attente non complétés
  ;(pendingTests ?? []).slice(0, 5).forEach((t) => {
    const client = t.user_id ? clientByUserId.get(t.user_id) : null
    if (client && !pendingUserIdSet.has(t.user_id)) return // déjà ajouté
    if (client) {
      alerts.push({
        id: `pending-${t.id}`,
        type: 'pending_test',
        clientNom: client.nom,
        clientId: client.id,
        message: 'Test envoyé mais non complété depuis plus de 7 jours',
      })
    }
  })

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#141325]">Bonjour, {displayName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Bienvenue dans votre espace coach MINND.</p>
        </div>
        <Button asChild className="bg-[#7069F4] text-white hover:bg-[#7069F4]/90">
          <Link href="/coach/clients/new">
            <UserPlus className="mr-2 h-4 w-4" />
            Ajouter un client
          </Link>
        </Button>
      </div>

      {/* Statistiques */}
      <StatsCards
        clientsActifs={clientsActifs ?? 0}
        testsEnvoyesMois={testsEnvoyesMois ?? 0}
        tauxCompletion={tauxCompletion}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Alertes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alertes</CardTitle>
          </CardHeader>
          <CardContent>
            <AlertsList alerts={alerts.slice(0, 5)} />
          </CardContent>
        </Card>

        {/* Derniers résultats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Derniers résultats</CardTitle>
          </CardHeader>
          <CardContent>
            {!recentResults || recentResults.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun résultat pour le moment.</p>
            ) : (
              <ul className="space-y-2">
                {recentResults.map((test) => {
                  const definition = Array.isArray(test.test_definitions)
                    ? test.test_definitions[0]
                    : test.test_definitions
                  const profile = Array.isArray(test.profiles) ? test.profiles[0] : test.profiles
                  // Récupère le nom du client via son user_id
                  const client = test.user_id ? clientByUserId.get(test.user_id) : null

                  return (
                    <li key={test.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium">{client?.nom ?? '—'}</span>
                      <span className="text-muted-foreground">{(definition as { name: string } | null)?.name ?? '—'}</span>
                      {test.score_global !== null && (
                        <span className="font-semibold text-[#7069F4]">{test.score_global}/10</span>
                      )}
                      {profile && (
                        <Badge
                          style={{ backgroundColor: (profile as { color: string }).color, color: '#fff' }}
                          className="text-xs"
                        >
                          {(profile as { name: string }).name}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {test.completed_at
                          ? new Date(test.completed_at).toLocaleDateString('fr-FR')
                          : ''}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
