import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-muted flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl mx-auto text-center space-y-6">
        <Badge variant="secondary" className="text-sm px-4 py-1.5">
          MINND Mental Performance
        </Badge>
        <h1 className="text-5xl font-bold tracking-tight">
          Bienvenue sur{' '}
          <span className="text-[#7069F4]">MINND</span>
        </h1>
        <p className="text-xl text-muted-foreground">
          Plateforme de performance mentale pour coachs et athlètes.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Button asChild size="lg" className="bg-[#7069F4] hover:bg-[#5B54D6] text-white min-w-40">
            <Link href="/login">Connexion</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="min-w-40">
            <Link href="/register">Créer un compte</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
