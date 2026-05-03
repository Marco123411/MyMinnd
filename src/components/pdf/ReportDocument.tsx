import {
  Document,
  Page,
  View,
  Text,
  Canvas,
  StyleSheet,
} from '@react-pdf/renderer'
import type { MentalProfile } from '@/types'

// ── MINND design tokens ───────────────────────────────────────
const TEAL = '#7069F4'
const MAUVE = '#3C3CD6'
const DARK = '#141325'
const LIGHT_TEAL = '#F1F0FE'
const GRAY = '#64748b'
const BORDER = '#e2e8f0'

// ── Types ─────────────────────────────────────────────────────
export interface ScoreEntry {
  entity_type: string
  entity_id: string | null
  score: number
  percentile: number | null
}

export interface NodeEntry {
  id: string
  parent_id: string | null
  name: string
  depth: number
  is_leaf: boolean
  order_index: number
}

export interface ReportData {
  test: {
    id: string
    score_global: number | null
    completed_at: string
    definition_name: string
  }
  client: {
    nom: string
    prenom: string | null
    context: string | null
  }
  nodes: NodeEntry[]
  scores: ScoreEntry[]
  profile: MentalProfile | null
  globalPercentile: number | null
  previousTest?: {
    completed_at: string
    score_global: number | null
    scores: ScoreEntry[]
  }
}

// PDFKit-compatible painter interface (subset needed for radar drawing)
// Note: closePath() n'est pas disponible dans react-pdf v4 — fermer le polygone avec lineTo()
interface PDFPainter {
  moveTo: (x: number, y: number) => PDFPainter
  lineTo: (x: number, y: number) => PDFPainter
  stroke: (color: string) => PDFPainter
  fill: (color: string) => PDFPainter
  fillAndStroke: (fillColor: string, strokeColor: string) => PDFPainter
}

// ── Helpers ───────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function percentileColor(p: number | null): string {
  if (p === null) return GRAY
  if (p < 25) return '#ef4444'
  if (p < 50) return '#f97316'
  if (p < 75) return '#22c55e'
  return TEAL
}

function getScore(scores: ScoreEntry[], id: string): number {
  return scores.find((s) => s.entity_id === id)?.score ?? 0
}

function getPercentile(scores: ScoreEntry[], id: string): number | null {
  return scores.find((s) => s.entity_id === id)?.percentile ?? null
}

function clientFullName(client: ReportData['client']): string {
  return [client.prenom, client.nom].filter(Boolean).join(' ')
}

// ── Styles ────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    padding: 40,
    backgroundColor: '#ffffff',
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: DARK,
  },
  pageHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  pageHeaderText: { fontSize: 8, color: GRAY },
  h2: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: DARK, marginBottom: 14 },
  h3: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: DARK, marginBottom: 6 },
  body: { fontSize: 10, color: '#334155', lineHeight: 1.6 },
  small: { fontSize: 8, color: GRAY },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingVertical: 5,
    alignItems: 'center',
  },
  leafName: { fontSize: 9, color: DARK, width: 150 },
  leafScore: { fontSize: 9, color: DARK, width: 32, textAlign: 'right' },
  leafPct: { fontSize: 8, color: GRAY, width: 38, textAlign: 'right' },
})

// ── Shared page header ────────────────────────────────────────
function PageHeader({ testName, clientName }: { testName: string; clientName: string }) {
  return (
    <View style={s.pageHeaderRow} fixed>
      <Text style={s.pageHeaderText}>
        MINND Mental Performance — {testName} — {clientName}
      </Text>
      <Text
        style={s.pageHeaderText}
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  )
}

