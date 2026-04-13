# Niveau 3 — Preuve de progression MINND

## Contexte & motivation

La fonctionnalité la plus différenciante de MINND n'est pas le programme lui-même —
c'est la **preuve que le programme fonctionne**. Aucune plateforme concurrente ne peut
montrer la corrélation entre l'exécution d'exercices mentaux et l'évolution d'un score
psychométrique normé.

Ce niveau ajoute :
1. Un **dashboard de progression** pour le coach : graphe d'adhérence au programme vs
   évolution des scores MINND sur les compétences ciblées
2. Un **rapport PDF de fin de programme** pour le client : avant/après par domaine,
   exercices réalisés, message du coach

**Prérequis :** Les Niveaux 1 et 2 doivent être en place.

---

## Stack technique

- **Next.js 14 App Router** — Server Components + Server Actions
- **Supabase** (PostgreSQL + RLS) — lecture des `test_scores` et `programmes`
- **shadcn/ui** — composants (Card, Badge, Tabs…)
- **@react-pdf/renderer** — génération PDF côté serveur (déjà intégré)
- **Recharts** (ou chart natif shadcn/ui si disponible) — graphes de progression
- **Admin client** : `createAdminClient()` pour les lectures cross-ownership

---

## Fichiers existants à connaître

```
supabase/migrations/
  20260330000000_create_test_engine.sql   ← test_scores, tests, competency_tree
  20260330000001_create_users_tests.sql   ← normative_stats, profiles

src/
  types/index.ts                          ← ajouter ProgressionData
  app/
    actions/
      programmes.ts                       ← getClientProgrammesAction (Niveau 2)
      profile-intelligence.ts             ← lecture scores existante (référence)
    api/
      reports/generate/[testId]/route.ts  ← pattern PDF à suivre
  components/
    coach/
      ProgrammeEtapesList.tsx             ← composant Niveau 2
```

---

## Architecture de la donnée de progression

```
Programme (Niveau 2)
  └── programme_etapes
        ├── autonomous_sessions → statut terminee = complétion
        ├── cabinet_sessions    → statut realisee = complétion
        └── recurring_templates → recurring_executions.completed

Tests psychométriques (existants)
  └── tests (status = 'completed')
        └── test_scores (score par nœud competency_tree)
              └── normative_stats (percentile = rang normalisé)

Corrélation : timeline du programme ↔ tests passés dans la même période
```

---

## Tâche 1 — Server Action : données de progression

**Fichier :** `src/app/actions/programmes.ts` — Ajouter à la fin.

