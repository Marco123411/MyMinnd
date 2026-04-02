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
export type InvitationStatus = 'none' | 'pending' | 'accepted'

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
  invitation_status: InvitationStatus
  invited_at: string | null
  created_at: string
  updated_at: string
}

// Client enrichi avec les données du dernier test complété (pour la liste)
export interface ClientWithLastTest extends Client {
  lastTestScore: number | null
  lastTestDate: string | null
  profileName: string | null
  profileColor: string | null
  pendingTestsCount: number
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
  // Champs enrichis — étape 25 Profile Intelligence
  tagline: string | null
  celebrity_examples: CelebrityExample[]
  coach_priority: string | null
  coach_exercise: string | null
  coach_trap: string | null
  team_role: string | null
  team_contribution: string | null
  avg_compatibility: number | null
  forces_details: ForceDetail[]
  faiblesses_details: ForceDetail[]
}

// Exemple de célébrité associé à un profil MINND
export interface CelebrityExample {
  name: string
  sport: string
  reason: string
}

// Force ou faiblesse typique d'un profil (z-score de référence)
export interface ForceDetail {
  label: string
  z: number
  sub_slug: string
}

// Compatibilité entre deux profils MINND (matrice 8×8)
export interface ProfileCompatibility {
  id: string
  test_definition_id: string
  profile_a_id: string
  profile_b_id: string
  score: number
  synergie: string | null
  friction: string | null
  conseil: string | null
}

// Marqueur discriminant athlètes internationaux vs départementaux
export interface EliteMarker {
  sub_slug: string
  label: string
  delta: number
}

// Prédicteur du score global (corrélation Pearson)
export interface GlobalPredictor {
  sub_slug: string
  label: string
  r: number
}

// Score moyen par niveau de compétition
export interface ScoreByLevel {
  level: string
  n: number
  score: number
}

// Définition d'un insight conditionnel (stocké en base)
export interface ConditionalInsightDef {
  id: string
  title: string
  condition: Record<string, Record<string, number>> | 'always'
  text_positive: string | null
  text_negative: string | null
}

// Insight activé après évaluation des conditions sur les scores du client
export interface ActiveInsight {
  id: string
  title: string
  text: string
}

// Z-score d'une sous-compétence du client (calculé dynamiquement)
export interface LeafZScore {
  nodeId: string
  name: string
  sub_slug: string
  parentId: string | null  // ID du nœud domaine parent (pour le groupement)
  z: number
  score: number
  percentile: number | null
}

// Compatibilité avec un coéquipier (pour affichage coach)
export interface TeammateCompatibility {
  clientName: string
  profileName: string
  profileColor: string
  score: number
  synergie: string | null
  friction: string | null
  conseil: string | null
}

