import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RegisterAthleteForm } from './RegisterAthleteForm'

export const metadata = {
  title: 'Créer votre profil mental — MINND',
  description: 'Passez le PMA gratuitement et découvrez votre profil mental MINND.',
}

export default async function RegisterAthletePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Redirige si déjà connecté
  if (user) {
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (userData?.role === 'client') redirect('/test/pma/start')
    if (userData?.role === 'coach') redirect('/coach')
    if (userData?.role === 'admin') redirect('/admin')
  }

  return <RegisterAthleteForm />
}
