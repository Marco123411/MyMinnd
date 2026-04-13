'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { BaselineComparisonTable } from '@/components/cognitive/BaselineComparisonTable'
import type { BaselineComparisonRow } from '@/components/cognitive/BaselineComparisonTable'
import { TrendingUp, TrendingDown, Minus, Plus, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'

interface BaselineSummary {
  id: string
  name: string
  pre_date: string
  post_date: string
  created_at: string
  summary: {
    tests_compared: number
    metrics_improved: number
    metrics_regressed: number
    metrics_stable: number
    overall_trend: 'improving' | 'stable' | 'declining'
  } | null
}

interface BaselineDetail {
  results: {
    comparisons: Array<{
      test_slug: string
      test_name: string
      metrics: Record<string, {
        pre: number
        post: number
        delta: number
        delta_percent: number
        improved: boolean
      }>
      pre_benchmark:  Record<string, 'elite' | 'average' | 'poor'>
      post_benchmark: Record<string, 'elite' | 'average' | 'poor'>
    }>
  } | null
}

interface BaselinesClientProps {
  programId: string
  initialBaselines: BaselineSummary[]
}

function trendIcon(trend: string) {
  if (trend === 'improving') return <TrendingUp size={14} className="text-green-600" />
  if (trend === 'declining') return <TrendingDown size={14} className="text-red-500" />
  return <Minus size={14} className="text-muted-foreground" />
}

function trendBadge(trend: string) {
  if (trend === 'improving') return <Badge className="bg-green-100 text-green-700 border-0 text-xs">En progression</Badge>
  if (trend === 'declining') return <Badge className="bg-red-100 text-red-700 border-0 text-xs">En régression</Badge>
  return <Badge className="bg-gray-100 text-gray-600 border-0 text-xs">Stable</Badge>
}

function buildTableRows(detail: BaselineDetail): BaselineComparisonRow[] {
  if (!detail.results) return []
  const rows: BaselineComparisonRow[] = []

  for (const comp of detail.results.comparisons) {
    for (const [metric, vals] of Object.entries(comp.metrics)) {
      rows.push({
        testName:      comp.test_name,
        testSlug:      comp.test_slug,
        metric,
        preValue:      vals.pre,
        postValue:     vals.post,
        delta:         vals.delta,
        deltaPercent:  vals.delta_percent,
        improved:      vals.improved,
        preBenchmark:  comp.pre_benchmark[metric]  ?? 'average',
        postBenchmark: comp.post_benchmark[metric] ?? 'average',
      })
    }
  }

  return rows
}

export function BaselinesClient({ programId, initialBaselines }: BaselinesClientProps) {
  const [baselines, setBaselines] = useState<BaselineSummary[]>(initialBaselines)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [detail, setDetail] = useState<Record<string, BaselineDetail>>({})
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', pre_date: '', post_date: '' })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandError, setExpandError] = useState<string | null>(null)

  async function toggleExpand(id: string) {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id)
    setExpandError(null)

    if (!detail[id]) {
      try {
        const res = await fetch(`/api/programmes/${programId}/baselines/${id}`)
        const json = await res.json()
        if (!res.ok) {
          setExpandError(json.error ?? 'Erreur lors du chargement des détails')
          return
        }
        if (json.data) setDetail((prev) => ({ ...prev, [id]: json.data as BaselineDetail }))
      } catch {
        setExpandError('Erreur réseau lors du chargement des détails')
      }
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError(null)

    try {
      const res = await fetch(`/api/programmes/${programId}/baselines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()

      if (!res.ok) { setError(json.error ?? 'Erreur lors de la création'); return }

      const newBaseline: BaselineSummary = {
        id:         json.data.id,
        name:       json.data.name,
        pre_date:   json.data.pre_date,
        post_date:  json.data.post_date,
        created_at: json.data.created_at,
        summary:    json.data.results?.summary ?? null,
      }

      setBaselines((prev) => [newBaseline, ...prev])
      setDetail((prev) => ({ ...prev, [newBaseline.id]: { results: json.data.results } }))
      setForm({ name: '', pre_date: '', post_date: '' })
      setShowForm(false)
      setExpanded(newBaseline.id)
    } catch {
      setError('Erreur réseau')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette baseline ?')) return
    const res = await fetch(`/api/programmes/${programId}/baselines/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setError(json.error ?? 'Erreur lors de la suppression')
      return
    }
    setBaselines((prev) => prev.filter((b) => b.id !== id))
    if (expanded === id) setExpanded(null)
  }

  return (
    <div className="space-y-4">
      {/* Bouton création */}
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => setShowForm((v) => !v)}
          className="bg-[#20808D] hover:bg-[#1a6a75] text-white"
        >
          <Plus size={14} className="mr-1" />
          Nouvelle baseline
        </Button>
      </div>

      {/* Formulaire création */}
      {showForm && (
        <Card className="border-[#20808D]/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Nouvelle baseline Pre/Post</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Nom</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="ex: Pré-saison vs Post-saison 2026"
                  required
                  className="h-8 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Date Pré</label>
                  <Input
                    type="date"
                    value={form.pre_date}
                    onChange={(e) => setForm((p) => ({ ...p, pre_date: e.target.value }))}
                    required
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Date Post</label>
                  <Input
                    type="date"
                    value={form.post_date}
                    onChange={(e) => setForm((p) => ({ ...p, post_date: e.target.value }))}
                    required
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              {error && <p className="text-xs text-red-500">{error}</p>}
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                  Annuler
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={creating}
                  className="bg-[#20808D] hover:bg-[#1a6a75] text-white"
                >
                  {creating ? 'Calcul…' : 'Créer'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Liste des baselines */}
      {baselines.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Aucune baseline. Créez-en une pour comparer l&apos;évolution Pre/Post.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {baselines.map((b) => (
            <Card key={b.id} className="overflow-hidden">
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/40 transition-colors"
                onClick={() => toggleExpand(b.id)}
              >
                <div className="flex items-center gap-3">
                  {b.summary && trendIcon(b.summary.overall_trend)}
                  <div>
                    <p className="text-sm font-medium">{b.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Pré : {b.pre_date} · Post : {b.post_date}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {b.summary && trendBadge(b.summary.overall_trend)}
                  {b.summary && (
                    <span className="text-xs text-muted-foreground">
                      {b.summary.tests_compared} test(s) · {b.summary.metrics_improved}↑ {b.summary.metrics_regressed}↓
                    </span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(b.id) }}
                    className="text-muted-foreground hover:text-red-500 transition-colors p-1"
                  >
                    <Trash2 size={14} />
                  </button>
                  {expanded === b.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
              </div>

              {expanded === b.id && (
                <div className="border-t px-4 pb-4 pt-2">
                  {expandError ? (
                    <div className="py-4 text-center text-sm text-red-500">{expandError}</div>
                  ) : detail[b.id] ? (
                    <BaselineComparisonTable rows={buildTableRows(detail[b.id])} />
                  ) : (
                    <div className="py-4 text-center text-sm text-muted-foreground">
                      Chargement…
                    </div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
