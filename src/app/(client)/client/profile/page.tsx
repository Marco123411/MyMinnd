import Link from 'next/link'
import { getClientProfileData } from '@/app/actions/client-data'
import { RadarChart } from '@/components/ui/radar-chart'
import { ScoreDisplay } from '@/components/ui/score-display'
import { ProfileCard } from '@/components/client/ProfileCard'
import { Badge } from '@/components/ui/badge'
import { contextLabels } from '@/lib/context-labels'

interface PageProps {
  searchParams: Promise<{ test?: string }>
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default async function ProfilePage({ searchParams }: PageProps) {
  const { test: testId } = await searchParams
  const data = await getClientProfileData(testId)

  const context = data.user.context ?? 'wellbeing'
  const labels = contextLabels[context as keyof typeof contextLabels] ?? contextLabels.wellbeing

  return (
    <div className="space-y-6">
      {/* Titre */}
      <div>
        <h1 className="text-2xl font-bold text-[#141325]">{labels.profileLabel}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Vos résultats MINND</p>
      </div>

      {/* Sélecteur de test — si plusieurs tests disponibles */}
      {data.allTests.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {data.allTests.map((t) => (
            <Link
              key={t.id}
              href={`/client/profile?test=${t.id}`}
              className="shrink-0"
            >
              <Badge
                variant={data.selectedTest?.id === t.id ? 'default' : 'outline'}
                className={
                  data.selectedTest?.id === t.id
                    ? 'bg-[#7069F4] cursor-default'
                    : 'cursor-pointer hover:border-[#7069F4]'
                }
              >
                {t.definition_name} — {formatDate(t.completed_at)}
              </Badge>
            </Link>
          ))}
        </div>
      )}

      {data.selectedTest === null ? (
        /* Aucun test complété — message neutre, pas de CTA autonome */
        <div className="py-12 text-center">
          <p className="text-muted-foreground">Aucun test complété pour l&apos;instant.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Votre coach vous enverra un test dès que vous serez prêt.
          </p>
        </div>
      ) : (
        <>
          {/* Score global + percentile */}
          {data.globalScore !== null && (
            <div className="flex flex-col items-center py-4">
              <ScoreDisplay
                score={data.globalScore}
                size="lg"
                label="Score global"
                description={
                  data.globalPercentile !== null
                    ? `${data.globalPercentile}e percentile`
                    : undefined
                }
              />
            </div>
          )}

          {/* Radar */}
          {data.radarData.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Profil par domaine
              </h2>
              <RadarChart data={data.radarData} height={280} />
            </div>
          )}

          {/* Profil mental */}
          <ProfileCard profile={data.profile} />
        </>
      )}
    </div>
  )
}
