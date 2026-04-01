import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { PricingClient } from './PricingClient'
import type { SubscriptionTier, SubscriptionStatus } from '@/types'

// Price IDs lus côté serveur et passés au composant client comme props (non-secrets mais non-NEXT_PUBLIC)
function getPriceIds() {
  return {
    proMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? '',
    proAnnual: process.env.STRIPE_PRICE_PRO_ANNUAL ?? '',
    expertMonthly: process.env.STRIPE_PRICE_EXPERT_MONTHLY ?? '',
    expertAnnual: process.env.STRIPE_PRICE_EXPERT_ANNUAL ?? '',
  }
}

export default async function PricingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: userData } = await supabase
    .from('users')
    .select('subscription_tier, subscription_status')
    .eq('id', user?.id ?? '')
    .single()

  const tier = (userData?.subscription_tier ?? 'free') as SubscriptionTier
  const status = (userData?.subscription_status ?? 'inactive') as SubscriptionStatus

  // Suspense requis par useSearchParams dans PricingClient (F7)
  return (
    <Suspense fallback={<div className="max-w-5xl mx-auto px-4 py-8 text-gray-400">Chargement...</div>}>
      <PricingClient
        currentTier={tier}
        currentStatus={status}
        priceIds={getPriceIds()}
      />
    </Suspense>
  )
}
