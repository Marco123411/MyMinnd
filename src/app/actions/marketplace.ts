'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { expertProfileSchema } from '@/lib/validations/marketplace'
import type { ExpertProfile, ExpertProfileWithUser, ExpertFilters, Review } from '@/types'

const uuidSchema = z.string().uuid()

function validateUuid(id: string): boolean {
  return uuidSchema.safeParse(id).success
}

// ============================================================
// getExpertsAction — liste publique des experts (marketplace)
// Accessible sans authentification
// ============================================================
export async function getExpertsAction(
  filters?: ExpertFilters
): Promise<{ data: ExpertProfileWithUser[]; error: string | null }> {
  const supabase = await createClient()

  let query = supabase
    .from('expert_profiles')
    .select(`
      *,
      users!user_id (
        nom,
        prenom,
        photo_url
      )
    `)
    .eq('is_visible', true)

  if (filters?.context) {
    query = query.contains('contexts_couverts', [filters.context])
  }
  if (filters?.sport) {
    query = query.contains('sports', [filters.sport])
  }
  if (filters?.public_cible) {
    query = query.contains('public_cible', [filters.public_cible])
  }
  if (filters?.localisation) {
    // Sanitize ILIKE pattern — escape special chars to prevent injection
    const sanitized = filters.localisation.replace(/[%_\\]/g, '\\$&')
    query = query.ilike('localisation', `%${sanitized}%`)
  }
  if (filters?.specialite) {
    query = query.contains('specialites', [filters.specialite])
  }
  if (filters?.tarif_min != null) {
    query = query.gte('tarif_seance', filters.tarif_min)
  }
  if (filters?.tarif_max != null) {
    query = query.lte('tarif_seance', filters.tarif_max)
  }
  if (filters?.note_min != null && filters.note_min > 0) {
    query = query.gte('note_moyenne', filters.note_min)
  }

  // Tri
  switch (filters?.sortBy) {
    case 'note':
      query = query.order('note_moyenne', { ascending: false })
      break
    case 'prix':
      query = query.order('tarif_seance', { ascending: true, nullsFirst: false })
      break
    case 'nb_profils':
      query = query.order('nb_profils_analyses', { ascending: false })
      break
    default:
      // Pertinence : badge certifié en premier, puis note
      query = query
        .order('badge_certifie', { ascending: false })
        .order('note_moyenne', { ascending: false })
  }

  const { data, error } = await query

  if (error) {
    console.error('[getExpertsAction]', error)
    return { data: [], error: 'Impossible de charger les experts' }
  }

  const experts: ExpertProfileWithUser[] = (data ?? []).map((row) => {
    const { users, ...profile } = row as ExpertProfile & { users: { nom: string; prenom: string | null; photo_url: string | null } | null }
    return {
      ...profile,
      photo_url: profile.photo_url ?? users?.photo_url ?? null,
      nom: users?.nom ?? '',
      prenom: users?.prenom ?? null,
    }
  })

  return { data: experts, error: null }
}

// ============================================================
// getExpertAction — profil détaillé d'un expert avec ses avis
// Accessible sans authentification
// ============================================================
export async function getExpertAction(
  expertId: string
): Promise<{ data: (ExpertProfileWithUser & { reviews: Review[] }) | null; error: string | null }> {
  if (!validateUuid(expertId)) return { data: null, error: 'ID invalide' }

  const supabase = await createClient()

  const [profileResult, reviewsResult] = await Promise.all([
    supabase
      .from('expert_profiles')
      .select(`
        *,
        users!user_id (
          nom,
          prenom,
          photo_url
        )
      `)
      .eq('user_id', expertId)
      .eq('is_visible', true)
      .single(),
    supabase
      .from('reviews')
      .select(`
        *,
        reviewer:users!reviewer_user_id (
          prenom,
          nom
        )
      `)
      .eq('expert_user_id', expertId)
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  if (profileResult.error || !profileResult.data) {
    return { data: null, error: null }
  }

  const row = profileResult.data as ExpertProfile & { users: { nom: string; prenom: string | null; photo_url: string | null } | null }
  const { users, ...profile } = row

  const reviews: Review[] = (reviewsResult.data ?? []).map((r) => {
    const reviewer = r.reviewer as { prenom: string | null; nom: string } | null
    const prenom = reviewer?.prenom ?? ''
    const nomInitiale = reviewer?.nom ? reviewer.nom.charAt(0).toUpperCase() + '.' : ''
    return {
      ...r,
      reviewer: undefined,
      reviewer_display_name: [prenom, nomInitiale].filter(Boolean).join(' '),
    } as Review
  })

  return {
    data: {
      ...profile,
      photo_url: profile.photo_url ?? users?.photo_url ?? null,
      nom: users?.nom ?? '',
      prenom: users?.prenom ?? null,
      reviews,
    },
    error: null,
  }
}

// ============================================================
// getMyExpertProfileAction — profil de l'expert connecté
// Nécessite authentification (role='coach')
// ============================================================
export async function getMyExpertProfileAction(): Promise<{
  data: ExpertProfile | null
  error: string | null
}> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { data: null, error: 'Non authentifié' }

  const { data, error } = await supabase
    .from('expert_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[getMyExpertProfileAction]', error.code, error.message, error.details)
    return { data: null, error: 'Impossible de charger le profil' }
  }

  return { data: data as ExpertProfile | null, error: null }
}

// ============================================================
// upsertExpertProfileAction — création ou mise à jour du profil expert
// ============================================================
export async function upsertExpertProfileAction(
  formData: unknown
): Promise<{ data: ExpertProfile | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { data: null, error: 'Non authentifié' }

  const parsed = expertProfileSchema.safeParse(formData)
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Données invalides'
    return { data: null, error: msg }
  }

  // Vérifie que le coach a le bon rôle
  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (userData?.role !== 'coach' && userData?.role !== 'admin') {
    return { data: null, error: 'Accès refusé' }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('expert_profiles')
    .upsert(
      { ...parsed.data, user_id: user.id },
      { onConflict: 'user_id' }
    )
    .select()
    .single()

  if (error) {
    console.error('[upsertExpertProfileAction]', error)
    return { data: null, error: 'Impossible de sauvegarder le profil' }
  }

  return { data: data as ExpertProfile, error: null }
}

// ============================================================
// getExpertProfileStatsAction — stats pour le dashboard coach
// ============================================================
export async function getExpertProfileStatsAction(): Promise<{
  data: { nb_demandes: number; avis_recents: Review[] } | null
  error: string | null
}> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { data: null, error: 'Non authentifié' }

  const [dispatchResult, reviewsResult] = await Promise.all([
    supabase
      .from('dispatches')
      .select('id', { count: 'exact', head: true })
      .eq('expert_id', user.id),
    supabase
      .from('reviews')
      .select('*')
      .eq('expert_user_id', user.id)
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(3),
  ])

  return {
    data: {
      nb_demandes: dispatchResult.count ?? 0,
      avis_recents: (reviewsResult.data ?? []) as Review[],
    },
    error: null,
  }
}
