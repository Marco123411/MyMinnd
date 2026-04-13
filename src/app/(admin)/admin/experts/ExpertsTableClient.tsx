'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toggleExpertBadgeAction, toggleExpertVisibilityAction } from '@/app/actions/admin'
import type { AdminExpertWithStats } from '@/types'

const TIER_LABELS: Record<string, string> = {
  free: 'Gratuit',
  pro: 'Pro',
  expert: 'Expert',
}

const TIER_VARIANTS: Record<string, string> = {
  free: 'bg-gray-100 text-gray-700',
  pro: 'bg-[#F1F0FE] text-[#7069F4]',
  expert: 'bg-[#FF9F40]/20 text-[#EC638B]',
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

interface Props {
  initialExperts: AdminExpertWithStats[]
}

export function ExpertsTableClient({ initialExperts }: Props) {
  const [experts, setExperts] = useState(initialExperts)
  const [filterTier, setFilterTier] = useState<string>('all')
  const [filterBadge, setFilterBadge] = useState<string>('all')
  const [filterNote, setFilterNote] = useState<string>('all')
  const [filterTaux, setFilterTaux] = useState<string>('all')
  const [loadingBadge, setLoadingBadge] = useState<string | null>(null)
  const [loadingVisible, setLoadingVisible] = useState<string | null>(null)

  async function handleToggleBadge(userId: string, current: boolean) {
    if (loadingBadge) return
    setLoadingBadge(userId)
    setExperts((prev) =>
      prev.map((e) => (e.user_id === userId ? { ...e, badge_certifie: !current } : e))
    )
    const result = await toggleExpertBadgeAction(userId, !current)
    if (result.error) {
      // Rollback si erreur
      setExperts((prev) =>
        prev.map((e) => (e.user_id === userId ? { ...e, badge_certifie: current } : e))
      )
    }
    setLoadingBadge(null)
  }

  async function handleToggleVisible(userId: string, current: boolean) {
    if (loadingVisible) return
    setLoadingVisible(userId)
    setExperts((prev) =>
      prev.map((e) => (e.user_id === userId ? { ...e, is_visible: !current } : e))
    )
    const result = await toggleExpertVisibilityAction(userId, !current)
    if (result.error) {
      setExperts((prev) =>
        prev.map((e) => (e.user_id === userId ? { ...e, is_visible: current } : e))
      )
    }
    setLoadingVisible(null)
  }

  const filtered = experts.filter((e) => {
    if (filterTier !== 'all' && e.subscription_tier !== filterTier) return false
    if (filterBadge === 'certifie' && !e.badge_certifie) return false
    if (filterBadge === 'non_certifie' && e.badge_certifie) return false
    if (filterNote === '3' && e.note_moyenne < 3) return false
    if (filterNote === '4' && e.note_moyenne < 4) return false
    if (filterNote === '4.5' && e.note_moyenne < 4.5) return false
    if (filterTaux === '50' && e.taux_reponse < 50) return false
    if (filterTaux === '75' && e.taux_reponse < 75) return false
    if (filterTaux === '90' && e.taux_reponse < 90) return false
    return true
  })

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <Select value={filterTier} onValueChange={setFilterTier}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les tiers</SelectItem>
            <SelectItem value="pro">Pro</SelectItem>
            <SelectItem value="expert">Expert</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterBadge} onValueChange={setFilterBadge}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Badge" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="certifie">Certifiés</SelectItem>
            <SelectItem value="non_certifie">Non certifiés</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterNote} onValueChange={setFilterNote}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Note min." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes notes</SelectItem>
            <SelectItem value="3">3+ étoiles</SelectItem>
            <SelectItem value="4">4+ étoiles</SelectItem>
            <SelectItem value="4.5">4.5+ étoiles</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterTaux} onValueChange={setFilterTaux}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Taux réponse" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous taux</SelectItem>
            <SelectItem value="50">50%+</SelectItem>
            <SelectItem value="75">75%+</SelectItem>
            <SelectItem value="90">90%+</SelectItem>
          </SelectContent>
        </Select>

        <span className="self-center text-sm text-muted-foreground">
          {filtered.length} expert{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tableau principal */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead className="text-center">Badge certifié</TableHead>
              <TableHead className="text-center">Visible marketplace</TableHead>
              <TableHead className="text-right">Dispatches</TableHead>
              <TableHead className="text-right">Note</TableHead>
              <TableHead className="text-right">Taux réponse</TableHead>
              <TableHead>Dernière connexion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Aucun expert trouvé
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((expert) => (
                <TableRow key={expert.user_id}>
                  <TableCell className="font-medium">
                    {expert.prenom ? `${expert.prenom} ${expert.nom}` : expert.nom}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {expert.email}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${TIER_VARIANTS[expert.subscription_tier] ?? ''}`}
                    >
                      {TIER_LABELS[expert.subscription_tier] ?? expert.subscription_tier}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={expert.badge_certifie}
                      disabled={loadingBadge === expert.user_id}
                      onCheckedChange={() => handleToggleBadge(expert.user_id, expert.badge_certifie)}
                      aria-label="Badge certifié"
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={expert.is_visible}
                      disabled={loadingVisible === expert.user_id}
                      onCheckedChange={() => handleToggleVisible(expert.user_id, expert.is_visible)}
                      aria-label="Visible marketplace"
                    />
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {expert.nb_dispatches}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {expert.note_moyenne > 0 ? `${expert.note_moyenne.toFixed(1)}/5` : '—'}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {expert.taux_reponse > 0 ? `${expert.taux_reponse}%` : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(expert.last_login_at)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Section onboarding */}
      {filtered.some((e) => !e.has_photo || !e.has_bio || !e.has_titre || !e.has_specialites || !e.badge_certifie) && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-[#141325]">Onboarding en cours</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered
              .filter((e) => !e.has_photo || !e.has_bio || !e.has_titre || !e.has_specialites)
              .map((expert) => {
                const checks = [
                  { label: 'Photo uploadée', ok: expert.has_photo },
                  { label: 'Titre défini', ok: expert.has_titre },
                  { label: 'Bio rédigée', ok: expert.has_bio },
                  { label: 'Spécialités renseignées', ok: expert.has_specialites },
                  { label: 'Badge certifié', ok: expert.badge_certifie },
                ]
                const completed = checks.filter((c) => c.ok).length
                return (
                  <div key={expert.user_id} className="rounded-lg border bg-card p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">
                        {expert.prenom ? `${expert.prenom} ${expert.nom}` : expert.nom}
                      </p>
                      <Badge variant="outline" className="text-xs">
                        {completed}/{checks.length}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      {checks.map((c) => (
                        <div key={c.label} className="flex items-center gap-2 text-xs">
                          <span className={c.ok ? 'text-green-500' : 'text-gray-300'}>
                            {c.ok ? '✓' : '○'}
                          </span>
                          <span className={c.ok ? 'text-muted-foreground line-through' : ''}>
                            {c.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}
