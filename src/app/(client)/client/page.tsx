import Link from 'next/link'
import { CalendarDays, ClipboardList, PlayCircle, UserCheck } from 'lucide-react'
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

      {/* Tests en attente — toujours affichés si présents */}
      {data.pendingTests.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Tests assignés
          </h2>
          <div className="space-y-2">
            {data.pendingTests.map((test) => (
              <Card key={test.id} className="border-[#20808D]/40 bg-[#E8F4F5]/50">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-[#1A1A2E]">{test.definition_name}</p>
                      <Badge variant="outline" className="mt-1 text-xs capitalize">{test.level_slug}</Badge>
                    </div>
                    <Link href={test.inviteUrl}>
                      <Button size="sm" className="shrink-0 bg-[#20808D] hover:bg-[#186870]">
                        <PlayCircle className="mr-1.5 h-4 w-4" />
                        Commencer
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

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
              <div className="mt-4">
                <Link href={`/client/results/${data.latestTest.id}`}>
                  <Button variant="outline" className="w-full" size="sm">
                    Voir mes résultats
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        /* Pas encore de test — état vide neutre, pas de CTA autonome */
        <Card>
          <CardContent className="pt-6 pb-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <ClipboardList className="h-7 w-7 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-bold text-[#1A1A2E]">Bienvenue sur MINND</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Votre coach va bientôt vous envoyer vos premiers contenus.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Prochaine séance avec le coach */}
      {data.nextCabinetSession && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Prochaine séance
          </h2>
          <Link href="/client/sessions">
            <Card className="border-[#20808D]/30 hover:border-[#20808D] transition-colors cursor-pointer">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <UserCheck className="h-4 w-4 text-[#20808D] shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1A1A2E] truncate">
                      {data.nextCabinetSession.objectif}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDate(data.nextCabinetSession.date_seance)}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">
                    {data.nextCabinetSession.statut === 'planifiee' ? 'Planifiée' :
                     data.nextCabinetSession.statut === 'realisee' ? 'Réalisée' : 'Annulée'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}
    </div>
  )
}
