// User & auth — matches DB schema (public.users)
export type UserRole = 'client' | 'coach' | 'admin'
export type ClientContext = 'sport' | 'corporate' | 'wellbeing' | 'coaching'
export type SubscriptionTier = 'free' | 'pro' | 'expert'
export type SubscriptionStatus = 'active' | 'inactive' | 'past_due' | 'cancelled'

export interface User {
  id: string
  role: UserRole
  context: ClientContext | null
  nom: string
  prenom: string | null
  photo_url: string | null
  subscription_tier: SubscriptionTier
  subscription_status: SubscriptionStatus
  is_active: boolean
  created_at: string
  last_login_at: string | null
}

// AuthUser — User enrichi avec l'email Supabase Auth (utilisé par le hook useUser)
export interface AuthUser extends User {
  email: string
}

// CRM Coach — matches DB schema (public.clients)
export type ClientStatus = 'actif' | 'en_pause' | 'archive'
export type ClientNiveau = 'amateur' | 'semi-pro' | 'professionnel' | 'elite'

export interface Client {
  id: string
  coach_id: string
  user_id: string | null
  nom: string
  email: string | null
  context: ClientContext
  sport: string | null
  niveau: ClientNiveau | null
  entreprise: string | null
  poste: string | null
  date_naissance: string | null
  objectifs: string | null
  notes_privees: string | null
  statut: ClientStatus
  tags: string[]
  photo: string | null
  created_at: string
  updated_at: string
}

// Client enrichi avec les données du dernier test complété (pour la liste)
export interface ClientWithLastTest extends Client {
  lastTestScore: number | null
  lastTestDate: string | null
  profileName: string | null
  profileColor: string | null
}

// Test engine — matches DB schema (test_definitions, competency_tree, questions, profiles, …)
export type TestLevelSlug = 'discovery' | 'complete' | 'expert'
export type TestContext = ClientContext  // alias — même ensemble de valeurs

export interface TestLevelConfig {
  slug: TestLevelSlug
  name: string
  price_cents: number
  question_filter: 'discovery' | 'complete'
  includes_percentiles: boolean
  includes_profile: boolean
  includes_report: boolean
  includes_expert_session: boolean
}

export interface TestDefinition {
  id: string
  slug: string
  name: string
  description: string | null
  context: TestContext
  scale_min: number
  scale_max: number
  clustering_algo: string
  clustering_k: number | null
  normative_n: number
  is_active: boolean
  levels: TestLevelConfig[]
  report_template_id: string | null
  created_at: string
  updated_at: string
}

export interface CompetencyNode {
  id: string
  test_definition_id: string
  parent_id: string | null
  name: string
  slug: string
  description: string | null
  depth: number         // 0 = domaine, 1 = sous-compétence
  order_index: number
  is_leaf: boolean      // true = questions rattachées à ce noeud
}

export interface Question {
  id: string
  test_definition_id: string
  competency_node_id: string
  text_fr: string
  text_en: string | null
  is_reversed: boolean  // score = 11 - réponse si true
  is_active: boolean
  level_required: 'discovery' | 'complete'
  order_index: number
}

export interface MentalProfile {
  id: string
  test_definition_id: string
  name: string
  family: string | null
  color: string
  population_pct: number | null
  avg_score: number | null
  description: string | null
  strengths: string | null
  weaknesses: string | null
  recommendations: string | null
}

export interface ProfileCentroid {
  id: string
  profile_id: string
  competency_node_id: string
  value: number
}

export interface NormativeStat {
  id: string
  test_definition_id: string
  competency_node_id: string
  mean: number
  std_dev: number
  sample_size: number
  percentile_distribution: Record<string, number> | null
  updated_at: string
}

// Passations et scoring — matches DB schema (tests, responses, test_scores, payments)

// Vue coach : test avec définition + profil + token d'invitation (lu via admin client)
export interface TestForCoach {
  id: string
  client_id: string | null
  level_slug: TestLevelSlug
  status: 'pending' | 'in_progress' | 'completed' | 'expired'
  score_global: number | null
  created_at: string
  completed_at: string | null
  invite_url: string | null          // URL complète construite côté serveur (token non exposé)
  token_expires_at: string | null
  definition_name: string
  profile_name: string | null
  profile_color: string | null
}

export interface Test {
  id: string
  test_definition_id: string
  user_id: string | null
  coach_id: string | null
  level_slug: TestLevelSlug
  status: 'pending' | 'in_progress' | 'completed' | 'expired'
  score_global: number | null
  profile_id: string | null
  payment_id: string | null
  invitation_token: string | null
  token_expires_at: string | null
  started_at: string | null
  completed_at: string | null
  report_url: string | null
  created_at: string
  updated_at: string
}

export interface Response {
  id: string
  test_id: string
  question_id: string
  raw_score: number       // réponse brute 1-10
  computed_score: number  // après inversion si is_reversed (11 - raw_score)
  answered_at: string
}

export interface TestScore {
  id: string
  test_id: string
  entity_type: 'competency_node' | 'global'
  entity_id: string | null  // null si entity_type = 'global'
  score: number
  percentile: number | null
}

export interface Payment {
  id: string
  user_id: string
  type: 'subscription' | 'test_l2' | 'test_l3' | 'expert_payout'
  amount_cents: number
  currency: string
  stripe_payment_id: string | null
  status: 'pending' | 'succeeded' | 'failed' | 'refunded'
  metadata: Record<string, unknown> | null
  created_at: string
}
