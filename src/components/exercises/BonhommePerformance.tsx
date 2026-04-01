'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import type { BonhommeScores } from '@/types'

// Couleurs par groupe de dimension
const GROUP_COLORS = {
  cerveau: '#3C3CD6',  // mental, strategique, tactique
  corps: '#20808D',    // physique, hygiene, technique
  coeur: '#944454',    // relationnel
} as const

const DIMENSIONS: {
  key: keyof BonhommeScores
  label: string
  group: keyof typeof GROUP_COLORS
}[] = [
  { key: 'mental',      label: 'MENTAL',          group: 'cerveau' },
  { key: 'strategique', label: 'STRATÉGIQUE',      group: 'cerveau' },
  { key: 'tactique',    label: 'TACTIQUE',         group: 'cerveau' },
  { key: 'physique',    label: 'PHYSIQUE',         group: 'corps'   },
  { key: 'hygiene',     label: 'HYGIÈNE DE VIE',   group: 'corps'   },
  { key: 'technique',   label: 'TECHNIQUE',        group: 'corps'   },
  { key: 'relationnel', label: 'RELATIONNEL',      group: 'coeur'   },
]

const DEFAULT_SCORES: BonhommeScores = {
  mental: 50, strategique: 50, tactique: 50,
  physique: 50, hygiene: 50, technique: 50,
  relationnel: 50,
}

interface Props {
  onSave?: (data: BonhommeScores & { global_score: number; completed_at: string }) => void
  isPending?: boolean
}

// Chemin SVG d'un coeur centré en (cx, cy) avec un rayon r
function heartPath(cx: number, cy: number, r: number): string {
  const s = r * 0.8
  return `M ${cx} ${cy + s * 0.3}
    C ${cx} ${cy - s * 0.1}, ${cx - s * 0.5} ${cy - s * 0.6}, ${cx - s * 0.7} ${cy - s * 0.3}
    C ${cx - s * 1.1} ${cy - s * 0.8}, ${cx - s * 1.1} ${cy - s * 1.3}, ${cx - s * 0.6} ${cy - s * 1.4}
    C ${cx - s * 0.2} ${cy - s * 1.5}, ${cx} ${cy - s * 1.1}, ${cx} ${cy - s * 0.8}
    C ${cx} ${cy - s * 1.1}, ${cx + s * 0.2} ${cy - s * 1.5}, ${cx + s * 0.6} ${cy - s * 1.4}
    C ${cx + s * 1.1} ${cy - s * 1.3}, ${cx + s * 1.1} ${cy - s * 0.8}, ${cx + s * 0.7} ${cy - s * 0.3}
    C ${cx + s * 0.5} ${cy - s * 0.6}, ${cx} ${cy - s * 0.1}, ${cx} ${cy + s * 0.3} Z`
}

