'use client'

import { useState, type ReactNode } from 'react'
import { Copy, Check, MessageCircle, ExternalLink, Share2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface ShareProfileDialogProps {
  profileName: string
  profileSlug: string
  globalScore: number | null
  children: ReactNode
}

export function ShareProfileDialog({
  profileName,
  profileSlug,
  globalScore,
  children,
}: ShareProfileDialogProps) {
  const [copied, setCopied] = useState(false)

  // Évite l'hydration mismatch SSR/client : utilise toujours la variable d'env
  // (exposée au client via NEXT_PUBLIC_).
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myminnd.com'

  const shareUrl = `${baseUrl}/profil/${profileSlug}`
  const shareText = `Mon profil mental est ${profileName}${
    globalScore !== null ? ` (score ${globalScore.toFixed(1)}/10)` : ''
  }. Et toi ? Passe le test gratuitement →`

  const fullShareText = `${shareText} ${shareUrl}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullShareText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('[ShareProfileDialog] Copy failed:', err)
    }
  }

  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
    shareUrl
  )}`
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(fullShareText)}`

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Partager mon profil mental</DialogTitle>
          <DialogDescription>
            Invitez vos amis à découvrir leur profil mental MINND.
          </DialogDescription>
        </DialogHeader>

        {/* Preview card */}
        <div className="rounded-lg border bg-gradient-to-br from-[#E8F4F5] to-white p-4 my-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#20808D]">
            Mon profil mental MINND
          </p>
          <p className="text-xl font-bold text-[#1A1A2E] mt-1">{profileName}</p>
          {globalScore !== null && (
            <p className="text-sm text-muted-foreground mt-1">
              Score global : <strong>{globalScore.toFixed(1)}/10</strong>
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-3 break-all">{shareUrl}</p>
        </div>

        {/* Share buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={handleCopy}
            className="gap-1.5 h-11"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-green-600" />
                Copié !
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copier le lien
              </>
            )}
          </Button>

          <Button variant="outline" asChild className="gap-1.5 h-11">
            <a href={linkedInUrl} target="_blank" rel="noopener noreferrer">
              <Share2 className="h-4 w-4" />
              LinkedIn
            </a>
          </Button>

          <Button variant="outline" asChild className="gap-1.5 h-11">
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </a>
          </Button>

          <Button variant="outline" asChild className="gap-1.5 h-11">
            <a
              href={`${baseUrl}/api/og/profile/${profileSlug}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-4 w-4" />
              Voir l&apos;image
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