```typescript
// ============================================================
// Types de progression
// ============================================================

export interface ScoreProgression {
  node_id: string
  node_label: string    // label lisible du nœud (domaine/sous-compétence)
  depth: number         // 0 = domaine, 1 = sous-compétence
  // Avant le programme (test le plus proche AVANT la date de création du programme)
  score_avant: number | null       // percentile 0-100
  score_raw_avant: number | null   // score brut
  // Après le programme (test le plus récent APRÈS début du programme)
  score_apres: number | null
  score_raw_apres: number | null
  // Delta
  delta_percentile: number | null  // score_apres - score_avant (positif = amélioration)
}

export interface AdherencePoint {
  semaine: string       // label "Sem. 1", "Sem. 2"…
  taux: number          // 0-100 (% étapes complétées cette semaine)
  etapes_completes: number
  etapes_total: number
}

export interface ProgrammeProgressionData {
  programme_id: string
  nom: string
  date_debut: string
  taux_global: number           // % complétion global du programme
  etapes_completes: number
  etapes_total: number
  scores: ScoreProgression[]
  adherence_par_semaine: AdherencePoint[]
  // Dates des tests utilisés pour le calcul avant/après
  test_avant_id: string | null
  test_apres_id: string | null
  test_avant_date: string | null
  test_apres_date: string | null
}

/**
 * Calcule les données de progression d'un programme :
 * - Adhérence semaine par semaine
 * - Évolution des scores MINND (avant/après démarrage du programme)
 *
 * @param programmeId  UUID du programme
 * @param clientUserId auth user_id du client
 */
export async function getProgrammeProgressionAction(
  programmeId: string,
  clientUserId: string
): Promise<{ data: ProgrammeProgressionData | null; error: string | null }> {
  const { user, error: authError } = await requireCoach()
  if (authError || !user) return { data: null, error: authError ?? 'Non authentifié' }

  const admin = createAdminClient()

  // 1. Charger le programme avec ses étapes (réutilise la logique Niveau 2)
  const { data: programmes, error: progError } = await admin
    .from('programmes')
    .select(`
      *,
      programme_etapes (
        *,
        cabinet_sessions (statut, date_seance),
        autonomous_sessions (statut, date_realisation, date_cible),
        recurring_templates (titre, recurring_executions (completed, started_at))
      )
    `)
    .eq('id', programmeId)
    .eq('coach_id', user.id)
    .single()

  if (progError || !programmes) return { data: null, error: progError?.message ?? 'Programme introuvable' }

  const dateDebut = new Date(programmes.created_at)

  // 2. Calculer la complétion globale et l'adhérence par semaine
  const etapes = programmes.programme_etapes ?? []
  let etapesCompletes = 0
  const etapesParSemaine: Map<number, { total: number; completes: number }> = new Map()

  etapes.forEach((etape: {
    type_seance: string
    cabinet_sessions: { statut: string; date_seance: string } | null
    autonomous_sessions: { statut: string; date_realisation: string | null; date_cible: string | null } | null
    recurring_templates: { recurring_executions: { completed: boolean; started_at: string }[] } | null
    ordre: number
  }) => {
    // Calculer la semaine de l'étape par rapport au début du programme
    let dateEtape: Date | null = null
    let estComplete = false

    if (etape.type_seance === 'cabinet' && etape.cabinet_sessions) {
      dateEtape = new Date(etape.cabinet_sessions.date_seance)
      estComplete = etape.cabinet_sessions.statut === 'realisee'
    } else if (etape.type_seance === 'autonomie' && etape.autonomous_sessions) {
      const dateRef = etape.autonomous_sessions.date_realisation ?? etape.autonomous_sessions.date_cible
      dateEtape = dateRef ? new Date(dateRef) : null
      estComplete = etape.autonomous_sessions.statut === 'terminee'
    } else if (etape.type_seance === 'recurrente' && etape.recurring_templates) {
      const executions = etape.recurring_templates.recurring_executions ?? []
      const lastCompleted = executions.find((e) => e.completed)
      dateEtape = lastCompleted ? new Date(lastCompleted.started_at) : null
      estComplete = !!lastCompleted
    }

    if (estComplete) etapesCompletes++

    // Affecter à une semaine (semaine 1 = 7 premiers jours)
    const refDate = dateEtape ?? new Date()
    const diffMs = refDate.getTime() - dateDebut.getTime()
    const semaine = Math.max(1, Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000)))

    const semaineData = etapesParSemaine.get(semaine) ?? { total: 0, completes: 0 }
    etapesParSemaine.set(semaine, {
      total:    semaineData.total + 1,
      completes: semaineData.completes + (estComplete ? 1 : 0),
    })
  })

  const adherenceParSemaine: AdherencePoint[] = Array.from(etapesParSemaine.entries())
    .sort(([a], [b]) => a - b)
    .map(([semaine, { total, completes }]) => ({
      semaine:          `Sem. ${semaine}`,
      taux:             total > 0 ? Math.round((completes / total) * 100) : 0,
      etapes_completes: completes,
      etapes_total:     total,
    }))

  // 3. Charger les tests du client avant et après le début du programme
  const { data: tests, error: testsError } = await admin
    .from('tests')
    .select('id, created_at, status')
    .eq('user_id', clientUserId)
    .eq('status', 'completed')
    .order('created_at', { ascending: true })

  if (testsError) return { data: null, error: testsError.message }

  // Test AVANT = le plus récent AVANT dateDebut
  const testsAvant = (tests ?? []).filter((t) => new Date(t.created_at) < dateDebut)
  const testAvant = testsAvant[testsAvant.length - 1] ?? null

  // Test APRÈS = le plus récent APRÈS dateDebut
  const testsApres = (tests ?? []).filter((t) => new Date(t.created_at) >= dateDebut)
  const testApres = testsApres[testsApres.length - 1] ?? null

  // 4. Charger les scores des deux tests + les labels des nœuds
  const testIds = [testAvant?.id, testApres?.id].filter(Boolean) as string[]
  if (testIds.length === 0) {
    // Pas de tests dans la période — retourner progression sans scores
    return {
      data: {
        programme_id:         programmeId,
        nom:                  programmes.nom,
        date_debut:           programmes.created_at,
        taux_global:          etapes.length > 0 ? Math.round((etapesCompletes / etapes.length) * 100) : 0,
        etapes_completes:     etapesCompletes,
        etapes_total:         etapes.length,
        scores:               [],
        adherence_par_semaine: adherenceParSemaine,
        test_avant_id:        null,
        test_apres_id:        null,
        test_avant_date:      null,
        test_apres_date:      null,
      },
      error: null,
    }
  }

  // Charger les scores de ces tests
  const { data: scoresRaw, error: scoresError } = await admin
    .from('test_scores')
    .select('test_id, node_id, score, percentile')
    .in('test_id', testIds)

  if (scoresError) return { data: null, error: scoresError.message }

  // Charger les labels des nœuds
  const nodeIds = [...new Set((scoresRaw ?? []).map((s) => s.node_id))]
  const { data: nodes, error: nodesError } = await admin
    .from('competency_tree')
    .select('id, label, depth')
    .in('id', nodeIds)
    .in('depth', [0, 1])  // domaines et sous-compétences seulement (pas les feuilles)

  if (nodesError) return { data: null, error: nodesError.message }

  // Indexer les scores par test_id + node_id
  const scoresMap = new Map<string, { score: number; percentile: number }>()
  ;(scoresRaw ?? []).forEach((s) => {
    scoresMap.set(`${s.test_id}|${s.node_id}`, { score: s.score, percentile: s.percentile ?? 50 })
  })

  // Construire les ScoreProgression
  const scores: ScoreProgression[] = (nodes ?? []).map((node) => {
    const avant = testAvant ? scoresMap.get(`${testAvant.id}|${node.id}`) : undefined
    const apres = testApres ? scoresMap.get(`${testApres.id}|${node.id}`) : undefined

    const deltaPercentile =
      avant && apres ? Math.round(apres.percentile - avant.percentile) : null

    return {
      node_id:         node.id,
      node_label:      node.label,
      depth:           node.depth,
      score_avant:     avant?.percentile ?? null,
      score_raw_avant: avant?.score ?? null,
      score_apres:     apres?.percentile ?? null,
      score_raw_apres: apres?.score ?? null,
      delta_percentile: deltaPercentile,
    }
  })

  return {
    data: {
      programme_id:          programmeId,
      nom:                   programmes.nom,
      date_debut:            programmes.created_at,
      taux_global:           etapes.length > 0 ? Math.round((etapesCompletes / etapes.length) * 100) : 0,
      etapes_completes:      etapesCompletes,
      etapes_total:          etapes.length,
      scores,
      adherence_par_semaine: adherenceParSemaine,
      test_avant_id:         testAvant?.id ?? null,
      test_apres_id:         testApres?.id ?? null,
      test_avant_date:       testAvant?.created_at ?? null,
      test_apres_date:       testApres?.created_at ?? null,
    },
    error: null,
  }
}
```

