import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ExternalLink, Star, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ExpertProfileForm } from '@/components/marketplace/ExpertProfileForm'
import { ExpertCard } from '@/components/marketplace/ExpertCard'
import { StarRating } from '@/components/marketplace/StarRating'
import { getMyExpertProfileAction, getExpertProfileStatsAction } from '@/app/actions/marketplace'

export default async function CoachExpertProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [userResult, profileResult, statsResult] = await Promise.all([
    supabase.from('users').select('nom, prenom, photo_url').eq('id', user.id).single(),
    getMyExpertProfileAction(),
    getExpertProfileStatsAction(),
  ])
  const userData = userResult.data

  const profile = profileResult.data
  const stats = statsResult.data

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A2E]">Mon profil Expert MINND</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Votre présence publique sur la marketplace
          </p>
        </div>
        {profile?.is_visible && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/marketplace/${user.id}`} target="_blank" className="gap-2">
              <ExternalLink className="h-4 w-4" />
              Voir mon profil
            </Link>
          </Button>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[#E8F4F5] flex items-center justify-center">
                <Users className="h-5 w-5 text-[#20808D]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1A1A2E]">{stats.nb_demandes}</p>
                <p className="text-xs text-muted-foreground">Demandes reçues</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[#E8F4F5] flex items-center justify-center">
                <Star className="h-5 w-5 text-[#20808D]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#1A1A2E]">
                  {profile?.note_moyenne ? profile.note_moyenne.toFixed(1) : '-'}
                </p>
                <p className="text-xs text-muted-foreground">{profile?.nb_avis ?? 0} avis</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Avis récents */}
      {stats && stats.avis_recents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Avis récents</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {stats.avis_recents.map((review) => (
              <div key={review.id} className="py-3 border-b last:border-0">
                <div className="flex items-center gap-2 mb-1">
                  <StarRating rating={review.rating} size="sm" />
                  <span className="text-xs text-muted-foreground">
                    {new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(new Date(review.created_at))}
                  </span>
                </div>
                {review.comment && (
                  <p className="text-sm text-foreground line-clamp-2">{review.comment}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Preview carte */}
      {profile && userData && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Aperçu carte marketplace
          </h2>
          <div className="max-w-sm pointer-events-none">
            <ExpertCard
              expert={{
                ...profile,
                nom: userData.nom ?? '',
                prenom: userData.prenom ?? null,
                photo_url: profile.photo_url ?? userData.photo_url ?? null,
              }}
            />
          </div>
        </div>
      )}

      {/* Formulaire */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {profile ? 'Modifier le profil' : 'Créer mon profil expert'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ExpertProfileForm profile={profile} onSuccess={() => {}} />
        </CardContent>
      </Card>
    </div>
  )
}