// ── Page 1: Cover ─────────────────────────────────────────────
function CoverPage({ data }: { data: ReportData }) {
  const levelLabel = 'Profil mental'
  const contextMap: Record<string, string> = {
    sport: 'Sport',
    corporate: 'Corporate',
    wellbeing: 'Bien-être',
    coaching: 'Coaching',
  }

  return (
    <Page size="A4" style={[s.page, { justifyContent: 'center', alignItems: 'center' }]}>
      {/* Wordmark */}
      <View style={{ marginBottom: 36, alignItems: 'center' }}>
        <Text
          style={{
            fontSize: 30,
            fontFamily: 'Helvetica-Bold',
            color: TEAL,
            letterSpacing: 3,
          }}
        >
          MINND
        </Text>
        <Text style={{ fontSize: 10, color: GRAY, marginTop: 3, letterSpacing: 4 }}>
          MENTAL PERFORMANCE
        </Text>
      </View>

      {/* Test name */}
      <Text
        style={{
          fontSize: 22,
          fontFamily: 'Helvetica-Bold',
          color: DARK,
          textAlign: 'center',
          marginBottom: 6,
        }}
      >
        {data.test.definition_name}
      </Text>

      {/* Level */}
      <View
        style={{
          paddingHorizontal: 12,
          paddingVertical: 4,
          borderRadius: 12,
          backgroundColor: LIGHT_TEAL,
          marginBottom: 30,
          alignSelf: 'center',
        }}
      >
        <Text style={{ fontSize: 9, color: TEAL, fontFamily: 'Helvetica-Bold' }}>
          {levelLabel}
        </Text>
      </View>

      {/* Divider */}
      <View
        style={{ width: 50, height: 2, backgroundColor: TEAL, marginBottom: 30, alignSelf: 'center' }}
      />

      {/* Client */}
      <Text
        style={{
          fontSize: 20,
          fontFamily: 'Helvetica-Bold',
          color: DARK,
          textAlign: 'center',
          marginBottom: 4,
        }}
      >
        {clientFullName(data.client)}
      </Text>
      {data.client.context && (
        <Text style={[s.small, { textAlign: 'center', marginBottom: 4 }]}>
          {contextMap[data.client.context] ?? data.client.context}
        </Text>
      )}
      <Text style={[s.small, { textAlign: 'center', marginBottom: 24 }]}>
        {formatDate(data.test.completed_at)}
      </Text>

      {/* Profile badge */}
      {data.profile && (
        <View
          style={{
            borderWidth: 2,
            borderColor: data.profile.color ?? TEAL,
            borderRadius: 8,
            paddingHorizontal: 20,
            paddingVertical: 10,
            alignSelf: 'center',
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontFamily: 'Helvetica-Bold',
              color: data.profile.color ?? TEAL,
              textAlign: 'center',
            }}
          >
            {data.profile.name}
          </Text>
          {data.profile.family && (
            <Text style={[s.small, { textAlign: 'center', marginTop: 2 }]}>
              {data.profile.family}
            </Text>
          )}
        </View>
      )}

      {/* Footer */}
      <Text
        style={{
          fontSize: 8,
          color: GRAY,
          position: 'absolute',
          bottom: 32,
          left: 0,
          right: 0,
          textAlign: 'center',
        }}
      >
        MINND Mental Performance — Confidentiel
      </Text>
    </Page>
  )
}

