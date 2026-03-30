'use client'

import { useState } from 'react'
import Link from 'next/link'
import { forgotPasswordAction } from '@/app/actions/auth'
import { forgotPasswordSchema, type ForgotPasswordFormData } from '@/lib/validations/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setEmailError(null)

    const formData: ForgotPasswordFormData = { email }
    const parsed = forgotPasswordSchema.safeParse(formData)
    if (!parsed.success) {
      setEmailError(parsed.error.issues[0].message)
      return
    }

    setIsLoading(true)
    try {
      const result = await forgotPasswordAction(formData)
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
          <h2 className="text-xl font-semibold">Email envoyé</h2>
          <p className="text-muted-foreground text-sm">
            Vérifiez votre boîte mail. Si un compte existe pour <strong>{email}</strong>,
            vous recevrez un lien de réinitialisation.
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
        <h2 className="text-2xl font-semibold">Mot de passe oublié</h2>
        <p className="text-muted-foreground text-sm">
          Entrez votre email pour recevoir un lien de réinitialisation.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="vous@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
            {emailError && <p className="text-xs text-destructive">{emailError}</p>}
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">{error}</p>
          )}

          <Button type="submit" className="w-full bg-teal text-white hover:bg-teal/90" disabled={isLoading}>
            {isLoading ? 'Envoi…' : 'Envoyer le lien'}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link href="/login" className="text-teal hover:underline">
            ← Retour à la connexion
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
