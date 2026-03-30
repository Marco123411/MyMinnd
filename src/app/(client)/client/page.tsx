import Link from 'next/link'
import { CalendarDays, ClipboardList } from 'lucide-react'
import { getClientHomeData } from '@/app/actions/client-data'
import { RadarChart } from '@/components/ui/radar-chart'
import { ScoreDisplay } from '@/components/ui/score-display'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { contextLabels } from '@/lib/context-labels'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default async function ClientHomePage() {
  const data = await getClientHomeData()

  const context = data.user.context ?? 'wellbeing'
  const labels = contextLabels[context as keyof typeof contextLabels] ?? contextLabels.wellbeing
  const prenom = data.user.prenom ?? data.user.nom

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-[#1A1A2E]">Bonjour, {prenom}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{labels.title}</p>
      </div>

      {data.latestTest ? (
        <>
          {/* Score global */}
          <div className="flex flex-col items-center py-6">
            <ScoreDisplay
              score={data.globalScore ?? 0}
              size="lg"
              label="Score global"
              description={
                data.globalPercentile !== null
                  ? `${data.globalPercentile}e percentile`
                  : undefined
              }
            />

            {/* Profil mental */}
            {data.profile && (
              <div className="mt-4 flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: data.profile.color }}
                />
                <span className="text-sm font-medium text-foreground">{data.profile.name}</span>
              </div>
            )}
          </div>

          {/* Radar */}
          {data.radarData.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Profil par domaine
              </h2>
              <RadarChart data={data.radarData} height={280} />
            </div>
          )}

          {/* Dernier test + CTA */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarDays className="h-4 w-4 shrink-0" />
                  <span>
                    Dernier test le{' '}
                    <span className="text-foreground font-medium">
                      {formatDate(data.latestTest.completed_at)}
                    </span>
                  </span>
                </div>
                <Badge variant="outline" className="shrink-0 text-xs">
                  {data.latestTest.definition_name}
                </Badge>
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Link href={`/client/results/${data.latestTest.id}`} className="flex-1">
                  <Button variant="outline" className="w-full" size="sm">
                    Voir mes résultats
                  </Button>
                </Link>
                <Link href={`/test/${data.latestTest.definition_slug}`} className="flex-1">
                  <Button className="w-full bg-[#20808D] hover:bg-[#186870]" size="sm">
                    Repasser le test
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        /* Pas encore de test */
        <Card className="border-2 border-[#20808D] bg-[#E8F4F5]">
          <CardContent className="pt-6 pb-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#20808D]/10">
              <ClipboardList className="h-7 w-7 text-[#20808D]" />
            </div>
            <h2 className="text-lg font-bold text-[#1A1A2E]">Prêt à vous découvrir ?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {labels.ctaTest} et obtenez votre profil de performance mental.
            </p>
            <Link href="/test/pma" className="mt-4 inline-block">
              <Button className="bg-[#20808D] hover:bg-[#186870]">
                Passer votre premier test
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Séances — placeholder */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Mes séances
        </h2>
        <Card className="opacity-60">
          <CardContent className="pt-4 pb-4 flex items-center gap-3 text-sm text-muted-foreground">
            <ClipboardList className="h-4 w-4 shrink-0" />
            <span>Bientôt disponible</span>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
