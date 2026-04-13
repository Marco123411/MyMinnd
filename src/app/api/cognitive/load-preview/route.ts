import { NextRequest, NextResponse } from 'next/server'
import { computeCognitiveLoad, getCognitiveLoadZone, getCognitiveLoadColor } from '@/lib/cognitive/load'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const schema = z.object({
  duration:              z.coerce.number().int().positive(),
  intensity:             z.coerce.number().int().min(10).max(100),
  baseCognitiveLoad:     z.coerce.number().int().min(1).max(10),
  intensityConfigurable: z.enum(['true', 'false']).transform(v => v === 'true'),
})

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const params = Object.fromEntries(request.nextUrl.searchParams)
  const parsed = schema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const { duration, intensity, baseCognitiveLoad, intensityConfigurable } = parsed.data
  const cognitiveLoad = computeCognitiveLoad({
    baseCognitiveLoad,
    durationSec: duration,
    intensityPercent: intensity,
    intensityConfigurable,
  })
  const zone = getCognitiveLoadZone(cognitiveLoad)

  return NextResponse.json({ cognitiveLoad, zone, color: getCognitiveLoadColor(zone) })
}
