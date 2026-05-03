'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle, ExternalLink, FileText, Loader2, RotateCcw, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { resendInvitationAction } from '@/app/actions/tests-invite'
import type { CoachAlerts, CoachPendingTest, CoachReportRow } from '@/types'

// ============================================================
// Types et constantes
// ============================================================

type Periode = '30j' | '90j' | '1an' | 'tout'

// Formate une date ISO en "31 mars 2026"
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// Couleur du score selon le percentile
function scoreColorClass(percentile: number | null): string {
  if (percentile === null) return 'text-muted-foreground'
  if (percentile >= 75) return 'text-green-600 font-semibold'
  if (percentile >= 50) return 'text-amber-600 font-semibold'
  return 'text-red-600 font-semibold'
}

// ============================================================
// Composant principal
// ============================================================

interface Props {
  reports: CoachReportRow[]
  alerts: CoachAlerts
  pendingTests: CoachPendingTest[]
}

export default function RapportsPageClient({ reports, alerts, pendingTests }: Props) {
  const router = useRouter()

  // État des filtres du tableau
  const [periode, setPeriode] = useState<Periode>('tout')
  const [profil, setProfil] = useState<string>('all')
  const [recherche, setRecherche] = useState('')

  // État de la génération PDF (testId en cours ou null)
  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null)
  const [pdfError, setPdfError] = useState<string | null>(null)

  // État du renvoi d'invitation (testId en cours ou null)
  const [resendingId, setResendingId] = useState<string | null>(null)
  const [resendSuccess, setResendSuccess] = useState<string | null>(null)
  const [resendError, setResendError] = useState<string | null>(null)

  // Profils distincts disponibles dans les données (pour le filtre)
  const distinctProfiles = useMemo(() => {
    const seen = new Set<string>()
    reports.forEach((r) => {
      if (r.profileName) seen.add(r.profileName)
    })
    return Array.from(seen).sort()
  }, [reports])

  // Filtrage réactif du tableau des rapports
  const filteredReports = useMemo(() => {
    const now = Date.now()
    const periodeMs: Record<Periode, number | null> = {
      '30j': 30 * 24 * 60 * 60 * 1000,
      '90j': 90 * 24 * 60 * 60 * 1000,
      '1an': 365 * 24 * 60 * 60 * 1000, // 12 derniers mois glissants
      tout: null,
    }

    return reports.filter((r) => {
      const cutoff = periodeMs[periode]
      if (cutoff && now - new Date(r.completedAt).getTime() > cutoff) return false
      if (profil !== 'all' && r.profileName !== profil) return false
      if (recherche.trim()) {
        const term = recherche.trim().toLowerCase()
        const fullName = `${r.clientNom} ${r.clientPrenom}`.toLowerCase()
        if (!fullName.includes(term)) return false
      }
      return true
    })
  }, [reports, periode, profil, recherche])

  // Génération du rapport PDF via l'API
  async function handleGeneratePdf(testId: string) {
    setGeneratingPdfId(testId)
    setPdfError(null)
    try {
      const res = await fetch(`/api/reports/generate/${testId}`, { method: 'POST' })
      if (!res.ok) {
        const body = (await res.json()) as { error?: string }
        const message = body.error ?? 'Erreur inconnue'
        console.error('Erreur génération PDF:', message)
        setPdfError(message)
      } else {
        router.refresh()
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur réseau'
      console.error('Erreur génération PDF:', message)
      setPdfError(message)
    } finally {
      setGeneratingPdfId(null)
    }
  }

  // Renvoi de l'invitation par email
  async function handleResend(testId: string) {
    setResendingId(testId)
    setResendSuccess(null)
    setResendError(null)
    try {
      const { error } = await resendInvitationAction(testId)
      if (error) {
        console.error('Erreur renvoi invitation:', error)
        setResendError(error)
      } else {
        setResendSuccess(testId)
        setTimeout(() => setResendSuccess(null), 3000)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur réseau'
      console.error('Erreur renvoi invitation:', message)
      setResendError(message)
    } finally {
      setResendingId(null)
    }
  }

  // Copie du lien d'invitation dans le presse-papier
  async function handleCopyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url)
    } catch (err) {
      console.error('Clipboard non disponible:', err)
    }
  }

  return (
    <div className="space-y-6">
      {/* Bandeau d'erreur PDF visible au niveau de la page */}
      {pdfError && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          Erreur lors de la génération du PDF : {pdfError}
        </div>
      )}
      {resendError && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          Erreur lors du renvoi de l&apos;invitation : {resendError}
        </div>
      )}

      {/* ====================================================
          Section 1 — Alertes prioritaires (3 cards)
      ==================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <AlertCard
          title="Clients inactifs"
          description="Pas de test complété depuis 90+ jours"
          count={alerts.inactifs}
          color="destructive"
          icon={<Users className="h-5 w-5" />}
        />
        <AlertCard
          title="Tests en attente"
          description="Invitation envoyée depuis 7+ jours"
          count={alerts.pendingOld}
          color="warning"
          icon={<RotateCcw className="h-5 w-5" />}
        />
        <AlertCard
          title="PDFs à générer"
          description="Rapports Complete/Expert sans PDF"
          count={alerts.pdfMissing}
          color="info"
          icon={<FileText className="h-5 w-5" />}
        />
      </div>

      {/* ====================================================
          Section 2 — Tableau des rapports complétés
      ==================================================== */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Rapports complétés</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filtres */}
          <div className="flex flex-wrap gap-3 mb-4">
            <Input
              placeholder="Rechercher un client…"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              className="max-w-xs"
            />
            <Select value={periode} onValueChange={(v) => setPeriode(v as Periode)}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Période" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30j">30 derniers jours</SelectItem>
                <SelectItem value="90j">90 derniers jours</SelectItem>
                <SelectItem value="1an">12 derniers mois</SelectItem>
                <SelectItem value="tout">Toute la période</SelectItem>
              </SelectContent>
            </Select>
            {distinctProfiles.length > 0 && (
              <Select value={profil} onValueChange={setProfil}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Profil" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les profils</SelectItem>
                  {distinctProfiles.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Tableau */}
          {filteredReports.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Aucun rapport ne correspond aux filtres sélectionnés.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Test</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Profil MINND</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>PDF</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReports.map((r) => (
                    <TableRow key={r.testId}>
                      {/* Client */}
                      <TableCell>
                        {r.clientId ? (
                          <Link
                            href={`/coach/clients/${r.clientId}`}
                            className="font-medium hover:underline text-[#7069F4]"
                          >
                            {r.clientNom} {r.clientPrenom}
                          </Link>
                        ) : (
                          <span className="font-medium">
                            {r.clientNom} {r.clientPrenom}
                          </span>
                        )}
                      </TableCell>

                      {/* Test */}
                      <TableCell className="text-sm text-muted-foreground">
                        {r.definitionName}
                      </TableCell>

                      {/* Score */}
                      <TableCell>
                        {r.scoreGlobal !== null ? (
                          <span className={scoreColorClass(r.scorePercentile)}>
                            {r.scoreGlobal.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      {/* Profil MINND */}
                      <TableCell>
                        {r.profileName ? (
                          <Badge
                            variant="secondary"
                            style={{
                              backgroundColor: r.profileColor ? `${r.profileColor}20` : undefined,
                              color: r.profileColor ?? undefined,
                              borderColor: r.profileColor ?? undefined,
                            }}
                            className="border"
                          >
                            {r.profileName}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>

                      {/* Date */}
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(r.completedAt)}
                      </TableCell>

                      {/* PDF */}
                      <TableCell>
                        {r.reportUrl ? (
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                          >
                            <a href={r.reportUrl} target="_blank" rel="noopener noreferrer">
                              Voir PDF
                            </a>
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={generatingPdfId === r.testId}
                            onClick={() => handleGeneratePdf(r.testId)}
                          >
                            {generatingPdfId === r.testId ? (
                              <>
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                Génération…
                              </>
                            ) : (
                              'Générer PDF'
                            )}
                          </Button>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell>
                        {r.clientId && (
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/coach/clients/${r.clientId}`}>
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ====================================================
          Section 3 — Tests en cours (affiché seulement si non vide)
      ==================================================== */}
      {pendingTests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tests en cours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Test</TableHead>
                    <TableHead>Envoyé le</TableHead>
                    <TableHead>Attente</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingTests.map((t) => (
                    <TableRow key={t.testId}>
                      {/* Client */}
                      <TableCell>
                        {t.clientId ? (
                          <Link
                            href={`/coach/clients/${t.clientId}`}
                            className="font-medium hover:underline text-[#7069F4]"
                          >
                            {t.clientNom} {t.clientPrenom}
                          </Link>
                        ) : (
                          <span className="font-medium">
                            {t.clientNom} {t.clientPrenom}
                          </span>
                        )}
                      </TableCell>

                      {/* Test */}
                      <TableCell>
                        <span className="text-sm">{t.definitionName}</span>
                      </TableCell>

                      {/* Date d'envoi */}
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(t.createdAt)}
                      </TableCell>

                      {/* Jours d'attente */}
                      <TableCell>
                        <span
                          className={
                            t.daysWaiting > 7
                              ? 'text-red-600 font-semibold text-sm'
                              : 'text-muted-foreground text-sm'
                          }
                        >
                          {t.daysWaiting}j
                        </span>
                      </TableCell>

                      {/* Actions */}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={resendingId === t.testId}
                            onClick={() => handleResend(t.testId)}
                          >
                            {resendingId === t.testId ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : resendSuccess === t.testId ? (
                              <>
                                <CheckCircle className="h-3 w-3 mr-1 text-green-600" />
                                Envoyé
                              </>
                            ) : (
                              'Relancer'
                            )}
                          </Button>
                          {t.inviteUrl && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCopyLink(t.inviteUrl!)}
                            >
                              Copier lien
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ============================================================
// Composant AlertCard — card d'alerte avec count et icône
// ============================================================

interface AlertCardProps {
  title: string
  description: string
  count: number
  color: 'destructive' | 'warning' | 'info'
  icon: React.ReactNode
}

const ALERT_STYLES: Record<AlertCardProps['color'], { border: string; bg: string; text: string }> =
  {
    destructive: {
      border: 'border-red-200',
      bg: 'bg-red-50',
      text: 'text-red-700',
    },
    warning: {
      border: 'border-amber-200',
      bg: 'bg-amber-50',
      text: 'text-amber-700',
    },
    info: {
      border: 'border-[#7069F4]/20',
      bg: 'bg-[#F1F0FE]',
      text: 'text-[#7069F4]',
    },
  }

function AlertCard({ title, description, count, color, icon }: AlertCardProps) {
  // Si count = 0, afficher en gris avec checkmark
  const isOk = count === 0
  const styles = isOk
    ? { border: 'border-gray-100', bg: 'bg-gray-50', text: 'text-gray-400' }
    : ALERT_STYLES[color]

  return (
    <Card className={`border ${styles.border} ${styles.bg}`}>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          <div>
            <p className={`text-sm font-medium ${styles.text}`}>{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
          <div className={styles.text}>
            {isOk ? <CheckCircle className="h-5 w-5 text-green-500" /> : icon}
          </div>
        </div>
        <p className={`text-3xl font-bold mt-3 ${isOk ? 'text-gray-300' : styles.text}`}>
          {count}
        </p>
      </CardContent>
    </Card>
  )
}
