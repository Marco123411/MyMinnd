'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { User, Lock, CheckCircle2 } from 'lucide-react'
import { updateProfileAction, changePasswordAction } from '@/app/actions/auth'

interface SettingsPageClientProps {
  nom: string
  prenom: string
  email: string
}

export function SettingsPageClient({ nom, prenom, email }: SettingsPageClientProps) {
  // ── Profil ────────────────────────────────────────────────────────────────
  const [profileNom, setProfileNom] = useState(nom)
  const [profilePrenom, setProfilePrenom] = useState(prenom)
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPendingProfile, startProfile] = useTransition()

  function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault()
    setProfileMessage(null)
    startProfile(async () => {
      const result = await updateProfileAction({ nom: profileNom, prenom: profilePrenom || undefined })
      if (result.error) {
        setProfileMessage({ type: 'error', text: result.error })
      } else {
        setProfileMessage({ type: 'success', text: 'Profil mis à jour.' })
      }
    })
  }

  // ── Mot de passe ──────────────────────────────────────────────────────────
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isPendingPassword, startPassword] = useTransition()

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPasswordMessage(null)
    startPassword(async () => {
      const result = await changePasswordAction({ password, confirmPassword })
      if (result.error) {
        setPasswordMessage({ type: 'error', text: result.error })
      } else {
        setPasswordMessage({ type: 'success', text: 'Mot de passe modifié.' })
        setPassword('')
        setConfirmPassword('')
      }
    })
  }

  return (
    <div className="space-y-6 max-w-xl">
      {/* Informations personnelles */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-[#20808D]" />
            Informations personnelles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="prenom">Prénom</Label>
                <Input
                  id="prenom"
                  value={profilePrenom}
                  onChange={(e) => setProfilePrenom(e.target.value)}
                  placeholder="Prénom"
                  disabled={isPendingProfile}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nom">Nom</Label>
                <Input
                  id="nom"
                  value={profileNom}
                  onChange={(e) => setProfileNom(e.target.value)}
                  placeholder="Nom"
                  disabled={isPendingProfile}
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={email}
                disabled
                className="bg-muted text-muted-foreground"
              />
              <p className="text-xs text-muted-foreground">
                Pour modifier votre email, contactez le support.
              </p>
            </div>
            {profileMessage && (
              <p className={`text-sm flex items-center gap-1.5 ${profileMessage.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                {profileMessage.type === 'success' && <CheckCircle2 className="h-4 w-4" />}
                {profileMessage.text}
              </p>
            )}
            <Button
              type="submit"
              disabled={isPendingProfile}
              className="bg-[#20808D] hover:bg-[#1a6b77] text-white"
            >
              {isPendingProfile ? 'Sauvegarde…' : 'Sauvegarder'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Sécurité */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4 text-[#20808D]" />
            Mot de passe
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">Nouveau mot de passe</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 8 caractères"
                disabled={isPendingPassword}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Répétez le mot de passe"
                disabled={isPendingPassword}
                required
              />
            </div>
            {passwordMessage && (
              <p className={`text-sm flex items-center gap-1.5 ${passwordMessage.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                {passwordMessage.type === 'success' && <CheckCircle2 className="h-4 w-4" />}
                {passwordMessage.text}
              </p>
            )}
            <Button
              type="submit"
              disabled={isPendingPassword || !password || !confirmPassword}
              className="bg-[#20808D] hover:bg-[#1a6b77] text-white"
            >
              {isPendingPassword ? 'Modification…' : 'Modifier le mot de passe'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
