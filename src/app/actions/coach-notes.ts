'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { Resend } from 'resend'
import { TestResultsReadyEmail } from '@/emails/TestResultsReadyEmail'

const upsertNoteSchema = z.object({
  testId: z.string().uuid(),
  nodeId: z.string().uuid(),
  // trim() before min(1) prevents whitespace-only notes from violating the DB CHECK constraint
  note: z.string().trim().min(1).max(2000),
})

const nodeRefSchema = z.object({
  testId: z.string().uuid(),
  nodeId: z.string().uuid(),
})

/** Sauvegarde ou met à jour une annotation de coach sur une compétence */
export async function upsertCoachNoteAction(
  testId: string,
  nodeId: string,
  note: string
): Promise<{ error: string | null }> {
  const parsed = upsertNoteSchema.safeParse({ testId, nodeId, note })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  // Vérifie rôle coach
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'coach') return { error: 'Accès réservé aux coachs' }

  // Vérifie que ce test appartient bien au coach
  const { data: test } = await supabase
    .from('tests')
    .select('id, coach_id')
    .eq('id', parsed.data.testId)
    .single()
  if (!test || test.coach_id !== user.id) return { error: 'Test introuvable' }

  const { error } = await supabase
    .from('test_coach_notes')
    .upsert(
      {
        test_id: parsed.data.testId,
        coach_id: user.id,
        node_id: parsed.data.nodeId,
        note: parsed.data.note.trim(),
      },
      { onConflict: 'test_id,node_id' }
    )

  if (error) return { error: error.message }
  return { error: null }
}

/** Supprime une annotation de coach */
export async function deleteCoachNoteAction(
  testId: string,
  nodeId: string
): Promise<{ error: string | null }> {
  const parsed = nodeRefSchema.safeParse({ testId, nodeId })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { error } = await supabase
    .from('test_coach_notes')
    .delete()
    .eq('test_id', parsed.data.testId)
    .eq('node_id', parsed.data.nodeId)
    .eq('coach_id', user.id)

  if (error) return { error: error.message }
  return { error: null }
}

/** Récupère toutes les annotations d'un test pour le coach (vue édition) */
export async function getCoachNotesForTestAction(
  testId: string
): Promise<{ data: Record<string, string> | null; error: string | null }> {
  const uuidParsed = z.string().uuid().safeParse(testId)
  if (!uuidParsed.success) return { data: null, error: 'ID test invalide' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Non authentifié' }

  const { data, error } = await supabase
    .from('test_coach_notes')
    .select('node_id, note')
    .eq('test_id', uuidParsed.data)
    .eq('coach_id', user.id)

  if (error) return { data: null, error: error.message }

  const notesMap: Record<string, string> = {}
  for (const row of data ?? []) {
    notesMap[row.node_id] = row.note
  }

  return { data: notesMap, error: null }
}

/** Publie les résultats du test + notifie le client par email */
export async function publishTestResultsAction(
  testId: string
): Promise<{ error: string | null }> {
  const uuidParsed = z.string().uuid().safeParse(testId)
  if (!uuidParsed.success) return { error: 'ID test invalide' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const admin = createAdminClient()

  // Récupère le test avec infos client + test_definition
  const { data: test, error: fetchError } = await admin
    .from('tests')
    .select(`
      id,
      coach_id,
      user_id,
      results_released_at,
      status,
      test_definitions ( name ),
      users!tests_user_id_fkey ( nom, prenom )
    `)
    .eq('id', testId)
    .single()

  if (fetchError || !test) return { error: 'Test introuvable' }
  if (test.coach_id !== user.id) return { error: 'Accès refusé' }
  if (test.status !== 'completed') return { error: "Le test n'est pas encore complété" }
  if (test.results_released_at) return { error: 'Les résultats ont déjà été publiés' }

  // Publie les résultats — filtre atomique sur IS NULL pour prévenir les doubles envois (TOCTOU)
  const { data: updatedRows, error: updateError } = await admin
    .from('tests')
    .update({ results_released_at: new Date().toISOString() })
    .eq('id', testId)
    .is('results_released_at', null)
    .select('id')

  if (updateError) return { error: updateError.message }
  // Si aucune ligne mise à jour, la publication a déjà eu lieu (race condition)
  if (!updatedRows || updatedRows.length === 0) return { error: 'Les résultats ont déjà été publiés' }

  // Envoie email au client si Resend configuré
  if (test.user_id && process.env.RESEND_API_KEY) {
    // Récupère l'email via auth (non stocké dans public.users)
    const [{ data: coachData }, { data: clientAuthData }] = await Promise.all([
      admin.from('users').select('nom, prenom').eq('id', user.id).single(),
      admin.auth.admin.getUserById(test.user_id),
    ])

    const clientEmail = clientAuthData?.user?.email
    if (clientEmail) {
      const resend = new Resend(process.env.RESEND_API_KEY)

      const clientUserInfo = Array.isArray(test.users) ? test.users[0] : (test.users as { nom: string; prenom: string | null } | null)
      const defRecord = Array.isArray(test.test_definitions) ? test.test_definitions[0] : (test.test_definitions as { name: string } | null)

      const coachName = coachData
        ? [coachData.prenom, coachData.nom].filter(Boolean).join(' ')
        : 'Votre coach'
      const clientName = clientUserInfo?.prenom ?? clientUserInfo?.nom ?? 'Athlète'
      const testName = defRecord?.name ?? 'Test MINND'
      const resultsUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/client/results/${testId}`

      const { error: emailError } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL ?? 'MINND <noreply@myminnd.com>',
        to: [clientEmail],
        subject: `Vos résultats "${testName}" sont disponibles sur MINND`,
        react: TestResultsReadyEmail({
          clientName,
          coachName,
          testName,
          resultsUrl,
        }),
      })

      if (emailError) {
        console.error('[publishTestResultsAction] Erreur envoi email client:', emailError.message)
      }
    }
  }

  return { error: null }
}
