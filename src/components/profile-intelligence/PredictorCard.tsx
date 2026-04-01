import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp, AlertCircle } from 'lucide-react'

interface PredictorCardProps {
  label: string
  r: number
  clientScore: number
  sub_slug: string
}

function getInterpretation(score: number, label: string): { text: string; positive: boolean } {
  if (score >= 7) {
    return {
      text: `Excellent — ce levier est actif dans votre profil.`,
      positive: true,
    }
  }
  if (score < 5) {
    return {
      text: `Levier de progression prioritaire : chaque point gagné en ${label} impacte l'ensemble du profil.`,
      positive: false,
    }
  }
  return {
    text: `En développement — renforcer ce levier améliorera votre score global.`,
    positive: true,
  }
}

export function PredictorCard({ label, r, clientScore }: PredictorCardProps) {
  const { text, positive } = getInterpretation(clientScore, label)
  const widthPct = (clientScore / 10) * 100

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-sm font-semibold text-[#1A1A2E]">{label}</p>
            <p className="text-xs text-muted-foreground">
              Corrélation avec le score global : r={r.toFixed(3)}
            </p>
          </div>
          <span className="text-lg font-bold text-[#20808D] shrink-0">
            {clientScore.toFixed(1)}/10
          </span>
        </div>

        {/* Barre de score */}
        <div className="h-2 w-full rounded-full bg-[#E8F4F5] mb-3">
          <div
            className="h-2 rounded-full bg-[#20808D] transition-all"
            style={{ width: `${widthPct}%` }}
          />
        </div>

        {/* Interprétation */}
        <div className={`flex items-start gap-2 text-xs ${positive ? 'text-[#20808D]' : 'text-orange-700'}`}>
          {positive ? (
            <TrendingUp className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          )}
          <p>{text}</p>
        </div>
      </CardContent>
    </Card>
  )
}