---

## Tâche 2 — Composant `ProgrammeProgressionDashboard` (coach)

Créer `src/components/coach/ProgrammeProgressionDashboard.tsx` :

Ce composant Client affiche les données de progression calculées par `getProgrammeProgressionAction`.
Il utilise shadcn/ui + Tailwind uniquement (pas de dépendance Recharts obligatoire — graphe CSS natif).

```tsx
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, Minus, BarChart3, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProgrammeProgressionData } from '@/app/actions/programmes'

interface ProgrammeProgressionDashboardProps {
  data: ProgrammeProgressionData
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return <Badge variant="outline" className="text-xs">N/A</Badge>
  if (delta > 0) return (
    <Badge className="bg-green-100 text-green-700 gap-1 text-xs">
      <TrendingUp className="h-3 w-3" />+{delta} pts
    </Badge>
  )
  if (delta < 0) return (
    <Badge className="bg-red-50 text-red-600 gap-1 text-xs">
      <TrendingDown className="h-3 w-3" />{delta} pts
    </Badge>
  )
  return (
    <Badge variant="outline" className="gap-1 text-xs">
      <Minus className="h-3 w-3" />stable
    </Badge>
  )
}

export function ProgrammeProgressionDashboard({ data }: ProgrammeProgressionDashboardProps) {
  // Filtrer aux domaines (depth 0) pour le résumé principal
  const domaines = data.scores.filter((s) => s.depth === 0)
  const topProgression = [...domaines].sort((a, b) => (b.delta_percentile ?? 0) - (a.delta_percentile ?? 0))[0]

  const hasScores = data.test_avant_id || data.test_apres_id
  const hasBothScores = data.test_avant_id && data.test_apres_id

  return (
    <div className="space-y-4">
      {/* KPIs en ligne */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-[#20808D]">{data.taux_global}%</p>
            <p className="text-xs text-muted-foreground mt-0.5">Complétion</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-[#1A1A2E]">
              {data.etapes_completes}/{data.etapes_total}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Étapes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold text-[#944454]">
              {topProgression?.delta_percentile !== null && topProgression?.delta_percentile !== undefined
                ? `+${topProgression.delta_percentile}`
                : '—'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Meilleure progression</p>
          </CardContent>
        </Card>
      </div>

      {/* Adhérence par semaine — graphe barres CSS */}
      {data.adherence_par_semaine.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[#20808D]" />
              Adhérence par semaine
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-end gap-2 h-24">
              {data.adherence_par_semaine.map((point) => (
                <div key={point.semaine} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-medium text-[#1A1A2E]">{point.taux}%</span>
                  <div
                    className="w-full rounded-t bg-[#20808D] transition-all"
                    style={{ height: `${Math.max(4, point.taux)}%` }}
                  />
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {point.semaine}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scores MINND — tableau avant/après */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Évolution des scores MINND</CardTitle>
          {!hasScores && (
            <p className="text-xs text-muted-foreground">
              Aucun test complété avant ou après le démarrage du programme.
            </p>
          )}
          {hasScores && !hasBothScores && (
            <p className="text-xs text-amber-600">
              Un seul test disponible — relancez un test pour voir l'évolution.
            </p>
          )}
          {hasBothScores && (
            <p className="text-xs text-muted-foreground">
              Test avant : {data.test_avant_date ? new Date(data.test_avant_date).toLocaleDateString('fr-FR') : '—'}
              {' · '}
              Test après : {data.test_apres_date ? new Date(data.test_apres_date).toLocaleDateString('fr-FR') : '—'}
            </p>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          {domaines.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">Aucune donnée de score disponible.</p>
          ) : (
            <div className="space-y-2">
              {domaines.map((score) => (
                <div key={score.node_id} className="flex items-center gap-3 py-1.5 border-b last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{score.node_label}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      <span>Avant : {score.score_avant !== null ? `${score.score_avant}e perc.` : '—'}</span>
                      <span>Après : {score.score_apres !== null ? `${score.score_apres}e perc.` : '—'}</span>
                    </div>
                    {/* Mini barre comparaison */}
                    {score.score_avant !== null && score.score_apres !== null && (
                      <div className="mt-1.5 relative h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="absolute top-0 left-0 h-full rounded-full bg-muted-foreground/30"
                          style={{ width: `${score.score_avant}%` }}
                        />
                        <div
                          className={cn(
                            'absolute top-0 left-0 h-full rounded-full transition-all',
                            (score.delta_percentile ?? 0) >= 0 ? 'bg-[#20808D]' : 'bg-[#944454]'
                          )}
                          style={{ width: `${score.score_apres}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <DeltaBadge delta={score.delta_percentile} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

