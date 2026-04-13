import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, AlertTriangle, Brain } from 'lucide-react'
import type { CognitiveTestPreset } from '@/types'

interface PresetWithTestSlug extends CognitiveTestPreset {
  test_slug: string
  test_name: string
}

export default async function AdminCognitivePresetsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') redirect('/admin')

  const admin = createAdminClient()

  const { data: presets } = await admin
    .from('cognitive_test_presets')
    .select('*, cognitive_test_definitions(slug, name)')
    .order('is_validated', { ascending: false })
    .order('created_at')

  const enriched: PresetWithTestSlug[] = (presets ?? []).map((p) => {
    const def = Array.isArray(p.cognitive_test_definitions)
      ? p.cognitive_test_definitions[0]
      : p.cognitive_test_definitions
    const d = def as { slug: string; name: string } | null
    return {
      ...(p as CognitiveTestPreset),
      test_slug: d?.slug ?? '',
      test_name: d?.name ?? '',
    }
  })

  // Grouper par test
  const grouped: Record<string, PresetWithTestSlug[]> = {}
  for (const p of enriched) {
    if (!grouped[p.test_slug]) grouped[p.test_slug] = []
    grouped[p.test_slug].push(p)
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-2">
        <Brain className="h-5 w-5 text-[#7069F4]" />
        <h1 className="text-xl font-bold text-[#141325]">Presets de tests cognitifs</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Presets globaux disponibles pour tous les coachs. Les presets validés scientifiquement
        affichent une référence bibliographique dans l&apos;UI.
      </p>

      {Object.entries(grouped).map(([slug, testPresets]) => {
        const testName = testPresets[0]?.test_name ?? slug
        return (
          <Card key={slug}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">{testName}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {testPresets.map((preset) => (
                  <div
                    key={preset.id}
                    className="flex items-start justify-between rounded-lg border p-3"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        {preset.is_validated ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                        )}
                        <span className="font-medium text-sm">{preset.name}</span>
                        {preset.coach_id ? (
                          <Badge variant="outline" className="text-xs">Personnel</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-[#F1F0FE] text-[#7069F4]">Global</Badge>
                        )}
                        {!preset.is_active && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">Inactif</Badge>
                        )}
                      </div>
                      {preset.description && (
                        <p className="text-xs text-muted-foreground">{preset.description}</p>
                      )}
                      {preset.validation_reference && (
                        <p className="text-xs text-muted-foreground italic">
                          Réf. : {preset.validation_reference}
                        </p>
                      )}
                      <p className="text-xs font-mono text-muted-foreground">
                        slug: {preset.slug}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )
      })}

      {Object.keys(grouped).length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Aucun preset défini. Lancez la migration SQL pour créer les presets par défaut.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
