import { z } from 'zod'

export const clientSchema = z.object({
  nom: z.string().min(1, 'Nom requis').max(100),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  context: z.enum(['sport', 'corporate', 'wellbeing', 'coaching'], 'Le contexte est requis'),
  sport: z.string().max(100).optional().or(z.literal('')),
  niveau: z.enum(['amateur', 'semi-pro', 'professionnel', 'elite']).optional(),
  entreprise: z.string().max(200).optional().or(z.literal('')),
  poste: z.string().max(200).optional().or(z.literal('')),
  date_naissance: z.string().optional().or(z.literal('')),
  objectifs: z.string().optional(),
  notes_privees: z.string().optional(),
  statut: z.enum(['actif', 'en_pause', 'archive']).default('actif'),
  tags: z.array(z.string()).default([]),
})

export const updateClientSchema = clientSchema.partial().required({ nom: true, context: true })

export type ClientFormData = z.infer<typeof clientSchema>
export type UpdateClientFormData = z.infer<typeof updateClientSchema>
