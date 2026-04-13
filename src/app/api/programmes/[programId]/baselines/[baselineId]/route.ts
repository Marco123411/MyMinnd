import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const uuidSchema = z.string().uuid()

// GET — retourne la baseline complète avec les résultats détaillés
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ programId: string; baselineId: string }> }
) {
  const { programId, baselineId } = await params

  if (!uuidSchema.safeParse(programId).success || !uuidSchema.safeParse(baselineId).success) {
    return NextResponse.json({ error: 'Identifiant invalide' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  // Vérifie accès coach ou client (RLS gère la politique, mais on filtre programme pour être sûr)
  const { data: prog } = await supabase
    .from('programmes')
    .select('id, coach_id, client_id')
    .eq('id', programId)
    .single()

  if (!prog || (prog.coach_id !== user.id && prog.client_id !== user.id)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const { data: baseline, error } = await supabase
    .from('cognitive_baselines')
    .select('*')
    .eq('id', baselineId)
    .eq('programme_id', programId)
    .single()

  if (error || !baseline) {
    return NextResponse.json({ error: 'Baseline introuvable' }, { status: 404 })
  }

  return NextResponse.json({ data: baseline })
}

// DELETE — supprime la baseline (coach uniquement)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ programId: string; baselineId: string }> }
) {
  const { programId, baselineId } = await params

  if (!uuidSchema.safeParse(programId).success || !uuidSchema.safeParse(baselineId).success) {
    return NextResponse.json({ error: 'Identifiant invalide' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  // Seul le coach peut supprimer
  const { data: prog } = await supabase
    .from('programmes')
    .select('id, coach_id')
    .eq('id', programId)
    .eq('coach_id', user.id)
    .single()

  if (!prog) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const { error } = await supabase
    .from('cognitive_baselines')
    .delete()
    .eq('id', baselineId)
    .eq('programme_id', programId)

  if (error) return NextResponse.json({ error: 'Erreur lors de la suppression de la baseline' }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}
