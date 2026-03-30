'use client'

import { useState } from 'react'
import Link from 'next/link'
import { z } from 'zod'
import { signUpAction } from '@/app/actions/auth'
import { registerSchema, type RegisterFormData } from '@/lib/validations/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type FieldErrors = Partial<Record<keyof RegisterFormData | 'context', string>>

export default function RegisterPage() {
  const [formData, setFormData] = useState<RegisterFormData>({
    email: '',
    password: '',
    nom: '',
    prenom: '',
    role: 'client',
    context: null,
  })
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})

    const parsed = registerSchema.safeParse(formData)
    if (!parsed.success) {
      const errors: FieldErrors = {}
      parsed.error.issues.forEach((err: z.ZodIssue) => {
        const field = err.path[0] as keyof RegisterFormData
        errors[field] = err.message
      })
      setFieldErrors(errors)
      return
    }

    setIsLoading(true)
    try {
      const result = await signUpAction(formData)
      if (result?.error) {
        setError(result.error)
      } else {
        setSuccess(true)
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6 space-y-3 text-center">
          <div className="text-4xl">✉️</div>
          <h2 className="text-xl font-semibold">Vérifiez votre email</h2>
          <p className="text-muted-foreground text-sm">
            Un lien de confirmation a été envoyé à <strong>{formData.email}</strong>.
            Cliquez dessus pour activer votre compte.
          </p>
          <Link href="/login" className="text-teal hover:underline text-sm">
            Retour à la connexion
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader className="space-y-1 pb-4">
        <h2 className="text-2xl font-semibold">Créer un compte</h2>
        <p className="text-muted-foreground text-sm">Rejoignez MINND.</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="nom">Nom *</Label>
              <Input
                id="nom"
                placeholder="Dupont"
                value={formData.nom}
                onChange={(e) => setFormData((f) => ({ ...f, nom: e.target.value }))}
                disabled={isLoading}
              />
              {fieldErrors.nom && <p className="text-xs text-destructive">{fieldErrors.nom}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="prenom">Prénom</Label>
              <Input
                id="prenom"
                placeholder="Jean"
                value={formData.prenom ?? ''}
                onChange={(e) => setFormData((f) => ({ ...f, prenom: e.target.value }))}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="vous@exemple.com"
              value={formData.email}
              onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))}
              disabled={isLoading}
            />
            {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="password">Mot de passe * (min. 8 caractères)</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData((f) => ({ ...f, password: e.target.value }))}
              disabled={isLoading}
            />
            {fieldErrors.password && (
              <p className="text-xs text-destructive">{fieldErrors.password}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label>Je suis *</Label>
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
              <Label>Mon contexte *</Label>
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

          <Button type="submit" className="w-full bg-teal text-white hover:bg-teal/90" disabled={isLoading}>
            {isLoading ? 'Création du compte…' : 'Créer mon compte'}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Déjà un compte ?{' '}
          <Link href="/login" className="text-teal hover:underline font-medium">
            Se connecter
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
