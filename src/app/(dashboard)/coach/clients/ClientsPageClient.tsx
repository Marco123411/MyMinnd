'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ClientCard } from '@/components/coach/ClientCard'
import { ClientFilters, type FilterState } from '@/components/coach/ClientFilters'
import { UserPlus } from 'lucide-react'
import type { ClientWithLastTest } from '@/types'

interface ClientsPageClientProps {
  initialClients: ClientWithLastTest[]
}

export function ClientsPageClient({ initialClients }: ClientsPageClientProps) {
  const [filters, setFilters] = useState<FilterState>({
    statut: '',
    context: '',
    search: '',
    tag: '',
    sortBy: '',
  })

  // Collecte tous les tags disponibles
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>()
    initialClients.forEach((c) => c.tags?.forEach((t) => tagSet.add(t)))
    return Array.from(tagSet).sort()
  }, [initialClients])

  // Filtre côté client (les données initiales sont déjà chargées)
  const filtered = useMemo(() => {
    let list = [...initialClients]

    if (filters.statut) list = list.filter((c) => c.statut === filters.statut)
    if (filters.context) list = list.filter((c) => c.context === filters.context)
    if (filters.tag) list = list.filter((c) => c.tags?.includes(filters.tag))
    if (filters.search) {
      const q = filters.search.toLowerCase()
      list = list.filter(
        (c) =>
          c.nom.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.sport?.toLowerCase().includes(q) ||
          c.entreprise?.toLowerCase().includes(q)
      )
    }
    if (filters.sortBy === 'nom') list.sort((a, b) => a.nom.localeCompare(b.nom))
    if (filters.sortBy === 'score') list.sort((a, b) => (b.lastTestScore ?? -1) - (a.lastTestScore ?? -1))
    if (filters.sortBy === 'last_test') list.sort((a, b) => (b.lastTestDate ?? '').localeCompare(a.lastTestDate ?? ''))

    return list
  }, [initialClients, filters])

  const handleFilterChange = useCallback((f: FilterState) => setFilters(f), [])

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[#1A1A2E]">
          Clients
          <span className="ml-2 text-base font-normal text-muted-foreground">
            ({filtered.length})
          </span>
        </h1>
        <Button asChild className="bg-[#20808D] text-white hover:bg-[#20808D]/90">
          <Link href="/coach/clients/new">
            <UserPlus className="mr-2 h-4 w-4" />
            Ajouter un client
          </Link>
        </Button>
      </div>

      {/* Filtres */}
      <ClientFilters onFilterChange={handleFilterChange} availableTags={availableTags} />

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground">
            {initialClients.length === 0
              ? 'Aucun client. Commencez par en ajouter un.'
              : 'Aucun client ne correspond aux filtres.'}
          </p>
          {initialClients.length === 0 && (
            <Button asChild className="mt-4 bg-[#20808D] text-white hover:bg-[#20808D]/90">
              <Link href="/coach/clients/new">Ajouter mon premier client</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((client) => (
            <ClientCard key={client.id} client={client} />
          ))}
        </div>
      )}
    </div>
  )
}
