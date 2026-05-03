import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/server'
import type { SubscriptionTier, SubscriptionStatus } from '@/types'

const WEBHOOK_SECRET: string = process.env.STRIPE_WEBHOOK_SECRET ?? ''

// Maps a Stripe price ID to a MINND subscription tier — throws on unknown ID (F4)
function getTierFromPriceId(priceId: string): SubscriptionTier {
  const { STRIPE_PRICE_PRO_MONTHLY, STRIPE_PRICE_PRO_ANNUAL, STRIPE_PRICE_EXPERT_MONTHLY, STRIPE_PRICE_EXPERT_ANNUAL } = process.env
  if (priceId === STRIPE_PRICE_PRO_MONTHLY || priceId === STRIPE_PRICE_PRO_ANNUAL) return 'pro'
  if (priceId === STRIPE_PRICE_EXPERT_MONTHLY || priceId === STRIPE_PRICE_EXPERT_ANNUAL) return 'expert'
  // Fail-closed : price ID inconnu → erreur explicite, Stripe retentera
  throw new Error(`Price ID Stripe inconnu: ${priceId}`)
}

// Maps Stripe subscription status to MINND status
function getStatusFromStripe(stripeStatus: string): SubscriptionStatus {
  if (stripeStatus === 'active' || stripeStatus === 'trialing') return 'active'
  if (stripeStatus === 'past_due') return 'past_due'
  if (stripeStatus === 'canceled' || stripeStatus === 'unpaid') return 'cancelled'
  return 'inactive'
}

// Extracts customer ID string safely from Stripe union type (F8)
function extractCustomerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!customer) return null
  return typeof customer === 'string' ? customer : customer.id
}

// Retrieves the MINND user ID from a Stripe customer ID
async function getUserIdFromCustomer(customerId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('users')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()
  return data?.id ?? null
}

async function handleSubscriptionCheckout(session: Stripe.Checkout.Session, userId: string): Promise<void> {
  const admin = createAdminClient()

  // Idempotency : vérifier si ce paiement existe déjà (F3)
  const { data: existing } = await admin
    .from('payments')
    .select('id')
    .contains('metadata', { session_id: session.id })
    .maybeSingle()
  if (existing) return

  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 })
  const priceId = lineItems.data[0]?.price?.id ?? ''
  const tier = getTierFromPriceId(priceId)

  const { error: updateError } = await admin
    .from('users')
    .update({ subscription_tier: tier, subscription_status: 'active' })
    .eq('id', userId)
  if (updateError) throw new Error(`Mise à jour subscription échouée: ${updateError.message}`)

  const { error: insertError } = await admin.from('payments').insert({
    user_id: userId,
    type: 'subscription',
    amount_cents: session.amount_total ?? 0,
    currency: (session.currency ?? 'eur').toUpperCase(),
    stripe_payment_id: typeof session.payment_intent === 'string'
      ? session.payment_intent
      : (session.payment_intent?.id ?? null),
    status: 'succeeded',
    metadata: { session_id: session.id, price_id: priceId },
  })
  if (insertError) throw new Error(`Enregistrement paiement échoué: ${insertError.message}`)
}

