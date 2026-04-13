'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ClientCard } from '@/components/coach/ClientCard'
import { ClientFilters, type FilterState } from '@/components/coach/ClientFilters'
import { ClientSlideOver } from '@/components/coach/ClientSlideOver'
import { getDisplayStatus, STATUS_PENDING_TEST } from '@/lib/clientStatus'
import { UserPlus, Download } from 'lucide-react'
import type { ClientWithLastTest } from '@/types'

interface ClientsPageClientProps {
  initialClients: ClientWithLastTest[]
}

// Préfixe les valeurs qui commencent par un caractère de formule (sécurité CSV injection)
function sanitizeCSVValue(val: string): string {
  if (/^[=+\-@\t\r]/.test(val)) return "'" + val
  return val
}

// Génère et télécharge un CSV des clients visibles (BOM pour Excel/accents français)
function exportClientsCSV(clients: ClientWithLastTest[]) {
  const headers = ['Nom', 'Email', 'Context', 'Sport', 'Entreprise', 'Statut', 'Score Global', 'Profil MINND', 'Dernier Test', 'Tags']
  const rows = clients.map((c) => [
    c.nom,
    c.email ?? '',
    c.context,
    c.sport ?? '',
    c.entreprise ?? '',
    getDisplayStatus(c),
    c.lastTestScore !== null ? c.lastTestScore.toFixed(2) : '',
    c.profileName ?? '',
    c.lastTestDate
      ? new Date(c.lastTestDate).toLocaleDateString('fr-FR')
      : '',
    (c.tags ?? []).join('; '),
  ])

  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${sanitizeCSVValue(String(v).replace(/"/g, '""'))}"`).join(','))
    .join('\n')

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `minnd-clients-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function ClientsPageClient({ initialClients }: ClientsPageClientProps) {
  const [filters, setFilters] = useState<FilterState>({
    statut: '',
    context: '',
    search: '',
    tag: '',
    sortBy: '',
  })
  const [selectedClient, setSelectedClient] = useState<ClientWithLastTest | null>(null)
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false)

  // Collecte tous les tags disponibles
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>()
    initialClients.forEach((c) => c.tags?.forEach((t) => tagSet.add(t)))
    return Array.from(tagSet).sort()
  }, [initialClients])

  // Filtre côté client
  const filtered = useMemo(() => {
    let list = [...initialClients]

    if (filters.statut) {
      if (filters.statut === 'en_attente') {
        list = list.filter((c) => getDisplayStatus(c) === STATUS_PENDING_TEST)
      } else {
        list = list.filter((c) => c.statut === filters.statut)
      }
    }
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

  function handleCardClick(client: ClientWithLastTest) {
    setSelectedClient(client)
    setIsSlideOverOpen(true)
  }

  // Mémorisé pour éviter la recréation à chaque render (stabilise les listeners keydown)
  const handleSlideOverClose = useCallback(() => {
    setIsSlideOverOpen(false)
    // Efface le client sélectionné après l'animation (250ms) pour éviter les données périmées
    setTimeout(() => setSelectedClient(null), 260)
  }, [])

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[#141325]">
          Clients
          <span className="ml-2 text-base font-normal text-muted-foreground">
            ({filtered.length})
          </span>
        </h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => exportClientsCSV(filtered)}
            disabled={filtered.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Exporter CSV
          </Button>
          <Button asChild className="bg-[#7069F4] text-white hover:bg-[#7069F4]/90">
            <Link href="/coach/clients/new">
              <UserPlus className="mr-2 h-4 w-4" />
              Ajouter un client
            </Link>
          </Button>
        </div>
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
            <Button asChild className="mt-4 bg-[#7069F4] text-white hover:bg-[#7069F4]/90">
              <Link href="/coach/clients/new">Ajouter mon premier client</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onClick={() => handleCardClick(client)}
            />
          ))}
        </div>
      )}

      {/* Slide-over */}
      <ClientSlideOver
        client={selectedClient}
        isOpen={isSlideOverOpen}
        onClose={handleSlideOverClose}
      />
    </div>
  )
}
