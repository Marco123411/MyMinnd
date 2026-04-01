'use client'

import { useUser } from '@/hooks/useUser'
import type { SubscriptionTier, SubscriptionStatus } from '@/types'

type SubscriptionFeature =
  | 'unlimited_clients'
  | 'sessions'
  | 'unlimited_tests'
  | 'custom_exercises'
  | 'certified_badge'
  | 'priority_dispatch'

const FEATURE_REQUIREMENTS: Record<SubscriptionFeature, SubscriptionTier[]> = {
  unlimited_clients: ['pro', 'expert'],
  sessions: ['pro', 'expert'],
  unlimited_tests: ['pro', 'expert'],
  custom_exercises: ['expert'],
  certified_badge: ['expert'],
  priority_dispatch: ['expert'],
}

export function useSubscription() {
  const { user, isLoading } = useUser()

  const tier: SubscriptionTier = user?.subscription_tier ?? 'free'
  const status: SubscriptionStatus = user?.subscription_status ?? 'inactive'
  const isActive = status === 'active'

  function canAccess(feature: SubscriptionFeature): boolean {
    // L'abonnement doit être actif ET le tier suffisant (F9)
    return isActive && FEATURE_REQUIREMENTS[feature].includes(tier)
  }

  function upsellTier(feature: SubscriptionFeature): SubscriptionTier | null {
    if (canAccess(feature)) return null
    return FEATURE_REQUIREMENTS[feature][0] ?? null
  }

  return { tier, status, isActive, isLoading, canAccess, upsellTier }
}