// ── Page 2: Score overview + radar ───────────────────────────
function ScoreOverviewPage({ data }: { data: ReportData }) {
  const domainNodes = data.nodes
    .filter((n) => n.depth === 0)
    .sort((a, b) => a.order_index - b.order_index)
  const name = clientFullName(data.client)

  return (
    <Page size="A4" style={s.page}>
      <PageHeader testName={data.test.definition_name} clientName={name} />
      <Text style={s.h2}>Vue d'ensemble des scores</Text>

      {/* Global score */}
      {data.test.score_global !== null && (
        <View style={{ alignItems: 'center', marginBottom: 18 }}>
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: LIGHT_TEAL,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                fontSize: 34,
                fontFamily: 'Helvetica-Bold',
                color: TEAL,
                textAlign: 'center',
              }}
            >
              {data.test.score_global.toFixed(1)}
            </Text>
            <Text style={[s.small, { textAlign: 'center', marginTop: -2 }]}>/10</Text>
          </View>
          <Text style={[s.small, { textAlign: 'center', marginTop: 4 }]}>Score global</Text>
          {data.globalPercentile !== null && (
            <Text style={[s.small, { textAlign: 'center' }]}>
              {data.globalPercentile}e percentile
            </Text>
          )}
        </View>
      )}

      {/* Radar canvas — drawn as polygon */}
      {domainNodes.length >= 3 && (
        <View style={{ alignItems: 'center', marginBottom: 16 }}>
          <Canvas
            style={{ width: 260, height: 200 }}
            paint={(painterCtx, w, h) => {
              const painter = painterCtx as unknown as PDFPainter
              const cx = w / 2
              const cy = h / 2
              const r = Math.min(w, h) / 2 - 18
              const n = domainNodes.length

              const toXY = (idx: number, val: number) => {
                const angle = (idx * 2 * Math.PI) / n - Math.PI / 2
                return {
                  x: cx + val * r * Math.cos(angle),
                  y: cy + val * r * Math.sin(angle),
                }
              }

              // Grid rings (polygon-shaped for clarity)
              for (let ring = 1; ring <= 5; ring++) {
                const frac = ring / 5
                for (let i = 0; i < n; i++) {
                  const { x: x1, y: y1 } = toXY(i, frac)
                  const { x: x2, y: y2 } = toXY((i + 1) % n, frac)
                  painter.moveTo(x1, y1).lineTo(x2, y2).stroke('#e2e8f0')
                }
              }

              // Axes
              domainNodes.forEach((_, i) => {
                const { x, y } = toXY(i, 1)
                painter.moveTo(cx, cy).lineTo(x, y).stroke('#e2e8f0')
              })

              // Data polygon — filled (closePath not available in react-pdf v4, close manually)
              const firstScore = getScore(data.scores, domainNodes[0].id) / 10
              const { x: x0, y: y0 } = toXY(0, firstScore)
              domainNodes.forEach((d, i) => {
                const score = getScore(data.scores, d.id) / 10
                const { x, y } = toXY(i, score)
                if (i === 0) painter.moveTo(x, y)
                else painter.lineTo(x, y)
              })
              painter.lineTo(x0, y0).fillAndStroke(LIGHT_TEAL, TEAL)
              return null
            }}
          />
        </View>
      )}

      {/* Domain table */}
      <View>
        <View style={[s.tableRow, { backgroundColor: LIGHT_TEAL }]}>
          <Text style={{ flex: 2, fontSize: 9, fontFamily: 'Helvetica-Bold' }}>Domaine</Text>
          <Text style={{ flex: 1, fontSize: 9, fontFamily: 'Helvetica-Bold', textAlign: 'right' }}>Score</Text>
          <Text style={{ flex: 1, fontSize: 9, fontFamily: 'Helvetica-Bold', textAlign: 'right' }}>Percentile</Text>
        </View>
        {domainNodes.map((d) => {
          const pct = getPercentile(data.scores, d.id)
          return (
            <View key={d.id} style={s.tableRow}>
              <Text style={{ flex: 2, fontSize: 9 }}>{d.name}</Text>
              <Text
                style={{
                  flex: 1,
                  fontSize: 9,
                  color: TEAL,
                  fontFamily: 'Helvetica-Bold',
                  textAlign: 'right',
                }}
              >
                {getScore(data.scores, d.id).toFixed(1)}/10
              </Text>
              <Text
                style={{
                  flex: 1,
                  fontSize: 9,
                  color: pct !== null ? percentileColor(pct) : GRAY,
                  textAlign: 'right',
                }}
              >
                {pct !== null ? `${pct}e` : '—'}
              </Text>
            </View>
          )
        })}
      </View>
    </Page>
  )
}

