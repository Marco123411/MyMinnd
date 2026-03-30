'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Brain, Clock, UserCheck, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/client', label: 'Accueil', icon: Home, exact: true },
  { href: '/client/profile', label: 'Profil', icon: Brain, exact: false },
  { href: '/client/history', label: 'Historique', icon: Clock, exact: false },
  { href: '/client/coach', label: 'Coach', icon: UserCheck, exact: false },
  { href: '/client/settings', label: 'Réglages', icon: Settings, exact: false },
]

export function ClientNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background shadow-[0_-1px_10px_rgba(0,0,0,0.06)]">
      <div className="mx-auto flex max-w-2xl items-center justify-around px-2 py-2">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1 text-xs transition-colors',
                isActive
                  ? 'text-[#20808D]'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon
                className={cn('h-5 w-5', isActive && 'stroke-[2.5px]')}
              />
              <span>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
