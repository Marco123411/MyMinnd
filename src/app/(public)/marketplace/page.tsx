import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getExpertsAction } from '@/app/actions/marketplace'
import { MarketplaceClient } from '@/components/marketplace/MarketplaceClient'

export const metadata: Metadata = {
  title: 'Annuaire des experts certifiés MINND',
  description: 'Trouvez un préparateur mental certifié MINND pour accompagner votre performance sportive, corporate ou bien-être.',
}

export default async function MarketplacePage() {
  // Initial SSR fetch — no filters, default sort (badge + note)
  const { data: initialExperts } = await getExpertsAction()

  return (
    <Suspense fallback={
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="h-8 w-64 bg-muted animate-pulse rounded mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-52 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    }>
      <MarketplaceClient initialExperts={initialExperts} />
    </Suspense>
  )
}
