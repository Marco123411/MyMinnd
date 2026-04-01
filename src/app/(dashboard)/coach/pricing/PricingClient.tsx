'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Check } from 'lucide-react'
import type { SubscriptionTier, SubscriptionStatus } from '@/types'

interface PriceIds {
  proMonthly: string
  proAnnual: string
  expertMonthly: string
  expertAnnual: string
}

interface PricingClientProps {
  currentTier: SubscriptionTier
  currentStatus: SubscriptionStatus
  priceIds: PriceIds
}

interface TierConfig {
  id: SubscriptionTier
  name: string
  monthlyPrice: number
  annualMonthlyPrice: number
  annualTotal: number
  features: string[]
  recommended?: boolean
}

const TIER_CONFIGS: TierConfig[] = [
  {
    id: 'free',
    name: 'Gratuit',
    monthlyPrice: 0,
    annualMonthlyPrice: 0,
    annualTotal: 0,
    features: [
      'CRM basique',
      '2 demandes de dispatch / mois',
      'Tests discovery illimités',
    ],
  },
  {
    id: 'pro',
    name: 'Coach Pro',
    monthlyPrice: 39,
    annualMonthlyPrice: 29,
    annualTotal: 348,
    features: [
      'CRM complet',
      'Tests illimités (Complete inclus)',
      'Séances de suivi',
      "Jusqu'à 30 profils actifs",
      'Rapports PDF',
    ],
  },
  {
    id: 'expert',
    name: 'Coach Expert',
    monthlyPrice: 59,
    annualMonthlyPrice: 49,
    annualTotal: 588,
    features: [
      'Tout illimité',
      'Exercices personnalisés',
      'Badge certifié',
      'Priorité dispatch',
      'Sessions Expert (Level 3)',
    ],
    recommended: true,
  },
]

const TIER_LABELS: Record<SubscriptionTier, string> = {
  free: 'Gratuit',
  pro: 'Coach Pro',
  expert: 'Coach Expert',
}

