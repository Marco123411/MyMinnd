import type { ReactNode } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { Badge } from '@/components/ui/badge'

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar isAdmin />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header>
          <Badge variant="destructive" className="text-xs">Admin</Badge>
        </Header>
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
