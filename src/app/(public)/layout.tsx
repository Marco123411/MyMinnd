import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl font-black tracking-[0.2em] text-[#7069F4]">MINND</span>
              <span className="hidden sm:block text-xs text-muted-foreground tracking-widest uppercase">
                Performance Mentale
              </span>
            </Link>

            <nav className="flex items-center gap-3">
              <Button variant="ghost" asChild size="sm">
                <Link href="/login">Connexion</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">S&apos;inscrire</Link>
              </Button>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="border-t py-6 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} MINND — Plateforme de performance mentale
          </p>
        </div>
      </footer>
    </div>
  )
}
