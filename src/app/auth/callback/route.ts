import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// URL de base fixe (évite les open-redirect via Host header spoofing)
function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
}

function redirectHome(role: string): NextResponse {
  const base = appUrl()
  if (role === 'coach') return NextResponse.redirect(`${base}/coach`)
  if (role === 'admin') return NextResponse.redirect(`${base}/admin`)
  return NextResponse.redirect(`${base}/client`)
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const base = appUrl()

  const supabase = await createClient()

  // Flux OAuth (code PKCE)
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error || !data.session) {
      return NextResponse.redirect(`${base}/login?error=auth_failed`)
    }
  }
  // Flux confirmation email (token_hash)
  else if (tokenHash && type === 'email') {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'email',
    })
    if (error) {
      return NextResponse.redirect(`${base}/login?error=confirmation_failed`)
    }
  }
  else {
    return NextResponse.redirect(`${base}/login?error=missing_params`)
  }

  // Récupère l'utilisateur après échange de session
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.redirect(`${base}/login?error=no_user`)
  }

  // Vérifie si le profil est complet
  const { data: userData, error: profileError } = await supabase
    .from('users')
    .select('role, context')
    .eq('id', user.id)
    .single()

  if (profileError || !userData) {
    return NextResponse.redirect(`${base}/complete-profile`)
  }

  // Premier login OAuth : role='client' + context=null = profil à compléter
  if (userData.context === null && userData.role === 'client') {
    return NextResponse.redirect(`${base}/complete-profile`)
  }

  const parsedRole = z.enum(['client', 'coach', 'admin']).safeParse(userData.role)
  if (!parsedRole.success) {
    return NextResponse.redirect(`${base}/login?error=invalid_role`)
  }

  return redirectHome(parsedRole.data)
}
