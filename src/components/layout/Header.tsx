'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { useUser } from '@/hooks/useUser'

interface HeaderProps {
  children?: ReactNode
}

export function Header({ children }: HeaderProps) {
  const { user, signOut } = useUser()

  return (
    <header className="h-16 border-b bg-card px-6 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-xl font-bold text-teal">
          MINND
        </Link>
        {children}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm">
          {user ? `${user.prenom ?? ''} ${user.nom}`.trim() : 'Mon profil'}
        </Button>
        <Button variant="outline" size="sm" onClick={signOut}>
          Déconnexion
        </Button>
      </div>
    </header>
  )
}
