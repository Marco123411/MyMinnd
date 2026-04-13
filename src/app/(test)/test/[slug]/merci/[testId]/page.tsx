import { redirect } from 'next/navigation'
import Link from 'next/link'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'

interface PageProps {
  params: Promise<{ slug: string; testId: string }>
}

export default async function MerciPage({ params }: PageProps) {
  const { slug, testId } = await params

  const uuidParsed = z.string().uuid().safeParse(testId)
  if (!uuidParsed.success) redirect(`/test/${slug}`)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?returnUrl=/test/${slug}/merci/${testId}`)

  const { data: test, error } = await supabase
    .from('tests')
    .select('id, status, coach_id, results_released_at')
    .eq('id', testId)
    .eq('user_id', user.id)
    .single()

  if (error || !test || test.status !== 'completed') redirect(`/test/${slug}`)

  // Récupère le prénom du coach
  let coachFirstName = 'votre coach'
  if (test.coach_id) {
    const { data: coachData } = await supabase
      .from('users')
      .select('nom, prenom')
      .eq('id', test.coach_id)
      .single()
    if (coachData) {
      coachFirstName = coachData.prenom ?? coachData.nom
    }
  }

  const isReleased = !!test.results_released_at

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f4f5] px-4 py-12">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-sm">
        {/* Icône de confirmation */}
        <div className="mb-6 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#F1F0FE]">
            <svg
              className="h-8 w-8 text-[#7069F4]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>

        {/* Titre */}
        <h1 className="mb-2 text-center text-2xl font-bold text-[#141325]">
          Merci&nbsp;! Votre test a bien été enregistré.
        </h1>
        <p className="mb-8 text-center text-muted-foreground">
          {isReleased
            ? 'Votre restitution personnalisée est prête.'
            : `${coachFirstName} a été notifié et prépare votre restitution personnalisée.`}
        </p>

        {/* Stepper 3 étapes */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {/* Étape 1 — Test complété */}
            <div className="flex flex-col items-center gap-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#7069F4] text-white">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-center text-xs font-medium text-[#7069F4]">Test<br />complété</span>
            </div>

            {/* Ligne 1 */}
            <div className="mb-4 flex-1 border-t-2 border-[#7069F4] mx-2" />

            {/* Étape 2 — Coach notifié */}
            <div className="flex flex-col items-center gap-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#7069F4] text-white">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-center text-xs font-medium text-[#7069F4]">Coach<br />notifié</span>
            </div>

            {/* Ligne 2 */}
            <div
              className={`mb-4 flex-1 border-t-2 mx-2 ${isReleased ? 'border-[#7069F4]' : 'border-gray-200'}`}
            />

            {/* Étape 3 — Résultats */}
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  isReleased ? 'bg-[#7069F4] text-white' : 'bg-gray-100 text-gray-400'
                }`}
              >
                {isReleased ? (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                )}
              </div>
              <span
                className={`text-center text-xs font-medium ${
                  isReleased ? 'text-[#7069F4]' : 'text-gray-400'
                }`}
              >
                {isReleased ? (
                  <>Résultats<br />disponibles&nbsp;!</>
                ) : (
                  <>Résultats<br />en préparation</>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* CTA si résultats disponibles */}
        {isReleased ? (
          <div className="mb-6 text-center">
            <Link href={`/client/results/${testId}`}>
              <Button className="w-full bg-[#7069F4] hover:bg-[#5B54D6]">
                Voir mes résultats
              </Button>
            </Link>
          </div>
        ) : (
          <p className="mb-6 text-center text-sm text-muted-foreground">
            Vous recevrez un email dès que vos résultats seront disponibles.
          </p>
        )}

        {/* Retour espace client */}
        <div className="text-center">
          <Link href="/client">
            <Button variant="ghost" className="text-muted-foreground">
              Retour à mon espace
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
