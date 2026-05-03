import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let userRole: string | null = null
  if (user) {
    const { data } = await supabase.from('users').select('role').eq('id', user.id).single()
    userRole = data?.role ?? null
  }

  const athleteHref = userRole === 'client' ? '/test/pma/start' : '/register/athlete'
  const athleteCtaLabel = userRole === 'client' ? 'Commencer mon test' : 'Passez le test gratuitement'

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#E8F4F5] to-white flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl mx-auto text-center space-y-6">
        <Badge variant="secondary" className="text-sm px-4 py-1.5">
          MINND Mental Performance
        </Badge>
        <h1 className="text-5xl font-bold tracking-tight text-[#1A1A2E]">
          Bienvenue sur <span className="text-[#20808D]">MINND</span>
        </h1>
        <p className="text-xl text-muted-foreground">
          Découvrez votre profil mental en 15 minutes.
        </p>

        {/* CTA principal athlète */}
        <div className="pt-4">
          <Button
            asChild
            size="lg"
            className="bg-[#20808D] hover:bg-[#1a6b76] text-white h-14 px-8 text-lg min-w-64"
          >
            <Link href={athleteHref}>{athleteCtaLabel}</Link>
          </Button>
          <p className="mt-3 text-sm text-muted-foreground">
            155 questions • 15-20 minutes • Résultats immédiats
          </p>
        </div>

        {/* Séparateur */}
        <div className="pt-6 pb-2">
          <div className="inline-flex items-center gap-3 text-sm text-muted-foreground">
            <span className="h-px w-12 bg-gray-300" />
            <span>ou</span>
            <span className="h-px w-12 bg-gray-300" />
          </div>
        </div>

        {/* CTAs secondaires */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg" variant="outline" className="min-w-40">
            <Link href="/login">Connexion</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="min-w-40">
            <Link href="/register">Espace préparateur</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
