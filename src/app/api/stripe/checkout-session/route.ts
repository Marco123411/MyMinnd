import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { getOrCreateStripeCustomer } from '@/lib/stripe/customer'

// Team prices exclus : pas de mapping tier dans le webhook (F12)
const ALLOWED_PRICE_IDS = new Set([
  process.env.STRIPE_PRICE_PRO_MONTHLY,
  process.env.STRIPE_PRICE_PRO_ANNUAL,
  process.env.STRIPE_PRICE_EXPERT_MONTHLY,
  process.env.STRIPE_PRICE_EXPERT_ANNUAL,
].filter(Boolean) as string[])

const schema = z.object({
  priceId: z.string().min(1),
})

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

  const { priceId } = parsed.data

  // Validation : seuls les price IDs déclarés en env sont acceptés
  if (!ALLOWED_PRICE_IDS.has(priceId)) {
    return NextResponse.json({ error: 'Price ID non autorisé' }, { status: 400 })
  }

  const stripeCustomerId = await getOrCreateStripeCustomer(user.id, user.email ?? '')

  // Fallback localhost pour le développement local (F10)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/coach/pricing?success=true`,
    cancel_url: `${appUrl}/coach/pricing?cancelled=true`,
    metadata: { user_id: user.id },
  })

  return NextResponse.json({ url: session.url })
}