---

## Tâche 3 — Intégration sur la fiche client coach

**Fichier :** `src/app/(dashboard)/coach/clients/[id]/page.tsx`

Ajouter un nouvel onglet "Progression" à la fiche client, visible seulement si un programme actif existe.

```tsx
// Import
import { getProgrammeProgressionAction } from '@/app/actions/programmes'
import { ProgrammeProgressionDashboard } from '@/components/coach/ProgrammeProgressionDashboard'

// Dans le fetch du Server Component (après avoir chargé les programmes) :
const progressionData = programmes?.[0]
  ? await getProgrammeProgressionAction(programmes[0].id, client.user_id)
  : { data: null, error: null }

// Dans la liste des tabs (si un programme actif existe) :
{programmes && programmes.length > 0 && (
  <TabsTrigger value="progression">Progression</TabsTrigger>
)}

// Nouveau TabsContent :
{programmes && programmes.length > 0 && (
  <TabsContent value="progression" className="space-y-4">
    <h3 className="text-sm font-semibold text-[#1A1A2E]">
      Progression — {programmes[0].nom}
    </h3>
    {progressionData.error && (
      <p className="text-sm text-red-600">{progressionData.error}</p>
    )}
    {progressionData.data && (
      <ProgrammeProgressionDashboard data={progressionData.data} />
    )}
  </TabsContent>
)}
```