// ── Page 3: Sub-competencies ──────────────────────────────────
function SubCompetenciesPage({ data }: { data: ReportData }) {
  const domainNodes = data.nodes
    .filter((n) => n.depth === 0)
    .sort((a, b) => a.order_index - b.order_index)
  const name = clientFullName(data.client)

  return (
    <Page size="A4" style={s.page}>
      <PageHeader testName={data.test.definition_name} clientName={name} />
      <Text style={s.h2}>Détail des sous-compétences</Text>

      {domainNodes.map((domain) => {
        const leaves = data.nodes
          .filter((n) => n.is_leaf && n.parent_id === domain.id)
          .sort((a, b) => a.order_index - b.order_index)

        return (
          <View key={domain.id} style={{ marginBottom: 14 }} wrap={false}>
            <View
              style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}
            >
              <Text style={s.h3}>{domain.name}</Text>
              <Text
                style={{ fontSize: 10, color: TEAL, fontFamily: 'Helvetica-Bold' }}
              >
                {getScore(data.scores, domain.id).toFixed(1)}/10
              </Text>
            </View>

            {leaves.map((leaf) => {
              const score = getScore(data.scores, leaf.id)
              const pct = getPercentile(data.scores, leaf.id)
              const barColor = percentileColor(pct)
              const barWidthPct = `${(score / 10) * 100}%`

              return (
                <View
                  key={leaf.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginBottom: 5,
                  }}
                >
                  <Text style={s.leafName}>{leaf.name}</Text>
                  {/* Bar track */}
                  <View
                    style={{
                      flex: 1,
                      height: 7,
                      backgroundColor: BORDER,
                      borderRadius: 4,
                      marginHorizontal: 8,
                    }}
                  >
                    <View
                      style={{
                        height: 7,
                        width: barWidthPct,
                        backgroundColor: barColor,
                        borderRadius: 4,
                      }}
                    />
                  </View>
                  <Text style={s.leafScore}>{score.toFixed(1)}</Text>
                  <Text style={s.leafPct}>
                    {pct !== null ? `${pct}e` : ''}
                  </Text>
                </View>
              )
            })}
          </View>
        )
      })}

      {/* Percentile legend */}
      <View style={{ flexDirection: 'row', marginTop: 10 }}>
        {(
          [
            { color: '#ef4444', label: '< 25e' },
            { color: '#f97316', label: '25–50e' },
            { color: '#22c55e', label: '50–75e' },
            { color: TEAL, label: '> 75e' },
          ] as const
        ).map((l) => (
          <View
            key={l.label}
            style={{ flexDirection: 'row', alignItems: 'center', marginRight: 14 }}
          >
            <View
              style={{
                width: 9,
                height: 9,
                backgroundColor: l.color,
                borderRadius: 2,
                marginRight: 4,
              }}
            />
            <Text style={s.small}>{l.label}</Text>
          </View>
        ))}
      </View>
    </Page>
  )
}

// ── Page 4: Mental profile ────────────────────────────────────
function ProfilePage({ data }: { data: ReportData }) {
  const profile = data.profile!
  const name = clientFullName(data.client)

  return (
    <Page size="A4" style={s.page}>
      <PageHeader testName={data.test.definition_name} clientName={name} />
      <Text style={s.h2}>Profil mental</Text>

      {/* Profile card */}
      <View
        style={{
          borderWidth: 2,
          borderColor: profile.color ?? TEAL,
          borderRadius: 8,
          padding: 18,
          marginBottom: 18,
        }}
      >
        {profile.family && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
            <View
              style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: profile.color ?? TEAL,
                marginRight: 6,
              }}
            />
            <Text style={{ fontSize: 9, color: profile.color ?? TEAL }}>
              {profile.family}
            </Text>
          </View>
        )}
        <Text
          style={{
            fontSize: 22,
            fontFamily: 'Helvetica-Bold',
            color: profile.color ?? TEAL,
            marginBottom: 8,
          }}
        >
          {profile.name}
        </Text>

        <View style={{ flexDirection: 'row', marginBottom: 10 }}>
          {profile.population_pct !== null && (
            <Text style={[s.small, { marginRight: 16 }]}>
              {profile.population_pct.toFixed(0)}% de la population
            </Text>
          )}
          {profile.avg_score !== null && (
            <Text style={s.small}>Score moyen : {profile.avg_score.toFixed(1)}/10</Text>
          )}
        </View>

        {profile.description && (
          <Text style={s.body}>{profile.description}</Text>
        )}
      </View>

      {/* Strengths & Weaknesses */}
      <View style={{ flexDirection: 'row' }}>
        {profile.strengths && (
          <View
            style={{
              flex: 1,
              backgroundColor: '#f0fdf4',
              borderRadius: 6,
              padding: 12,
              marginRight: 8,
            }}
          >
            <Text style={[s.h3, { color: '#16a34a' }]}>Points forts</Text>
            <Text style={s.body}>{profile.strengths}</Text>
          </View>
        )}
        {profile.weaknesses && (
          <View
            style={{
              flex: 1,
              backgroundColor: '#fff1f2',
              borderRadius: 6,
              padding: 12,
              marginLeft: profile.strengths ? 8 : 0,
            }}
          >
            <Text style={[s.h3, { color: MAUVE }]}>Axes de developpement</Text>
            <Text style={s.body}>{profile.weaknesses}</Text>
          </View>
        )}
      </View>
    </Page>
  )
}

