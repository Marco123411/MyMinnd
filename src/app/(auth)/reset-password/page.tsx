'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { resetPasswordAction } from '@/app/actions/auth'
import { resetPasswordSchema, type ResetPasswordFormData } from '@/lib/validations/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [formData, setFormData] = useState<ResetPasswordFormData>({
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ResetPasswordFormData, string>>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})

    const parsed = resetPasswordSchema.safeParse(formData)
    if (!parsed.success) {
      const errors: Partial<Record<keyof ResetPasswordFormData, string>> = {}
      parsed.error.issues.forEach((err: z.ZodIssue) => {
        const field = err.path[0] as keyof ResetPasswordFormData
        errors[field] = err.message
      })
      setFieldErrors(errors)
      return
    }

    setIsLoading(true)
    try {
      const result = await resetPasswordAction(formData)
      if (result?.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        setTimeout(() => router.push('/login'), 2000)
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6 space-y-3 text-center">
          <div className="text-4xl">✅</div>
          <h2 className="text-xl font-semibold">Mot de passe mis à jour</h2>
          <p className="text-muted-foreground text-sm">
            Redirection vers la connexion…
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader className="space-y-1 pb-4">
        <h2 className="text-2xl font-semibold">Nouveau mot de passe</h2>
        <p className="text-muted-foreground text-sm">Choisissez un nouveau mot de passe sécurisé.</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="password">Nouveau mot de passe (min. 8 caractères)</Label>
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
            <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={formData.confirmPassword}
              onChange={(e) => setFormData((f) => ({ ...f, confirmPassword: e.target.value }))}
              disabled={isLoading}
            />
            {fieldErrors.confirmPassword && (
              <p className="text-xs text-destructive">{fieldErrors.confirmPassword}</p>
            )}
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">{error}</p>
          )}

          <Button type="submit" className="w-full bg-teal text-white hover:bg-teal/90" disabled={isLoading}>
            {isLoading ? 'Mise à jour…' : 'Mettre à jour le mot de passe'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
