import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { MapPin, Star, Users, TrendingUp, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { StarRating } from '@/components/marketplace/StarRating'
import { ReviewCard } from '@/components/marketplace/ReviewCard'
import { ContactRequestCta, type ContactRequestCtaMode } from '@/components/marketplace/ContactRequestCta'
import { getExpertAction } from '@/app/actions/marketplace'
import { createClient } from '@/lib/supabase/server'

interface PageProps {
  params: Promise<{ expertId: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { expertId } = await params
  const { data: expert } = await getExpertAction(expertId)
  if (!expert) return { title: 'Expert non trouvé — MINND' }
  const displayName = [expert.prenom, expert.nom].filter(Boolean).join(' ')
  return {
    title: `${displayName} — Expert certifié MINND`,
    description: expert.bio.slice(0, 160),
  }
}

export default async function ExpertProfilePage({ params }: PageProps) {
  const { expertId } = await params
  const { data: expert } = await getExpertAction(expertId)

  if (!expert) notFound()

  const displayName = [expert.prenom, expert.nom].filter(Boolean).join(' ')
  const initials = [expert.prenom?.charAt(0), expert.nom.charAt(0)]
    .filter(Boolean)
    .join('')
    .toUpperCase()

  const anciennete = new Date().getFullYear() - new Date(expert.created_at).getFullYear()

  // Détermine le mode du CTA de demande d'accompagnement
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Récupère le tier d'abonnement du coach (non inclus dans getExpertAction)
  const { data: coachTierRow } = await supabase
    .from('users')
    .select('subscription_tier')
    .eq('id', expertId)
    .single()

  const ctaMode: ContactRequestCtaMode = await (async () => {
    // Coach en plan free : non disponible pour les demandes
    if (!coachTierRow || coachTierRow.subscription_tier === 'free') {
      return { kind: 'not-eligible' as const }
    }
    if (!user) {
      return { kind: 'guest' as const }
    }
    const { data: userRow } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
    if (userRow?.role !== 'client') {
      return { kind: 'not-eligible' as const }
    }
    // Dernier PMA complété
    const { data: lastPma } = await supabase
      .from('tests')
      .select('id, score_global, profile_id, test_definitions!inner(slug)')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .eq('test_definitions.slug', 'pma')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!lastPma) {
      return { kind: 'no-pma' as const }
    }
    // Demande pending existante
    const { data: pending } = await supabase
      .from('contact_requests')
      .select('id')
      .eq('athlete_user_id', user.id)
      .eq('coach_user_id', expertId)
      .eq('status', 'pending')
      .maybeSingle()
    if (pending) return { kind: 'pending' as const }

    // Récupère le nom du profil + sport de l'athlète pour prefill
    const [{ data: profileRow }, { data: clientRow }] = await Promise.all([
      lastPma.profile_id
        ? supabase.from('profiles').select('name').eq('id', lastPma.profile_id).single()
        : Promise.resolve({ data: null }),
      supabase.from('clients').select('sport').eq('user_id', user.id).maybeSingle(),
    ])

    return {
      kind: 'eligible' as const,
      pmaTestId: lastPma.id,
      profileName: profileRow?.name ?? null,
      globalScore: lastPma.score_global,
      athleteSport: clientRow?.sport ?? null,
    }
  })()

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Lien retour */}
      <div className="mb-6">
        <Link href="/marketplace" className="text-sm text-muted-foreground hover:text-foreground">
          ← Retour à l&apos;annuaire
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Colonne principale */}
        <div className="lg:col-span-2 space-y-8">
          {/* Header */}
          <div className="flex items-start gap-5">
            <div className="shrink-0">
              {expert.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={expert.photo_url}
                  alt={displayName}
                  className="h-24 w-24 rounded-full object-cover"
                />
              ) : (
                <div className="h-24 w-24 rounded-full bg-[#F1F0FE] flex items-center justify-center">
                  <span className="text-2xl font-bold text-[#7069F4]">{initials}</span>
                </div>
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-[#141325]">{displayName}</h1>
                {expert.badge_certifie && (
                  <Badge className="bg-[#7069F4] text-white">Certifié MINND</Badge>
                )}
              </div>
              <p className="text-muted-foreground mb-3">{expert.titre}</p>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span>{expert.localisation}</span>
                {expert.tarif_seance != null && (
                  <>
                    <span className="mx-1">·</span>
                    <span className="font-medium text-foreground">Dès {expert.tarif_seance}€/séance</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Bio */}
          <section>
            <h2 className="text-lg font-semibold text-[#141325] mb-3">À propos</h2>
            <p className="text-foreground leading-relaxed whitespace-pre-line">{expert.bio}</p>
          </section>

          {/* Spécialités + sports + public */}
          <section className="space-y-4">
            {expert.specialites.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Spécialités
                </h3>
                <div className="flex flex-wrap gap-2">
                  {expert.specialites.map((s) => (
                    <Badge key={s} variant="secondary">{s}</Badge>
                  ))}
                </div>
              </div>
            )}
            {expert.sports.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Sports
                </h3>
                <div className="flex flex-wrap gap-2">
                  {expert.sports.map((s) => (
                    <Badge key={s} variant="outline">{s}</Badge>
                  ))}
                </div>
              </div>
            )}
            {expert.public_cible.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Public accompagné
                </h3>
                <div className="flex flex-wrap gap-2">
                  {expert.public_cible.map((p) => (
                    <Badge key={p} variant="outline">{p}</Badge>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Avis */}
          <section>
            <h2 className="text-lg font-semibold text-[#141325] mb-4">
              Avis clients
              {expert.nb_avis > 0 && (
                <span className="text-base font-normal text-muted-foreground ml-2">
                  ({expert.nb_avis})
                </span>
              )}
            </h2>
            {expert.reviews.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aucun avis pour le moment.</p>
            ) : (
              <div className="divide-y">
                {expert.reviews.map((review) => (
                  <ReviewCard key={review.id} review={review} />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Sidebar : signaux de confiance + CTA */}
        <div className="space-y-5">
          {/* Signaux de confiance */}
          <div className="rounded-xl border bg-white p-5 space-y-4">
            <h2 className="font-semibold text-[#141325]">Signaux de confiance</h2>

            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-[#F1F0FE] flex items-center justify-center shrink-0">
                <Star className="h-4 w-4 text-[#7069F4]" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <StarRating rating={Math.round(expert.note_moyenne)} size="sm" />
                  <span className="text-sm font-medium">
                    {expert.note_moyenne > 0 ? expert.note_moyenne.toFixed(1) : '-'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {expert.nb_avis} avis vérifié{expert.nb_avis > 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-[#F1F0FE] flex items-center justify-center shrink-0">
                <Users className="h-4 w-4 text-[#7069F4]" />
              </div>
              <div>
                <p className="text-sm font-medium">{expert.nb_profils_analyses}</p>
                <p className="text-xs text-muted-foreground">
                  profil{expert.nb_profils_analyses > 1 ? 's' : ''} analysé{expert.nb_profils_analyses > 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {expert.taux_reponse > 0 && (
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-[#F1F0FE] flex items-center justify-center shrink-0">
                  <TrendingUp className="h-4 w-4 text-[#7069F4]" />
                </div>
                <div>
                  <p className="text-sm font-medium">{Math.round(expert.taux_reponse)}%</p>
                  <p className="text-xs text-muted-foreground">taux de réponse</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-[#F1F0FE] flex items-center justify-center shrink-0">
                <Clock className="h-4 w-4 text-[#7069F4]" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {anciennete === 0 ? 'Nouveau' : `${anciennete} an${anciennete > 1 ? 's' : ''}`}
                </p>
                <p className="text-xs text-muted-foreground">sur MINND</p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="rounded-xl border bg-[#1A1A2E] p-5 text-white space-y-3">
            <h3 className="font-semibold">Demander un accompagnement</h3>
            <p className="text-sm text-white/70">
              Envoyez votre profil mental PMA à {expert.prenom ?? displayName} pour démarrer un suivi.
            </p>
            <ContactRequestCta
              expertId={expertId}
              coachDisplayName={displayName}
              mode={ctaMode}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
