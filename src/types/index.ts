// User & auth
export type UserRole = 'client' | 'coach' | 'admin'
export type ClientContext = 'sport' | 'corporate' | 'wellbeing' | 'coaching'

export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
  context?: ClientContext
  avatar_url?: string
  created_at: string
  updated_at: string
}

// Test engine
export type TestLevel = 'discovery' | 'complete' | 'expert'
export type TestType = 'profiling' | 'cognitive'

export interface CompetencyNode {
  id: string
  label: string
  parent_id?: string
  weight?: number
  invert?: boolean // score inversion: 11 - response
  children?: CompetencyNode[]
}

export interface TestDefinition {
  id: string
  name: string
  slug: string
  type: TestType
  levels: TestLevel[]
  competency_tree: CompetencyNode[]
  created_at: string
}

// Test sessions
export interface TestScores {
  global: number                   // mean of ALL leaves
  domains: Record<string, number>  // mean of leaf children
  leaves: Record<string, number>   // mean of responses
  percentile?: number
  profile_id?: string
}

export interface TestSession {
  id: string
  user_id: string
  test_definition_id: string
  level: TestLevel
  status: 'in_progress' | 'completed' | 'abandoned'
  responses: Record<string, number>
  scores?: TestScores
  created_at: string
  completed_at?: string
}
