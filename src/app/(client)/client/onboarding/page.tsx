import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OnboardingClient } from './OnboardingClient'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('context, nom, prenom')
    .eq('id', user.id)
    .single()

  // Si le contexte est déjà défini, l'onboarding est terminé
  if (profile?.context) redirect('/client')

  const prenom = profile?.prenom ?? profile?.nom ?? 'vous'

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#E8F4F5] to-white flex items-start justify-center pt-12 px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#1A1A2E]">MINND</h1>
          <p className="text-sm text-[#20808D] mt-1 tracking-widest uppercase">Performance Mentale</p>
        </div>
        <OnboardingClient prenom={prenom} />
      </div>
    </div>
  )
}
