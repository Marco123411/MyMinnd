import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
})

export const registerSchema = z
  .object({
    email: z.string().email('Email invalide'),
    password: z.string().min(8, 'Minimum 8 caractères'),
    nom: z.string().min(1, 'Nom requis'),
    prenom: z.string().optional(),
    role: z.enum(['client', 'coach']),
    context: z.enum(['sport', 'corporate', 'wellbeing', 'coaching']).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === 'client' && !data.context) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['context'],
        message: 'Le contexte est requis pour un client',
      })
    }
  })

export const forgotPasswordSchema = z.object({
  email: z.string().email('Email invalide'),
})

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, 'Minimum 8 caractères'),
    confirmPassword: z.string().min(1, 'Confirmation requise'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Les mots de passe ne correspondent pas',
  })

export const completeProfileSchema = z
  .object({
    role: z.enum(['client', 'coach']),
    context: z.enum(['sport', 'corporate', 'wellbeing', 'coaching']).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role === 'client' && !data.context) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['context'],
        message: 'Le contexte est requis pour un client',
      })
    }
  })

export type LoginFormData = z.infer<typeof loginSchema>
export type RegisterFormData = z.infer<typeof registerSchema>
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>
export type CompleteProfileFormData = z.infer<typeof completeProfileSchema>
