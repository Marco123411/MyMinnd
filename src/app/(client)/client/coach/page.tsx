import { Mail, UserCheck } from 'lucide-react'
import { getClientCoach } from '@/app/actions/client-data'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { TestLevelSlug } from '@/types'

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const statusLabels: Record<string, string> = {
  pending: 'En attente',
  in_progress: 'En cours',
  completed: 'Terminé',
  expired: 'Expiré',
}

const levelLabels: Record<TestLevelSlug, string> = {
  discovery: 'Discovery',
  complete: 'Complet',
  expert: 'Expert',
}

export default async function MyCoachPage() {
  const { coach, sentTests } = await getClientCoach()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1A1A2E]">Mon coach</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Votre accompagnateur MINND</p>
      </div>

      {coach ? (
        <>
          {/* Carte coach */}
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#E8F4F5] text-xl font-bold text-[#20808D]">
                  {coach.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={coach.photo_url}
                      alt={`${coach.nom} ${coach.prenom ?? ''}`}
                      className="h-16 w-16 rounded-full object-cover"
                    />
                  ) : (
                    `${coach.nom.charAt(0)}${coach.prenom?.charAt(0) ?? ''}`
                  )}
                </div>

                {/* Infos */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#1A1A2E]">
                    {coach.prenom ? `${coach.prenom} ${coach.nom}` : coach.nom}
                  </p>
                  <p className="text-sm text-muted-foreground">Coach certifié MINND</p>
                </div>

                {/* Bouton contacter */}
                <a
                  href={`mailto:${coach.nom}@minnd.com`}
                  className="shrink-0"
                >
                  <Button size="sm" variant="outline" className="gap-2">
                    <Mail className="h-4 w-4" />
                    Contacter
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Tests envoyés */}
          {sentTests.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Tests envoyés par mon coach
              </h2>
              <div className="space-y-2">
                {sentTests.map((t) => (
                  <Card key={t.id}>
                    <CardContent className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{t.definition_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {levelLabels[t.level_slug]} · {formatDate(t.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {t.score_global !== null && (
                          <span className="text-sm font-medium text-[#20808D]">
                            {t.score_global.toFixed(1)}/10
                          </span>
                        )}
                        <Badge
                          variant={t.status === 'completed' ? 'default' : 'outline'}
                          className={t.status === 'completed' ? 'bg-[#20808D]' : ''}
                        >
                          {statusLabels[t.status] ?? t.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        /* Pas de coach assigné */
        <Card className="border-dashed">
          <CardContent className="py-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <UserCheck className="h-7 w-7 text-muted-foreground" />
            </div>
            <h2 className="font-semibold text-foreground">Pas encore de coach assigné</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Un expert certifié MINND peut vous accompagner dans votre développement.
            </p>
            <Button
              variant="outline"
              className="mt-4 border-[#20808D] text-[#20808D]"
              disabled
            >
              Trouver un expert MINND
              <span className="ml-2 text-xs text-muted-foreground">(Bientôt disponible)</span>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
