'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { CognitiveTestPreset } from '@/types'

const uuidSchema = z.string().uuid()

const presetCreateSchema = z.object({
  cognitive_test_id: z.string().uuid(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9_]+$/),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).nullable(),
  config: z.record(z.string(), z.unknown()),
})

const adminPresetCreateSchema = presetCreateSchema.extend({
  is_validated: z.boolean(),
  validation_reference: z.string().max(500).nullable(),
})

// Champs modifiables par l'admin (liste blanche explicite — pas de mass-assignment)
const adminPresetUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  is_validated: z.boolean().optional(),
  validation_reference: z.string().max(500).nullable().optional(),
  is_active: z.boolean().optional(),
})

// Récupère les presets disponibles pour un test (globaux + personnels du coach)
export async function getCognitivePresetsForTest(
  testId: string
): Promise<{ data: CognitiveTestPreset[]; error: string | null }> {
  const parsed = uuidSchema.safeParse(testId)
  if (!parsed.success) return { data: [], error: 'testId invalide' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [], error: 'Non authentifié' }

  const { data, error } = await supabase
    .from('cognitive_test_presets')
    .select('*')
    .eq('cognitive_test_id', parsed.data)
    .eq('is_active', true)
    .order('is_validated', { ascending: false })
    .order('created_at')

  if (error) return { data: [], error: 'Impossible de charger les presets' }
  return { data: (data ?? []) as CognitiveTestPreset[], error: null }
}

// Récupère tous les presets groupés par test slug (pour l'UI d'invitation)
export async function getAllCognitivePresetsAction(): Promise<{
  data: Record<string, CognitiveTestPreset[]>
  error: string | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: {}, error: 'Non authentifié' }

  const { data, error } = await supabase
    .from('cognitive_test_presets')
    .select('*, cognitive_test_definitions(slug)')
    .eq('is_active', true)
    .order('is_validated', { ascending: false })
    .order('created_at')

  if (error) return { data: {}, error: 'Impossible de charger les presets' }

  const grouped: Record<string, CognitiveTestPreset[]> = {}
  for (const row of data ?? []) {
    const def = Array.isArray(row.cognitive_test_definitions)
      ? row.cognitive_test_definitions[0]
      : row.cognitive_test_definitions
    const slug = (def as { slug: string } | null)?.slug ?? ''
    if (!grouped[slug]) grouped[slug] = []
    grouped[slug].push(row as CognitiveTestPreset)
  }

  return { data: grouped, error: null }
}

// Crée un preset personnel pour le coach connecté
export async function createCoachPresetAction(input: {
  cognitive_test_id: string
  slug: string
  name: string
  description: string | null
  config: Record<string, unknown>
}): Promise<{ data: CognitiveTestPreset | null; error: string | null }> {
  const parsed = presetCreateSchema.safeParse(input)
  if (!parsed.success) return { data: null, error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Non authentifié' }
  if (user.app_metadata?.role !== 'coach') return { data: null, error: 'Accès refusé' }

  const { data, error } = await supabase
    .from('cognitive_test_presets')
    .insert({
      ...parsed.data,
      coach_id: user.id,
      is_validated: false,
    })
    .select()
    .single()

  if (error) return { data: null, error: 'Impossible de créer le preset' }
  revalidatePath('/coach')
  return { data: data as CognitiveTestPreset, error: null }
}

// Soft-delete d'un preset personnel du coach
export async function deleteCoachPresetAction(
  presetId: string
): Promise<{ error: string | null }> {
  const parsed = uuidSchema.safeParse(presetId)
  if (!parsed.success) return { error: 'presetId invalide' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  if (user.app_metadata?.role !== 'coach') return { error: 'Accès refusé' }

  const { error } = await supabase
    .from('cognitive_test_presets')
    .update({ is_active: false })
    .eq('id', parsed.data)
    .eq('coach_id', user.id)

  if (error) return { error: 'Impossible de supprimer le preset' }
  revalidatePath('/coach')
  return { error: null }
}

// Admin : créer un preset global (is_validated possible)
export async function adminCreatePresetAction(input: {
  cognitive_test_id: string
  slug: string
  name: string
  description: string | null
  config: Record<string, unknown>
  is_validated: boolean
  validation_reference: string | null
}): Promise<{ data: CognitiveTestPreset | null; error: string | null }> {
  const parsed = adminPresetCreateSchema.safeParse(input)
  if (!parsed.success) return { data: null, error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Non authentifié' }
  if (user.app_metadata?.role !== 'admin') return { data: null, error: 'Accès refusé' }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('cognitive_test_presets')
    .insert({
      ...parsed.data,
      coach_id: null,
    })
    .select()
    .single()

  if (error) return { data: null, error: 'Impossible de créer le preset' }
  revalidatePath('/admin/cognitive-presets')
  return { data: data as CognitiveTestPreset, error: null }
}

// Admin : modifier un preset existant
export async function adminUpdatePresetAction(
  presetId: string,
  updates: z.infer<typeof adminPresetUpdateSchema>
): Promise<{ error: string | null }> {
  const parsedId = uuidSchema.safeParse(presetId)
  if (!parsedId.success) return { error: 'presetId invalide' }

  const parsedUpdates = adminPresetUpdateSchema.safeParse(updates)
  if (!parsedUpdates.success) return { error: parsedUpdates.error.issues[0].message }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }
  if (user.app_metadata?.role !== 'admin') return { error: 'Accès refusé' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('cognitive_test_presets')
    .update(parsedUpdates.data)
    .eq('id', parsedId.data)

  if (error) return { error: 'Impossible de modifier le preset' }
  revalidatePath('/admin/cognitive-presets')
  return { error: null }
}
