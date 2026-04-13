'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { FIGURE_FACTORS } from '@/lib/exercises/constants'
import type { FigureScores, FigureNotes } from '@/types'

const DEFAULT_SCORES: FigureScores = {
  psycho: 50, physique: 50, technique: 50,
  tactique: 50, social: 50, materiel: 50,
}

const DEFAULT_NOTES: FigureNotes = {
  psycho: '', physique: '', technique: '',
  tactique: '', social: '', materiel: '',
}

interface Props {
  onSave?: (data: {
    scores: FigureScores
    notes: FigureNotes
    global_score: number
    completed_at: string
  }) => void
  isPending?: boolean
}

// Convertit un angle en degrés + un rayon en coordonnée cartésienne
function polarToXY(angleDeg: number, r: number, cx: number, cy: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180)
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function RadarSVG({ scores }: { scores: FigureScores }) {
  const cx = 120
  const cy = 120
  const maxR = 90

  // Grilles à 25%, 50%, 75%, 100%
  const gridLevels = [0.25, 0.5, 0.75, 1]

  // Points du polygone de données
  const dataPoints = FIGURE_FACTORS.map(f => {
    const r = (scores[f.key] / 100) * maxR
    return polarToXY(f.angle, r, cx, cy)
  })

  const polygonPoints = dataPoints.map(p => `${p.x},${p.y}`).join(' ')

  // Couleur dominante : facteur avec le score le plus haut
  const maxFactor = FIGURE_FACTORS.reduce((a, b) => scores[a.key] > scores[b.key] ? a : b)

  return (
    <svg viewBox="0 0 240 240" className="w-full max-w-[280px] mx-auto" aria-label="Figure de Performance">
      {/* Grilles hexagonales */}
      {gridLevels.map(pct => {
        const gridPts = FIGURE_FACTORS.map(f => {
          const p = polarToXY(f.angle, maxR * pct, cx, cy)
          return `${p.x},${p.y}`
        }).join(' ')
        return (
          <polygon
            key={pct}
            points={gridPts}
            fill="none"
            stroke="#F1F0FE"
            strokeWidth={pct === 1 ? 1.5 : 1}
          />
        )
      })}

      {/* Axes */}
      {FIGURE_FACTORS.map(f => {
        const tip = polarToXY(f.angle, maxR, cx, cy)
        return (
          <line
            key={f.key}
            x1={cx} y1={cy}
            x2={tip.x} y2={tip.y}
            stroke="#F1F0FE"
            strokeWidth={1}
          />
        )
      })}

      {/* Polygone de données */}
      <polygon
        points={polygonPoints}
        fill={maxFactor.color}
        fillOpacity={0.2}
        stroke={maxFactor.color}
        strokeWidth={2}
      />

      {/* Points aux sommets */}
      {FIGURE_FACTORS.map(f => {
        const r = (scores[f.key] / 100) * maxR
        const p = polarToXY(f.angle, r, cx, cy)
        return (
          <circle key={f.key} cx={p.x} cy={p.y} r={4} fill={f.color} />
        )
      })}

      {/* Labels des axes */}
      {FIGURE_FACTORS.map(f => {
        const labelR = maxR + 18
        const p = polarToXY(f.angle, labelR, cx, cy)
        return (
          <text
            key={f.key}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={9}
            fill={f.color}
            fontWeight="600"
          >
            {f.label}
          </text>
        )
      })}

      {/* Centre */}
      <circle cx={cx} cy={cy} r={3} fill="#141325" />
    </svg>
  )
}

export function FigurePerformance({ onSave, isPending }: Props) {
  const [scores, setScores] = useState<FigureScores>(DEFAULT_SCORES)
  const [notes, setNotes]   = useState<FigureNotes>(DEFAULT_NOTES)

  // F5: diviseur dynamique basé sur le nombre de facteurs réels
  const globalScore = Object.values(scores).reduce((sum, v) => sum + v, 0) / FIGURE_FACTORS.length

  function handleScore(key: keyof FigureScores, value: number) {
    setScores(prev => ({ ...prev, [key]: value }))
  }

  function handleNote(key: keyof FigureNotes, value: string) {
    setNotes(prev => ({ ...prev, [key]: value }))
  }

  function handleSave() {
    onSave?.({
      scores,
      notes,
      global_score: Math.round(globalScore * 10) / 10,
      completed_at: new Date().toISOString(),
    })
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Radar */}
        <div className="flex flex-col items-center gap-3">
          <RadarSVG scores={scores} />
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Score moyen</p>
            <p className="text-3xl font-bold text-[#7069F4]">
              {globalScore.toFixed(1)}
              <span className="text-lg text-muted-foreground"> %</span>
            </p>
          </div>
        </div>

        {/* Cartes facteurs */}
        <div className="space-y-3">
          {FIGURE_FACTORS.map(({ key, label, color }) => {
            const value = scores[key]
            return (
              <div key={key} className="rounded-lg border p-3 space-y-2">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm" style={{ color }}>{label}</span>
                  <span className="text-sm font-bold" style={{ color }}>{value} %</span>
                </div>

                {/* Curseur */}
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
                    onChange={e => handleScore(key, Number(e.target.value))}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
                    aria-label={label}
                  />
                </div>

                {/* Notes */}
                <textarea
                  value={notes[key]}
                  onChange={e => handleNote(key, e.target.value)}
                  placeholder="Observations..."
                  rows={2}
                  className="w-full text-xs rounded border border-input bg-background px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-[#7069F4]"
                />
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
            className="bg-[#7069F4] hover:bg-[#7069F4]/90 text-white"
          >
            {isPending ? 'Enregistrement...' : 'Valider la Figure'}
          </Button>
        </div>
      )}
    </div>
  )
}
