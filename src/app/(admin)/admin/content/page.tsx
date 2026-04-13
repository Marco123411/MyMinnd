import {
  getAdminExercisesAction,
  getAdminProfilesAction,
  getAdminQuestionsAction,
  getAdminTestDefinitionsAction,
  getAdminCognitiveTestsAction,
} from '@/app/actions/admin'
import { ContentPageClient } from './ContentPageClient'

export default async function AdminContentPage() {
  const [exercisesResult, profilesResult, questionsResult, testDefsResult, cognitiveResult] =
    await Promise.all([
      getAdminExercisesAction(),
      getAdminProfilesAction(),
      getAdminQuestionsAction(),
      getAdminTestDefinitionsAction(),
      getAdminCognitiveTestsAction(),
    ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#141325]">Gestion du contenu</h1>
        <p className="text-muted-foreground">
          Exercices, profils mentaux, questions et configuration des tests cognitifs
        </p>
      </div>

      <ContentPageClient
        initialExercises={exercisesResult.data}
        initialProfiles={profilesResult.data}
        initialQuestions={questionsResult.data}
        testDefinitions={testDefsResult.data}
        cognitiveTests={cognitiveResult.data}
      />
    </div>
  )
}
