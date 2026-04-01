'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { computeTestScores } from '@/lib/scoring'
import { z } from 'zod'
import { Resend } from 'resend'
import { TestCompletedCoachEmail } from '@/emails/TestCompletedCoachEmail'

const createTestSchema = z.object({
  testDefinitionId: z.string().uuid(),
  levelSlug: z.enum(['discovery', 'complete', 'expert']),
  coachId: z.string().uuid().optional(),
})

const saveResponseSchema = z.object({
  testId: z.string().uuid(),
  questionId: z.string().uuid(),
  rawScore: z.number().int().min(1).max(10),
  isReversed: z.boolean(),
})

export async function createTestAction(
  testDefinitionId: string,
  levelSlug: string,
  coachId?: string
): Promise<{ data: { testId: string } | null; error: string | null }> {
  const parsed = createTestSchema.safeParse({ testDefinitionId, levelSlug, coachId })
  if (!parsed.success) return { data: null, error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Non authentifié' }

  const { data, error } = await supabase
    .from('tests')
    .insert({
      test_definition_id: parsed.data.testDefinitionId,
      user_id: user.id,
      coach_id: parsed.data.coachId ?? null,
      level_slug: parsed.data.levelSlug,
      status: 'in_progress',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (error) return { data: null, error: error.message }
  return { data: { testId: data.id }, error: null }
}

export async function saveResponseAction(
  testId: string,
  questionId: string,
  rawScore: number,
  isReversed: boolean
): Promise<{ error: string | null }> {
  const parsed = saveResponseSchema.safeParse({ testId, questionId, rawScore, isReversed })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  // Defense-in-depth : vérifie propriété et statut (RLS assure aussi ceci côté DB)
  const { data: testCheck } = await supabase
    .from('tests')
    .select('id')
    .eq('id', parsed.data.testId)
    .eq('user_id', user.id)
    .eq('status', 'in_progress')
    .single()

  if (!testCheck) return { error: 'Test introuvable ou déjà terminé' }

  // computed_score : inversion si applicable (règle MINND NON-NÉGOCIABLE)
  const computedScore = parsed.data.isReversed ? 11 - parsed.data.rawScore : parsed.data.rawScore

  const { error } = await supabase.from('responses').upsert(
    {
      test_id: parsed.data.testId,
      question_id: parsed.data.questionId,
      raw_score: parsed.data.rawScore,
      computed_score: computedScore,
      answered_at: new Date().toISOString(),
    },
    { onConflict: 'test_id,question_id' }
  )

  if (error) return { error: error.message }
  return { error: null }
}

export async function completeTestAction(
  testId: string
): Promise<{ error: string | null }> {
  // Validation UUID (cohérent avec les autres actions)
  const uuidParsed = z.string().uuid().safeParse(testId)
  if (!uuidParsed.success) return { error: 'ID de test invalide' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  // Vérification propriété (lecture seule — le write atomique viendra après)
  const { data: test, error: testError } = await supabase
    .from('tests')
    .select('id, test_definition_id, level_slug, status, coach_id')
    .eq('id', testId)
    .eq('user_id', user.id)
    .single()

  if (testError || !test) return { error: 'Test introuvable' }
  if (test.status === 'completed') return { error: null } // déjà complété, idempotent

  // Admin client requis pour lire les tables restreintes (normative_stats, centroids)
  // et écrire test_scores / score_global (révoqués pour authenticated)
  const admin = createAdminClient()

  // Calcul complet des scores via le moteur (feuilles, domaines, global, percentiles, profil)
  const scoring = await computeTestScores(testId, test.test_definition_id, test.level_slug, admin)

  // Construit les lignes test_scores
  const testScores: {
    test_id: string
    entity_type: 'competency_node' | 'global'
    entity_id: string | null
    score: number
    percentile: number | null
  }[] = []

  if (scoring.globalScore !== null) {
    testScores.push({
      test_id: testId,
      entity_type: 'global',
      entity_id: null,
      score: scoring.globalScore,
      percentile: scoring.globalPercentile,
    })
  }
  for (const { nodeId, score, percentile } of scoring.leafScores) {
    testScores.push({ test_id: testId, entity_type: 'competency_node', entity_id: nodeId, score, percentile })
  }
  for (const { nodeId, score, percentile } of scoring.domainScores) {
    testScores.push({ test_id: testId, entity_type: 'competency_node', entity_id: nodeId, score, percentile })
  }

  // Mise à jour atomique du statut (WHERE status='in_progress' évite les doublons)
  const { data: locked, error: lockError } = await admin
    .from('tests')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      score_global: scoring.globalScore,
      profile_id: scoring.profileId,
    })
    .eq('id', testId)
    .eq('status', 'in_progress')
    .select('id')

  if (lockError) return { error: lockError.message }
  // Aucune ligne mise à jour = test déjà complété (race condition gagnée par un autre appel)
  if (!locked || locked.length === 0) return { error: null }

  // Sauvegarde des scores via admin (suppression puis insertion)
  if (testScores.length > 0) {
    await admin.from('test_scores').delete().eq('test_id', testId)
    const { error: insertError } = await admin.from('test_scores').insert(testScores)
    if (insertError) return { error: insertError.message }
  }

  // Notification email au coach si Resend configuré et coach assigné
  if (process.env.RESEND_API_KEY && test.coach_id) {
    const [{ data: coachAuthData }, { data: defData }, { data: clientData }] = await Promise.all([
      admin.auth.admin.getUserById(test.coach_id),
      admin.from('test_definitions').select('name').eq('id', test.test_definition_id).single(),
      admin.from('users').select('nom, prenom').eq('id', user.id).single(),
    ])

    const coachEmail = coachAuthData?.user?.email
    if (coachEmail) {
      const resend = new Resend(process.env.RESEND_API_KEY)

      const { data: coachData } = await admin
        .from('users')
        .select('nom, prenom')
        .eq('id', test.coach_id)
        .single()

      const coachFirstName = coachData?.prenom ?? coachData?.nom ?? 'Coach'
      const clientFullName = [clientData?.prenom, clientData?.nom].filter(Boolean).join(' ') || 'Client'
      const testName = defData?.name ?? 'Test MINND'
      const annotateUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/coach/tests/${testId}/results`

      const { error: emailError } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? 'MINND <noreply@myminnd.com>',
        to: [coachEmail],
        subject: `${clientFullName} a complété son test ${testName}`,
        react: TestCompletedCoachEmail({
          coachName: coachFirstName,
          clientName: clientFullName,
          testName,
          levelSlug: test.level_slug,
          globalScore: scoring.globalScore ?? 0,
          annotateUrl,
        }),
      })

      if (emailError) {
        console.error('[completeTestAction] Erreur envoi email coach:', emailError.message)
      }
    }
  }

  return { error: null }
}

export async function associateTestToUser(
  token: string
): Promise<{ data: { testId: string; testDefinitionSlug: string } | null; error: string | null }> {
  // Validation UUID : cohérent avec les autres actions + défense en profondeur
  const uuidParsed = z.string().uuid().safeParse(token)
  if (!uuidParsed.success) return { data: null, error: 'Lien invalide' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Non authentifié' }

  const admin = createAdminClient()

  const { data: test, error: fetchError } = await admin
    .from('tests')
    .select('id, test_definition_id, token_expires_at, user_id, status, client_id, test_definitions(slug)')
    .eq('invitation_token', token)
    .single()

  if (fetchError || !test) return { data: null, error: 'Lien invalide' }
  if (test.token_expires_at && new Date(test.token_expires_at) < new Date()) {
    return { data: null, error: 'Ce lien a expiré' }
  }
  if (test.user_id) return { data: null, error: 'Ce test a déjà été réclamé' }
  // Vérifie le statut : seuls les tests pending peuvent être réclamés via invitation
  if (test.status !== 'pending') return { data: null, error: 'Ce lien n\'est plus valide' }

  // Garde atomique : .is('user_id', null) évite la double-réclamation en cas de race condition
  const { data: updated, error: updateError } = await admin
    .from('tests')
    .update({ user_id: user.id, status: 'in_progress', started_at: new Date().toISOString() })
    .eq('id', test.id)
    .is('user_id', null)
    .select('id')

  if (updateError) return { data: null, error: updateError.message }
  // Race condition perdue : un autre appel a réclamé le test en parallèle
  if (!updated || updated.length === 0) return { data: null, error: 'Ce test a déjà été réclamé' }

  // Synchronise la fiche CRM : si le client n'avait pas de compte MINND, on lie son user_id
  const testWithClient = test as unknown as { client_id?: string }
  if (testWithClient.client_id) {
    const { data: crmClient } = await admin
      .from('clients')
      .select('id, user_id')
      .eq('id', testWithClient.client_id)
      .single()

    if (crmClient && !crmClient.user_id) {
      await admin
        .from('clients')
        .update({ user_id: user.id })
        .eq('id', testWithClient.client_id)
    }
  }

  const slug = (test.test_definitions as unknown as { slug: string } | null)?.slug ?? ''
  return { data: { testId: test.id, testDefinitionSlug: slug }, error: null }
}
