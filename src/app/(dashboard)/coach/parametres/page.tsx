import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Settings } from 'lucide-react'
import { SettingsPageClient } from './SettingsPageClient'

export default async function CoachParametresPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('nom, prenom')
    .eq('id', user.id)
    .single()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-5 w-5 text-[#20808D]" />
        <h1 className="text-xl font-bold text-[#1A1A2E]">Paramètres</h1>
      </div>

      <SettingsPageClient
        nom={(userData as { nom?: string } | null)?.nom ?? ''}
        prenom={(userData as { prenom?: string } | null)?.prenom ?? ''}
        email={user.email ?? ''}
      />
    </div>
  )
}
