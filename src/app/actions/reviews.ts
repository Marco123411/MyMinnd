'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { reviewSchema, expertResponseSchema, updateReviewSchema, reportReviewSchema } from '@/lib/validations/marketplace'
import type { Review } from '@/types'

const uuidSchema = z.string().uuid()

function validateUuid(id: string): boolean {
  return uuidSchema.safeParse(id).success
}

// ============================================================
// getReviewableDispatchAction — vérifie l'éligibilité à laisser un avis
// ============================================================
export async function getReviewableDispatchAction(
  dispatchId: string
): Promise<{
  data: { expertName: string; completedAt: string } | null
  error: string | null
}> {
  if (!validateUuid(dispatchId)) return { data: null, error: 'ID invalide' }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { data: null, error: 'Non authentifié' }

  // Récupère le dispatch avec le nom de l'expert
  const { data: dispatch, error: dispatchError } = await supabase
    .from('dispatches')
    .select(`
      id,
      client_id,
      status,
      completed_at,
      expert:users!expert_id (
        nom,
        prenom
      )
    `)
    .eq('id', dispatchId)
    .eq('client_id', user.id)
    .eq('status', 'termine')
    .single()

  if (dispatchError || !dispatch) {
    return { data: null, error: 'Session non trouvée ou non éligible' }
  }

  // Vérifie qu'il n'existe pas déjà un avis pour ce dispatch
  const { data: existing } = await supabase
    .from('reviews')
    .select('id')
    .eq('dispatch_id', dispatchId)
    .eq('reviewer_user_id', user.id)
    .maybeSingle()

  if (existing) {
    return { data: null, error: 'Vous avez déjà laissé un avis pour cette session' }
  }

  const expertRaw = dispatch.expert as unknown
  const expert = Array.isArray(expertRaw)
    ? (expertRaw[0] as { nom: string; prenom: string | null } | undefined) ?? null
    : (expertRaw as { nom: string; prenom: string | null } | null)
  const expertName = [expert?.prenom, expert?.nom].filter(Boolean).join(' ')

  return {
    data: {
      expertName,
      completedAt: dispatch.completed_at ?? '',
    },
    error: null,
  }
}

// ============================================================
// submitReviewAction — soumettre un avis
// ============================================================
export async function submitReviewAction(
  input: unknown
): Promise<{ data: Review | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { data: null, error: 'Non authentifié' }

  const parsed = reviewSchema.safeParse(input)
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Données invalides'
    return { data: null, error: msg }
  }

  const { dispatch_id, rating, comment } = parsed.data

  // Vérifie l'éligibilité : dispatch terminé appartenant au client
  const { data: dispatch } = await supabase
    .from('dispatches')
    .select('id, expert_id, client_id, status')
    .eq('id', dispatch_id)
    .eq('client_id', user.id)
    .eq('status', 'termine')
    .single()

  if (!dispatch) {
    return { data: null, error: 'Session non éligible à un avis' }
  }

  // F7: expert_id doit être renseigné
  if (!dispatch.expert_id) {
    return { data: null, error: 'Expert introuvable pour ce dispatch' }
  }

  // Vérifie l'absence d'avis existant
  const { data: existing } = await supabase
    .from('reviews')
    .select('id')
    .eq('dispatch_id', dispatch_id)
    .eq('reviewer_user_id', user.id)
    .maybeSingle()

  if (existing) {
    return { data: null, error: 'Vous avez déjà laissé un avis pour cette session' }
  }

  const { data, error } = await supabase
    .from('reviews')
    .insert({
      expert_user_id: dispatch.expert_id,
      reviewer_user_id: user.id,
      dispatch_id,
      rating,
      comment: comment ?? null,
    })
    .select()
    .single()

  if (error) {
    // F8: unique constraint — avis déjà existant (race condition ou doublon)
    if (error.code === '23505') {
      return { data: null, error: 'Vous avez déjà laissé un avis pour cette session' }
    }
    console.error('[submitReviewAction]', error)
    return { data: null, error: 'Impossible de publier l\'avis' }
  }

  return { data: data as Review, error: null }
}

// ============================================================
// updateReviewAction — modifier un avis (une seule fois, dans les 7 jours)
// Utilise createAdminClient pour contourner la RLS (la vérification se fait côté serveur)
// ============================================================
export async function updateReviewAction(
  input: unknown
): Promise<{ data: Review | null; error: string | null }> {
  const parsed = updateReviewSchema.safeParse(input)
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Données invalides'
    return { data: null, error: msg }
  }
  const { reviewId, rating, comment } = parsed.data

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { data: null, error: 'Non authentifié' }

  // Vérifications server-side avant bypass RLS
  const { data: review } = await supabase
    .from('reviews')
    .select('id, reviewer_user_id, is_edited, edited_before')
    .eq('id', reviewId)
    .single()

  if (!review) return { data: null, error: 'Avis non trouvé' }
  if (review.reviewer_user_id !== user.id) return { data: null, error: 'Accès refusé' }
  if (review.is_edited) return { data: null, error: 'Cet avis a déjà été modifié' }
  if (review.edited_before && new Date() > new Date(review.edited_before)) {
    return { data: null, error: 'La période de modification est expirée (7 jours)' }
  }

  // Admin client pour contourner la RLS WITH CHECK (is_edited passe false→true)
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('reviews')
    .update({ rating, comment: comment ?? null, is_edited: true })
    .eq('id', reviewId)
    .eq('reviewer_user_id', user.id) // Défense en profondeur
    .select()
    .single()

  if (error) {
    console.error('[updateReviewAction]', error)
    return { data: null, error: 'Impossible de modifier l\'avis' }
  }

  return { data: data as Review, error: null }
}

// ============================================================
// expertRespondToReviewAction — réponse publique de l'expert
// ============================================================
export async function expertRespondToReviewAction(
  reviewId: string,
  input: unknown
): Promise<{ data: Review | null; error: string | null }> {
  if (!validateUuid(reviewId)) return { data: null, error: 'ID invalide' }

  const parsed = expertResponseSchema.safeParse(input)
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Données invalides'
    return { data: null, error: msg }
  }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { data: null, error: 'Non authentifié' }

  // Vérifie que l'utilisateur est bien l'expert concerné et qu'il n'a pas encore répondu
  const { data: review } = await supabase
    .from('reviews')
    .select('id, expert_user_id, expert_response')
    .eq('id', reviewId)
    .single()

  if (!review) return { data: null, error: 'Avis non trouvé' }
  if (review.expert_user_id !== user.id) return { data: null, error: 'Accès refusé' }
  if (review.expert_response !== null) return { data: null, error: 'Vous avez déjà répondu à cet avis' }

  const { data, error } = await supabase
    .from('reviews')
    .update({ expert_response: parsed.data.expert_response })
    .eq('id', reviewId)
    .select()
    .single()

  if (error) {
    console.error('[expertRespondToReviewAction]', error)
    return { data: null, error: 'Impossible d\'enregistrer la réponse' }
  }

  return { data: data as Review, error: null }
}

// ============================================================
// reportReviewAction — signalement d'un avis (modération)
// ============================================================
export async function reportReviewAction(
  reviewId: string,
  reason: string
): Promise<{ error: string | null }> {
  if (!validateUuid(reviewId)) return { error: 'ID invalide' }
  if (!reason || reason.trim().length < 5) return { error: 'Raison du signalement requise' }

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'Non authentifié' }

  // Log server-side — la modération admin est hors scope de cette étape
  console.warn('[reportReviewAction] Signalement:', { reviewId, reportedBy: user.id, reason })

  return { error: null }
}
