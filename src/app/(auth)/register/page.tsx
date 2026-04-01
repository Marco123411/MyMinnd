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

type FieldErrors = Partial<Record<keyof RegisterFormData, string>>

export default function RegisterPage() {
  const [formData, setFormData] = useState<RegisterFormData>({
    email: '',
    password: '',
    nom: '',
    prenom: '',
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
        <h2 className="text-2xl font-semibold">Créer un compte Coach</h2>
        <p className="text-muted-foreground text-sm">Rejoignez la plateforme MINND.</p>
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

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">{error}</p>
          )}

          <Button type="submit" className="w-full bg-teal text-white hover:bg-teal/90" disabled={isLoading}>
            {isLoading ? 'Création du compte…' : 'Créer mon compte Coach'}
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
