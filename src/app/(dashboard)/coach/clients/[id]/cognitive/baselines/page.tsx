import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ChevronLeft } from 'lucide-react'
import { BaselinesClient } from './BaselinesClient'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function CognitiveBaselinesPage({ params }: PageProps) {
  const { id: clientId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Vérifie que le client appartient au coach
  const { data: client } = await supabase
    .from('clients')
    .select('id, first_name, last_name, user_id')
    .eq('id', clientId)
    .eq('coach_id', user.id)
    .single()

  if (!client) notFound()

  // Récupère les programmes de ce client gérés par le coach
  const { data: programmes } = await supabase
    .from('programmes')
    .select('id, name')
    .eq('client_id', client.user_id)
    .eq('coach_id', user.id)
    .order('created_at', { ascending: false })

  if (!programmes || programmes.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <nav className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href={`/coach/clients/${clientId}`} className="flex items-center gap-1 hover:text-foreground transition-colors">
            <ChevronLeft size={14} />
            {client.first_name} {client.last_name}
          </Link>
          <span>/</span>
          <span className="text-foreground">Baselines cognitives</span>
        </nav>
        <div className="text-center py-12 text-muted-foreground text-sm">
          Aucun programme trouvé pour ce client. Créez un programme pour gérer les baselines Pre/Post.
        </div>
      </div>
    )
  }

  // Utilise le premier programme (le plus récent) — le coach peut choisir si plusieurs
  const programme = programmes[0]

  // Charge la liste des baselines existantes
  const { data: baselinesRaw } = await supabase
    .from('cognitive_baselines')
    .select('id, name, pre_date, post_date, created_at, results')
    .eq('programme_id', programme.id)
    .order('created_at', { ascending: false })

  type BaselineRow = {
    id: string
    name: string
    pre_date: string
    post_date: string
    created_at: string
    results: {
      summary?: {
        tests_compared: number
        metrics_improved: number
        metrics_regressed: number
        metrics_stable: number
        overall_trend: 'improving' | 'stable' | 'declining'
      }
    } | null
  }

  const baselines = (baselinesRaw ?? []).map((b) => ({
    id:         b.id as string,
    name:       b.name as string,
    pre_date:   b.pre_date as string,
    post_date:  b.post_date as string,
    created_at: b.created_at as string,
    summary:    (b as BaselineRow).results?.summary ?? null,
  }))

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Fil d'Ariane */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/coach/clients/${clientId}`} className="flex items-center gap-1 hover:text-foreground transition-colors">
          <ChevronLeft size={14} />
          {client.first_name} {client.last_name}
        </Link>
        <span>/</span>
        <span className="text-foreground">Baselines cognitives</span>
      </nav>

      {/* En-tête */}
      <div>
        <h1 className="text-xl font-semibold">Baselines Pre/Post</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Programme : <span className="font-medium text-foreground">{programme.name}</span>
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Comparez les sessions cognitives en début et fin de cycle pour mesurer la progression.
        </p>
      </div>

      <BaselinesClient programId={programme.id} initialBaselines={baselines} />
    </div>
  )
}
