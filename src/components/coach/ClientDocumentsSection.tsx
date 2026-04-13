'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Download, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { uploadClientDocumentAction } from '@/app/actions/clients'
import type { ClientDocument } from '@/types'

const TYPE_LABELS: Record<ClientDocument['type'], string> = {
  inscription: 'Dossier d\'inscription',
  contrat: 'Contrat',
  autre: 'Autre',
}

interface ClientDocumentsSectionProps {
  clientId: string
  documents: Array<ClientDocument & { url: string }>
}

export function ClientDocumentsSection({ clientId, documents }: ClientDocumentsSectionProps) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()
  const [docType, setDocType] = useState<ClientDocument['type']>('inscription')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formRef.current) return
    setError(null)
    setSuccess(false)
    const formData = new FormData(formRef.current)
    formData.set('type', docType)
    startTransition(async () => {
      const result = await uploadClientDocumentAction(clientId, formData)
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
        formRef.current?.reset()
        setDocType('inscription')
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Liste des documents existants */}
      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun document joint.</p>
      ) : (
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li key={`${doc.uploaded_at}-${doc.name}`} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="font-medium truncate">{doc.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {TYPE_LABELS[doc.type]} · {new Date(doc.uploaded_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 shrink-0"
              >
                <Button size="sm" variant="outline" className="gap-1 h-7 text-xs">
                  <Download className="h-3 w-3" />
                  Télécharger
                </Button>
              </a>
            </li>
          ))}
        </ul>
      )}

      {/* Formulaire d'upload */}
      <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Input
            name="name"
            placeholder="Nom du document (ex: Dossier 2024)"
            required
            disabled={isPending}
          />
          <Select value={docType} onValueChange={(v) => setDocType(v as ClientDocument['type'])}>
            <SelectTrigger disabled={isPending}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inscription">Dossier d&apos;inscription</SelectItem>
              <SelectItem value="contrat">Contrat</SelectItem>
              <SelectItem value="autre">Autre</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Input
          name="file"
          type="file"
          accept=".pdf,application/pdf"
          required
          disabled={isPending}
          className="cursor-pointer"
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        {success && <p className="text-xs text-green-600">Document joint avec succès.</p>}
        <Button type="submit" size="sm" disabled={isPending} className="gap-1">
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          {isPending ? 'Upload en cours…' : 'Joindre le document'}
        </Button>
      </form>
    </div>
  )
}
