import { z } from 'zod'

export const expertProfileSchema = z.object({
  photo_url: z.string().url().nullish(),
  titre: z.string().min(3, 'Titre requis (3 caractères minimum)').max(200),
  bio: z.string().min(10, 'Bio requise (10 caractères minimum)').max(500, 'Bio limitée à 500 caractères'),
  specialites: z.array(z.string().min(1)).min(1, 'Au moins une spécialité requise'),
  sports: z.array(z.string().min(1)).default([]),
  contexts_couverts: z.array(z.enum(['sport', 'corporate', 'wellbeing', 'coaching'])).min(1, 'Au moins un contexte requis'),
  public_cible: z.array(z.enum(['amateur', 'semi-pro', 'professionnel', 'elite', 'jeunes'])).default([]),
  localisation: z.string().min(2, 'Localisation requise').max(200),
  tarif_seance: z.number().positive('Le tarif doit être positif').nullish(),
  disponibilites: z.record(z.string(), z.unknown()).nullish(),
  is_visible: z.boolean().default(true),
})

export const reviewSchema = z.object({
  dispatch_id: z.string().uuid('ID dispatch invalide'),
  rating: z.number().int().min(1, 'Note requise').max(5, 'Note maximum : 5'),
  comment: z.string().max(500, 'Commentaire limité à 500 caractères').optional(),
})

export const updateReviewSchema = z.object({
  reviewId: z.string().uuid('ID avis invalide'),
  rating: z.number().int().min(1, 'Note requise').max(5, 'Note maximum : 5'),
  comment: z.string().max(500, 'Commentaire limité à 500 caractères').optional(),
})

export const reportReviewSchema = z.object({
  reviewId: z.string().uuid('ID avis invalide'),
  reason: z.string().min(5, 'Raison trop courte').max(1000, 'Raison trop longue'),
})

export const expertResponseSchema = z.object({
  expert_response: z.string().min(1, 'Réponse requise').max(500, 'Réponse limitée à 500 caractères'),
})

export type ExpertProfileFormData = z.infer<typeof expertProfileSchema>
export type ReviewFormData = z.infer<typeof reviewSchema>
export type ExpertResponseFormData = z.infer<typeof expertResponseSchema>
