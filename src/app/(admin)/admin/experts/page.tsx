import { getAdminExpertsAction } from '@/app/actions/admin'
import { ExpertsTableClient } from './ExpertsTableClient'

export default async function AdminExpertsPage() {
  const { data: experts, error } = await getAdminExpertsAction()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#141325]">Pool d&apos;experts</h1>
        <p className="text-muted-foreground">
          Gestion des experts certifiés MINND — badges, visibilité et onboarding
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 text-sm">
          Erreur : {error}
        </div>
      ) : (
        <ExpertsTableClient initialExperts={experts} />
      )}
    </div>
  )
}
