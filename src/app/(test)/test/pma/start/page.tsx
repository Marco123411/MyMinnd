import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { TestDefinition } from '@/types'
import { PmaStartButton } from './PmaStartButton'

export const metadata = {
  title: 'Passez le PMA — MINND',
  description:
    '155 questions, 15-20 minutes. Découvrez votre profil mental parmi 8 types MINND.',
}

export default async function PmaStartPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/register/athlete')
  }

  // Récupère la définition PMA (slug stable)
  const { data: testDef, error: defError } = await supabase
    .from('test_definitions')
    .select('id, slug, name, description, normative_n')
    .eq('slug', 'pma')
    .eq('is_active', true)
    .single()

  if (defError || !testDef) redirect('/client')

  const definition = testDef as TestDefinition

  // Récupère les 8 profils-types du PMA pour preview
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, family, color')
    .eq('test_definition_id', definition.id)
    .order('name', { ascending: true })

  // Nombre total de tests passés (in_progress + completed) — display social proof
  const { count: totalTestsCount } = await supabase
    .from('tests')
    .select('id', { count: 'exact', head: true })
    .eq('test_definition_id', definition.id)
    .in('status', ['in_progress', 'completed'])

  const testsCount = totalTestsCount ?? definition.normative_n ?? 0

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#E8F4F5] to-white">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        {/* Hero */}
        <div className="text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-[#1A1A2E]">
            Découvrez votre profil mental
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            155 questions, 15-20 minutes. Résultats immédiats.
          </p>
        </div>

        {/* Description */}
        <div className="mt-8 rounded-2xl bg-white p-6 sm:p-8 shadow-sm">
          <p className="text-[#1A1A2E] leading-relaxed">
            Le <strong>PMA (Profil Mental Athlète)</strong> est un test de personnalité
            scientifiquement validé qui identifie votre profil mental parmi 8 types distincts.
            Il évalue 31 compétences mentales réparties en 6 domaines : confiance, gestion du
            stress, concentration, motivation, imagerie et énergie.
          </p>
          <p className="mt-3 text-[#1A1A2E] leading-relaxed">
            À la fin du test, vous recevrez instantanément votre profil mental, votre score
            global et vos forces principales.
          </p>
        </div>

        {/* Preview des 8 profils */}
        {profiles && profiles.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold text-[#1A1A2E] text-center mb-4">
              Quel profil êtes-vous&nbsp;?
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {profiles.map((profile) => (
                <div
                  key={profile.id}
                  className="rounded-xl border border-gray-200 bg-white p-4 text-center transition-all hover:shadow-md"
                  style={{ borderLeftColor: profile.color, borderLeftWidth: '4px' }}
                >
                  <p className="text-sm font-semibold text-[#1A1A2E]">{profile.name}</p>
                  {profile.family && (
                    <p className="mt-1 text-xs text-muted-foreground">{profile.family}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Social proof */}
        {testsCount > 0 && (
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Rejoignez les <strong>{testsCount.toLocaleString('fr-FR')} personnes</strong> qui
            ont déjà passé ce test.
          </p>
        )}

        {/* CTA */}
        <div className="mt-8 flex justify-center">
          <PmaStartButton testDefinitionId={definition.id} />
        </div>

        {/* Note bas de page */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Vos données sont confidentielles. Vous pouvez interrompre et reprendre le test à tout moment.
        </p>
      </div>
    </div>
  )
}
