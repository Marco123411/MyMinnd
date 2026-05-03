import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Inbox } from 'lucide-react'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CoachLeadsClient, type CoachLead } from './CoachLeadsClient'

export const metadata = {
  title: 'Demandes d\'accompagnement — MINND',
}

export default async function CoachLeadsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userRow } = await supabase
    .from('users')
    .select('role, subscription_tier')
    .eq('id', user.id)
    .single()

  if (!userRow || userRow.role !== 'coach') redirect('/')

  // Free tier : paywall
  if (userRow.subscription_tier === 'free') {
    const { count } = await supabase
      .from('contact_requests')
      .select('id', { count: 'exact', head: true })
      .eq('coach_user_id', user.id)
      .eq('status', 'pending')

    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-[#1A1A2E] mb-6">Demandes d&apos;accompagnement</h1>
        <Card className="p-8 text-center bg-gradient-to-br from-[#E8F4F5] to-white">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#20808D]">
            <Inbox className="h-7 w-7 text-white" />
          </div>
          <h2 className="text-xl font-bold text-[#1A1A2E] mb-2">
            {count ?? 0} athlète{(count ?? 0) > 1 ? 's' : ''} veulent vous contacter
          </h2>
          <p className="text-muted-foreground mb-6">
            Passez au plan <strong>Pro</strong> pour recevoir les demandes d&apos;accompagnement
            et débloquer votre annuaire public.
          </p>
          <Button asChild className="bg-[#20808D] hover:bg-[#1a6b76]">
            <Link href="/coach/pricing">Voir les plans Pro</Link>
          </Button>
        </Card>
      </div>
    )
  }

  // Liste des demandes. L'accès athlète (users, tests, profiles) passe par admin client :
  // avant acceptation, l'athlète n'est pas lié au coach → RLS bloquerait la lecture.
  // La sécurité est déjà assurée : les contact_requests filtrés par coach_user_id=user.id.
  const { data: requests } = await supabase
    .from('contact_requests')
    .select(
      'id, athlete_user_id, test_id, status, message, sport, level, objective, coach_response_message, created_at, responded_at, expires_at'
    )
    .eq('coach_user_id', user.id)
    .order('created_at', { ascending: false })

  const leads: CoachLead[] = []
  if (requests && requests.length > 0) {
    const admin = createAdminClient()
    const athleteIds = Array.from(new Set(requests.map((r) => r.athlete_user_id)))
    const testIds = Array.from(
      new Set(requests.map((r) => r.test_id).filter((id): id is string => !!id))
    )

    const [{ data: athleteUsers }, { data: tests }] = await Promise.all([
      admin.from('users').select('id, nom, prenom, photo_url').in('id', athleteIds),
      testIds.length > 0
        ? admin.from('tests').select('id, score_global, profile_id').in('id', testIds)
        : Promise.resolve({ data: [] as { id: string; score_global: number | null; profile_id: string | null }[] }),
    ])

    const profileIds = Array.from(
      new Set(
        (tests ?? [])
          .map((t) => t.profile_id)
          .filter((id): id is string => !!id)
      )
    )

    const { data: profiles } =
      profileIds.length > 0
        ? await admin.from('profiles').select('id, name, color').in('id', profileIds)
        : { data: [] as { id: string; name: string; color: string }[] }

    const userById = new Map((athleteUsers ?? []).map((u) => [u.id, u]))
    const testById = new Map((tests ?? []).map((t) => [t.id, t]))
    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]))

    for (const r of requests) {
      const athleteUser = userById.get(r.athlete_user_id)
      const test = r.test_id ? testById.get(r.test_id) : null
      const profile = test?.profile_id ? profileById.get(test.profile_id) : null
      leads.push({
        id: r.id,
        athleteName:
          [athleteUser?.prenom, athleteUser?.nom].filter(Boolean).join(' ') || 'Athlète',
        athletePhoto: athleteUser?.photo_url ?? null,
        profileName: profile?.name ?? null,
        profileColor: profile?.color ?? null,
        globalScore: test?.score_global ?? null,
        testId: r.test_id,
        sport: r.sport,
        level: r.level,
        objective: r.objective,
        message: r.message,
        coachResponseMessage: r.coach_response_message,
        status: r.status as CoachLead['status'],
        createdAt: r.created_at,
        respondedAt: r.responded_at,
        expiresAt: r.expires_at,
      })
    }
  }

  const pendingCount = leads.filter((l) => l.status === 'pending').length

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A2E]">Demandes d&apos;accompagnement</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Les athlètes qui souhaitent être accompagnés par vous.
          </p>
        </div>
        {pendingCount > 0 && (
          <Badge className="bg-[#FFC553] text-[#1A1A2E]">
            {pendingCount} en attente
          </Badge>
        )}
      </div>

      {leads.length === 0 ? (
        <Card className="p-8 text-center">
          <Inbox className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
          <h2 className="text-lg font-semibold text-[#1A1A2E] mb-1">
            Aucune demande pour le moment
          </h2>
          <p className="text-sm text-muted-foreground">
            Les athlètes qui consultent votre profil MINND pourront vous envoyer une demande
            d&apos;accompagnement ici.
          </p>
        </Card>
      ) : (
        <CoachLeadsClient leads={leads} />
      )}
    </div>
  )
}