---

## Tâche 4 — Génération PDF rapport de fin de programme

**Fichier :** `src/app/api/reports/programme/[programmeId]/route.ts` — CRÉER

Ce endpoint génère un PDF de rapport de fin de programme. Il suit le même pattern que
`src/app/api/reports/generate/[testId]/route.ts`.

### Structure du PDF (sections)

1. **En-tête** : Logo MINND, titre du programme, nom client, date d'impression
2. **Résumé** : taux de complétion, nombre d'étapes, période du programme
3. **Évolution par domaine** : tableau avant/après avec delta coloré (vert = amélioration)
4. **Détail des étapes** : liste ordonnée des séances avec statut (✓ Faite / ○ En attente)
5. **Message du coach** : texte libre saisi par le coach au moment de la génération
6. **Pied de page** : "Rapport généré par MINND — myminnd.com"

### Endpoint

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { ProgrammeReportPDF } from '@/components/pdf/ProgrammeReportPDF'

export async function GET(
  request: NextRequest,
  { params }: { params: { programmeId: string } }
) {
  const { programmeId } = params
  const coachMessage = request.nextUrl.searchParams.get('message') ?? ''

  const admin = createAdminClient()

  // Charger les données du programme
  const { data: programme } = await admin
    .from('programmes')
    .select('*, programme_etapes(*)')
    .eq('id', programmeId)
    .single()

  if (!programme) {
    return NextResponse.json({ error: 'Programme introuvable' }, { status: 404 })
  }

  // Charger les scores avant/après (réutiliser getProgrammeProgressionAction)
  // Note : ici on importe la logique de calcul, pas la server action directement
  // Pour simplifier : charger les tests et scores via admin client

  // Générer le PDF
  const pdfBuffer = await renderToBuffer(
    <ProgrammeReportPDF
      programme={programme}
      coachMessage={coachMessage}
    />
  )

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="rapport-programme-${programmeId}.pdf"`,
    },
  })
}
```

### Composant PDF

Créer `src/components/pdf/ProgrammeReportPDF.tsx` :

```tsx
import {
  Document, Page, Text, View, StyleSheet, Font,
} from '@react-pdf/renderer'
import type { ProgrammeAvecEtapes, ProgrammeProgressionData } from '@/types'

// Réutiliser les styles existants du rapport de test (couleurs MINND)
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    padding: 40,
    backgroundColor: '#FFFFFF',
    color: '#1A1A2E',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: '#20808D',
    paddingBottom: 12,
  },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#20808D' },
  subtitle: { fontSize: 11, color: '#666', marginTop: 4 },
  sectionTitle: {
    fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#20808D',
    marginTop: 20, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#E8F4F5',
    paddingBottom: 4,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  cell: { flex: 1 },
  cellRight: { flex: 1, textAlign: 'right' },
  green: { color: '#16A34A' },
  red: { color: '#DC2626' },
  muted: { color: '#6B7280', fontSize: 9 },
  etapeRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 5,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  coachMessage: {
    marginTop: 16, padding: 12, backgroundColor: '#E8F4F5',
    borderRadius: 4, fontSize: 10, lineHeight: 1.6,
  },
  footer: {
    position: 'absolute', bottom: 24, left: 40, right: 40,
    textAlign: 'center', fontSize: 8, color: '#9CA3AF',
  },
})

interface ProgrammeReportPDFProps {
  programme: ProgrammeAvecEtapes
  progression?: ProgrammeProgressionData | null
  coachMessage?: string
}

export function ProgrammeReportPDF({
  programme,
  progression,
  coachMessage,
}: ProgrammeReportPDFProps) {
  const dateImpr = new Date().toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  const tauxGlobal = progression?.taux_global ?? 0
  const domaines = (progression?.scores ?? []).filter((s) => s.depth === 0)

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* En-tête */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>MINND</Text>
            <Text style={styles.subtitle}>Rapport de programme</Text>
          </View>
          <View>
            <Text style={styles.muted}>Imprimé le {dateImpr}</Text>
          </View>
        </View>

        {/* Titre du programme */}
        <Text style={{ fontSize: 15, fontFamily: 'Helvetica-Bold', marginBottom: 4 }}>
          {programme.nom}
        </Text>
        {programme.description && (
          <Text style={styles.muted}>{programme.description}</Text>
        )}

        {/* Résumé complétion */}
        <Text style={styles.sectionTitle}>Résumé</Text>
        <View style={styles.row}>
          <Text>Complétion du programme</Text>
          <Text style={{ fontFamily: 'Helvetica-Bold', color: tauxGlobal >= 80 ? '#16A34A' : '#1A1A2E' }}>
            {tauxGlobal}%
          </Text>
        </View>
        <View style={styles.row}>
          <Text>Étapes réalisées</Text>
          <Text style={{ fontFamily: 'Helvetica-Bold' }}>
            {progression?.etapes_completes ?? '—'} / {progression?.etapes_total ?? '—'}
          </Text>
        </View>
        <View style={styles.row}>
          <Text>Démarré le</Text>
          <Text>{new Date(programme.created_at).toLocaleDateString('fr-FR')}</Text>
        </View>

        {/* Évolution des scores */}
        {domaines.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Évolution par domaine</Text>
            <View style={[styles.row, { fontFamily: 'Helvetica-Bold' }]}>
              <Text style={styles.cell}>Domaine</Text>
              <Text style={styles.cell}>Avant</Text>
              <Text style={styles.cell}>Après</Text>
              <Text style={styles.cellRight}>Évolution</Text>
            </View>
            {domaines.map((score) => (
              <View key={score.node_id} style={styles.row}>
                <Text style={styles.cell}>{score.node_label}</Text>
                <Text style={styles.cell}>
                  {score.score_avant !== null ? `${score.score_avant}e perc.` : '—'}
                </Text>
                <Text style={styles.cell}>
                  {score.score_apres !== null ? `${score.score_apres}e perc.` : '—'}
                </Text>
                <Text style={[
                  styles.cellRight,
                  { fontFamily: 'Helvetica-Bold' },
                  (score.delta_percentile ?? 0) > 0 ? styles.green : {},
                  (score.delta_percentile ?? 0) < 0 ? styles.red : {},
                ]}>
                  {score.delta_percentile !== null
                    ? `${score.delta_percentile > 0 ? '+' : ''}${score.delta_percentile} pts`
                    : '—'}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* Liste des étapes */}
        <Text style={styles.sectionTitle}>Détail des étapes</Text>
        {programme.etapes.map((etape) => (
          <View key={etape.id} style={styles.etapeRow}>
            <Text style={{ width: 16, color: etape.est_complete ? '#16A34A' : '#9CA3AF' }}>
              {etape.est_complete ? '✓' : '○'}
            </Text>
            <Text style={{ flex: 1 }}>{etape.ordre}. {etape.titre_display}</Text>
            <Text style={styles.muted}>
              {etape.type_seance === 'cabinet' ? 'Cabinet'
                : etape.type_seance === 'autonomie' ? 'Autonome'
                : 'Routine'}
            </Text>
          </View>
        ))}

        {/* Message du coach */}
        {coachMessage && (
          <>
            <Text style={styles.sectionTitle}>Message de votre coach</Text>
            <View style={styles.coachMessage}>
              <Text>{coachMessage}</Text>
            </View>
          </>
        )}

        {/* Pied de page */}
        <Text style={styles.footer}>
          Rapport généré par MINND — Performance Mentale
        </Text>

      </Page>
    </Document>
  )
}
```

---

## Tâche 5 — Bouton "Générer le rapport PDF" sur la fiche coach

**Fichier :** Ajouter dans l'onglet "Progression" de la fiche client coach.

```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { FileDown } from 'lucide-react'

interface ProgrammeReportButtonProps {
  programmeId: string
}

export function ProgrammeReportButton({ programmeId }: ProgrammeReportButtonProps) {
  const [message, setMessage] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  function handleDownload() {
    const url = `/api/reports/programme/${programmeId}?message=${encodeURIComponent(message)}`
    window.open(url, '_blank')
  }

  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="gap-2"
      >
        <FileDown className="h-4 w-4" />
        Générer le rapport PDF
      </Button>

      {isOpen && (
        <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
          <div className="space-y-1.5">
            <Label htmlFor="coach-msg">Message pour le client (optionnel)</Label>
            <Textarea
              id="coach-msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Félicitations pour ce programme ! Voici mes observations…"
              rows={3}
            />
          </div>
          <Button
            size="sm"
            onClick={handleDownload}
            className="bg-[#20808D] hover:bg-[#1a6b77] text-white gap-2"
          >
            <FileDown className="h-4 w-4" />
            Télécharger le PDF
          </Button>
        </div>
      )}
    </div>
  )
}
```

---

## Résumé des fichiers à créer / modifier

| Fichier | Action |
|---------|--------|
| `src/app/actions/programmes.ts` | MODIFIER (ajouter `getProgrammeProgressionAction` + types) |
| `src/types/index.ts` | MODIFIER (ajouter `ScoreProgression`, `AdherencePoint`, `ProgrammeProgressionData`) |
| `src/components/coach/ProgrammeProgressionDashboard.tsx` | CRÉER |
| `src/components/coach/ProgrammeReportButton.tsx` | CRÉER |
| `src/app/api/reports/programme/[programmeId]/route.ts` | CRÉER |
| `src/components/pdf/ProgrammeReportPDF.tsx` | CRÉER |
| `src/app/(dashboard)/coach/clients/[id]/page.tsx` | MODIFIER (nouvel onglet Progression) |

---

## Critères d'acceptation

- [ ] Sur la fiche client coach, un onglet "Progression" apparaît si un programme actif existe
- [ ] Le taux de complétion global est affiché en gros
- [ ] Le graphe d'adhérence par semaine s'affiche avec des barres proportionnelles
- [ ] Si deux tests sont disponibles (avant/après programme), l'évolution par domaine s'affiche
- [ ] Les scores en progression sont affichés en vert, en régression en rouge
- [ ] Si aucun test n'est disponible, un message informatif s'affiche (pas d'erreur)
- [ ] Le PDF se génère et s'ouvre dans un nouvel onglet
- [ ] Le PDF contient : résumé, évolution des scores, liste des étapes, message coach
- [ ] Le calcul "test avant" = test le plus récent AVANT la date de création du programme
- [ ] Le calcul "test après" = test le plus récent APRÈS la date de création du programme
- [ ] Pas de `any` TypeScript
- [ ] shadcn/ui uniquement pour les composants UI (pas Recharts — graphe CSS natif)

---

## Contraintes globales (CLAUDE.md)

- `NEVER` utiliser `any` en TypeScript
- `NEVER` silent catch — toujours gérer les erreurs explicitement
- Valider les inputs avec Zod dans les server actions
- shadcn/ui pour tous les composants UI
- Commentaires logique métier en **français**, code technique en **anglais**
- `NEVER` mélanger Prisma et Supabase dans un même module
- Le graphe utilise CSS/Tailwind natif — pas de dépendance Recharts à installer
