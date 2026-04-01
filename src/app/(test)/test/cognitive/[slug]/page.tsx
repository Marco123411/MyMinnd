import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCognitiveTestDefinitionBySlugAction } from '@/app/actions/cognitive'
import { CognitiveLandingClient } from './CognitiveLandingClient'
import { Badge } from '@/components/ui/badge'

interface PageProps {
  params: Promise<{ slug: string }>
}

export default async function CognitiveLandingPage({ params }: PageProps) {
  const { slug } = await params

  // Vérifier que l'utilisateur est connecté
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: definition, error } = await getCognitiveTestDefinitionBySlugAction(slug)
  if (error || !definition) notFound()

  const durationLabel =
    definition.duration_minutes >= 60
      ? `${Math.floor(definition.duration_minutes / 60)}h${definition.duration_minutes % 60 > 0 ? definition.duration_minutes % 60 + 'min' : ''}`
      : `${definition.duration_minutes} min`

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-8">

        {/* En-tête */}
        <div className="text-center space-y-3">
          <Badge className="bg-[#20808D]/20 text-[#20808D] border-[#20808D]/30">
            Test cognitif
          </Badge>
          <h1 className="text-3xl font-bold text-white font-display">
            {definition.name}
          </h1>
          <p className="text-gray-400">{definition.description}</p>
        </div>

        {/* Informations */}
        <div className="bg-gray-900 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Durée estimée</span>
            <span className="text-white font-medium">{durationLabel}</span>
          </div>
          <div className="border-t border-gray-800" />

          {/* Instructions */}
          {definition.instructions_fr && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-300">Instructions</p>
              <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-line">
                {definition.instructions_fr}
              </p>
            </div>
          )}
        </div>

        {/* Avertissements */}
        <div className="bg-yellow-950/30 border border-yellow-800/30 rounded-xl p-4 text-sm text-yellow-300/80 space-y-1">
          <p className="font-medium">Avant de commencer</p>
          <ul className="list-disc list-inside space-y-1 text-yellow-400/60">
            <li>Ferme les autres onglets et applications</li>
            <li>Trouve un endroit calme</li>
            <li>Utilise un ordinateur ou une tablette si possible</li>
          </ul>
        </div>

        {/* Bouton de démarrage (client component) */}
        <CognitiveLandingClient slug={slug} />
      </div>
    </div>
  )
}
