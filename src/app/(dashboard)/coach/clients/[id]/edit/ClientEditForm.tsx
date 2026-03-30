'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { X } from 'lucide-react'
import { clientSchema, type ClientFormData } from '@/lib/validations/clients'
import { updateClientAction } from '@/app/actions/clients'
import type { Client } from '@/types'

type FieldErrors = Partial<Record<keyof ClientFormData, string>>

interface ClientEditFormProps {
  client: Client
}

export function ClientEditForm({ client }: ClientEditFormProps) {
  const router = useRouter()
  const [formData, setFormData] = useState<ClientFormData>({
    nom: client.nom,
    email: client.email ?? '',
    context: client.context,
    sport: client.sport ?? '',
    niveau: client.niveau ?? undefined,
    entreprise: client.entreprise ?? '',
    poste: client.poste ?? '',
    date_naissance: client.date_naissance ?? '',
    objectifs: client.objectifs ?? '',
    notes_privees: client.notes_privees ?? '',
    statut: client.statut,
    tags: client.tags ?? [],
  })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [tagInput, setTagInput] = useState('')

  function update(patch: Partial<ClientFormData>) {
    setFormData((prev) => ({ ...prev, ...patch }))
  }

  function addTag() {
    const tag = tagInput.trim()
    if (tag && !formData.tags.includes(tag)) {
      update({ tags: [...formData.tags, tag] })
    }
    setTagInput('')
  }

  function removeTag(tag: string) {
    update({ tags: formData.tags.filter((t) => t !== tag) })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})

    const parsed = clientSchema.safeParse(formData)
    if (!parsed.success) {
      const errors: FieldErrors = {}
      parsed.error.issues.forEach((issue: z.ZodIssue) => {
        const key = issue.path[0] as keyof ClientFormData
        if (!errors[key]) errors[key] = issue.message
      })
      setFieldErrors(errors)
      return
    }

    setIsLoading(true)
    try {
      const result = await updateClientAction(client.id, parsed.data)
      if (result.error) {
        setError(result.error)
        return
      }
      router.push(`/coach/clients/${client.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur inattendue est survenue')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      {/* Nom */}
      <div className="space-y-1">
        <Label htmlFor="nom">Nom *</Label>
        <Input
          id="nom"
          value={formData.nom}
          onChange={(e) => update({ nom: e.target.value })}
        />
        {fieldErrors.nom && <p className="text-xs text-destructive">{fieldErrors.nom}</p>}
      </div>

      {/* Email */}
      <div className="space-y-1">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={formData.email ?? ''}
          onChange={(e) => update({ email: e.target.value })}
        />
        {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
      </div>

      {/* Context */}
      <div className="space-y-1">
        <Label>Contexte *</Label>
        <Select
          value={formData.context}
          onValueChange={(v) => update({ context: v as ClientFormData['context'] })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="sport">Sport</SelectItem>
            <SelectItem value="corporate">Corporate</SelectItem>
            <SelectItem value="wellbeing">Bien-être</SelectItem>
            <SelectItem value="coaching">Coaching</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Champs conditionnels — Sport */}
      {formData.context === 'sport' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="sport">Sport pratiqué</Label>
            <Input
              id="sport"
              value={formData.sport ?? ''}
              onChange={(e) => update({ sport: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label>Niveau</Label>
            <Select
              value={formData.niveau ?? ''}
              onValueChange={(v) => update({ niveau: v as ClientFormData['niveau'] })}
            >
              <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="amateur">Amateur</SelectItem>
                <SelectItem value="semi-pro">Semi-pro</SelectItem>
                <SelectItem value="professionnel">Professionnel</SelectItem>
                <SelectItem value="elite">Élite</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Champs conditionnels — Corporate */}
      {formData.context === 'corporate' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="entreprise">Entreprise</Label>
            <Input
              id="entreprise"
              value={formData.entreprise ?? ''}
              onChange={(e) => update({ entreprise: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="poste">Poste</Label>
            <Input
              id="poste"
              value={formData.poste ?? ''}
              onChange={(e) => update({ poste: e.target.value })}
            />
          </div>
        </div>
      )}

      {/* Statut */}
      <div className="space-y-1">
        <Label>Statut</Label>
        <Select
          value={formData.statut}
          onValueChange={(v) => update({ statut: v as ClientFormData['statut'] })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="actif">Actif</SelectItem>
            <SelectItem value="en_pause">En pause</SelectItem>
            <SelectItem value="archive">Archivé</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Date naissance */}
      <div className="space-y-1">
        <Label htmlFor="date_naissance">Date de naissance</Label>
        <Input
          id="date_naissance"
          type="date"
          value={formData.date_naissance ?? ''}
          onChange={(e) => update({ date_naissance: e.target.value })}
        />
      </div>

      {/* Tags */}
      <div className="space-y-1">
        <Label>Tags</Label>
        <div className="flex gap-2">
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
            placeholder="Appuyer sur Entrée pour ajouter"
          />
          <Button type="button" variant="outline" onClick={addTag}>Ajouter</Button>
        </div>
        {formData.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {formData.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                {tag}
                <button type="button" onClick={() => removeTag(tag)}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Objectifs */}
      <div className="space-y-1">
        <Label htmlFor="objectifs">Objectifs</Label>
        <Textarea
          id="objectifs"
          value={formData.objectifs ?? ''}
          onChange={(e) => update({ objectifs: e.target.value })}
          rows={3}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button variant="outline" asChild>
          <Link href={`/coach/clients/${client.id}`}>Annuler</Link>
        </Button>
        <Button
          type="submit"
          disabled={isLoading}
          className="bg-[#20808D] text-white hover:bg-[#20808D]/90"
        >
          {isLoading ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </div>
    </form>
  )
}
