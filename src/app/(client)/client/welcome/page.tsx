import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function WelcomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold text-[#1A1A2E]">Bienvenue sur MINND !</h1>
        <p className="text-muted-foreground">Votre compte est activé.</p>
        <Link href="/client/dashboard" className="text-[#20808D] underline">
          Accéder à mon espace
        </Link>
      </div>
    </div>
  )
}
