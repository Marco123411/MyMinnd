'use client'

import { useState, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { updateUserRoleAction, toggleUserActiveAction } from '@/app/actions/admin'
import type { AdminUser, UserRole } from '@/types'

const ROLE_LABELS: Record<string, string> = {
  client: 'Client',
  coach: 'Coach',
  admin: 'Admin',
}

const ROLE_COLORS: Record<string, string> = {
  client: 'bg-blue-50 text-blue-700',
  coach: 'bg-[#F1F0FE] text-[#7069F4]',
  admin: 'bg-red-50 text-red-700',
}

const TIER_LABELS: Record<string, string> = {
  free: 'Gratuit',
  pro: 'Pro',
}

const TIER_COLORS: Record<string, string> = {
  free: 'bg-gray-100 text-gray-600',
  pro: 'bg-[#F1F0FE] text-[#7069F4]',
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

const PAGE_SIZE = 50

interface Props {
  initialUsers: AdminUser[]
}

export function UsersPageClient({ initialUsers }: Props) {
  const [users, setUsers] = useState(initialUsers)
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [filterTier, setFilterTier] = useState('all')
  const [filterActive, setFilterActive] = useState('all')
  const [page, setPage] = useState(0)
  const [loadingRole, setLoadingRole] = useState<string | null>(null)
  const [loadingActive, setLoadingActive] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (filterRole !== 'all' && u.role !== filterRole) return false
      if (filterTier !== 'all' && u.subscription_tier !== filterTier) return false
      if (filterActive === 'actif' && !u.is_active) return false
      if (filterActive === 'inactif' && u.is_active) return false
      if (search) {
        const q = search.toLowerCase()
        if (
          !u.nom.toLowerCase().includes(q) &&
          !(u.prenom ?? '').toLowerCase().includes(q) &&
          !u.email.toLowerCase().includes(q)
        ) return false
      }
      return true
    })
  }, [users, filterRole, filterTier, filterActive, search])

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  async function handleToggleActive(userId: string, current: boolean) {
    if (loadingActive) return
    setLoadingActive(userId)
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_active: !current } : u)))
    const result = await toggleUserActiveAction(userId, !current)
    if (result.error) {
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_active: current } : u)))
    }
    setLoadingActive(null)
  }

  async function handleChangeRole(userId: string, newRole: string) {
    if (loadingRole) return
    setLoadingRole(userId)
    const result = await updateUserRoleAction(userId, newRole as UserRole)
    if (!result.error) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole as UserRole } : u))
      )
    }
    setLoadingRole(null)
  }

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="flex flex-wrap gap-3 items-center">
        <Input
          placeholder="Rechercher par nom ou email..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          className="w-64"
        />

        <Select value={filterRole} onValueChange={(v) => { setFilterRole(v); setPage(0) }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Rôle" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les rôles</SelectItem>
            <SelectItem value="client">Client</SelectItem>
            <SelectItem value="coach">Coach</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterTier} onValueChange={(v) => { setFilterTier(v); setPage(0) }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les tiers</SelectItem>
            <SelectItem value="free">Gratuit</SelectItem>
            <SelectItem value="pro">Pro</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterActive} onValueChange={(v) => { setFilterActive(v); setPage(0) }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="actif">Actifs</SelectItem>
            <SelectItem value="inactif">Désactivés</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-sm text-muted-foreground">
          {filtered.length} utilisateur{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tableau */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead className="text-center">Actif</TableHead>
              <TableHead className="text-right">Tests</TableHead>
              <TableHead>Inscription</TableHead>
              <TableHead>Dernière connexion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Aucun utilisateur trouvé
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((user) => (
                <TableRow key={user.id} className={!user.is_active ? 'opacity-60' : ''}>
                  <TableCell className="font-medium text-sm">
                    {user.prenom ? `${user.prenom} ${user.nom}` : user.nom}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {user.email}
                  </TableCell>
                  <TableCell>
                    {loadingRole === user.id ? (
                      <span className="text-xs text-muted-foreground">...</span>
                    ) : (
                      <Select
                        value={user.role}
                        onValueChange={(v) => handleChangeRole(user.id, v)}
                        disabled={loadingRole === user.id}
                      >
                        <SelectTrigger className="h-7 w-28 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="client">Client</SelectItem>
                          <SelectItem value="coach">Coach</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${TIER_COLORS[user.subscription_tier] ?? ''}`}
                    >
                      {TIER_LABELS[user.subscription_tier] ?? user.subscription_tier}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={user.is_active}
                      disabled={loadingActive === user.id}
                      onCheckedChange={() => handleToggleActive(user.id, user.is_active)}
                      aria-label="Actif"
                    />
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {user.test_count}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(user.created_at)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(user.last_login_at)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page + 1} / {totalPages} ({filtered.length} résultats)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 0}
            >
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages - 1}
            >
              Suivant
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
