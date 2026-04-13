import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getProfileIntelligenceData } from '@/app/actions/profile-intelligence'
import { ProfileIdentityCard } from '@/components/profile-intelligence/ProfileIdentityCard'
import { TripleRadarChart } from '@/components/profile-intelligence/TripleRadarChart'
import { ZScoreForcesFaiblesses } from '@/components/profile-intelligence/ZScoreForcesFaiblesses'
import { EliteMarkersComparison } from '@/components/profile-intelligence/EliteMarkersComparison'
import { PredictorCard } from '@/components/profile-intelligence/PredictorCard'
import { ConditionalInsightCard } from '@/components/profile-intelligence/ConditionalInsightCard'
import { CoachGuidePanel } from '@/components/profile-intelligence/CoachGuidePanel'
import { SubcompetenceDetailList } from '@/components/profile-intelligence/SubcompetenceDetailList'
import { ProfileCompatibilityMini } from '@/components/profile-intelligence/ProfileCompatibilityMini'

interface ProfileIntelligenceTabProps {
  lastTestId: string | null
  levelSlug: string | null
  hasProfile?: boolean
}

export async function ProfileIntelligenceTab({
  lastTestId,
  levelSlug,
  hasProfile = false,
}: ProfileIntelligenceTabProps) {
  // Niveau Discovery, pas de test, ou profil non encore calculé
  if (!lastTestId || levelSlug === 'discovery' || !hasProfile) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-sm font-medium text-[#141325] mb-1">
            Profil Intelligence non disponible
          </p>
          <p className="text-xs text-muted-foreground">
            {!lastTestId
              ? 'Aucun test complété pour ce client.'
              : !hasProfile
              ? 'Profil mental non encore calculé pour ce test. Relancez le scoring ou invitez le client à repasser un test Complete.'
              : 'Disponible à partir du niveau Complete (PMA Level 2).'}
          </p>
        </CardContent>
      </Card>
    )
  }

  const data = await getProfileIntelligenceData(lastTestId)

  if (!data) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground text-sm">
          Impossible de charger les données d&apos;intelligence profil.
        </CardContent>
      </Card>
    )
  }

  const {
    profile,
    globalScore,
    globalPercentile,
    leafZScores,
    domainScores,
    centroidDomainScores,
    globalAverageDomainScores,
    eliteMarkers,
    globalPredictors,
    scoresByLevel,
    nonDiscriminantSubs,
    activeInsights,
    teammates,
  } = data

  // Map slug → score pour EliteMarkersComparison
  const scoresBySlug = Object.fromEntries(
    leafZScores.map((l) => [l.sub_slug, l.score])
  )

  // Top prédicteurs (Flow + Confiance en soi)
  const topPredictors = globalPredictors.slice(0, 2)

  // Cercle vertueux actif ?
  const flowScore = scoresBySlug['flow'] ?? 0
  const confianceScore = scoresBySlug['confiance_en_soi'] ?? 0
  const cerclVirtueux = flowScore > 7 && confianceScore > 7

  // Map parentId pour SubcompetenceDetailList
  // On reconstruit la map depuis domainScores (on n'a pas parent_id directement ici)
  // On utilise leafZScores avec le nodeParentMap vide — la liste sera quand même rendue
  // Note : nodeParentMap est construit dans la server action — on passe les domaines avec leurs feuilles
  // Pour l'affichage, on passe domainScores comme domainNodes
  const domainNodes = domainScores.map((d) => ({ id: d.nodeId, name: d.name, score: d.score }))

  // Reconstruit nodeParentMap depuis les parentId des leafZScores
  const nodeParentMap: Record<string, string> = Object.fromEntries(
    leafZScores
      .filter((l) => l.parentId !== null)
      .map((l) => [l.nodeId, l.parentId as string])
  )

  return (
    <div className="space-y-6">
      {/* Section 1 : Identité du profil */}
      <ProfileIdentityCard
        profile={profile}
        globalPercentile={globalPercentile}
      />

      {/* Section 2 : KPI Row — 4 cartes */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Score global</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[#7069F4]">{globalScore.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">/10 · {globalPercentile}e percentile</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Positionnement</CardTitle>
          </CardHeader>
          <CardContent>
            {scoresByLevel.length > 0 ? (() => {
              const closest = scoresByLevel.reduce((prev, curr) =>
                Math.abs(curr.score - globalScore) < Math.abs(prev.score - globalScore) ? curr : prev
              )
              return (
                <>
                  <p className="text-sm font-semibold text-[#141325]">{closest.level}</p>
                  <p className="text-xs text-muted-foreground">Niveau le plus proche ({closest.score})</p>
                </>
              )
            })() : <p className="text-sm text-muted-foreground">—</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Point fort</CardTitle>
          </CardHeader>
          <CardContent>
            {leafZScores.length > 0 ? (() => {
              const top = [...leafZScores].sort((a, b) => b.z - a.z)[0]
              return (
                <>
                  <p className="text-xs font-semibold text-[#141325] leading-tight">{top.name}</p>
                  <p className="text-xs text-green-600 mt-0.5">z=+{top.z.toFixed(2)}</p>
                </>
              )
            })() : <p className="text-sm text-muted-foreground">—</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs text-muted-foreground">Axe prioritaire</CardTitle>
          </CardHeader>
          <CardContent>
            {leafZScores.length > 0 ? (() => {
              const bottom = [...leafZScores].sort((a, b) => a.z - b.z)[0]
              return (
                <>
                  <p className="text-xs font-semibold text-[#141325] leading-tight">{bottom.name}</p>
                  <p className="text-xs text-orange-600 mt-0.5">z={bottom.z.toFixed(2)}</p>
                </>
              )
            })() : <p className="text-sm text-muted-foreground">—</p>}
          </CardContent>
        </Card>
      </div>

      {/* Section 3 : Radar triple */}
      {domainScores.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Radar comparatif</CardTitle>
          </CardHeader>
          <CardContent>
            <TripleRadarChart
              clientScores={domainScores.map((d) => ({ subject: d.name, value: d.score }))}
              centroidScores={centroidDomainScores.map((d) => ({ subject: d.name, value: d.score }))}
              globalAverages={globalAverageDomainScores.map((d) => ({ subject: d.name, value: d.score }))}
              profileName={profile.name}
              profileColor={profile.color}
              height={320}
            />
          </CardContent>
        </Card>
      )}

      {/* Section 4 : Forces et faiblesses z-scores */}
      <div>
        <h3 className="text-sm font-semibold text-[#141325] mb-3">Forces et axes de travail</h3>
        <ZScoreForcesFaiblesses
          leafZScores={leafZScores}
          profileForces={profile.forces_details}
          profileFaiblesses={profile.faiblesses_details}
        />
      </div>

      {/* Section 5 : Marqueurs élite */}
      {eliteMarkers.length > 0 && (
        <EliteMarkersComparison
          eliteMarkers={eliteMarkers}
          scoresBySlug={scoresBySlug}
          scoresByLevel={scoresByLevel}
        />
      )}

      {/* Section 6 : Prédicteurs de performance */}
      {topPredictors.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[#141325] mb-3">Prédicteurs de performance</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {topPredictors.map((pred) => (
              <PredictorCard
                key={pred.sub_slug}
                label={pred.label}
                r={pred.r}
                clientScore={scoresBySlug[pred.sub_slug] ?? 0}
                sub_slug={pred.sub_slug}
              />
            ))}
          </div>
          {cerclVirtueux && (
            <div className="mt-3 rounded-lg border-l-4 border-[#7069F4] bg-[#F1F0FE] px-4 py-3">
              <p className="text-sm font-semibold text-[#7069F4]">✓ Cercle vertueux Confiance-Flow actif</p>
              <p className="text-xs text-[#141325]/80 mt-0.5">
                La confiance et le flow se renforcent mutuellement (r=0.532). Principal avantage compétitif.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Section 7 : Insights conditionnels */}
      {activeInsights.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[#141325] mb-3">Insights personnalisés</h3>
          <div className="space-y-2">
            {activeInsights.slice(0, 4).map((insight) => (
              <ConditionalInsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        </div>
      )}

      {/* Section 8 : Guide Coach — réservé coach */}
      <CoachGuidePanel profile={profile} />

      {/* Section 9 : Compatibilité d'équipe */}
      {teammates.length > 0 && (
        <ProfileCompatibilityMini teammates={teammates} />
      )}

      {/* Section 10 : Détail des 31 sous-compétences */}
      {leafZScores.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Détail des sous-compétences</CardTitle>
          </CardHeader>
          <CardContent>
            <SubcompetenceDetailList
              leafZScores={leafZScores}
              domainNodes={domainNodes}
              nodeParentMap={nodeParentMap}
              nonDiscriminantSubs={nonDiscriminantSubs}
              showZScores={true}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
