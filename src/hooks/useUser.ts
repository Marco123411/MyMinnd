'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { AuthUser } from '@/types'

export function useUser() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  // Instance unique partagée dans tout le hook
  const supabase = useMemo(() => createClient(), [])

  const fetchUser = useCallback(async () => {
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authUser) {
      setUser(null)
      setIsLoading(false)
      return
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, role, context, nom, prenom, photo_url, subscription_tier, subscription_status, is_active, created_at, last_login_at')
      .eq('id', authUser.id)
      .single()

    if (userError || !userData) {
      setUser(null)
      setIsLoading(false)
      return
    }

    setUser({ ...userData, email: authUser.email ?? '' })
    setIsLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      // TOKEN_REFRESHED n'invalide pas les données du profil — pas besoin de refetch
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        fetchUser()
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setIsLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, fetchUser])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Sign out error:', error.message)
    }
    router.push('/login')
  }, [supabase, router])

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    signOut,
  }
}
