'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ExpertCard } from '@/components/marketplace/ExpertCard'
import { ExpertFilters } from '@/components/marketplace/ExpertFilters'
import { Button } from '@/components/ui/button'
import type { ExpertFilters as ExpertFiltersType, ExpertProfileWithUser } from '@/types'
import { getExpertsAction } from '@/app/actions/marketplace'

interface MarketplaceClientProps {
  initialExperts: ExpertProfileWithUser[]
}

export function MarketplaceClient({ initialExperts }: MarketplaceClientProps) {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [experts, setExperts] = useState<ExpertProfileWithUser[]>(initialExperts)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState<ExpertFiltersType>({
    context: (searchParams.get('context') as ExpertFiltersType['context']) ?? undefined,
    localisation: searchParams.get('localisation') ?? undefined,
    public_cible: (searchParams.get('public_cible') as ExpertFiltersType['public_cible']) ?? undefined,
    specialite: searchParams.get('specialite') ?? undefined,
    note_min: searchParams.get('note_min') ? Number(searchParams.get('note_min')) : undefined,
    sortBy: (searchParams.get('sortBy') as ExpertFiltersType['sortBy']) ?? undefined,
  })

  // Only re-fetch when filters change (not on mount — initial data is server-rendered)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!mounted) return
    setLoading(true)
    getExpertsAction(filters).then(({ data }) => {
      setExperts(data)
      setLoading(false)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, mounted])

  const handleFilterChange = (newFilters: ExpertFiltersType) => {
    setFilters(newFilters)

    // Sync URL params
    const params = new URLSearchParams()
    if (newFilters.context) params.set('context', newFilters.context)
    if (newFilters.localisation) params.set('localisation', newFilters.localisation)
    if (newFilters.public_cible) params.set('public_cible', newFilters.public_cible)
    if (newFilters.specialite) params.set('specialite', newFilters.specialite)
    if (newFilters.note_min) params.set('note_min', String(newFilters.note_min))
    if (newFilters.sortBy) params.set('sortBy', newFilters.sortBy)
    router.replace(`/marketplace?${params.toString()}`, { scroll: false })
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* En-tête */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#141325] mb-2">
          Trouvez votre expert certifié MINND
        </h1>
        <p className="text-muted-foreground">
          Des préparateurs mentaux certifiés pour accompagner votre performance
        </p>
      </div>

      {/* Filtres */}
      <div className="mb-8 p-4 rounded-xl border bg-white">
        <ExpertFilters filters={filters} onFilterChange={handleFilterChange} />
      </div>

      {/* Grille d'experts */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-52 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : experts.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-lg font-medium text-[#141325] mb-2">
            Aucun expert trouvé
          </p>
          <p className="text-muted-foreground mb-6">
            Essayez d&apos;élargir vos critères de recherche
          </p>
          <Button variant="outline" onClick={() => handleFilterChange({})}>
            Réinitialiser les filtres
          </Button>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            {experts.length} expert{experts.length > 1 ? 's' : ''} trouvé{experts.length > 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {experts.map((expert) => (
              <ExpertCard key={expert.id} expert={expert} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
