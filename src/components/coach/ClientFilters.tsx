'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Search, X } from 'lucide-react'

export interface FilterState {
  statut: string
  context: string
  search: string
  tag: string
  sortBy: 'nom' | 'last_test' | 'score' | ''
}

interface ClientFiltersProps {
  onFilterChange: (filters: FilterState) => void
  availableTags?: string[]
}

const DEFAULT_FILTERS: FilterState = {
  statut: '',
  context: '',
  search: '',
  tag: '',
  sortBy: '',
}

export function ClientFilters({ onFilterChange, availableTags = [] }: ClientFiltersProps) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  function update(patch: Partial<FilterState>) {
    setFilters((prev) => {
      const next = { ...prev, ...patch }
      return next
    })
  }

  // Propagate changes (debounced for search)
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => onFilterChange(filters), 300)
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current)
    }
  }, [filters, onFilterChange])

  function reset() {
    setFilters(DEFAULT_FILTERS)
  }

  const hasActiveFilters =
    filters.statut || filters.context || filters.search || filters.tag || filters.sortBy

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Recherche */}
      <div className="relative min-w-[200px]">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher..."
          value={filters.search}
          onChange={(e) => update({ search: e.target.value })}
          className="pl-8"
        />
      </div>

      {/* Statut */}
      <Select value={filters.statut || 'all'} onValueChange={(v) => update({ statut: v === 'all' ? '' : v })}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Statut" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous les statuts</SelectItem>
          <SelectItem value="actif">Actif</SelectItem>
          <SelectItem value="en_pause">En pause</SelectItem>
          <SelectItem value="archive">Archivé</SelectItem>
        </SelectContent>
      </Select>

      {/* Context */}
      <Select value={filters.context || 'all'} onValueChange={(v) => update({ context: v === 'all' ? '' : v })}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Contexte" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous les contextes</SelectItem>
          <SelectItem value="sport">Sport</SelectItem>
          <SelectItem value="corporate">Corporate</SelectItem>
          <SelectItem value="wellbeing">Bien-être</SelectItem>
          <SelectItem value="coaching">Coaching</SelectItem>
        </SelectContent>
      </Select>

      {/* Tri */}
      <Select value={filters.sortBy || 'default'} onValueChange={(v) => update({ sortBy: v === 'default' ? '' : (v as FilterState['sortBy']) })}>
        <SelectTrigger className="w-[160px]">
          <SelectValue placeholder="Trier par" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default">Trier par...</SelectItem>
          <SelectItem value="nom">Nom A→Z</SelectItem>
          <SelectItem value="last_test">Dernier test</SelectItem>
          <SelectItem value="score">Score global</SelectItem>
        </SelectContent>
      </Select>

      {/* Tags disponibles */}
      {availableTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {availableTags.map((tag) => (
            <button
              key={tag}
              onClick={() => update({ tag: filters.tag === tag ? '' : tag })}
              className="cursor-pointer"
            >
              <Badge
                variant={filters.tag === tag ? 'default' : 'outline'}
                className={filters.tag === tag ? 'bg-[#20808D]' : ''}
              >
                {tag}
              </Badge>
            </button>
          ))}
        </div>
      )}

      {/* Reset */}
      {hasActiveFilters && (
        <button
          onClick={reset}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
          Réinitialiser
        </button>
      )}
    </div>
  )
}
