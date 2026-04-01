import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { getFigureEvolutionAction } from '@/app/actions/exercises'
import { createAdminClient } from '@/lib/supabase/server'
import { FigureEvolutionDashboard } from '@/components/exercises/FigureEvolutionDashboard'
import { ChevronLeft } from 'lucide-react'

interface Props {
  params: Promise<{ id: string }>
}

export default async function FigureEvolutionPage({ params }: Props) {
  const { id } = await params
  const admin = createAdminClient()

  // F12: requêtes indépendantes en parallèle
  const [evolutionResult, clientResult] = await Promise.all([
    getFigureEvolutionAction(id),
    admin.from('clients').select('nom, prenom').eq('id', id).maybeSingle(),
  ])

  // F9: erreur d'autorisation explicitement traitée (notFound pour tout autre cas)
  if (evolutionResult.error === 'Accès non autorisé' || evolutionResult.error === 'Non authentifié') {
    notFound()
  }
  if (evolutionResult.error && evolutionResult.error !== 'Accès non autorisé') {
    notFound()
  }

  // F7: PII client seulement utilisée après confirmation que l'accès est autorisé
  const client = clientResult.data
  const clientName = client ? `${client.prenom ?? ''} ${client.nom}`.trim() : 'Client'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/coach/clients/${id}`}>
            <ChevronLeft className="w-4 h-4 mr-1" />
            Retour
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A2E]">Figure de Performance</h1>
          <p className="text-muted-foreground">Évolution — {clientName}</p>
        </div>

        <div className="ml-auto">
          <Button asChild className="bg-[#20808D] hover:bg-[#20808D]/90 text-white">
            <Link href={`/coach/exercises?clientId=${id}`}>
              Lancer un exercice
            </Link>
          </Button>
        </div>
      </div>

      <FigureEvolutionDashboard results={evolutionResult.data ?? []} />
    </div>
  )
}
