import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
})

// Inscription publique = coachs uniquement (role hardcodé côté action)
export const registerSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Minimum 8 caractères'),
  nom: z.string().min(1, 'Nom requis'),
  prenom: z.string().optional(),
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

// Wizard d'onboarding client — définit le contexte après acceptation de l'invitation
export const clientOnboardingSchema = z
  .object({
    context: z.enum(['sport', 'corporate', 'wellbeing', 'coaching'], {
      error: 'Le contexte est requis',
    }),
    sport: z.string().optional(),
    entreprise: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.context === 'sport' && !data.sport?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sport'],
        message: 'La discipline est requise',
      })
    }
    if (data.context === 'corporate' && !data.entreprise?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['entreprise'],
        message: "L'entreprise est requise",
      })
    }
  })

export const updateProfileSchema = z.object({
  nom: z.string().min(1, 'Nom requis').max(100),
  prenom: z.string().max(100).optional(),
})

export const changePasswordSchema = z
  .object({
    password: z.string().min(8, 'Minimum 8 caractères'),
    confirmPassword: z.string().min(1, 'Confirmation requise'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Les mots de passe ne correspondent pas',
  })

export type LoginFormData = z.infer<typeof loginSchema>
export type RegisterFormData = z.infer<typeof registerSchema>
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>
export type CompleteProfileFormData = z.infer<typeof completeProfileSchema>
export type ClientOnboardingFormData = z.infer<typeof clientOnboardingSchema>
export type UpdateProfileFormData = z.infer<typeof updateProfileSchema>
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>