function BonhommeSVG({ scores }: { scores: BonhommeScores }) {
  const cerveau = (scores.mental + scores.strategique + scores.tactique) / 3
  // F11: technique inclus dans corps (3 dimensions physiques)
  const corpsScore = (scores.physique + scores.hygiene + scores.technique) / 3

  // Tête : rayon 20→58px selon score cerveau
  const headR = 20 + (cerveau / 100) * 38
  const headCx = 100
  const headCy = headR + 10

  // Corps : largeur 18→50 selon corpsScore, hauteur fixe
  const torsoW = 18 + (corpsScore / 100) * 32
  const torsoH = 70
  const torsoX = headCx - torsoW / 2
  const torsoY = headCy + headR + 4

  // Bras : strokeWidth 3→12 selon physique
  const limbW = 3 + (scores.physique / 100) * 9

  // Bras gauche
  const leftArmStart = { x: torsoX, y: torsoY + 12 }
  const leftArmEnd   = { x: torsoX - 28, y: torsoY + 44 }
  // Bras droit
  const rightArmStart = { x: torsoX + torsoW, y: torsoY + 12 }
  const rightArmEnd   = { x: torsoX + torsoW + 28, y: torsoY + 44 }

  // Jambes
  const legTop = torsoY + torsoH
  const leftLegEnd  = { x: headCx - 22, y: legTop + 60 }
  const rightLegEnd = { x: headCx + 22, y: legTop + 60 }

  // Coeur : rayon 6→16 selon relationnel
  const heartR = 6 + (scores.relationnel / 100) * 10
  const heartCx = headCx
  const heartCy = torsoY + torsoH / 2

  // Total SVG height
  const svgH = legTop + 70

  return (
    <svg
      viewBox={`0 0 200 ${svgH}`}
      className="w-full max-w-[260px] mx-auto"
      aria-label="Bonhomme de Performance"
    >
      {/* Jambes */}
      <line x1={headCx} y1={legTop} x2={leftLegEnd.x}  y2={leftLegEnd.y}  stroke="#1A1A2E" strokeWidth={limbW} strokeLinecap="round" />
      <line x1={headCx} y1={legTop} x2={rightLegEnd.x} y2={rightLegEnd.y} stroke="#1A1A2E" strokeWidth={limbW} strokeLinecap="round" />

      {/* Corps */}
      <rect
        x={torsoX} y={torsoY}
        width={torsoW} height={torsoH}
        rx={torsoW * 0.3}
        fill="#20808D"
        opacity={0.85}
      />

      {/* Coeur */}
      <path d={heartPath(heartCx, heartCy, heartR)} fill="#944454" opacity={0.9} />

      {/* Bras */}
      <line
        x1={leftArmStart.x}  y1={leftArmStart.y}
        x2={leftArmEnd.x}    y2={leftArmEnd.y}
        stroke="#1A1A2E" strokeWidth={limbW} strokeLinecap="round"
      />
      <line
        x1={rightArmStart.x} y1={rightArmStart.y}
        x2={rightArmEnd.x}   y2={rightArmEnd.y}
        stroke="#1A1A2E" strokeWidth={limbW} strokeLinecap="round"
      />

      {/* Tête */}
      <circle cx={headCx} cy={headCy} r={headR} fill="#FFC553" opacity={0.9} />

      {/* Yeux */}
      <circle cx={headCx - headR * 0.25} cy={headCy - headR * 0.05} r={headR * 0.09} fill="#1A1A2E" />
      <circle cx={headCx + headR * 0.25} cy={headCy - headR * 0.05} r={headR * 0.09} fill="#1A1A2E" />
    </svg>
  )
}

export function BonhommePerformance({ onSave, isPending }: Props) {
  const [scores, setScores] = useState<BonhommeScores>(DEFAULT_SCORES)

  // F5: diviseur dynamique basé sur le nombre de dimensions réelles
  const globalScore = Object.values(scores).reduce((sum, v) => sum + v, 0) / DIMENSIONS.length

  function handleSlider(key: keyof BonhommeScores, value: number) {
    setScores(prev => ({ ...prev, [key]: value }))
  }

  function handleSave() {
    onSave?.({
      ...scores,
      global_score: Math.round(globalScore * 10) / 10,
      completed_at: new Date().toISOString(),
    })
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* SVG bonhomme */}
        <div className="flex flex-col items-center gap-4">
          <BonhommeSVG scores={scores} />
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Score global</p>
            <p className="text-3xl font-bold text-[#20808D]">
              {globalScore.toFixed(1)}
              <span className="text-lg text-muted-foreground"> / 100</span>
            </p>
          </div>
        </div>

        {/* Curseurs */}
        <div className="space-y-4">
          {DIMENSIONS.map(({ key, label, group }) => {
            const color = GROUP_COLORS[group]
            const value = scores[key]
            return (
              <div key={key} className="space-y-1">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium" style={{ color }}>{label}</span>
                  <span className="text-muted-foreground w-8 text-right">{value}</span>
                </div>
                <div className="relative h-2 rounded-full bg-gray-100">
                  <div
                    className="absolute h-full rounded-full transition-none"
                    style={{ width: `${value}%`, backgroundColor: color }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={value}
                    onChange={e => handleSlider(key, Number(e.target.value))}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
                    aria-label={label}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {onSave && (
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={isPending}
            className="bg-[#20808D] hover:bg-[#20808D]/90 text-white"
          >
            {isPending ? 'Enregistrement...' : 'Valider l\'exercice'}
          </Button>
        </div>
      )}
    </div>
  )
}
