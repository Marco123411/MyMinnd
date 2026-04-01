'use client'

import { Fragment, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FIGURE_FACTORS } from '@/lib/exercises/constants'
import type { InteractiveExerciseResult, FigureScores, FigureNotes } from '@/types'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

interface Props {
  results: InteractiveExerciseResult[]
}

export function FigureEvolutionDashboard({ results }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (results.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">Aucune exécution enregistrée</p>
        <p className="text-sm mt-1">Lancez la Figure de Performance avec ce client pour commencer le suivi.</p>
      </div>
    )
  }

  // Données formatées pour Recharts (tri chronologique)
  const chartData = [...results]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map(r => {
      const scores = (r.data as { scores?: Partial<FigureScores> }).scores ?? {}
      return {
        date: formatDate(r.created_at),
        ...Object.fromEntries(FIGURE_FACTORS.map(f => [f.key, scores[f.key] ?? 0])),
      }
    })

  // Tableau chronologique (plus récent en premier)
  const tableRows = [...results].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  // colSpan dynamique : Date + N facteurs + Moy. + Notes
  const colSpan = FIGURE_FACTORS.length + 3

  return (
    <div className="space-y-6">
      {/* Graphique */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Évolution des {FIGURE_FACTORS.length} facteurs</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8F4F5" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(value) => [`${value}%`]}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              {FIGURE_FACTORS.map(f => (
                <Line
                  key={f.key}
                  type="monotone"
                  dataKey={f.key}
                  name={f.label}
                  stroke={f.color}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tableau historique */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historique des exécutions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left py-2 pr-4 font-medium whitespace-nowrap">Date</th>
                  {FIGURE_FACTORS.map(f => (
                    <th key={f.key} className="text-right py-2 px-2 font-medium whitespace-nowrap" style={{ color: f.color }}>
                      {f.label.slice(0, 4)}.
                    </th>
                  ))}
                  <th className="text-right py-2 pl-2 font-medium">Moy.</th>
                  <th className="py-2 pl-4" />
                </tr>
              </thead>
              <tbody>
                {tableRows.map(r => {
                  const d = r.data as { scores?: Partial<FigureScores>; notes?: Partial<FigureNotes>; global_score?: number }
                  const scores = d.scores ?? ({} as Partial<FigureScores>)
                  const notes  = d.notes  ?? ({} as Partial<FigureNotes>)
                  const factorValues = FIGURE_FACTORS.map(f => scores[f.key] ?? 0)
                  const avg = typeof d.global_score === 'number'
                    ? d.global_score
                    : factorValues.length > 0
                      ? factorValues.reduce((s, v) => s + v, 0) / factorValues.length
                      : 0
                  const isOpen = expandedId === r.id

                  return (
                    // F4: Fragment avec key (fix reconciliation React)
                    <Fragment key={r.id}>
                      <tr className="border-b hover:bg-muted/30 transition-colors">
                        <td className="py-2 pr-4 whitespace-nowrap">{formatDate(r.created_at)}</td>
                        {FIGURE_FACTORS.map(f => (
                          <td key={f.key} className="text-right px-2 font-medium" style={{ color: f.color }}>
                            {scores[f.key] ?? '—'}
                          </td>
                        ))}
                        <td className="text-right pl-2 font-bold text-[#20808D]">
                          {avg.toFixed(1)}
                        </td>
                        <td className="pl-4">
                          <button
                            onClick={() => setExpandedId(isOpen ? null : r.id)}
                            className="text-xs text-muted-foreground hover:text-foreground underline"
                          >
                            {isOpen ? 'Masquer' : 'Notes'}
                          </button>
                        </td>
                      </tr>

                      {/* Ligne expandée : notes */}
                      {isOpen && (
                        <tr className="bg-muted/20">
                          {/* F14: colSpan dynamique */}
                          <td colSpan={colSpan} className="py-3 px-4">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                              {FIGURE_FACTORS.map(f => (
                                <div key={f.key}>
                                  <p className="text-xs font-semibold mb-0.5" style={{ color: f.color }}>
                                    {f.label}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {notes[f.key] || <em>Aucune note</em>}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