// Données agrégées pour la couche Intelligence Profil (étape 25)
export interface ProfileIntelligenceData {
  profile: MentalProfile
  globalScore: number
  globalPercentile: number
  levelSlug: string
  leafZScores: LeafZScore[]
  domainScores: { nodeId: string; name: string; score: number }[]
  centroidDomainScores: { name: string; score: number }[]
  globalAverageDomainScores: { name: string; score: number }[]
  eliteMarkers: EliteMarker[]
  globalPredictors: GlobalPredictor[]
  scoresByLevel: ScoreByLevel[]
  nonDiscriminantSubs: string[]
  activeInsights: ActiveInsight[]
  teammates: TeammateCompatibility[]
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

// Vue coach : page Rapports — ligne du tableau des rapports complétés
export type CoachReportRow = {
  testId: string
  clientId: string
  clientNom: string
  clientPrenom: string
  definitionName: string
  levelSlug: TestLevelSlug
  scoreGlobal: number | null
  scorePercentile: number | null
  profileName: string | null
  profileColor: string | null
  completedAt: string
  reportUrl: string | null
}

// Vue coach : test en attente de réponse client (section "Tests en cours")
export type CoachPendingTest = {
  testId: string
  clientId: string
  clientNom: string
  clientPrenom: string
  definitionName: string
  levelSlug: TestLevelSlug
  createdAt: string
  daysWaiting: number
  inviteUrl: string | null
}

// Alertes calculées pour le dashboard coach Rapports
export type CoachAlerts = {
  inactifs: number    // clients sans test complété depuis 90+ jours
  pendingOld: number  // tests pending depuis 7+ jours
  pdfMissing: number  // tests Complete/Expert complétés sans report_url
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

// ============================================================
// Dispatch types — workflow mission expert Level 3
// ============================================================

export type DispatchStatus =
  | 'nouveau'
  | 'en_cours'
  | 'dispatche'
  | 'accepte'
  | 'en_session'
  | 'termine'
  | 'annule'

export interface Dispatch {
  id: string
  client_id: string
  test_id: string
  payment_id: string
  status: DispatchStatus
  expert_id: string | null
  dispatched_at: string | null
  accepted_at: string | null
  contacted_at: string | null
  completed_at: string | null
  expert_payment_id: string | null
  notes_admin: string | null
  created_at: string
  updated_at: string
}

export interface DispatchWithDetails extends Dispatch {
  client_nom: string
  client_prenom: string | null
  client_context: string | null
  client_sport: string | null
  test_score_global: number | null
  test_profile_name: string | null
  test_profile_color: string | null
  expert_nom: string | null
  expert_prenom: string | null
}

export interface AvailableExpert {
  id: string
  nom: string
  prenom: string | null
  context: string | null
  subscription_tier: 'pro' | 'expert'
}

// ============================================================
// Exercises — bibliothèque + exercices interactifs MINND
// ============================================================

export type ExerciseFormat = 'video' | 'document' | 'audio' | 'questionnaire' | 'interactive'

// Type de question dans un exercice personnalisé
export type ExerciseQuestionType = 'open' | 'scale' | 'mcq'

// Définition d'une question dans le formulaire d'exercice
export interface ExerciseQuestion {
  id: string
  type: ExerciseQuestionType
  label: string
  min?: number   // Pour scale uniquement (défaut 1)
  max?: number   // Pour scale uniquement (défaut 10)
  options?: string[]  // Pour mcq uniquement
}

// Réponse individuelle à une question
export interface ExerciseResponseItem {
  question_id: string
  type: ExerciseQuestionType
  value: string | number
}

// Enregistrement complet d'une session de réponses
export interface ExerciseResponseRecord {
  id: string
  exercise_id: string
  user_id: string
  // Champs legacy (ne plus utiliser pour les nouveaux writes)
  session_id: string | null
  session_type: 'autonomous' | 'recurring' | null
  // Nouveaux champs typés (FK vers les tables de sessions)
  autonomous_session_id: string | null
  recurring_execution_id: string | null
  responses: ExerciseResponseItem[]
  completed_at: string
}

export interface Exercise {
  id: string
  titre: string
  description: string | null
  categorie: string
  format: ExerciseFormat
  is_custom: boolean
  is_public: boolean
  coach_id: string | null
  created_at: string
  questions: ExerciseQuestion[]
}

// Scores du Bonhomme de Performance (7 dimensions, 0-100)
export interface BonhommeScores {
  mental: number
  strategique: number
  tactique: number
  physique: number
  hygiene: number
  technique: number
  relationnel: number
}

// Scores de la Figure de Performance (6 facteurs, 0-100)
export interface FigureScores {
  psycho: number
  physique: number
  technique: number
  tactique: number
  social: number
  materiel: number
}

// Notes textuelles par facteur de la Figure
export interface FigureNotes {
  psycho: string
  physique: string
  technique: string
  tactique: string
  social: string
  materiel: string
}

// Résultat d'un exercice interactif stocké en base (jsonb)
export interface InteractiveExerciseResult {
  id: string
  exercise_type: 'bonhomme_performance' | 'figure_performance'
  coach_id: string
  client_id: string | null
  autonomous_session_id: string | null
  data: Record<string, unknown>
  created_at: string
}

// ============================================================
// MARKETPLACE — Profils experts + Avis vérifiés
// ============================================================

export type ExpertPublicCible = ClientNiveau | 'jeunes'

export interface ExpertProfile {
  id: string
  user_id: string
  photo_url: string | null
  titre: string
  specialites: string[]
  sports: string[]
  contexts_couverts: ClientContext[]
  public_cible: ExpertPublicCible[]
  localisation: string
  tarif_seance: number | null
  bio: string
  badge_certifie: boolean
  nb_profils_analyses: number
  disponibilites: Record<string, unknown> | null
  note_moyenne: number
  nb_avis: number
  taux_reponse: number
  is_visible: boolean
  created_at: string
  updated_at: string
}

// Profil expert enrichi avec les infos utilisateur (pour l'affichage marketplace)
export interface ExpertProfileWithUser extends ExpertProfile {
  nom: string
  prenom: string | null
  email?: string
}

export interface Review {
  id: string
  expert_user_id: string
  reviewer_user_id: string
  dispatch_id: string
  rating: number
  comment: string | null
  expert_response: string | null
  is_published: boolean
  is_edited: boolean
  edited_before: string | null
  created_at: string
  updated_at: string
  // Champs calculés pour l'affichage
  reviewer_display_name?: string  // "Prénom N."
}

export interface ExpertFilters {
  sport?: string
  context?: ClientContext
  public_cible?: ExpertPublicCible
  localisation?: string
  specialite?: string
  tarif_min?: number
  tarif_max?: number
  note_min?: number
  sortBy?: 'pertinence' | 'note' | 'prix' | 'nb_profils'
}

// ============================================================
// MODULE COGNITIF
// Tests trial-based (RT en ms) : PVT, Stroop, Simon, Digital Span
// + questionnaire Likert cognitif
// ============================================================

// Métrique calculée post-session (issue de metrics_config)
export interface CognitiveMetricConfig {
  key: string
  label: string
  unit: string
  description?: string
}

// Définition d'un test cognitif (catalogue)
export interface CognitiveTestDefinition {
  id: string
  slug: string
  name: string
  description: string | null
  duration_minutes: number
  trial_based: boolean
  metrics_config: CognitiveMetricConfig[]
  normative_n: number
  is_active: boolean
  price_cents: number
  instructions_fr: string | null
  config: Record<string, unknown> | null
  created_at: string
}

export type CognitiveSessionStatus = 'pending' | 'in_progress' | 'completed' | 'abandoned'

// Session = une passation d'un test cognitif par un utilisateur
export interface CognitiveSession {
  id: string
  user_id: string
  cognitive_test_id: string
  // coach_id assigné côté serveur uniquement (jamais par le client)
  coach_id: string | null
  // started_at est null tant que la session est en statut 'pending'
  // Défini automatiquement lors de la transition pending → in_progress
  started_at: string | null
  completed_at: string | null
  status: CognitiveSessionStatus
  device_info: Record<string, unknown> | null
  // computed_metrics calculé côté serveur uniquement (protected par REVOKE)
  computed_metrics: Record<string, number> | null
  created_at: string
  updated_at: string
  preset_id: string | null
  config_used: Record<string, unknown> | null
}

// Preset d'un test cognitif (admin global ou coach personnel)
export interface CognitiveTestPreset {
  id: string
  cognitive_test_id: string
  slug: string
  name: string
  description: string | null
  config: Record<string, unknown>
  is_validated: boolean
  validation_reference: string | null
  coach_id: string | null  // null = preset global (admin)
  is_active: boolean
  created_at: string
}

// Trial = une épreuve individuelle dans une session (données brutes)
export interface CognitiveTrial {
  id: string
  session_id: string
  trial_index: number
  stimulus_type: string | null
  stimulus_data: Record<string, unknown> | null
  response_data: Record<string, unknown> | null
  reaction_time_ms: number | null
  is_correct: boolean | null
  is_anticipation: boolean
  is_lapse: boolean
  recorded_at: string
}

// Statistique normative par métrique (pour les futurs percentiles)
export interface CognitiveNormativeStat {
  id: string
  cognitive_test_id: string
  metric_key: string
  mean: number
  std_dev: number
  sample_size: number
  updated_at: string
}

// ============================================================
// MODULE SÉANCES — Étape 16
// Séances cabinet, autonomie, templates récurrents
// ============================================================

export type CabinetSessionStatut = 'planifiee' | 'realisee' | 'annulee'
export type AutonomousSessionStatut = 'a_faire' | 'en_cours' | 'terminee' | 'en_retard' | 'manquee'
export type TriggerType = 'pre_entrainement' | 'pre_competition' | 'quotidien' | 'post_entrainement' | 'libre'

// Exercice ordonné dans une séance autonomie ou un template
export interface ExerciceOrdonné {
  exercise_id: string
  ordre: number
  consignes: string
}

// Séance en cabinet (présentiel ou visio)
export interface CabinetSession {
  id: string
  coach_id: string
  client_id: string
  date_seance: string
  duree_minutes: number | null
  objectif: string
  contenu: string | null
  observations: string | null
  prochaine_etape: string | null
  exercices_utilises: ExerciceOrdonné[]
  statut: CabinetSessionStatut
  created_at: string
  updated_at: string
}

// Séance en autonomie assignée par le coach
export interface AutonomousSession {
  id: string
  coach_id: string
  client_id: string
  titre: string
  objectif: string
  exercices: ExerciceOrdonné[]
  date_cible: string | null
  statut: AutonomousSessionStatut
  date_realisation: string | null
  duree_realisee: number | null
  feedback_client: string | null
  created_at: string
  updated_at: string
}

// Exercice enrichi avec les données complètes depuis la bibliothèque
export interface ExerciceEnrichi extends ExerciceOrdonné {
  exercise: Exercise | null
}

// Séance autonomie enrichie avec les données des exercices (vue client)
export type AutonomousSessionEnrichi = Omit<AutonomousSession, 'exercices'> & {
  exercices: ExerciceEnrichi[]
}

// Template récurrent (routine pré-comp, quotidienne, etc.)
export interface RecurringTemplate {
  id: string
  coach_id: string
  client_id: string
  titre: string
  description: string | null
  exercices: ExerciceOrdonné[]
  duree_estimee: number | null
  trigger_type: TriggerType | null
  is_active: boolean
  created_at: string
}

// Exécution d'un template récurrent
export interface RecurringExecution {
  id: string
  template_id: string
  client_id: string
  started_at: string
  completed: boolean
  duree_minutes: number | null
  feedback: string | null
  data: Record<string, unknown>
}

// Élément de timeline fusionnant les 3 types de séances
export interface SessionHistoryItem {
  type: 'cabinet' | 'autonomie' | 'recurrente'
  date: string
  cabinet?: CabinetSession
  autonomous?: AutonomousSession
  execution?: RecurringExecution & { template: RecurringTemplate }
}

// Métriques d'observance pour le dashboard coach
export interface SessionsObservanceMetrics {
  taux_completion: number
  seances_en_retard: number
  seances_ce_mois: number
  derniere_seance_cabinet: string | null
}

// Option de select pour les clients (formulaires de séances)
export interface ClientSelectOption {
  id: string
  nom: string
  prenom: string
}

// ============================================================
// MODULE TESTS COGNITIFS FRONTEND — Étape 18
// Interfaces pour la passation des tests trial-based
// ============================================================

// Données d'un trial envoyées par le client au serveur
export interface TrialInput {
  trial_index: number
  stimulus_type: string
  stimulus_data: Record<string, unknown>
  response_data: Record<string, unknown> | null
  reaction_time_ms: number | null
  is_correct: boolean | null
  is_anticipation: boolean
  is_lapse: boolean
}

// Configuration spécifique pour chaque test cognitif (stockée dans cognitive_test_definitions.config)
export interface PVTConfig {
  duration_seconds: number
  isi_min_ms: number
  isi_max_ms: number
  lapse_threshold_ms: number
  anticipation_threshold_ms: number
}

export interface StroopConfig {
  trials_per_condition: number
  fixation_duration_ms: number
  feedback_duration_ms: number
  timeout_ms: number
}

export interface SimonConfig {
  trials_per_condition: number
  fixation_duration_ms: number
  timeout_ms: number
}

export interface DigitalSpanConfig {
  min_span: number
  max_span: number
  digit_display_ms: number
  inter_digit_ms: number
}

export type CognitiveTestConfig = PVTConfig | StroopConfig | SimonConfig | DigitalSpanConfig

// Métriques calculées après la passation (stockées dans cognitive_sessions.computed_metrics)
// Nommage selon spec étape 19
export interface CognitiveTestResult {
  // PVT
  median_rt?: number
  mean_rt?: number
  mean_reciprocal_rt?: number
  fastest_10pct_rt?: number
  slowest_10pct_rt?: number
  lapse_count?: number
  false_start_count?: number
  cv?: number
  // Stroop
  mean_rt_congruent?: number
  mean_rt_incongruent?: number
  stroop_effect_rt?: number
  accuracy_congruent?: number
  accuracy_incongruent?: number
  stroop_effect_accuracy?: number
  inverse_efficiency?: number
  // Simon
  simon_effect_rt?: number
  simon_effect_accuracy?: number
  // Digital Span
  span_forward?: number
  span_backward?: number
  total_span?: number
  longest_sequence?: number
  global_accuracy?: number
}

// ============================================================
// ADMINISTRATION — Types pour les pages admin
// ============================================================

export interface AdminUser extends User {
  email: string
  test_count: number
}

export interface AdminExpertWithStats {
  user_id: string
  nom: string
  prenom: string | null
  email: string
  subscription_tier: SubscriptionTier
  badge_certifie: boolean
  is_visible: boolean
  nb_dispatches: number
  note_moyenne: number
  nb_avis: number
  taux_reponse: number
  last_login_at: string | null
  // Onboarding checklist
  has_photo: boolean
  has_bio: boolean
  has_titre: boolean
  has_specialites: boolean
}

export interface MonitoringMetric {
  key: string
  label: string
  value: number | string
  previous: number | string
  unit?: string
  frequency: 'quotidien' | 'hebdo' | 'mensuel'
  delta_pct: number | null
}

export interface DashboardChartData {
  mrrEvolution: { month: string; mrr: number }[]
  tierDistribution: { tier: string; count: number }[]
  testsByDay: { date: string; profilage: number; cognitif: number }[]
}

export interface AdminDashboardStats {
  // Tests
  tests_today_profilage: number
  tests_today_cognitif: number
  // Revenus
  mrr_this_month: number
  // Inscriptions
  signups_this_week: number
  // Dispatches
  dispatches_pending: number
  // Alertes
  alert_pending_2h: number
  alert_expert_4h: number
}

export interface AdminContentExercise {
  id: string
  titre: string
  description: string | null
  categorie: string | null
  format: string
  is_custom: boolean
  is_public: boolean
  coach_id: string | null
  coach_nom: string | null
}

export interface AdminQuestion {
  id: string
  text_fr: string
  is_reversed: boolean
  is_active: boolean
  level_required: string | null
  test_definition_id: string
  test_definition_slug: string
  competency_node_id: string
  competency_node_name: string
}

export interface AdminProfile {
  id: string
  name: string
  color: string
  family: string | null
  description: string | null
  strengths: string | null
  weaknesses: string | null
  recommendations: string | null
  test_definition_id: string
  test_definition_name: string
}

// Annotations coach sur les compétences d'un test
export interface CoachNote {
  id: string
  test_id: string
  coach_id: string
  node_id: string
  note: string
  created_at: string
  updated_at: string
}

// Map node_id → note pour accès rapide côté composant
export type CoachNotesMap = Record<string, string>

// ============================================================
// Module Programme
// ============================================================

export type ProgrammeStatut = 'actif' | 'archive'

export type TypeSeance = 'cabinet' | 'autonomie' | 'recurrente'

export interface Programme {
  id: string
  coach_id: string
  client_id: string
  nom: string
  description: string | null
  statut: ProgrammeStatut
  created_at: string
  updated_at: string
}

export interface ProgrammeEtape {
  id: string
  programme_id: string
  ordre: number
  type_seance: TypeSeance
  cabinet_session_id: string | null
  autonomous_session_id: string | null
  recurring_template_id: string | null
  created_at: string
}

export interface ProgrammeEtapeEnrichie extends ProgrammeEtape {
  // Données dénormalisées pour affichage (une seule sera non-null selon type_seance)
  cabinet?: CabinetSession
  autonomous?: AutonomousSession
  template?: RecurringTemplate
  // Statut de complétion calculé
  est_complete: boolean
  titre_display: string
}

// Programme enrichi avec ses étapes et les données brutes des séances
export interface ProgrammeAvecEtapes extends Programme {
  etapes: ProgrammeEtapeEnrichie[]
}

// Statistiques d'avancement d'un programme
export interface ProgrammeStats {
  programme_id: string
  total_etapes: number
  etapes_completes: number
  taux_completion: number
}
