'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Moon, Sun, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { updateClientSettings, deleteClientAccount } from '@/app/actions/client-data'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { ClientContext, ClientNiveau } from '@/types'

const contextOptions: Array<{ value: ClientContext; label: string }> = [
  { value: 'sport', label: 'Sport' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'wellbeing', label: 'Bien-être' },
  { value: 'coaching', label: 'Coaching' },
]

const niveauOptions: Array<{ value: ClientNiveau; label: string }> = [
  { value: 'amateur', label: 'Amateur' },
  { value: 'semi-pro', label: 'Semi-pro' },
  { value: 'professionnel', label: 'Professionnel' },
  { value: 'elite', label: 'Élite' },
]

export default function SettingsPage() {
  const { user, isLoading } = useUser()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const supabase = useMemo(() => createClient(), [])

  // Profil form state
  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [context, setContext] = useState<ClientContext>('wellbeing')
  const [sport, setSport] = useState('')
  const [niveau, setNiveau] = useState<ClientNiveau | ''>('')
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [profileSaving, setProfileSaving] = useState(false)

  // Password form state
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [passwordSaving, setPasswordSaving] = useState(false)

  // Dark mode
  const [darkMode, setDarkMode] = useState(false)

  // Delete confirm
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Pré-remplir le formulaire quand l'utilisateur est chargé
  useEffect(() => {
    if (user) {
      setNom(user.nom ?? '')
      setPrenom(user.prenom ?? '')
      setContext((user.context as ClientContext) ?? 'wellbeing')
    }
  }, [user])

  // Dark mode — lire depuis localStorage
  useEffect(() => {
    const stored = localStorage.getItem('theme')
    const isDark = stored === 'dark' || (!stored && document.documentElement.classList.contains('dark'))
    setDarkMode(isDark)
  }, [])

  const toggleDarkMode = useCallback(() => {
    const next = !darkMode
    setDarkMode(next)
    if (next) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [darkMode])

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault()
    setProfileSaving(true)
    setProfileMsg(null)

    const result = await updateClientSettings({
      nom,
      prenom: prenom || undefined,
      context: context as ClientContext,
      sport: sport || undefined,
      niveau: niveau || undefined,
    })

    setProfileSaving(false)
    setProfileMsg(result.success
      ? { type: 'success', text: 'Profil mis à jour avec succès.' }
      : { type: 'error', text: result.error ?? 'Une erreur est survenue.' })
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setPasswordMsg(null)

    if (newPassword.length < 8) {
      setPasswordMsg({ type: 'error', text: 'Le mot de passe doit contenir au moins 8 caractères.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Les mots de passe ne correspondent pas.' })
      return
    }

    setPasswordSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPasswordSaving(false)

    if (error) {
      setPasswordMsg({ type: 'error', text: error.message })
    } else {
      setPasswordMsg({ type: 'success', text: 'Mot de passe mis à jour.' })
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true)
    await deleteClientAccount()
    // La redirection est gérée dans l'action serveur
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#141325]">Paramètres</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Gérez votre compte et vos préférences</p>
      </div>

      {/* ─── Profil ─── */}
      <Card>
        <CardContent className="pt-5">
          <h2 className="font-semibold text-foreground mb-4">Mon profil</h2>
          <form onSubmit={handleProfileSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="nom">Nom</Label>
                <Input
                  id="nom"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prenom">Prénom</Label>
                <Input
                  id="prenom"
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Contexte</Label>
              <div className="grid grid-cols-2 gap-2">
                {contextOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setContext(opt.value)}
                    className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                      context === opt.value
                        ? 'border-[#7069F4] bg-[#F1F0FE] text-[#7069F4] font-medium'
                        : 'border-border hover:border-muted-foreground'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {context === 'sport' && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="sport">Sport pratiqué</Label>
                  <Input
                    id="sport"
                    value={sport}
                    onChange={(e) => setSport(e.target.value)}
                    placeholder="Ex : Football, Tennis, Natation…"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Niveau</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {niveauOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setNiveau(opt.value)}
                        className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                          niveau === opt.value
                            ? 'border-[#7069F4] bg-[#F1F0FE] text-[#7069F4] font-medium'
                            : 'border-border hover:border-muted-foreground'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {profileMsg && (
              <p
                className={`text-sm ${
                  profileMsg.type === 'success' ? 'text-green-600' : 'text-red-500'
                }`}
              >
                {profileMsg.text}
              </p>
            )}

            <Button
              type="submit"
              disabled={profileSaving}
              className="w-full bg-[#7069F4] hover:bg-[#5B54D6]"
            >
              {profileSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enregistrer
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ─── Sécurité ─── */}
      <Card>
        <CardContent className="pt-5">
          <h2 className="font-semibold text-foreground mb-4">Sécurité</h2>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={user?.email ?? ''}
                readOnly
                className="bg-muted text-muted-foreground"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">Nouveau mot de passe</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>

            {passwordMsg && (
              <p
                className={`text-sm ${
                  passwordMsg.type === 'success' ? 'text-green-600' : 'text-red-500'
                }`}
              >
                {passwordMsg.text}
              </p>
            )}

            <Button
              type="submit"
              disabled={passwordSaving}
              variant="outline"
              className="w-full"
            >
              {passwordSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Changer le mot de passe
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* ─── Apparence ─── */}
      <Card>
        <CardContent className="pt-5">
          <h2 className="font-semibold text-foreground mb-4">Apparence</h2>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {darkMode ? (
                <Moon className="h-5 w-5 text-muted-foreground" />
              ) : (
                <Sun className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <p className="text-sm font-medium">Mode sombre</p>
                <p className="text-xs text-muted-foreground">
                  {darkMode ? 'Activé' : 'Désactivé'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleDarkMode}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                darkMode ? 'bg-[#7069F4]' : 'bg-muted'
              }`}
              aria-label="Basculer le mode sombre"
            >
              <span
                className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  darkMode ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* ─── Zone danger ─── */}
      <Card className="border-red-200">
        <CardContent className="pt-5">
          <h2 className="font-semibold text-red-600 mb-2">Zone sensible</h2>
          <p className="text-sm text-muted-foreground mb-4">
            La suppression de votre compte est irréversible. Toutes vos données seront désactivées.
          </p>
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-red-300 text-red-600 hover:bg-red-50">
                Supprimer mon compte
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Supprimer votre compte ?</DialogTitle>
                <DialogDescription>
                  Cette action désactivera votre compte. Vous ne pourrez plus accéder à votre espace
                  ni à vos résultats. Cette action ne peut pas être annulée.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                  Annuler
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                >
                  {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirmer la suppression
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  )
}
