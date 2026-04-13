import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { getClientAction } from '@/app/actions/clients'
import { ClientEditForm } from './ClientEditForm'

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { data: client, error } = await getClientAction(id)

  if (error || !client) notFound()

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#141325]">Modifier {client.nom}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Mettez à jour les informations du client.</p>
      </div>

      <Card>
        <CardHeader />
        <CardContent>
          <ClientEditForm client={client} />
        </CardContent>
      </Card>
    </div>
  )
}
