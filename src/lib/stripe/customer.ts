import { createAdminClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

// Gets existing Stripe customer ID or creates a new one, stores it in DB
export async function getOrCreateStripeCustomer(userId: string, email: string): Promise<string> {
  const admin = createAdminClient()

  // Lecture du stripe_customer_id (colonne masquée par RLS, nécessite admin client)
  const { data: userData, error: fetchError } = await admin
    .from('users')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single()

  if (fetchError) {
    throw new Error(`Impossible de récupérer l'utilisateur: ${fetchError.message}`)
  }

  if (userData.stripe_customer_id) {
    return userData.stripe_customer_id as string
  }

  // Création du client Stripe
  const customer = await stripe.customers.create({
    email,
    metadata: { user_id: userId },
  })

  // Stockage du stripe_customer_id (mise à jour via admin client — colonne protégée par RLS)
  const { error: updateError } = await admin
    .from('users')
    .update({ stripe_customer_id: customer.id })
    .eq('id', userId)

  if (updateError) {
    throw new Error(`Impossible de stocker le customer ID Stripe: ${updateError.message}`)
  }

  return customer.id
}
