'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Calendar, Clock, TrendingUp, AlertTriangle } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent } from '@/components/ui/card'
import { SessionStatusBadge } from '@/components/sessions/SessionStatusBadge'
import { PlanCabinetSessionModal } from '@/components/sessions/PlanCabinetSessionModal'
import { AssignAutonomousSessionModal } from '@/components/sessions/AssignAutonomousSessionModal'
import { CreateRecurringTemplateModal } from '@/components/sessions/CreateRecurringTemplateModal'
import { TRIGGER_LABELS } from '@/lib/sessions/constants'
import type {
  CabinetSession,
  AutonomousSession,
  RecurringTemplate,
  SessionsObservanceMetrics,
  ClientSelectOption,
  Exercise,
  AutonomousSessionStatut,
} from '@/types'

type EnrichedAutonomous = AutonomousSession & { client_nom: string; client_prenom: string }
type EnrichedTemplate = RecurringTemplate & {
  execution_count: number
  client_nom: string
  client_prenom: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface SessionsPageClientProps {
  cabinetUpcoming: CabinetSession[]
  cabinetPast: CabinetSession[]
  autonomousSessions: EnrichedAutonomous[]
  templates: EnrichedTemplate[]
  metrics: SessionsObservanceMetrics | null
  clients: ClientSelectOption[]
  exercises: Exercise[]
}

export function SessionsPageClient({
  cabinetUpcoming,
  cabinetPast,
  autonomousSessions,
  templates,
  metrics,
  clients,
  exercises,
}: SessionsPageClientProps) {
  const [filterClient, setFilterClient] = useState<string>('all')
  const [filterStatut, setFilterStatut] = useState<string>('all')

  // Clients uniques pour le filtre
  const uniqueClients = useMemo(() => {
    const seen = new Set<string>()
    return autonomousSessions.filter((s) => {
      if (seen.has(s.client_id)) return false
      seen.add(s.client_id)
      return true
    })
  }, [autonomousSessions])

  const filteredAutonomous = useMemo(() => {
    return autonomousSessions.filter((s) => {
      if (filterClient !== 'all' && s.client_id !== filterClient) return false
      if (filterStatut !== 'all' && s.statut !== filterStatut) return false
      return true
    })
  }, [autonomousSessions, filterClient, filterStatut])

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A2E]">Séances</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Gérez les séances cabinet, l&apos;autonomie et les routines de vos clients
          </p>
        </div>
      </div>

      {/* Métriques d'observance */}
      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-50">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-xl font-bold text-[#1A1A2E]">{metrics.taux_completion}%</p>
                  <p className="text-xs text-gray-500">Taux de complétion</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${metrics.seances_en_retard > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                  <AlertTriangle className={`h-4 w-4 ${metrics.seances_en_retard > 0 ? 'text-red-500' : 'text-gray-400'}`} />
                </div>
                <div>
                  <p className="text-xl font-bold text-[#1A1A2E]">{metrics.seances_en_retard}</p>
                  <p className="text-xs text-gray-500">En retard</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-50">
                  <Calendar className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-xl font-bold text-[#1A1A2E]">{metrics.seances_ce_mois}</p>
                  <p className="text-xs text-gray-500">Ce mois</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#E8F4F5]">
                  <Clock className="h-4 w-4 text-[#20808D]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#1A1A2E] truncate">
                    {metrics.derniere_seance_cabinet
                      ? formatDate(metrics.derniere_seance_cabinet)
                      : '—'}
                  </p>
                  <p className="text-xs text-gray-500">Dernière séance cabinet</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Onglets */}
      <Tabs defaultValue="cabinet">
        <TabsList className="mb-4">
          <TabsTrigger value="cabinet">
            Cabinet
            {cabinetUpcoming.length > 0 && (
              <span className="ml-1.5 text-xs bg-[#20808D] text-white rounded-full px-1.5">
                {cabinetUpcoming.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="autonomie">
            Autonomie
            {autonomousSessions.filter((s) => s.statut === 'en_retard').length > 0 && (
              <span className="ml-1.5 text-xs bg-red-500 text-white rounded-full px-1.5">
                {autonomousSessions.filter((s) => s.statut === 'en_retard').length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="templates">Templates récurrents</TabsTrigger>
        </TabsList>

        {/* ==================== TAB CABINET ==================== */}
        <TabsContent value="cabinet" className="space-y-6">
          <div className="flex justify-end">
            <PlanCabinetSessionModal clients={clients} exercises={exercises} />
          </div>

          {/* Séances à venir */}
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              À venir ({cabinetUpcoming.length})
            </h2>
            {cabinetUpcoming.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">Aucune séance planifiée.</p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead className="hidden md:table-cell">Objectif</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cabinetUpcoming.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="text-sm font-medium whitespace-nowrap">
                          {formatDateTime(s.date_seance)}
                        </TableCell>
                        <TableCell className="text-sm">{s.client_id.slice(0, 8)}…</TableCell>
                        <TableCell className="text-sm text-gray-600 hidden md:table-cell max-w-xs truncate">
                          {s.objectif}
                        </TableCell>
                        <TableCell>
                          <SessionStatusBadge statut={s.statut} />
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/coach/sessions/${s.id}`}
                            className="text-xs text-[#20808D] hover:underline"
                          >
                            Compte-rendu
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Séances passées */}
          {cabinetPast.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Passées ({cabinetPast.length})
              </h2>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="hidden md:table-cell">Objectif</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cabinetPast.slice(0, 20).map((s) => (
                      <TableRow key={s.id} className="opacity-80">
                        <TableCell className="text-sm whitespace-nowrap">
                          {formatDateTime(s.date_seance)}
                        </TableCell>
                        <TableCell className="text-sm text-gray-600 hidden md:table-cell max-w-xs truncate">
                          {s.objectif}
                        </TableCell>
                        <TableCell>
                          <SessionStatusBadge statut={s.statut} />
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/coach/sessions/${s.id}`}
                            className="text-xs text-[#20808D] hover:underline"
                          >
                            Voir
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ==================== TAB AUTONOMIE ==================== */}
        <TabsContent value="autonomie" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            {/* Taux global */}
            {metrics && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">Complétion globale</span>
                <div className="flex items-center gap-2">
                  <Progress value={metrics.taux_completion} className="w-24 h-2" />
                  <span className="text-sm font-medium">{metrics.taux_completion}%</span>
                </div>
              </div>
            )}
            <AssignAutonomousSessionModal clients={clients} exercises={exercises} />
          </div>

          {/* Filtres */}
          <div className="flex gap-3 flex-wrap">
            <Select value={filterClient} onValueChange={setFilterClient}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Tous les clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les clients</SelectItem>
                {uniqueClients.map((s) => (
                  <SelectItem key={s.client_id} value={s.client_id}>
                    {s.client_nom} {s.client_prenom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatut} onValueChange={setFilterStatut}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Tous les statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {(['a_faire', 'en_cours', 'terminee', 'en_retard', 'manquee'] as AutonomousSessionStatut[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    <SessionStatusBadge statut={s} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table séances autonomie */}
          {filteredAutonomous.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">Aucune séance trouvée.</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Titre</TableHead>
                    <TableHead className="hidden md:table-cell">Date cible</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="hidden lg:table-cell">Feedback</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAutonomous.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-sm font-medium whitespace-nowrap">
                        {s.client_nom} {s.client_prenom}
                      </TableCell>
                      <TableCell className="text-sm max-w-xs truncate">{s.titre}</TableCell>
                      <TableCell className="text-sm text-gray-500 hidden md:table-cell">
                        {s.date_cible ? formatDate(s.date_cible) : '—'}
                      </TableCell>
                      <TableCell>
                        <SessionStatusBadge statut={s.statut} />
                      </TableCell>
                      <TableCell className="text-xs text-gray-500 max-w-[180px] truncate hidden lg:table-cell">
                        {s.feedback_client ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ==================== TAB TEMPLATES ==================== */}
        <TabsContent value="templates" className="space-y-4">
          <div className="flex justify-end">
            <CreateRecurringTemplateModal clients={clients} exercises={exercises} />
          </div>

          {templates.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">Aucun template récurrent créé.</p>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead className="hidden md:table-cell">Déclenchement</TableHead>
                    <TableHead className="hidden md:table-cell">Durée est.</TableHead>
                    <TableHead>Exécutions</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-sm font-medium whitespace-nowrap">
                        {t.client_nom} {t.client_prenom}
                      </TableCell>
                      <TableCell className="text-sm">
                        <p className="font-medium truncate max-w-[160px]">{t.titre}</p>
                        {t.description && (
                          <p className="text-xs text-gray-400 truncate max-w-[160px]">{t.description}</p>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {t.trigger_type ? (
                          <Badge variant="outline" className="text-xs">
                            {TRIGGER_LABELS[t.trigger_type]}
                          </Badge>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500 hidden md:table-cell">
                        {t.duree_estimee ? `${t.duree_estimee} min` : '—'}
                      </TableCell>
                      <TableCell className="text-sm font-medium text-center">
                        {t.execution_count}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={t.is_active ? 'border-green-300 text-green-700' : 'border-gray-300 text-gray-400'}
                        >
                          {t.is_active ? 'Actif' : 'Inactif'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