// ── Page 5: Forces & axes d'amélioration ─────────────────────
function ForceWeaknessPage({ data }: { data: ReportData }) {
  const leafScores = data.nodes
    .filter((n) => n.is_leaf)
    .map((n) => ({ name: n.name, score: getScore(data.scores, n.id) }))
    .sort((a, b) => b.score - a.score)

  const top5 = leafScores.slice(0, 5)
  // slice(-5) sur un tableau décroissant → 5 scores les plus bas, du moins faible au plus faible
  // Pas de .reverse() : on veut afficher du plus faible au moins faible pour mettre en évidence la priorité
  const bottom5 = leafScores.slice(-5)
  const name = clientFullName(data.client)

  return (
    <Page size="A4" style={s.page}>
      <PageHeader testName={data.test.definition_name} clientName={name} />
      <Text style={s.h2}>Forces et axes d'amelioration</Text>

      <View style={{ flexDirection: 'row' }}>
        {/* Top 5 */}
        <View style={{ flex: 1, marginRight: 16 }}>
          <Text style={[s.h3, { color: TEAL }]}>Top 5 forces</Text>
          {top5.map((l, i) => (
            <View key={l.name} style={[s.tableRow, { paddingVertical: 7 }]}>
              <Text
                style={{ width: 18, fontSize: 9, color: TEAL, fontFamily: 'Helvetica-Bold' }}
              >
                {i + 1}.
              </Text>
              <Text style={{ flex: 1, fontSize: 9 }}>{l.name}</Text>
              <Text
                style={{ fontSize: 9, color: TEAL, fontFamily: 'Helvetica-Bold' }}
              >
                {l.score.toFixed(1)}
              </Text>
            </View>
          ))}
        </View>

        {/* Bottom 5 */}
        <View style={{ flex: 1 }}>
          <Text style={[s.h3, { color: MAUVE }]}>Top 5 a developper</Text>
          {bottom5.map((l, i) => (
            <View key={l.name} style={[s.tableRow, { paddingVertical: 7 }]}>
              <Text
                style={{ width: 18, fontSize: 9, color: MAUVE, fontFamily: 'Helvetica-Bold' }}
              >
                {i + 1}.
              </Text>
              <Text style={{ flex: 1, fontSize: 9 }}>{l.name}</Text>
              <Text
                style={{ fontSize: 9, color: MAUVE, fontFamily: 'Helvetica-Bold' }}
              >
                {l.score.toFixed(1)}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Page>
  )
}

// ── Page 6: Recommendations ───────────────────────────────────
function RecommendationsPage({ data }: { data: ReportData }) {
  const profile = data.profile!
  const name = clientFullName(data.client)

  const recommendations =
    profile.recommendations ??
    `Sur la base de votre profil ${profile.name}, nous vous recommandons de travailler en priorite sur vos axes d'amelioration identifies dans ce rapport. Un accompagnement par votre coach vous permettra de progresser efficacement.`

  return (
    <Page size="A4" style={s.page}>
      <PageHeader testName={data.test.definition_name} clientName={name} />
      <Text style={s.h2}>Recommandations</Text>

      <Text style={s.body}>{recommendations}</Text>

      <Text
        style={{
          fontSize: 8,
          color: GRAY,
          position: 'absolute',
          bottom: 32,
          left: 40,
          right: 40,
          textAlign: 'center',
        }}
      >
        Ce rapport a ete genere automatiquement par MINND Mental Performance.
      </Text>
    </Page>
  )
}

// ── Page 7 (opt.): Longitudinal T1/T2 ────────────────────────
function LongitudinalPage({ data }: { data: ReportData }) {
  const prev = data.previousTest!
  const deltaGlobal =
    data.test.score_global !== null && prev.score_global !== null
      ? data.test.score_global - prev.score_global
      : null

  const leafDeltas = data.nodes
    .filter((n) => n.is_leaf)
    .map((n) => ({
      name: n.name,
      delta: getScore(data.scores, n.id) - getScore(prev.scores, n.id),
    }))
    .sort((a, b) => b.delta - a.delta)

  const top3 = leafDeltas.filter((d) => d.delta > 0).slice(0, 3)
  // Pas de .reverse() : leafDeltas est trié décroissant → les négatifs en fin de tableau sont déjà du moins négatif au plus négatif
  // slice(-3) récupère les 3 plus grosses régressions, dans l'ordre voulu (la pire en dernier)
  const bottom3 = leafDeltas.filter((d) => d.delta < 0).slice(-3)
  const name = clientFullName(data.client)

  return (
    <Page size="A4" style={s.page}>
      <PageHeader testName={data.test.definition_name} clientName={name} />
      <Text style={s.h2}>Suivi longitudinal</Text>

      <View style={{ flexDirection: 'row', marginBottom: 16 }}>
        <Text style={[s.small, { marginRight: 16 }]}>T1 : {formatDate(prev.completed_at)}</Text>
        <Text style={s.small}>T2 : {formatDate(data.test.completed_at)}</Text>
      </View>

      {deltaGlobal !== null && (
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <Text
            style={{
              fontSize: 32,
              fontFamily: 'Helvetica-Bold',
              color: deltaGlobal >= 0 ? '#16a34a' : '#dc2626',
              textAlign: 'center',
            }}
          >
            {deltaGlobal >= 0 ? '+' : ''}
            {deltaGlobal.toFixed(2)}
          </Text>
          <Text style={[s.small, { textAlign: 'center' }]}>evolution du score global</Text>
        </View>
      )}

      <View style={{ flexDirection: 'row' }}>
        {top3.length > 0 && (
          <View style={{ flex: 1, marginRight: 16 }}>
            <Text style={[s.h3, { color: '#16a34a' }]}>Top progressions</Text>
            {top3.map((d) => (
              <View key={d.name} style={[s.tableRow, { paddingVertical: 7 }]}>
                <Text style={{ flex: 1, fontSize: 9 }}>{d.name}</Text>
                <Text
                  style={{ fontSize: 9, color: '#16a34a', fontFamily: 'Helvetica-Bold' }}
                >
                  +{d.delta.toFixed(1)}
                </Text>
              </View>
            ))}
          </View>
        )}
        {bottom3.length > 0 && (
          <View style={{ flex: 1 }}>
            <Text style={[s.h3, { color: '#dc2626' }]}>Points de vigilance</Text>
            {bottom3.map((d) => (
              <View key={d.name} style={[s.tableRow, { paddingVertical: 7 }]}>
                <Text style={{ flex: 1, fontSize: 9 }}>{d.name}</Text>
                <Text
                  style={{ fontSize: 9, color: '#dc2626', fontFamily: 'Helvetica-Bold' }}
                >
                  {d.delta.toFixed(1)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </Page>
  )
}

// ── Main export ───────────────────────────────────────────────
export function ReportDocument({ data }: { data: ReportData }) {
  return (
    <Document>
      <CoverPage data={data} />
      <ScoreOverviewPage data={data} />
      <SubCompetenciesPage data={data} />
      {data.profile && <ProfilePage data={data} />}
      <ForceWeaknessPage data={data} />
      {data.profile && <RecommendationsPage data={data} />}
      {data.previousTest && <LongitudinalPage data={data} />}
    </Document>
  )
}
