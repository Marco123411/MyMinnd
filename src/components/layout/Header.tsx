import Link from 'next/link'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'

interface HeaderProps {
  children?: ReactNode
}

export function Header({ children }: HeaderProps) {
  return (
    <header className="h-16 border-b bg-card px-6 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-xl font-bold text-teal">
          MINND
        </Link>
        {children}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm">Mon profil</Button>
        <Button variant="outline" size="sm">Déconnexion</Button>
      </div>
    </header>
  )
}
