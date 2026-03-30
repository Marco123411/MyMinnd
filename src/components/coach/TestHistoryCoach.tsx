'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { regenerateInvitationAction, resendInvitationAction } from '@/app/actions/tests-invite'
import type { TestForCoach } from '@/types'
import { Copy, Check, RefreshCw, Send, ExternalLink } from 'lucide-react'
import Link from 'next/link'

interface TestHistoryCoachProps {
  tests: TestForCoach[]
}

const STATUS_LABELS: Record<TestForCoach['status'], string> = {
  pending: 'En attente',
  in_progress: 'En cours',
  completed: 'Complété',
  expired: 'Expiré',
}

const STATUS_CLASSES: Record<TestForCoach['status'], string> = {
  pending: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  expired: 'bg-red-100 text-red-600',
}

interface TestRowProps {
  test: TestForCoach
}

function TestRow({ test }: TestRowProps) {
  const [copied, setCopied] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendDone, setResendDone] = useState(false)
  const [regenLoading, setRegenLoading] = useState(false)
  const [currentInviteUrl, setCurrentInviteUrl] = useState(test.invite_url)
  const [rowError, setRowError] = useState<string | null>(null)

  async function handleCopy() {
    if (!currentInviteUrl) return
    await navigator.clipboard.writeText(currentInviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleResend() {
    setResendLoading(true)
    setRowError(null)
    const result = await resendInvitationAction(test.id)
    setResendLoading(false)
    if (result.error) { setRowError(result.error); return }
    setResendDone(true)
    setTimeout(() => setResendDone(false), 3000)
  }

  async function handleRegenerate() {
    setRegenLoading(true)
    setRowError(null)
    const result = await regenerateInvitationAction(test.id)
    setRegenLoading(false)
    if (result.error) { setRowError(result.error); return }
    setCurrentInviteUrl(result.data!.inviteUrl)
  }

  const isPending = test.status === 'pending'
  const isExpired = test.status === 'expired'
  const canInteract = isPending || isExpired

  return (
    <li className="space-y-1 border-b py-3 text-sm last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-[#1A1A2E] truncate">{test.definition_name}</span>
          <Badge variant="outline" className="text-xs shrink-0">{test.level_slug}</Badge>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {test.status === 'completed' && test.score_global !== null && (
            <span className="font-medium text-[#20808D]">{test.score_global}/10</span>
          )}
          {test.profile_name && (
            <Badge
              style={{ backgroundColor: test.profile_color ?? '#20808D', color: '#fff' }}
              className="text-xs"
            >
              {test.profile_name}
            </Badge>
          )}
          <Badge className={`text-xs ${STATUS_CLASSES[test.status]}`}>
            {STATUS_LABELS[test.status]}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {new Date(test.created_at).toLocaleDateString('fr-FR')}
          </span>
        </div>
      </div>

      {/* Actions pour les tests pending/expired */}
      {canInteract && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {currentInviteUrl && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs text-muted-foreground"
              onClick={handleCopy}
            >
              {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
              {copied ? 'Copié' : 'Copier le lien'}
            </Button>
          )}
          {/* "Renvoyer" uniquement pour les tests pending (F9: masqué pour expired) */}
          {isPending && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs text-muted-foreground"
              onClick={handleResend}
              disabled={resendLoading || resendDone}
            >
              <Send className="h-3 w-3" />
              {resendDone ? 'Envoyé !' : resendLoading ? '...' : 'Renvoyer'}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs text-muted-foreground"
            onClick={handleRegenerate}
            disabled={regenLoading}
          >
            <RefreshCw className={`h-3 w-3 ${regenLoading ? 'animate-spin' : ''}`} />
            {regenLoading ? '...' : 'Nouveau lien'}
          </Button>
          {rowError && <span className="text-xs text-[#944454]">{rowError}</span>}
        </div>
      )}

      {/* Lien vers les résultats si complété */}
      {test.status === 'completed' && (
        <div className="pt-1">
          <Link
            href={`/coach/tests/${test.id}/results`}
            className="inline-flex items-center gap-1 text-xs text-[#20808D] hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Voir les résultats
          </Link>
        </div>
      )}
    </li>
  )
}

export function TestHistoryCoach({ tests }: TestHistoryCoachProps) {
  if (tests.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Aucun test envoyé à ce client.
      </p>
    )
  }

  return (
    <ul className="divide-y-0">
      {tests.map((test) => (
        <TestRow key={test.id} test={test} />
      ))}
    </ul>
  )
}
