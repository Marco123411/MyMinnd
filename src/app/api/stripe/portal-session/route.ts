import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export async function POST(): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Lecture du stripe_customer_id (masqué par RLS — nécessite admin client)
  const { data: userData, error: fetchError } = await admin
    .from('users')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single()

  if (fetchError || !userData?.stripe_customer_id) {
    return NextResponse.json(
      { error: 'Aucun abonnement Stripe trouvé. Souscrivez d\'abord à un plan.' },
      { status: 400 }
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const session = await stripe.billingPortal.sessions.create({
    customer: userData.stripe_customer_id as string,
    return_url: `${appUrl}/coach/pricing`,
  })

  return NextResponse.json({ url: session.url })
}
