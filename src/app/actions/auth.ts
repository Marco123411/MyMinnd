'use server'

import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  completeProfileSchema,
  clientOnboardingSchema,
  updateProfileSchema,
  changePasswordSchema,
  type LoginFormData,
  type RegisterFormData,
  type ForgotPasswordFormData,
  type ResetPasswordFormData,
  type CompleteProfileFormData,
  type ClientOnboardingFormData,
  type UpdateProfileFormData,
  type ChangePasswordFormData,
} from '@/lib/validations/auth'
import type { UserRole } from '@/types'

// Redirige vers l'espace approprié selon le rôle
function redirectByRole(role: UserRole): never {
  if (role === 'coach') redirect('/coach')
  if (role === 'admin') redirect('/admin')
  redirect('/client')
}

export async function signUpAction(
  formData: RegisterFormData
): Promise<{ error: string | null }> {
  const parsed = registerSchema.safeParse(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  // Inscription publique = coachs uniquement
  const { email, password, nom, prenom } = parsed.data
  const supabase = await createClient()

  const { data, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nom, prenom: prenom ?? null, role: 'coach', context: null },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/auth/callback`,
    },
  })

  if (signUpError) return { error: signUpError.message }
  if (!data.user) return { error: "Erreur lors de la création du compte" }

  // Met à jour le rôle via client admin (le trigger crée avec role='client' par défaut)
  const admin = createAdminClient()
  const { error: profileError } = await admin
    .from('users')
    .update({
      role: 'coach',
      context: null,
      nom,
      prenom: prenom ?? null,
    })
    .eq('id', data.user.id)

  if (profileError) return { error: profileError.message }
  return { error: null }
}

export async function signInAction(
  formData: LoginFormData
): Promise<{ error: string | null }> {
  const parsed = loginSchema.safeParse(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { email, password } = parsed.data
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) return { error: error.message }

  // Récupère le rôle depuis public.users
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('role')
    .eq('id', data.user.id)
    .single()

  if (userError || !userData) return { error: 'Erreur lors de la récupération du profil' }

  const role = z.enum(['client', 'coach', 'admin']).safeParse(userData.role)
  if (!role.success) return { error: 'Rôle invalide' }

  redirectByRole(role.data)
}

export async function signOutAction(): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const { error } = await supabase.auth.signOut()
  if (error) return { error: error.message }
  redirect('/login')
}

export async function forgotPasswordAction(
  formData: ForgotPasswordFormData
): Promise<{ error: string | null }> {
  const parsed = forgotPasswordSchema.safeParse(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/reset-password`,
  })

  if (error) return { error: error.message }
  return { error: null }
}

export async function resetPasswordAction(
  formData: ResetPasswordFormData
): Promise<{ error: string | null }> {
  const parsed = resetPasswordSchema.safeParse(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  })

  if (error) return { error: error.message }
  return { error: null }
}

export async function completeProfileAction(
  formData: CompleteProfileFormData
): Promise<{ error: string | null }> {
  const parsed = completeProfileSchema.safeParse(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const { role, context } = parsed.data
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return { error: 'Non authentifié' }

  // Vérifie que le profil n'est pas déjà complété (guard contre les modifications répétées)
  const { data: currentProfile } = await supabase
    .from('users')
    .select('role, context')
    .eq('id', user.id)
    .single()

  if (!currentProfile) return { error: 'Profil introuvable' }

  // Autorisé seulement si c'est encore le profil par défaut du trigger (role='client', context=null)
  if (currentProfile.role !== 'client' || currentProfile.context !== null) {
    return { error: 'Profil déjà complété' }
  }

  // Mise à jour via client admin pour contourner la restriction RLS sur la colonne role
  const admin = createAdminClient()
  const { error: updateError } = await admin
    .from('users')
    .update({
      role,
      context: role === 'coach' ? null : (context ?? null),
    })
    .eq('id', user.id)

  if (updateError) return { error: updateError.message }

  // Re-lit le rôle réel depuis la BDD pour la redirection (évite de faire confiance au payload utilisateur)
  const { data: updatedProfile, error: readError } = await admin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (readError || !updatedProfile) return { error: 'Erreur lors de la mise à jour du profil' }

  const parsedRole = z.enum(['client', 'coach', 'admin']).safeParse(updatedProfile.role)
  if (!parsedRole.success) return { error: 'Rôle invalide' }

  redirectByRole(parsedRole.data)
}

export async function updateProfileAction(
  formData: UpdateProfileFormData
): Promise<{ error: string | null }> {
  const parsed = updateProfileSchema.safeParse(formData)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { error } = await supabase
    .from('users')
    .update({ nom: parsed.data.nom, prenom: parsed.data.prenom ?? null })
    .eq('id', user.id)

  if (error) return { error: 'Impossible de mettre à jour le profil' }
  return { error: null }
}

export async function changePasswordAction(
  formData: ChangePasswordFormData
): Promise<{ error: string | null }> {
  const parsed = changePasswordSchema.safeParse(formData)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) return { error: error.message }
  return { error: null }
}

// Complète l'onboarding client : enregistre le contexte (sport/corporate/wellbeing/coaching)
// et les champs conditionnels (discipline, entreprise) dans public.users + public.clients
export async function completeClientOnboardingAction(
  formData: ClientOnboardingFormData
): Promise<{ error: string | null }> {
  const parsed = clientOnboardingSchema.safeParse(formData)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { context, sport, entreprise } = parsed.data
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) return { error: 'Non authentifié' }

  // Vérifie que l'utilisateur est bien un client
  const { data: currentProfile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!currentProfile) return { error: 'Profil introuvable' }
  if (currentProfile.role !== 'client') return { error: 'Action réservée aux clients' }

  const admin = createAdminClient()

  // Met à jour le contexte dans public.users via client admin (contourne RLS)
  const { error: userUpdateError } = await admin
    .from('users')
    .update({ context })
    .eq('id', user.id)

  if (userUpdateError) return { error: userUpdateError.message }

  // Met à jour les champs conditionnels dans public.clients si applicable
  if (context === 'sport' || context === 'corporate') {
    const clientUpdate: { sport?: string; entreprise?: string } = {}
    if (context === 'sport') clientUpdate.sport = sport ?? undefined
    if (context === 'corporate') clientUpdate.entreprise = entreprise ?? undefined

    const { error: clientUpdateError } = await admin
      .from('clients')
      .update(clientUpdate)
      .eq('user_id', user.id)

    if (clientUpdateError) {
      console.error('[completeClientOnboardingAction] clients update error:', clientUpdateError.message)
      // Non-bloquant : le contexte principal est enregistré, les champs secondaires peuvent être mis à jour plus tard
    }
  }

  return { error: null }
}
