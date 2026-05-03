'use client'

import { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { createInvitationAction, resendInvitationAction } from '@/app/actions/tests-invite'
import type { TestLevelConfig, TestLevelSlug, ClientContext } from '@/types'
import { Send, Copy, Check, ChevronDown } from 'lucide-react'

// Sous-ensemble de TestDefinition nécessaire pour le modal
interface TestDefinitionForModal {
  id: string
  slug: string
  name: string
  levels: TestLevelConfig[]
}

interface SendTestModalProps {
  clientId: string
  clientName: string
  clientContext: ClientContext
  clientEmail: string | null
  testDefinitions: TestDefinitionForModal[]
}

// Niveau MVP unique : on attribue toujours "complete", fallback sur le premier niveau disponible
const DEFAULT_LEVEL: TestLevelSlug = 'complete'

function pickDefaultLevel(levels: TestLevelConfig[] | undefined): TestLevelSlug {
  if (!levels || levels.length === 0) return DEFAULT_LEVEL
  const complete = levels.find((l) => l.slug === DEFAULT_LEVEL)
  return (complete?.slug ?? levels[0].slug) as TestLevelSlug
}

// Ordre de priorité par context pour afficher le test le plus pertinent en premier
const CONTEXT_PRIORITY: Record<ClientContext, string[]> = {
  sport: ['pma', 'pmc', 'pme', 'ops'],
  corporate: ['ops', 'pma', 'pmc', 'pme'],
  wellbeing: ['pme', 'pma', 'pmc', 'ops'],
  coaching: ['pmc', 'pma', 'pme', 'ops'],
}

type Step = 'select' | 'success'

export function SendTestModal({
  clientId,
  clientName,
  clientContext,
  clientEmail,
  testDefinitions,
}: SendTestModalProps) {
  // Trie les tests selon le context du client (F13: mémoïsé)
  const sortedDefinitions = useMemo(
    () =>
      [...testDefinitions].sort((a, b) => {
        const priority = CONTEXT_PRIORITY[clientContext] ?? []
        const ia = priority.indexOf(a.slug)
        const ib = priority.indexOf(b.slug)
        if (ia === -1 && ib === -1) return 0
        if (ia === -1) return 1
        if (ib === -1) return -1
        return ia - ib
      }),
    [testDefinitions, clientContext]
  )

  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('select')
  const [selectedDefinitionId, setSelectedDefinitionId] = useState<string>(
    sortedDefinitions[0]?.id ?? ''
  )
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [testId, setTestId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)

  function handleOpen(isOpen: boolean) {
    setOpen(isOpen)
    if (!isOpen) {
      setStep('select')
      setError(null)
      setInviteUrl(null)
      setTestId(null)
      setCopied(false)
      setEmailSent(false)
      setEmailError(null)
      setSelectedDefinitionId(sortedDefinitions[0]?.id ?? '')
    }
  }

  async function handleGenerate() {
    if (!selectedDefinitionId) return
    setIsLoading(true)
    setError(null)
    const def = testDefinitions.find((d) => d.id === selectedDefinitionId)
    const level = pickDefaultLevel(def?.levels)
    const result = await createInvitationAction(clientId, selectedDefinitionId, level)
    setIsLoading(false)
    if (result.error || !result.data) { setError(result.error ?? 'Erreur inattendue'); return }
    setInviteUrl(result.data.inviteUrl)
    setTestId(result.data.testId)
    // Si l'email a été envoyé automatiquement, marquer comme envoyé
    if (result.data.emailSent) setEmailSent(true)
    setStep('success')
  }

  async function handleCopy() {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleSendEmail() {
    if (!testId) return
    setEmailLoading(true)
    setEmailError(null)
    const result = await resendInvitationAction(testId)
    setEmailLoading(false)
    if (result.error) { setEmailError(result.error); return }
    setEmailSent(true)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button className="bg-[#7069F4] hover:bg-[#5B54D6]">
          <Send className="mr-2 h-4 w-4" />
          Envoyer un test
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === 'select' ? 'Envoyer un test à ' : 'Lien d\'invitation — '}
            <span className="text-[#7069F4]">{clientName}</span>
          </DialogTitle>
        </DialogHeader>

        {step === 'select' && (
          <div className="space-y-5 py-2">
            {/* Choix du test */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#141325]">Test</label>
              <div className="relative">
                <select
                  value={selectedDefinitionId}
                  onChange={(e) => setSelectedDefinitionId(e.target.value)}
                  className="w-full appearance-none rounded-md border border-input bg-background py-2 pl-3 pr-8 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-[#7069F4]"
                >
                  {sortedDefinitions.map((def) => (
                    <option key={def.id} value={def.id}>
                      {def.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>

            {error && <p className="text-sm text-[#3C3CD6]">{error}</p>}

            <Button
              className="w-full bg-[#7069F4] hover:bg-[#5B54D6]"
              onClick={handleGenerate}
              disabled={!selectedDefinitionId || isLoading}
            >
              {isLoading ? 'Génération...' : 'Générer le lien'}
            </Button>
          </div>
        )}

        {step === 'success' && inviteUrl && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Le lien est prêt. Copiez-le ou envoyez-le directement par email.
            </p>

            {/* URL d'invitation */}
            <div className="flex items-center gap-2 rounded-md border bg-muted/50 p-3">
              <code className="flex-1 truncate text-xs text-[#7069F4]">{inviteUrl}</code>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <Button variant="outline" onClick={handleCopy} className="w-full">
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4 text-green-600" />
                    Copié !
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    Copier le lien
                  </>
                )}
              </Button>

              {clientEmail ? (
                emailSent ? (
                  <p className="text-center text-sm text-green-600">Email envoyé à {clientEmail}</p>
                ) : (
                  <>
                    <Button
                      className="w-full bg-[#7069F4] hover:bg-[#5B54D6]"
                      onClick={handleSendEmail}
                      disabled={emailLoading}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      {emailLoading ? 'Envoi...' : 'Envoyer par email'}
                    </Button>
                    {emailError && <p className="text-sm text-[#3C3CD6]">{emailError}</p>}
                  </>
                )
              ) : (
                <p className="text-center text-xs text-muted-foreground">
                  Aucun email renseigné pour ce client
                </p>
              )}
            </div>

            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => handleOpen(false)}
            >
              Fermer
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
