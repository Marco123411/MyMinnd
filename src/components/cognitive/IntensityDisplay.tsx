'use client'

interface IntensityDisplayProps {
  percent: number
}

function getColor(percent: number): string {
  if (percent <= 40) return '#20808D'   // teal (basse)
  if (percent <= 70) return '#FFC553'   // gold (moyenne)
  return '#944454'                       // mauve (haute)
}

export function IntensityDisplay({ percent: rawPercent }: IntensityDisplayProps) {
  const percent = Math.min(100, Math.max(10, rawPercent))
  const fillPercent = ((percent - 10) / 90) * 100

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-24 w-8 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="absolute bottom-0 left-0 right-0 rounded-full transition-all"
          style={{
            height: `${fillPercent}%`,
            backgroundColor: getColor(percent),
          }}
        />
      </div>
      <span className="text-xs font-bold" style={{ color: getColor(percent) }}>
        {percent}%
      </span>
    </div>
  )
}
