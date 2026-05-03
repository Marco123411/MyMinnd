// User & auth — matches DB schema (public.users)
export type UserRole = 'client' | 'coach' | 'admin'
export type ClientContext = 'sport' | 'corporate' | 'wellbeing' | 'coaching'
export type SubscriptionTier = 'free' | 'pro'
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

export interface ClientDocument {
  name: string
  path: string  // chemin storage Supabase (pas une URL signée — générée à la volée côté serveur)
  type: 'inscription' | 'contrat' | 'autre'
  uploaded_at: string
  uploaded_by: string
}

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
  documents: ClientDocument[]
  manually_validated_at: string | null
  manually_validated_by: string | null
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
// ADMINISTRATION — Types pour les pages admin
// ============================================================

export interface AdminUser extends User {
  email: string
  test_count: number
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
  testsByDay: { date: string; profilage: number }[]
}

export interface AdminDashboardStats {
  // Tests
  tests_today_profilage: number
  // Revenus
  mrr_this_month: number
  // Inscriptions
  signups_this_week: number
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
  titre: string | null
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
  // Exercices Pre/In/Post liés à cette étape
  program_exercises: ProgramExercise[]
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

// Exercice bibliothèque dans un microcycle (Pre/In/Post)
export interface ProgramExercise {
  id: string
  programme_etape_id: string
  exercise_id: string | null
  phase: 'pre' | 'in' | 'post' | null
  display_order: number
  created_at: string
  completed_at: string | null
  exercises?: {
    id: string
    titre: string
    format: string
    description: string | null
  } | null
}
