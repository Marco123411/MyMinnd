import type { ReactNode } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let pendingLeadsCount = 0
  let isAdmin = false
  if (user) {
    const [{ data: userRow }, { count }] = await Promise.all([
      supabase.from('users').select('role').eq('id', user.id).single(),
      supabase
        .from('contact_requests')
        .select('id', { count: 'exact', head: true })
        .eq('coach_user_id', user.id)
        .eq('status', 'pending'),
    ])
    isAdmin = userRow?.role === 'admin'
    pendingLeadsCount = count ?? 0
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar isAdmin={isAdmin} pendingLeadsCount={pendingLeadsCount} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
