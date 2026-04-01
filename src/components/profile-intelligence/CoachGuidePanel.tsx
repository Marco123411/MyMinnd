import { Shield, Target, Dumbbell, AlertTriangle, Users } from 'lucide-react'
import { CelebrityExamplesList } from './CelebrityExamplesList'
import type { MentalProfile } from '@/types'

interface CoachGuidePanelProps {
  profile: MentalProfile
}

export function CoachGuidePanel({ profile }: CoachGuidePanelProps) {
  return (
    <div className="rounded-xl overflow-hidden border border-[#1A1A2E]/20">
      {/* En-tête coach — fond sombre, accès restreint */}
      <div className="flex items-center gap-2 bg-[#1A1A2E] px-4 py-3">
        <Shield className="h-4 w-4 text-[#FFC553]" />
        <p className="text-sm font-semibold text-white">Guide Coach</p>
        <span className="ml-auto text-[10px] text-white/50 uppercase tracking-wider">Réservé coach</span>
      </div>

      <div className="bg-white divide-y divide-gray-100">
        {/* Priorité #1 */}
        {profile.coach_priority && (
          <div className="flex items-start gap-3 px-4 py-3">
            <Target className="h-4 w-4 mt-0.5 shrink-0 text-[#20808D]" />
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                Priorité #1
              </p>
              <p className="text-sm text-[#1A1A2E] font-medium">{profile.coach_priority}</p>
            </div>
          </div>
        )}

        {/* Exercice recommandé */}
        {profile.coach_exercise && (
          <div className="flex items-start gap-3 px-4 py-3">
            <Dumbbell className="h-4 w-4 mt-0.5 shrink-0 text-[#20808D]" />
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                Exercice recommandé
              </p>
              <p className="text-sm text-[#1A1A2E]">{profile.coach_exercise}</p>
            </div>
          </div>
        )}

        {/* Piège à éviter */}
        {profile.coach_trap && (
          <div className="flex items-start gap-3 px-4 py-3">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-[#944454]" />
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                Piège à éviter
              </p>
              <p className="text-sm font-medium text-[#944454]">{profile.coach_trap}</p>
            </div>
          </div>
        )}

        {/* Rôle en équipe */}
        {(profile.team_role || profile.team_contribution) && (
          <div className="flex items-start gap-3 px-4 py-3">
            <Users className="h-4 w-4 mt-0.5 shrink-0 text-[#20808D]" />
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                Rôle en équipe
              </p>
              {profile.team_role && (
                <p className="text-sm font-medium text-[#1A1A2E]">{profile.team_role}</p>
              )}
              {profile.team_contribution && (
                <p className="text-sm text-muted-foreground mt-0.5">{profile.team_contribution}</p>
              )}
            </div>
          </div>
        )}

        {/* Athlètes de référence */}
        {profile.celebrity_examples.length > 0 && (
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Athlètes de référence
            </p>
            <CelebrityExamplesList
              celebrities={profile.celebrity_examples}
              profileColor={profile.color}
            />
          </div>
        )}
      </div>
    </div>
  )
}
