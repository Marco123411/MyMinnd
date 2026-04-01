import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { getOrCreateStripeCustomer } from '@/lib/stripe/customer'

const schema = z.object({
  testDefinitionId: z.string().uuid(),
  levelSlug: z.enum(['complete', 'expert']),
  testId: z.string().uuid().optional(),
})

const LEVEL_CONFIG = {
  complete: { priceCents: 1900, label: 'Complete' },
  expert: { priceCents: 7900, label: 'Expert' },
} as const

export async function POST(req: Request): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const body: unknown = await req.json()
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 })
  }

  const { testDefinitionId, levelSlug, testId } = parsed.data

  // Vérification que le testId appartient à l'utilisateur connecté (F11)
  if (testId) {
    const { data: testOwnership } = await supabase
      .from('tests')
      .select('id')
      .eq('id', testId)
      .eq('user_id', user.id)
      .single()
    if (!testOwnership) {
      return NextResponse.json({ error: 'Test introuvable ou non autorisé' }, { status: 403 })
    }
  }

  // Récupération du test_definition pour le nom affiché sur Stripe
  const { data: definition, error: defError } = await supabase
    .from('test_definitions')
    .select('name, slug')
    .eq('id', testDefinitionId)
    .single()

  if (defError || !definition) {
    return NextResponse.json({ error: 'Test introuvable' }, { status: 404 })
  }

  const { priceCents, label } = LEVEL_CONFIG[levelSlug]
  const stripeCustomerId = await getOrCreateStripeCustomer(user.id, user.email ?? '')

  const testSlug = definition.slug as string
  // Fallback localhost pour le développement local (F10)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const successUrl = testId
    ? `${appUrl}/test/${testSlug}/pass/${testId}?payment=success`
    : `${appUrl}/test/${testSlug}?payment=success`

  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'eur',
          unit_amount: priceCents,
          product_data: { name: `${definition.name} — ${label}` },
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: `${appUrl}/test/${testSlug}?payment=cancelled`,
    metadata: {
      user_id: user.id,
      test_definition_id: testDefinitionId,
      level_slug: levelSlug,
      test_id: testId ?? '',
    },
  })

  return NextResponse.json({ url: session.url })
}
