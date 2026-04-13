'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { X, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { upsertExpertProfileAction } from '@/app/actions/marketplace'
import { MARKETPLACE_CONTEXTES, MARKETPLACE_PUBLIC_CIBLE } from '@/lib/constants/marketplace'
import type { ExpertProfile, ClientContext, ExpertPublicCible } from '@/types'

interface ExpertProfileFormProps {
  profile: ExpertProfile | null
  onSuccess: () => void
}

export function ExpertProfileForm({ profile, onSuccess }: ExpertProfileFormProps) {
  const [titre, setTitre] = useState(profile?.titre ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [localisation, setLocalisation] = useState(profile?.localisation ?? '')
  const [tarifSeance, setTarifSeance] = useState(profile?.tarif_seance?.toString() ?? '')
  const [specialites, setSpecialites] = useState<string[]>(profile?.specialites ?? [])
  const [newSpecialite, setNewSpecialite] = useState('')
  const [sports, setSports] = useState<string[]>(profile?.sports ?? [])
  const [newSport, setNewSport] = useState('')
  const [contextes, setContextes] = useState<ClientContext[]>(
    (profile?.contexts_couverts ?? ['sport']) as ClientContext[]
  )
  const [publicCible, setPublicCible] = useState<ExpertPublicCible[]>(
    (profile?.public_cible ?? []) as ExpertPublicCible[]
  )
  const [isVisible, setIsVisible] = useState(profile?.is_visible ?? true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, startTransition] = useTransition()

  const toggleContext = (v: ClientContext) => {
    setContextes((prev) =>
      prev.includes(v) ? prev.filter((c) => c !== v) : [...prev, v]
    )
  }

  const togglePublicCible = (v: ExpertPublicCible) => {
    setPublicCible((prev) =>
      prev.includes(v) ? prev.filter((c) => c !== v) : [...prev, v]
    )
  }

  const addTag = (list: string[], setList: (v: string[]) => void, value: string, clear: () => void) => {
    const trimmed = value.trim()
    if (trimmed && !list.includes(trimmed)) {
      setList([...list, trimmed])
      clear()
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    startTransition(async () => {
      const result = await upsertExpertProfileAction({
        titre,
        bio,
        localisation,
        specialites,
        sports,
        contexts_couverts: contextes,
        public_cible: publicCible,
        tarif_seance: tarifSeance ? parseFloat(tarifSeance) : null,
        is_visible: isVisible,
      })

      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        onSuccess()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Visibilité */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <p className="font-medium text-sm">Visible sur la marketplace</p>
          <p className="text-xs text-muted-foreground">Activez pour apparaître dans l&apos;annuaire public</p>
        </div>
        <Switch checked={isVisible} onCheckedChange={setIsVisible} />
      </div>

      {/* Titre */}
      <div className="space-y-1.5">
        <Label htmlFor="titre">Titre professionnel *</Label>
        <Input
          id="titre"
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          placeholder="Ex : Préparateur mental certifié MINND"
          required
          maxLength={200}
        />
      </div>

      {/* Bio */}
      <div className="space-y-1.5">
        <Label htmlFor="bio">
          Bio <span className="text-muted-foreground text-xs">({bio.length}/500)</span>
        </Label>
        <Textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Présentez votre approche, votre parcours et ce que vous apportez à vos clients..."
          required
          maxLength={500}
          rows={4}
          className="resize-none"
        />
      </div>

      {/* Localisation + Tarif */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="localisation">Localisation *</Label>
          <Input
            id="localisation"
            value={localisation}
            onChange={(e) => setLocalisation(e.target.value)}
            placeholder="Paris, Île-de-France..."
            required
            maxLength={200}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="tarif">Tarif indicatif (€/séance)</Label>
          <Input
            id="tarif"
            type="number"
            min="0"
            step="0.01"
            value={tarifSeance}
            onChange={(e) => setTarifSeance(e.target.value)}
            placeholder="Ex : 120"
          />
        </div>
      </div>

      {/* Spécialités */}
      <div className="space-y-2">
        <Label>Spécialités *</Label>
        <div className="flex gap-2">
          <Input
            value={newSpecialite}
            onChange={(e) => setNewSpecialite(e.target.value)}
            placeholder="Ajouter une spécialité..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addTag(specialites, setSpecialites, newSpecialite, () => setNewSpecialite(''))
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => addTag(specialites, setSpecialites, newSpecialite, () => setNewSpecialite(''))}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {specialites.map((s) => (
            <Badge key={s} variant="secondary" className="gap-1">
              {s}
              <button type="button" onClick={() => setSpecialites(specialites.filter((x) => x !== s))}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      </div>

      {/* Sports */}
      <div className="space-y-2">
        <Label>Sports couverts</Label>
        <div className="flex gap-2">
          <Input
            value={newSport}
            onChange={(e) => setNewSport(e.target.value)}
            placeholder="Ajouter un sport..."
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addTag(sports, setSports, newSport, () => setNewSport(''))
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => addTag(sports, setSports, newSport, () => setNewSport(''))}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {sports.map((s) => (
            <Badge key={s} variant="secondary" className="gap-1">
              {s}
              <button type="button" onClick={() => setSports(sports.filter((x) => x !== s))}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      </div>

      {/* Contextes */}
      <div className="space-y-2">
        <Label>Contextes couverts *</Label>
        <div className="flex flex-wrap gap-2">
          {MARKETPLACE_CONTEXTES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => toggleContext(c.value)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm border transition-colors',
                contextes.includes(c.value)
                  ? 'bg-[#7069F4] text-white border-[#7069F4]'
                  : 'bg-background text-muted-foreground border-border hover:border-[#7069F4]'
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Public cible */}
      <div className="space-y-2">
        <Label>Public cible</Label>
        <div className="flex flex-wrap gap-2">
          {MARKETPLACE_PUBLIC_CIBLE.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => togglePublicCible(p.value)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm border transition-colors',
                publicCible.includes(p.value)
                  ? 'bg-[#7069F4] text-white border-[#7069F4]'
                  : 'bg-background text-muted-foreground border-border hover:border-[#7069F4]'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && (
        <p className="text-sm text-[#7069F4] font-medium">Profil sauvegardé avec succès !</p>
      )}

      <Button
        type="submit"
        disabled={isPending}
        className="w-full bg-[#7069F4] hover:bg-[#7069F4]/90"
      >
        {isPending ? 'Sauvegarde...' : profile ? 'Mettre à jour le profil' : 'Créer mon profil expert'}
      </Button>
    </form>
  )
}
