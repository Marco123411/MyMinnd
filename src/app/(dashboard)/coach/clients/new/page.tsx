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
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { X } from 'lucide-react'
import { clientSchema, type ClientFormData } from '@/lib/validations/clients'
import { createClientAction } from '@/app/actions/clients'

type FieldErrors = Partial<Record<keyof ClientFormData, string>>

const DEFAULT_FORM: ClientFormData = {
  nom: '',
  email: '',
  context: 'sport',
  sport: '',
  niveau: undefined,
  entreprise: '',
  poste: '',
  date_naissance: '',
  objectifs: '',
  notes_privees: '',
  statut: 'actif',
  tags: [],
}

export default function NewClientPage() {
  const router = useRouter()
  const [formData, setFormData] = useState<ClientFormData>(DEFAULT_FORM)
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
      const result = await createClientAction(parsed.data)
      if (result.error) {
        setError(result.error)
        return
      }
      router.push(`/coach/clients/${result.data?.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur inattendue est survenue')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#1A1A2E]">Nouveau client</h1>
        <p className="mt-1 text-sm text-muted-foreground">Renseignez les informations de base.</p>
      </div>

      <Card>
        <CardHeader />
        <CardContent>
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
                placeholder="Dupont"
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
                placeholder="client@exemple.com"
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
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sport">Sport</SelectItem>
                  <SelectItem value="corporate">Corporate</SelectItem>
                  <SelectItem value="wellbeing">Bien-être</SelectItem>
                  <SelectItem value="coaching">Coaching</SelectItem>
                </SelectContent>
              </Select>
              {fieldErrors.context && <p className="text-xs text-destructive">{fieldErrors.context}</p>}
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
                    placeholder="Football, Tennis…"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Niveau</Label>
                  <Select
                    value={formData.niveau ?? ''}
                    onValueChange={(v) => update({ niveau: v as ClientFormData['niveau'] })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner…" />
                    </SelectTrigger>
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
                    placeholder="Nom de l'entreprise"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="poste">Poste</Label>
                  <Input
                    id="poste"
                    value={formData.poste ?? ''}
                    onChange={(e) => update({ poste: e.target.value })}
                    placeholder="Directeur commercial…"
                  />
                </div>
              </div>
            )}

            {/* Date de naissance */}
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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addTag()
                    }
                  }}
                  placeholder="Appuyer sur Entrée pour ajouter"
                />
                <Button type="button" variant="outline" onClick={addTag}>
                  Ajouter
                </Button>
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
                placeholder="Objectifs du client…"
                rows={3}
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="outline" asChild>
                <Link href="/coach/clients">Annuler</Link>
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="bg-[#20808D] text-white hover:bg-[#20808D]/90"
              >
                {isLoading ? 'Création…' : 'Créer le client'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