async function handleOneTimePaymentCheckout(session: Stripe.Checkout.Session, userId: string): Promise<void> {
  const admin = createAdminClient()
  const levelSlug = session.metadata?.level_slug ?? ''
  const testId = session.metadata?.test_id || null
  const paymentType = levelSlug === 'expert' ? 'test_l3' : 'test_l2'

  // Idempotency : vérifier si ce paiement existe déjà (F3)
  const { data: existing } = await admin
    .from('payments')
    .select('id')
    .contains('metadata', { session_id: session.id })
    .maybeSingle()
  if (existing) {
    // Mise à jour du test même si paiement déjà existant (reprise après crash)
    if (testId && existing.id) {
      await admin.from('tests').update({ payment_id: existing.id, status: 'pending' }).eq('id', testId)
    }
    return
  }

  const { data: payment, error: insertError } = await admin
    .from('payments')
    .insert({
      user_id: userId,
      type: paymentType,
      amount_cents: session.amount_total ?? 0,
      currency: (session.currency ?? 'eur').toUpperCase(),
      stripe_payment_id: typeof session.payment_intent === 'string'
        ? session.payment_intent
        : (session.payment_intent?.id ?? null),
      status: 'succeeded',
      metadata: { session_id: session.id, test_definition_id: session.metadata?.test_definition_id },
    })
    .select('id')
    .single()
  if (insertError) throw new Error(`Enregistrement paiement test échoué: ${insertError.message}`)

  if (testId && payment?.id) {
    const { error: testError } = await admin
      .from('tests')
      .update({ payment_id: payment.id, status: 'pending' })
      .eq('id', testId)
    if (testError) throw new Error(`Mise à jour test échouée: ${testError.message}`)
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.user_id
  if (!userId) {
    console.error('Webhook checkout.session.completed: user_id manquant dans metadata')
    return
  }
  if (session.mode === 'subscription') {
    await handleSubscriptionCheckout(session, userId)
  } else if (session.mode === 'payment') {
    await handleOneTimePaymentCheckout(session, userId)
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const customerId = extractCustomerId(subscription.customer)
  if (!customerId) return
  const userId = await getUserIdFromCustomer(customerId)
  if (!userId) return

  const priceId = subscription.items.data[0]?.price?.id ?? ''
  const tier = getTierFromPriceId(priceId)
  const status = getStatusFromStripe(subscription.status) // (F5)

  const { error } = await createAdminClient()
    .from('users')
    .update({ subscription_tier: tier, subscription_status: status })
    .eq('id', userId)
  if (error) throw new Error(`Mise à jour subscription échouée: ${error.message}`)
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const customerId = extractCustomerId(subscription.customer)
  if (!customerId) return
  const userId = await getUserIdFromCustomer(customerId)
  if (!userId) return

  const { error } = await createAdminClient()
    .from('users')
    .update({ subscription_tier: 'free', subscription_status: 'cancelled' })
    .eq('id', userId)
  if (error) throw new Error(`Reset subscription échoué: ${error.message}`)
}

async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const customerId = extractCustomerId(invoice.customer as string | Stripe.Customer | Stripe.DeletedCustomer | null)
  if (!customerId) return
  const userId = await getUserIdFromCustomer(customerId)
  if (!userId) return

  // Idempotency : vérifier via stripe_payment_id (F14)
  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('payments')
    .select('id')
    .eq('stripe_payment_id', invoice.id)
    .maybeSingle()
  if (existing) return

  const { error } = await admin.from('payments').insert({
    user_id: userId,
    type: 'subscription',
    amount_cents: invoice.amount_paid,
    currency: invoice.currency.toUpperCase(),
    stripe_payment_id: invoice.id,
    status: 'succeeded',
    metadata: { invoice_id: invoice.id },
  })
  if (error) throw new Error(`Enregistrement invoice échoué: ${error.message}`)
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const customerId = extractCustomerId(invoice.customer as string | Stripe.Customer | Stripe.DeletedCustomer | null)
  if (!customerId) return
  const userId = await getUserIdFromCustomer(customerId)
  if (!userId) return

  const { error } = await createAdminClient()
    .from('users')
    .update({ subscription_status: 'past_due' })
    .eq('id', userId)
  if (error) throw new Error(`Mise à jour past_due échouée: ${error.message}`)

  console.warn('Paiement échoué pour user_id:', userId, '— invoice:', invoice.id)
}

export async function POST(req: Request): Promise<NextResponse> {
  // Lecture du raw body OBLIGATOIRE pour la vérification de signature Stripe
  const rawBody = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Signature manquante' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET)
  } catch (err) {
    // Log interne uniquement — pas de détails exposés au caller (F2)
    console.error('Vérification webhook échouée:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Webhook verification failed' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice)
        break
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
        break
      default:
        break
    }
  } catch (err) {
    // Retourner 500 pour que Stripe réessaie l'événement
    console.error(`Erreur lors du traitement de l'événement ${event.type}:`, err)
    return NextResponse.json({ error: 'Erreur interne' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
