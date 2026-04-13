import { getMyProgrammeAction } from '@/app/actions/programmes'
import { ProgrammeProgress } from '@/components/client/ProgrammeProgress'
import { Card, CardContent } from '@/components/ui/card'
import { Layers } from 'lucide-react'

export default async function ClientProgrammePage() {
  const { data: programme, error } = await getMyProgrammeAction()

  if (error) {
    return <p className="text-sm text-red-600 p-4">{error}</p>
  }

  if (!programme) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="pt-6 pb-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Layers className="h-7 w-7 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-bold text-[#141325]">Pas encore de programme</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Votre coach vous assignera bientôt un programme personnalisé.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold text-[#141325]">Mon programme</h1>
      <ProgrammeProgress programme={programme} />
    </div>
  )
}
