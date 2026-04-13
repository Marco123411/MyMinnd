'use client'

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts'

interface DataPoint {
  subject: string
  value: number
}

interface TripleRadarChartProps {
  clientScores: DataPoint[]
  centroidScores: DataPoint[]
  globalAverages: DataPoint[]
  profileName: string
  profileColor: string
  height?: number
}

// Fusionne les 3 séries en un tableau unifié pour recharts
function mergeData(
  clientScores: DataPoint[],
  centroidScores: DataPoint[],
  globalAverages: DataPoint[]
) {
  return clientScores.map((c, i) => ({
    subject: c.subject,
    client: c.value,
    centroid: centroidScores[i]?.value ?? 0,
    moyenne: globalAverages[i]?.value ?? 0,
    fullMark: 10,
  }))
}

export function TripleRadarChart({
  clientScores,
  centroidScores,
  globalAverages,
  profileName,
  profileColor,
  height = 320,
}: TripleRadarChartProps) {
  const data = mergeData(clientScores, centroidScores, globalAverages)

  // Couleur du centroïde = profil à 60% opacité
  const centroidColor = profileColor + '99'

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fill: '#141325', fontSize: 12 }}
        />
        <PolarRadiusAxis
          angle={30}
          domain={[0, 10]}
          tick={{ fontSize: 10, fill: '#94a3b8' }}
          tickCount={6}
        />

        {/* Couche 1 : Moyenne globale N=5705 */}
        <Radar
          name="Moyenne N=5 705"
          dataKey="moyenne"
          stroke="#94a3b8"
          strokeWidth={1}
          fill="transparent"
          fillOpacity={0}
        />

        {/* Couche 2 : Centroïde du profil type (pointillé) */}
        <Radar
          name={`Profil type ${profileName}`}
          dataKey="centroid"
          stroke={centroidColor}
          strokeWidth={1.5}
          strokeDasharray="5 5"
          fill="transparent"
          fillOpacity={0}
        />

        {/* Couche 3 : Score du client (trait plein, au-dessus) */}
        <Radar
          name="Votre profil"
          dataKey="client"
          stroke={profileColor}
          strokeWidth={2}
          fill={profileColor}
          fillOpacity={0.12}
        />

        <Tooltip
          formatter={(value, name) => [
            typeof value === 'number' ? `${value.toFixed(1)} / 10` : value,
            name,
          ]}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}
