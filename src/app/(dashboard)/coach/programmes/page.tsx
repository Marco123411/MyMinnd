import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getAllCoachProgrammesAction, getArchivedCoachProgrammesAction, type ProgrammeListItem } from '@/app/actions/programmes'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BookOpen, ChevronRight, CalendarDays, Archive, ArrowLeft, Trash2 } from 'lucide-react'

function ProgrammeCard({ prog }: { prog: ProgrammeListItem }) {
  const isArchived = prog.statut === 'archive'

  let daysLeft: number | null = null
  if (isArchived && prog.archived_at) {
    const deleteAt = new Date(prog.archived_at)
    deleteAt.setDate(deleteAt.getDate() + 30)
    daysLeft = Math.max(0, Math.ceil((deleteAt.getTime() - Date.now()) / 86_400_000))
  }

  return (
    <Link
      href={prog.client_crm_id ? `/coach/clients/${prog.client_crm_id}?tab=seances` : '#'}
      className="block"
    >
      <Card className={`hover:shadow-md transition-shadow cursor-pointer ${isArchived ? 'opacity-70' : ''}`}>
        <CardContent className="py-4 px-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${isArchived ? 'bg-gray-100' : 'bg-[#F1F0FE]'}`}>
                {isArchived
                  ? <Archive className="h-5 w-5 text-gray-400" />
                  : <BookOpen className="h-5 w-5 text-[#7069F4]" />
                }
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-[#141325] truncate">{prog.nom}</span>
                  {isArchived && daysLeft !== null && (
                    <Badge className={`text-xs gap-1 ${daysLeft <= 7 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                      <Trash2 className="h-2.5 w-2.5" />
                      Suppression dans {daysLeft}j
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                  <span className="font-medium text-[#7069F4]">{prog.client_nom}</span>
                  <span className="text-gray-300">·</span>
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {prog.etapes_total} étape{prog.etapes_total !== 1 ? 's' : ''}
                  </span>
                  {prog.description && (
                    <>
                      <span className="text-gray-300 hidden sm:inline">·</span>
                      <span className="text-xs truncate hidden sm:inline max-w-xs">{prog.description}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

export default async function ProgrammesPage({
  searchParams,
}: {
  searchParams: Promise<{ vue?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { vue } = await searchParams
  const showArchives = vue === 'archives'

  // Toujours fetcher les deux en parallèle (purge auto incluse dans getArchivedCoachProgrammesAction)
  const [activeResult, archiveResult] = await Promise.all([
    getAllCoachProgrammesAction(),
    getArchivedCoachProgrammesAction(),
  ])

  const programmes = showArchives ? archiveResult.data : activeResult.data
  const error = showArchives ? archiveResult.error : activeResult.error
  const archiveCount = archiveResult.data?.length ?? 0

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        {showArchives ? (
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground -ml-2">
              <Link href="/coach/programmes">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Actifs
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-[#141325]">Archives</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Suppression automatique 30 jours après archivage
              </p>
            </div>
          </div>
        ) : (
          <div>
            <h1 className="text-2xl font-bold text-[#141325]">Programmes</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Parcours structurés de vos clients
            </p>
          </div>
        )}

        {!showArchives && archiveCount > 0 && (
          <Button asChild variant="outline" size="sm" className="gap-2 text-muted-foreground">
            <Link href="/coach/programmes?vue=archives">
              <Archive className="h-4 w-4" />
              Archives
              <Badge className="bg-gray-100 text-gray-600 ml-1 text-xs px-1.5">{archiveCount}</Badge>
            </Link>
          </Button>
        )}
      </div>

      {/* Erreur */}
      {error && (
        <Card>
          <CardContent className="py-8 text-center text-red-500 text-sm">{error}</CardContent>
        </Card>
      )}

      {/* Liste vide */}
      {!error && (!programmes || programmes.length === 0) && (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
            {showArchives ? (
              <>
                <Archive className="h-10 w-10 text-muted-foreground/40" />
                <p className="font-medium text-[#141325]">Aucun programme archivé</p>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Les programmes archivés apparaissent ici et sont supprimés automatiquement après 30 jours.
                </p>
              </>
            ) : (
              <>
                <BookOpen className="h-10 w-10 text-muted-foreground/40" />
                <p className="font-medium text-[#141325]">Aucun programme créé</p>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Les programmes se créent depuis la fiche d&apos;un client →
                  onglet <strong>Séances</strong> → section <strong>Programme actif</strong>.
                </p>
                <Button asChild className="mt-2 bg-[#7069F4] hover:bg-[#5a53d4]">
                  <Link href="/coach/clients">Voir mes clients</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Liste */}
      {programmes && programmes.length > 0 && (
        <div className="space-y-3">
          {programmes.map((prog) => (
            <ProgrammeCard key={prog.id} prog={prog} />
          ))}
        </div>
      )}
    </div>
  )
}
