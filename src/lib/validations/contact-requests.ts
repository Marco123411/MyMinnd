import { z } from 'zod'

export const contactRequestLevelEnum = z.enum([
  'amateur',
  'semi-pro',
  'professionnel',
  'elite',
])

export const createContactRequestSchema = z.object({
  coach_user_id: z.string().uuid(),
  test_id: z.string().uuid(),
  sport: z.string().min(1, 'Sport requis').max(100),
  level: contactRequestLevelEnum,
  objective: z
    .string()
    .min(10, 'Décrivez votre objectif en quelques phrases')
    .max(500, "L'objectif est limité à 500 caractères"),
  message: z.string().max(1000).optional(),
  consent_share_results: z
    .literal(true)
    .refine((v) => v === true, { message: 'Le consentement est obligatoire' }),
})

export const declineContactRequestSchema = z.object({
  coach_response_message: z.string().max(1000).optional(),
})

export type CreateContactRequestFormData = z.infer<typeof createContactRequestSchema>
export type DeclineContactRequestFormData = z.infer<typeof declineContactRequestSchema>
export type ContactRequestLevel = z.infer<typeof contactRequestLevelEnum>
