import { notFound } from 'next/navigation'
import Link from 'next/link'
import { FileDown } from 'lucide-react'
import { z } from 'zod'
import { getClientTestDetail } from '@/app/actions/client-data'
import { getProfileIntelligenceData } from '@/app/actions/profile-intelligence'
import { RadarChart } from '@/components/ui/radar-chart'
import { SubcompetenceBar } from '@/components/test/SubcompetenceBar'
import { ProfileCard } from '@/components/client/ProfileCard'
import { ClientProfileView } from '@/components/profile-intelligence/ClientProfileView'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface PageProps {
  params: Promise<{ testId: string }>
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

const levelLabels: Record<string, string> = {
  discovery: 'Discovery',
  complete: 'Complet',
  expert: 'Expert',
}

export default async function ClientResultsPage({ params }: PageProps) {
  const { testId } = await params

  // Valider le format UUID avant d'interroger la base
  const uuidSchema = z.string().uuid()
  if (!uuidSchema.safeParse(testId).success) notFound()

  const [detail, intelligenceData] = await Promise.all([
    getClientTestDetail(testId),
    getProfileIntelligenceData(testId),
  ])

  if (!detail) notFound()

  const { test, nodes, scores, profile, globalPercentile, notesMap } = detail

  const getScore = (nodeId: string) =>
    scores.find((s) => s.entity_id === nodeId)?.score ?? 0

  const getPercentile = (nodeId: string) =>
    scores.find((s) => s.entity_id === nodeId)?.percentile ?? null

  const domainNodes = nodes
    .filter((n) => n.depth === 0)
    .sort((a, b) => a.order_index - b.order_index)

  const radarData = domainNodes.map((d) => ({
    subject: d.name,
    value: getScore(d.id),
    fullMark: 10 as const,
  }))

  const globalScore = test.score_global ?? scores.find((s) => s.entity_type === 'global')?.score

  const isDiscovery = test.level_slug === 'discovery'

  // Forces (top 5 feuilles) et axes d'amélioration (bottom 5)
  const leafScores = nodes
    .filter((n) => n.is_leaf)
    .map((n) => ({ name: n.name, score: getScore(n.id) }))
    .sort((a, b) => b.score - a.score)

  const top5 = leafScores.slice(0, 5)
  const bottom5 = leafScores.slice(-5).reverse()

  return (
    <div className="space-y-8">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A2E]">Résultats détaillés</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {test.definition_name} — {formatDate(test.completed_at)}
          </p>
        </div>
        <Badge variant="outline" className="shrink-0">
          {levelLabels[test.level_slug] ?? test.level_slug}
        </Badge>
      </div>

      {/* Score global */}
      {globalScore != null && (
        <div className="flex flex-col items-center py-4">
          <div className="flex h-28 w-28 items-center justify-center rounded-full bg-[#E8F4F5]">
            <span className="text-4xl font-bold text-[#20808D]">
              {globalScore.toFixed(1)}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Score global / 10</p>
          {globalPercentile !== null && (
            <p className="text-xs text-muted-foreground">{globalPercentile}e percentile</p>
          )}
        </div>
      )}

      {/* Radar */}
      {radarData.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Profil par domaine
          </h2>
          <RadarChart data={radarData} height={280} />
        </div>
      )}

      {/* Profil mental */}
      <ProfileCard
        profile={profile}
        levelSlug={test.level_slug}
      />

      {/* Détail par compétence — Complete / Expert uniquement */}
      {!isDiscovery && domainNodes.length > 0 && (
        <div className="space-y-8">
          <h2 className="text-lg font-semibold text-[#1A1A2E]">Détail par compétence</h2>
          {domainNodes.map((domain) => {
            const leaves = nodes
              .filter((n) => n.is_leaf && n.parent_id === domain.id)
              .sort((a, b) => a.order_index - b.order_index)

            return (
              <div key={domain.id}>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-[#1A1A2E]">{domain.name}</h3>
                  <span className="text-sm font-medium text-[#20808D]">
                    {getScore(domain.id).toFixed(1)}/10
                  </span>
                </div>
                {/* Note du coach sur le domaine */}
                {notesMap[domain.id] && (
                  <div className="mb-3 rounded-md bg-[#E8F4F5] px-3 py-2">
                    <p className="text-xs font-semibold text-[#20808D] mb-0.5">Note de votre coach</p>
                    <p className="text-sm text-[#1A1A2E]">{notesMap[domain.id]}</p>
                  </div>
                )}
                <div className="space-y-3 pl-2">
                  {leaves.map((leaf) => (
                    <div key={leaf.id}>
                      <SubcompetenceBar
                        name={leaf.name}
                        score={getScore(leaf.id)}
                        percentile={getPercentile(leaf.id)}
                      />
                      {/* Note du coach sur la sous-compétence */}
                      {notesMap[leaf.id] && (
                        <div className="mt-1 ml-2 rounded-md bg-[#E8F4F5] px-3 py-2">
                          <p className="text-xs font-semibold text-[#20808D] mb-0.5">Note de votre coach</p>
                          <p className="text-sm text-[#1A1A2E]">{notesMap[leaf.id]}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Forces & axes d'amélioration */}
      {leafScores.length >= 5 && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-semibold text-[#20808D] uppercase tracking-wide mb-3">
              Forces
            </h3>
            <ul className="space-y-2">
              {top5.map((l) => (
                <li key={l.name} className="flex justify-between text-sm">
                  <span className="truncate text-foreground">{l.name}</span>
                  <span className="ml-2 shrink-0 font-medium text-[#20808D]">
                    {l.score.toFixed(1)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#944454] uppercase tracking-wide mb-3">
              À développer
            </h3>
            <ul className="space-y-2">
              {bottom5.map((l) => (
                <li key={l.name} className="flex justify-between text-sm">
                  <span className="truncate text-foreground">{l.name}</span>
                  <span className="ml-2 shrink-0 font-medium text-[#944454]">
                    {l.score.toFixed(1)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Vue intelligence profil (Complete / Expert uniquement) */}
      {intelligenceData && !isDiscovery && (
        <div>
          <h2 className="text-lg font-semibold text-[#1A1A2E] mb-4">Analyse de profil détaillée</h2>
          <ClientProfileView data={intelligenceData} />
        </div>
      )}

      {/* Télécharger le rapport PDF */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <p className="text-sm font-medium text-foreground">Rapport PDF</p>
          <p className="text-xs text-muted-foreground">
            {test.report_url?.startsWith('https://') ? 'Disponible au téléchargement' : 'Non disponible pour ce niveau'}
          </p>
        </div>
        {test.report_url?.startsWith('https://') ? (
          <a href={test.report_url} target="_blank" rel="noreferrer">
            <Button size="sm" className="bg-[#20808D] hover:bg-[#186870] gap-2">
              <FileDown className="h-4 w-4" />
              Télécharger
            </Button>
          </a>
        ) : (
          <Button size="sm" variant="outline" disabled className="gap-2">
            <FileDown className="h-4 w-4" />
            Indisponible
          </Button>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-center pt-2">
        <Link href="/client">
          <Button variant="ghost" className="text-muted-foreground">
            Retour à l&apos;accueil
          </Button>
        </Link>
      </div>
    </div>
  )
}
