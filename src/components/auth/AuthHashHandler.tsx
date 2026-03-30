'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Handles Supabase implicit-flow auth redirects (hash fragments).
 * The Supabase dashboard sends magic links / password-reset links that
 * append #access_token=... to the redirect URL. Since hash fragments are
 * never sent to the server, this client component detects and exchanges them.
 *
 * Uses setSession() explicitly instead of relying on onAuthStateChange timing.
 * Renders nothing — just processes auth state on mount.
 */
export function AuthHashHandler() {
  const router = useRouter()

  useEffect(() => {
    const hash = window.location.hash

    // Handle error hash (e.g. #error=access_denied&error_code=otp_expired)
    if (hash.startsWith('#error=') || hash.includes('&error=')) {
      const params = new URLSearchParams(hash.slice(1))
      const code = params.get('error_code') ?? params.get('error') ?? 'auth_failed'
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
      router.replace(`/login?error=${encodeURIComponent(code)}`)
      return
    }

    if (!hash.includes('access_token=')) return

    const params = new URLSearchParams(hash.slice(1))
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const type = params.get('type') // 'magiclink' | 'recovery' | 'signup'

    if (!accessToken || !refreshToken) return

    const supabase = createClient()

    // Clean the URL immediately so tokens don't appear in history
    window.history.replaceState(null, '', window.location.pathname + window.location.search)

    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(async ({ data, error }) => {
        if (error || !data.session) {
          router.replace('/login?error=auth_failed')
          return
        }

        // Password recovery — let the user set a new password
        if (type === 'recovery') {
          router.replace('/reset-password')
          return
        }

        // Lookup role in DB
        const { data: userData } = await supabase
          .from('users')
          .select('role, context')
          .eq('id', data.session.user.id)
          .single()

        if (!userData) {
          // New user or incomplete profile
          router.replace('/complete-profile')
          return
        }

        if (userData.role === 'coach') router.replace('/coach')
        else if (userData.role === 'admin') router.replace('/admin')
        else router.replace('/client')
      })
  }, [router])

  return null
}
