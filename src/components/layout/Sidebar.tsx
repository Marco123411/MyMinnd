'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Users, BarChart2, Settings, Dumbbell, CalendarDays, BookOpen, Inbox } from 'lucide-react'

const coachNavItems = [
  { href: '/coach', label: 'Tableau de bord', icon: LayoutDashboard, exact: true },
  { href: '/coach/clients', label: 'Clients', icon: Users },
  { href: '/coach/leads', label: 'Demandes', icon: Inbox, badgeKey: 'pendingLeads' as const },
  { href: '/coach/programmes', label: 'Programmes', icon: BookOpen },
  { href: '/coach/exercises', label: 'Exercices', icon: Dumbbell },
  { href: '/coach/sessions', label: 'Séances', icon: CalendarDays },
  { href: '/coach/rapports', label: 'Rapports', icon: BarChart2 },
  { href: '/coach/parametres', label: 'Paramètres', icon: Settings },
]

const adminNavItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/utilisateurs', label: 'Utilisateurs', icon: Users },
]

interface SidebarProps {
  isAdmin?: boolean
  pendingLeadsCount?: number
}

export function Sidebar({ isAdmin = false, pendingLeadsCount = 0 }: SidebarProps) {
  const pathname = usePathname()
  const navItems = isAdmin ? adminNavItems : coachNavItems

  return (
    <aside className="w-64 bg-[#141325] flex flex-col shrink-0">
      <div className="h-16 border-b border-white/10 px-6 flex items-center">
        <span className="text-xl font-bold text-white" style={{ fontFamily: 'GalanoGrotesque, sans-serif' }}>MINND</span>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`)
          const showBadge =
            'badgeKey' in item && item.badgeKey === 'pendingLeads' && pendingLeadsCount > 0
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-300',
                isActive
                  ? 'bg-[#7069F4] text-white'
                  : 'text-white/60 hover:bg-white/10 hover:text-white'
              )}
            >
              <span className="flex items-center gap-3">
                <Icon className="h-4 w-4" />
                {item.label}
              </span>
              {showBadge && (
                <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-[#FFC553] text-[#1A1A2E] text-xs font-semibold">
                  {pendingLeadsCount > 99 ? '99+' : pendingLeadsCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
