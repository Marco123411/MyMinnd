import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TestEngine } from '@/components/test/TestEngine'
import { completeTestAction } from '@/app/actions/test'
import type { Question } from '@/types'

interface PageProps {
  params: Promise<{ slug: string; testId: string }>
}

export default async function PassPage({ params }: PageProps) {
  const { slug, testId } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?returnUrl=/test/${slug}/pass/${testId}`)

  // Récupère le test en vérifiant l'appartenance à l'utilisateur
  const { data: test, error: testError } = await supabase
    .from('tests')
    .select('id, level_slug, status, test_definition_id')
    .eq('id', testId)
    .eq('user_id', user.id)
    .single()

  if (testError || !test) redirect(`/test/${slug}`)
  if (test.status === 'completed') redirect(`/test/${slug}/results/${testId}`)

  // Récupère les questions selon le niveau du test
  const questionsQuery =
    test.level_slug === 'discovery'
      ? supabase
          .from('questions')
          .select('id, text_fr, text_en, is_reversed, level_required, order_index, competency_node_id, test_definition_id, is_active')
          .eq('test_definition_id', test.test_definition_id)
          .eq('is_active', true)
          .eq('level_required', 'discovery')
          .order('order_index')
      : supabase
          .from('questions')
          .select('id, text_fr, text_en, is_reversed, level_required, order_index, competency_node_id, test_definition_id, is_active')
          .eq('test_definition_id', test.test_definition_id)
          .eq('is_active', true)
          .order('order_index')

  const { data: questions } = await questionsQuery

  // Récupère les réponses existantes (reprise)
  const { data: existingResponses } = await supabase
    .from('responses')
    .select('question_id, raw_score')
    .eq('test_id', testId)

  const existingAnswers: Record<string, number> = {}
  for (const r of existingResponses ?? []) {
    existingAnswers[r.question_id] = r.raw_score
  }

  const questionList = (questions ?? []) as Question[]

  // Si toutes les questions ont déjà une réponse, finalise le test et redirige
  // (évite la boucle redirect : pass → results → pass si completeTestAction a échoué avant)
  const allAnswered = questionList.length > 0 && questionList.every((q) => q.id in existingAnswers)
  if (allAnswered) {
    await completeTestAction(testId) // idempotent si déjà complété
    redirect(`/test/${slug}/results/${testId}`)
  }

  return (
    <TestEngine
      testId={testId}
      testSlug={slug}
      questions={questionList}
      existingAnswers={existingAnswers}
    />
  )
}