export function PricingClient({ currentTier, currentStatus, priceIds }: PricingClientProps) {
  const searchParams = useSearchParams()
  const [isAnnual, setIsAnnual] = useState(false)
  const [loadingTier, setLoadingTier] = useState<SubscriptionTier | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const isSubscribed = currentTier !== 'free' && currentStatus === 'active'

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      setNotification({ type: 'success', message: 'Abonnement activé avec succès ! Bienvenue.' })
    } else if (searchParams.get('cancelled') === 'true') {
      setNotification({ type: 'error', message: 'Paiement annulé. Vous pouvez réessayer à tout moment.' })
    }
  }, [searchParams])

  function getPriceId(tierId: SubscriptionTier): string {
    if (tierId === 'pro') return isAnnual ? priceIds.proAnnual : priceIds.proMonthly
    if (tierId === 'expert') return isAnnual ? priceIds.expertAnnual : priceIds.expertMonthly
    return ''
  }

  async function handleSubscribe(tierId: SubscriptionTier) {
    if (tierId === 'free') return
    setLoadingTier(tierId)

    const priceId = getPriceId(tierId)
    if (!priceId) {
      setNotification({ type: 'error', message: 'Configuration Stripe manquante. Contactez le support.' })
      setLoadingTier(null)
      return
    }

    try {
      const res = await fetch('/api/stripe/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      })
      const data = await res.json() as { url?: string; error?: string }

      if (!res.ok || !data.url) {
        throw new Error(data.error ?? 'Erreur lors de la création de la session')
      }

      window.location.href = data.url
    } catch (err) {
      setNotification({ type: 'error', message: err instanceof Error ? err.message : 'Une erreur est survenue' })
      setLoadingTier(null)
    }
  }

  async function handleManageSubscription() {
    setPortalLoading(true)
    try {
      const res = await fetch('/api/stripe/portal-session', { method: 'POST' })
      const data = await res.json() as { url?: string; error?: string }

      if (!res.ok || !data.url) {
        throw new Error(data.error ?? 'Erreur portail')
      }

      window.location.href = data.url
    } catch (err) {
      setNotification({ type: 'error', message: err instanceof Error ? err.message : 'Une erreur est survenue' })
      setPortalLoading(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* En-tête */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-[#1A1A2E]">Abonnements</h1>
          <Badge className="bg-[#E8F4F5] text-[#20808D] border-0">
            {TIER_LABELS[currentTier]}
            {isSubscribed && ' · Actif'}
          </Badge>
        </div>
        <p className="text-gray-500">Choisissez le plan adapté à votre pratique de coaching.</p>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`rounded-lg px-4 py-3 text-sm font-medium ${
          notification.type === 'success'
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {notification.message}
        </div>
      )}

      {/* Toggle mensuel / annuel */}
      <div className="flex items-center gap-3">
        <span className={`text-sm font-medium ${!isAnnual ? 'text-[#1A1A2E]' : 'text-gray-400'}`}>Mensuel</span>
        <Switch checked={isAnnual} onCheckedChange={setIsAnnual} />
        <span className={`text-sm font-medium ${isAnnual ? 'text-[#1A1A2E]' : 'text-gray-400'}`}>
          Annuel
          <span className="ml-2 inline-flex items-center rounded-full bg-[#FFC553]/20 px-2 py-0.5 text-xs font-semibold text-amber-700">
            −26 %
          </span>
        </span>
      </div>

      {/* Cartes de prix */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {TIER_CONFIGS.map((tier) => {
          const isCurrent = tier.id === currentTier && (tier.id === 'free' || isSubscribed)
          const price = isAnnual ? tier.annualMonthlyPrice : tier.monthlyPrice

          return (
            <Card
              key={tier.id}
              className={`relative flex flex-col ${
                tier.recommended
                  ? 'border-2 border-[#FFC553] shadow-lg'
                  : 'border border-gray-200'
              } ${isCurrent ? 'ring-2 ring-[#20808D]' : ''}`}
            >
              {tier.recommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-[#FFC553] px-3 py-1 text-xs font-bold text-[#1A1A2E]">
                    Recommandé
                  </span>
                </div>
              )}

              <CardHeader className="pb-4">
                <CardTitle className="text-lg text-[#1A1A2E]">{tier.name}</CardTitle>
                <div className="mt-2">
                  {tier.monthlyPrice === 0 ? (
                    <span className="text-3xl font-bold text-[#1A1A2E]">Gratuit</span>
                  ) : (
                    <div>
                      <span className="text-3xl font-bold text-[#1A1A2E]">{price} €</span>
                      <span className="text-sm text-gray-500"> /mois</span>
                      {isAnnual && (
                        <p className="text-xs text-gray-400 mt-1">Soit {tier.annualTotal} €/an</p>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="flex flex-col flex-1 gap-6">
                <ul className="space-y-2 flex-1">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-gray-600">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#20808D]" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {isSubscribed ? (
                  isCurrent ? (
                    <Button
                      onClick={handleManageSubscription}
                      disabled={portalLoading}
                      variant="outline"
                      className="w-full border-[#20808D] text-[#20808D] hover:bg-[#E8F4F5]"
                    >
                      {portalLoading ? 'Chargement...' : 'Gérer mon abonnement'}
                    </Button>
                  ) : (
                    <Button
                      onClick={handleManageSubscription}
                      disabled={portalLoading}
                      variant="outline"
                      className="w-full"
                    >
                      {portalLoading ? 'Chargement...' : 'Changer de plan'}
                    </Button>
                  )
                ) : tier.id === 'free' ? (
                  <Button disabled variant="outline" className="w-full">
                    Plan actuel
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleSubscribe(tier.id)}
                    disabled={loadingTier !== null}
                    className={`w-full ${
                      tier.recommended
                        ? 'bg-[#20808D] hover:bg-[#1a6b78] text-white'
                        : 'bg-[#1A1A2E] hover:bg-[#2a2a4e] text-white'
                    }`}
                  >
                    {loadingTier === tier.id ? 'Chargement...' : "S'abonner"}
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Note de bas de page */}
      <p className="text-xs text-gray-400 text-center">
        Paiement sécurisé par Stripe. Annulez à tout moment depuis votre espace de gestion.
      </p>
    </div>
  )
}
