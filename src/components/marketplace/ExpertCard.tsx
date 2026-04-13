import Link from 'next/link'
import { MapPin } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StarRating } from './StarRating'
import type { ExpertProfileWithUser } from '@/types'

interface ExpertCardProps {
  expert: ExpertProfileWithUser
}

export function ExpertCard({ expert }: ExpertCardProps) {
  const initials = [expert.prenom?.charAt(0), expert.nom.charAt(0)]
    .filter(Boolean)
    .join('')
    .toUpperCase()

  const displayName = [expert.prenom, expert.nom].filter(Boolean).join(' ')
  const visibleSpecialites = expert.specialites.slice(0, 3)
  const hiddenCount = expert.specialites.length - 3

  return (
    <Link href={`/marketplace/${expert.user_id}`} className="block group">
      <Card className="h-full transition-shadow duration-200 group-hover:shadow-md">
        <CardContent className="p-5 flex flex-col gap-3">
          {/* Header : photo + nom + titre + badge certifié */}
          <div className="flex items-start gap-3">
            <div className="shrink-0">
              {expert.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={expert.photo_url}
                  alt={displayName}
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <div className="h-16 w-16 rounded-full bg-[#F1F0FE] flex items-center justify-center">
                  <span className="text-lg font-semibold text-[#7069F4]">{initials}</span>
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-[#141325] truncate">{displayName}</h3>
                {expert.badge_certifie && (
                  <Badge variant="default" className="text-xs bg-[#7069F4] text-white shrink-0">
                    Certifié MINND
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{expert.titre}</p>
            </div>
          </div>

          {/* Spécialités */}
          {visibleSpecialites.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {visibleSpecialites.map((s) => (
                <Badge key={s} variant="secondary" className="text-xs">
                  {s}
                </Badge>
              ))}
              {hiddenCount > 0 && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  +{hiddenCount}
                </Badge>
              )}
            </div>
          )}

          {/* Localisation */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{expert.localisation}</span>
          </div>

          {/* Note + tarif */}
          <div className="flex items-center justify-between mt-auto pt-2 border-t">
            <div className="flex items-center gap-1.5">
              <StarRating rating={Math.round(expert.note_moyenne)} size="sm" />
              {expert.nb_avis > 0 ? (
                <span className="text-xs text-muted-foreground">
                  {expert.note_moyenne.toFixed(1)} ({expert.nb_avis})
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Aucun avis</span>
              )}
            </div>
            <div className="text-right">
              {expert.tarif_seance != null ? (
                <span className="text-sm font-medium text-[#141325]">
                  Dès {expert.tarif_seance}€
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Sur demande</span>
              )}
            </div>
          </div>

          {/* Profils analysés */}
          {expert.nb_profils_analyses > 0 && (
            <p className="text-xs text-muted-foreground -mt-1">
              {expert.nb_profils_analyses} profil{expert.nb_profils_analyses > 1 ? 's' : ''} analysé{expert.nb_profils_analyses > 1 ? 's' : ''}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
