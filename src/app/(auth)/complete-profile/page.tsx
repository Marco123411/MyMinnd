'use client'

import { useState } from 'react'
import { z } from 'zod'
import { completeProfileAction } from '@/app/actions/auth'
import { completeProfileSchema, type CompleteProfileFormData } from '@/lib/validations/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type FieldErrors = Partial<Record<keyof CompleteProfileFormData | 'context', string>>

export default function CompleteProfilePage() {
  const [formData, setFormData] = useState<CompleteProfileFormData>({
    role: 'client',
    context: null,
  })
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})

    const parsed = completeProfileSchema.safeParse(formData)
    if (!parsed.success) {
      const errors: FieldErrors = {}
      parsed.error.issues.forEach((err: z.ZodIssue) => {
        const field = err.path[0] as keyof CompleteProfileFormData
        errors[field] = err.message
      })
      setFieldErrors(errors)
      return
    }

    setIsLoading(true)
    try {
      const result = await completeProfileAction(formData)
      if (result?.error) setError(result.error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader className="space-y-1 pb-4">
        <h2 className="text-2xl font-semibold">Complétez votre profil</h2>
        <p className="text-muted-foreground text-sm">
          Dernière étape pour personnaliser votre expérience MINND.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label>Je suis</Label>
            <Select
              value={formData.role}
              onValueChange={(value) =>
                setFormData((f) => ({
                  ...f,
                  role: value as 'client' | 'coach',
                  context: value === 'coach' ? null : f.context,
                }))
              }
              disabled={isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choisir un rôle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client">Client (athlète, individu, professionnel)</SelectItem>
                <SelectItem value="coach">Coach / Praticien</SelectItem>
              </SelectContent>
            </Select>
            {fieldErrors.role && <p className="text-xs text-destructive">{fieldErrors.role}</p>}
          </div>

          {formData.role === 'client' && (
            <div className="space-y-1">
              <Label>Mon contexte</Label>
              <Select
                value={formData.context ?? ''}
                onValueChange={(value) =>
                  setFormData((f) => ({
                    ...f,
                    context: value as 'sport' | 'corporate' | 'wellbeing',
                  }))
                }
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un contexte" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sport">Sport</SelectItem>
                  <SelectItem value="corporate">Corporate / Entreprise</SelectItem>
                  <SelectItem value="wellbeing">Bien-être</SelectItem>
                </SelectContent>
              </Select>
              {fieldErrors.context && (
                <p className="text-xs text-destructive">{fieldErrors.context}</p>
              )}
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">{error}</p>
          )}

          <Button type="submit" className="w-full bg-[#7069F4] text-white hover:bg-[#5B54D6]" disabled={isLoading}>
            {isLoading ? 'Enregistrement…' : 'Accéder à mon espace'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
