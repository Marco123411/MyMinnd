import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { associateTestToUser } from '@/app/actions/test'
import { Button } from '@/components/ui/button'

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function InvitePage({ params }: PageProps) {
  const { token } = await params
  const admin = createAdminClient()

  // Récupère le test via token (admin client nécessaire — colonnes cachées via RLS)
  const { data: test, error } = await admin
    .from('tests')
    .select('id, token_expires_at, user_id, test_definitions(slug, name)')
    .eq('invitation_token', token)
    .single()

  if (error || !test) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-bold text-[#3C3CD6]">Lien invalide</h1>
        <p className="mt-2 text-muted-foreground">Ce lien d'invitation est invalide ou a déjà été utilisé.</p>
        <Link href="/login" className="mt-6">
          <Button>Se connecter</Button>
        </Link>
      </div>
    )
  }

  if (test.token_expires_at && new Date(test.token_expires_at) < new Date()) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <h1 className="text-2xl font-bold text-[#3C3CD6]">Lien expiré</h1>
        <p className="mt-2 text-muted-foreground">Ce lien d'invitation a expiré. Demandez un nouveau lien à votre coach.</p>
      </div>
    )
  }

  const definition = test.test_definitions as unknown as { slug: string; name: string } | null
  const testSlug = definition?.slug ?? ''
  const testName = definition?.name ?? 'Test'

  // Si le test est déjà réclamé, redirige vers la passation
  if (test.user_id) redirect(`/test/${testSlug}/pass/${test.id}`)

  // Vérifie si l'utilisateur est connecté
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    // Associe le test à l'utilisateur et redirige
    const result = await associateTestToUser(token)
    if (result.error) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
          <h1 className="text-2xl font-bold text-[#3C3CD6]">Erreur</h1>
          <p className="mt-2 text-muted-foreground">{result.error}</p>
        </div>
      )
    }
    redirect(`/test/${testSlug}/pass/${test.id}`)
  }

  // Utilisateur non connecté — affiche le formulaire d'accueil
  const returnUrl = `/test/invite/${token}`

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="w-full max-w-md space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#141325]">Invitation à passer un test</h1>
          <p className="mt-2 text-muted-foreground">
            Vous avez été invité à passer le test <strong>{testName}</strong>.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Link href={`/login?returnUrl=${encodeURIComponent(returnUrl)}`}>
            <Button className="w-full bg-[#7069F4] hover:bg-[#5B54D6]">Se connecter</Button>
          </Link>
          <Link href={`/register?returnUrl=${encodeURIComponent(returnUrl)}`}>
            <Button variant="outline" className="w-full">
              Créer un compte
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
