'use client'

import { useState, useEffect, useRef } from 'react'
import { MapPin, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StarRating } from './StarRating'
import { cn } from '@/lib/utils'
import { MARKETPLACE_CONTEXTES, MARKETPLACE_PUBLIC_CIBLE, MARKETPLACE_SPECIALITES } from '@/lib/constants/marketplace'
import type { ExpertFilters, ClientContext, ExpertPublicCible } from '@/types'

interface ExpertFiltersProps {
  filters: ExpertFilters
  onFilterChange: (filters: ExpertFilters) => void
}

export function ExpertFilters({ filters, onFilterChange }: ExpertFiltersProps) {
  const [localisation, setLocalisation] = useState(filters.localisation ?? '')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounce localisation input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (localisation !== (filters.localisation ?? '')) {
        onFilterChange({ ...filters, localisation: localisation || undefined })
      }
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localisation])

  const togglePublicCible = (value: ExpertPublicCible) => {
    onFilterChange({
      ...filters,
      public_cible: filters.public_cible === value ? undefined : value,
    })
  }

  const hasActiveFilters =
    !!filters.context ||
    !!filters.localisation ||
    !!filters.public_cible ||
    !!filters.specialite ||
    !!filters.note_min ||
    !!filters.sortBy

  const reset = () => {
    setLocalisation('')
    onFilterChange({})
  }

  return (
    <div className="flex flex-wrap items-start gap-3">
      {/* Localisation */}
      <div className="relative min-w-[180px]">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Ville ou région..."
          value={localisation}
          onChange={(e) => setLocalisation(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Contexte */}
      <Select
        value={filters.context ?? 'all'}
        onValueChange={(v) =>
          onFilterChange({ ...filters, context: v === 'all' ? undefined : (v as ClientContext) })
        }
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Contexte" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tous</SelectItem>
          {MARKETPLACE_CONTEXTES.map((c) => (
            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Spécialité */}
      <Select
        value={filters.specialite ?? 'all'}
        onValueChange={(v) =>
          onFilterChange({ ...filters, specialite: v === 'all' ? undefined : v })
        }
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Spécialité" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Toutes spécialités</SelectItem>
          {MARKETPLACE_SPECIALITES.map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Public cible (badges toggleables) */}
      <div className="flex flex-wrap gap-1.5">
        {MARKETPLACE_PUBLIC_CIBLE.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => togglePublicCible(p.value)}
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
              filters.public_cible === p.value
                ? 'bg-[#7069F4] text-white border-[#7069F4]'
                : 'bg-background text-muted-foreground border-border hover:border-[#7069F4]'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Note minimum */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground whitespace-nowrap">Note min.</span>
        <StarRating
          rating={filters.note_min ?? 0}
          onChange={(v) =>
            onFilterChange({ ...filters, note_min: v === filters.note_min ? undefined : v })
          }
          size="md"
        />
      </div>

      {/* Tri */}
      <Select
        value={filters.sortBy ?? 'pertinence'}
        onValueChange={(v) =>
          onFilterChange({
            ...filters,
            sortBy: v === 'pertinence' ? undefined : (v as ExpertFilters['sortBy']),
          })
        }
      >
        <SelectTrigger className="w-[170px]">
          <SelectValue placeholder="Trier par" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="pertinence">Pertinence</SelectItem>
          <SelectItem value="note">Mieux notés</SelectItem>
          <SelectItem value="prix">Prix croissant</SelectItem>
          <SelectItem value="nb_profils">Plus d&apos;expérience</SelectItem>
        </SelectContent>
      </Select>

      {/* Reset */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={reset} className="gap-1.5">
          <X className="h-3.5 w-3.5" />
          Réinitialiser
        </Button>
      )}
    </div>
  )
}

// Badge helper réexporté pour usage dans la page
export { Badge }
