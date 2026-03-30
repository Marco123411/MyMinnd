'use server'

import { createClient } from '@/lib/supabase/server'
import {
  clientSchema,
  updateClientSchema,
  type ClientFormData,
  type UpdateClientFormData,
} from '@/lib/validations/clients'
import type { Client, ClientWithLastTest } from '@/types'

export interface ClientFilters {
  statut?: string
  context?: string
  search?: string
  tag?: string
  sortBy?: 'nom' | 'last_test' | 'score'
}

// Récupère tous les clients du coach connecté avec les données du dernier test
export async function getClientsAction(
  filters?: ClientFilters
): Promise<{ data: ClientWithLastTest[]; error: string | null }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [], error: 'Non authentifié' }

  // Étape 1 : récupère les clients (sans join sur tests — le join tests_coach_id_fkey
  // lie tests.coach_id → clients, ce qui ramène TOUS les tests du coach, pas par client)
  let query = supabase
    .from('clients')
    .select('*')
    .eq('coach_id', user.id)
    .order('created_at', { ascending: false })

  if (filters?.statut) query = query.eq('statut', filters.statut)
  if (filters?.context) query = query.eq('context', filters.context)
  if (filters?.search) {
    // F1 FIX : séparation des clauses pour éviter l'injection PostgREST via .or()
    const search = filters.search.trim()
    query = query.or(
      `nom.ilike.${encodePostgrestLike(search)},email.ilike.${encodePostgrestLike(search)}`
    )
  }

  const { data: clients, error } = await query

  if (error) return { data: [], error: error.message }
  if (!clients || clients.length === 0) return { data: [], error: null }

  // Étape 2 : dernier test complété par user_id (une seule requête, pas N+1)
  const userIds = clients.filter((c) => c.user_id).map((c) => c.user_id as string)

  type LastTestRow = {
    user_id: string
    score_global: number | null
    completed_at: string | null
    profiles: { name: string; color: string } | null
  }

  const lastTestMap = new Map<string, LastTestRow>()

  if (userIds.length > 0) {
    const { data: recentTests } = await supabase
      .from('tests')
      .select('user_id, score_global, completed_at, profiles ( name, color )')
      .eq('coach_id', user.id)
      .eq('status', 'completed')
      .in('user_id', userIds)
      .order('completed_at', { ascending: false })

    // Garde uniquement le test le plus récent par user_id
    ;(recentTests ?? []).forEach((t) => {
      const test = t as unknown as LastTestRow
      if (test.user_id && !lastTestMap.has(test.user_id)) {
        lastTestMap.set(test.user_id, test)
      }
    })
  }

  const enriched: ClientWithLastTest[] = (clients as Client[]).map((client) => {
    const lastTest = client.user_id ? lastTestMap.get(client.user_id) ?? null : null
    return {
      ...client,
      lastTestScore: lastTest?.score_global ?? null,
      lastTestDate: lastTest?.completed_at ?? null,
      profileName: lastTest?.profiles?.name ?? null,
      profileColor: lastTest?.profiles?.color ?? null,
    }
  })

  if (filters?.sortBy === 'nom') enriched.sort((a, b) => a.nom.localeCompare(b.nom))
  else if (filters?.sortBy === 'score') enriched.sort((a, b) => (b.lastTestScore ?? -1) - (a.lastTestScore ?? -1))
  else if (filters?.sortBy === 'last_test') enriched.sort((a, b) => (b.lastTestDate ?? '').localeCompare(a.lastTestDate ?? ''))

  return { data: enriched, error: null }
}

// Échappe les caractères spéciaux PostgREST dans une valeur ilike
function encodePostgrestLike(value: string): string {
  // Échappe les caractères qui pourraient injecter des clauses PostgREST
  return `%${value.replace(/[,%()]/g, '')}%`
}

// Récupère un client par ID (vérifie l'appartenance au coach — défense en profondeur)
export async function getClientAction(
  id: string
): Promise<{ data: Client | null; error: string | null }> {
  const supabase = await createClient()

  // F2 FIX : auth + filtre coach_id explicite (défense en profondeur en plus du RLS)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Non authentifié' }

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .eq('coach_id', user.id)
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as Client, error: null }
}

// Crée un nouveau client (avec vérification limite Pro)
export async function createClientAction(
  formData: ClientFormData
): Promise<{ data: { id: string } | null; error: string | null }> {
  const parsed = clientSchema.safeParse(formData)
  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0].message }
  }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'Non authentifié' }

  // F9 FIX : limite pour tier Pro uniquement (spec étape 6 : "Limite Coach Pro")
  // Free = pas de limite définie, Pro = 30 actifs max, Expert = illimité
  const { data: profile } = await supabase
    .from('users')
    .select('subscription_tier')
    .eq('id', user.id)
    .single()

  if (profile?.subscription_tier === 'pro') {
    const { count } = await supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .eq('coach_id', user.id)
      .eq('statut', 'actif')

    if ((count ?? 0) >= 30) {
      return {
        data: null,
        error: 'Limite atteinte (30 clients actifs). Passez à Expert pour débloquer la limite.',
      }
    }
  }

  const { nom, email, context, sport, niveau, entreprise, poste, date_naissance, objectifs, notes_privees, statut, tags } =
    parsed.data

  const { data, error } = await supabase
    .from('clients')
    .insert({
      coach_id: user.id,
      nom,
      email: email || null,
      context,
      sport: sport || null,
      niveau: niveau ?? null,
      entreprise: entreprise || null,
      poste: poste || null,
      date_naissance: date_naissance || null,
      objectifs: objectifs || null,
      notes_privees: notes_privees || null,
      statut,
      tags,
    })
    .select('id')
    .single()

  if (error) return { data: null, error: error.message }
  return { data: { id: data.id }, error: null }
}

// Met à jour un client existant
export async function updateClientAction(
  id: string,
  formData: UpdateClientFormData
): Promise<{ error: string | null }> {
  const parsed = updateClientSchema.safeParse(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  // F3 FIX : auth + coach_id dans le WHERE
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { nom, email, context, sport, niveau, entreprise, poste, date_naissance, objectifs, notes_privees, statut, tags } =
    parsed.data

  const { error } = await supabase
    .from('clients')
    .update({
      nom,
      email: email || null,
      context,
      sport: sport || null,
      niveau: niveau ?? null,
      entreprise: entreprise || null,
      poste: poste || null,
      date_naissance: date_naissance || null,
      objectifs: objectifs || null,
      notes_privees: notes_privees || null,
      statut,
      tags,
    })
    .eq('id', id)
    .eq('coach_id', user.id)

  if (error) return { error: error.message }
  return { error: null }
}

// Archive ou réactive un client
export async function archiveClientAction(
  id: string,
  statut: 'actif' | 'archive'
): Promise<{ error: string | null }> {
  // F4 FIX : auth + coach_id dans le WHERE
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { error } = await supabase
    .from('clients')
    .update({ statut })
    .eq('id', id)
    .eq('coach_id', user.id)

  if (error) return { error: error.message }
  return { error: null }
}

// Met à jour les notes privées et objectifs (pour l'onglet Notes)
export async function updateClientNotesAction(
  id: string,
  notes_privees: string,
  objectifs: string
): Promise<{ error: string | null }> {
  // F5 FIX : auth + coach_id dans le WHERE
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { error } = await supabase
    .from('clients')
    .update({ notes_privees: notes_privees || null, objectifs: objectifs || null })
    .eq('id', id)
    .eq('coach_id', user.id)

  if (error) return { error: error.message }
  return { error: null }
}
