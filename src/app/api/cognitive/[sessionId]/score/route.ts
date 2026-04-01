import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { scoreSession } from '@/lib/cognitive/scoring'
import { z } from 'zod'

const uuidSchema = z.string().uuid()

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params

  if (!uuidSchema.safeParse(sessionId).success) {
    return NextResponse.json({ error: 'sessionId invalide' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // F4: seul le coach assigné peut déclencher un re-scoring (pas le client lui-même)
  const { data: session, error: sessionError } = await supabase
    .from('cognitive_sessions')
    .select('id, user_id, coach_id, cognitive_test_id, status')
    .eq('id', sessionId)
    .eq('coach_id', user.id)
    .single()

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Session introuvable ou accès refusé' }, { status: 404 })
  }

  if (session.status !== 'completed') {
    return NextResponse.json({ error: 'Session non terminée' }, { status: 422 })
  }

  // Récupérer le slug du test et les trials
  const [{ data: defData }, { data: trialsData }] = await Promise.all([
    supabase
      .from('cognitive_test_definitions')
      .select('slug')
      .eq('id', session.cognitive_test_id)
      .single(),
    supabase
      .from('cognitive_trials')
      .select('stimulus_type, stimulus_data, reaction_time_ms, is_correct, is_anticipation, is_lapse')
      .eq('session_id', sessionId)
      .order('trial_index'),
  ])

  if (!defData || !trialsData) {
    return NextResponse.json({ error: 'Données introuvables' }, { status: 404 })
  }

  const metrics = scoreSession(defData.slug, trialsData)

  // computed_metrics est révoqué pour `authenticated` — on utilise le service_role
  // F1: scoper par user_id en plus de id pour limiter le blast radius du client admin
  const admin = createAdminClient()
  const { error: updateError } = await admin
    .from('cognitive_sessions')
    .update({ computed_metrics: metrics })
    .eq('id', sessionId)
    .eq('user_id', session.user_id)

  if (updateError) {
    return NextResponse.json({ error: 'Erreur lors de la mise à jour des métriques' }, { status: 500 })
  }

  return NextResponse.json({ metrics })
}
