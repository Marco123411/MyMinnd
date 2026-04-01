import { getAdminUsersAction } from '@/app/actions/admin'
import { UsersPageClient } from './UsersPageClient'

export default async function AdminUtilisateursPage() {
  const { data: users, error } = await getAdminUsersAction()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#1A1A2E]">Utilisateurs</h1>
        <p className="text-muted-foreground">
          Gestion des coachs, clients et administrateurs de la plateforme
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 text-sm">
          Erreur : {error}
        </div>
      ) : (
        <UsersPageClient initialUsers={users} />
      )}
    </div>
  )
}
