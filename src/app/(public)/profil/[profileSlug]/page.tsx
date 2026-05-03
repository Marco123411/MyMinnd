import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Metadata } from 'next'

interface PageProps {
  params: Promise<{ profileSlug: string }>
}

interface CelebrityExample {
  name: string
  sport?: string | null
  reason?: string | null
}

async function fetchProfile(slug: string) {
  if (!slug || slug.length > 100) return null
  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('id, name, family, color, tagline, description, celebrity_examples')
    .eq('slug', slug)
    .maybeSingle()
  return data
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { profileSlug } = await params
  const profile = await fetchProfile(profileSlug)

  if (!profile) {
    return {
      title: 'Profil introuvable — MINND',
      description: 'Ce profil mental MINND n\'existe pas.',
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://myminnd.com'
  const ogImageUrl = `${baseUrl}/api/og/profile/${profileSlug}`
  const title = `${profile.name} — Profil mental MINND`
  const description =
    profile.tagline ??
    profile.description?.slice(0, 160) ??
    'Découvrez votre profil mental en passant le test PMA gratuitement.'

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${baseUrl}/profil/${profileSlug}`,
      siteName: 'MINND',
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: title }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  }
}

export default async function ProfilePublicPage({ params }: PageProps) {
  const { profileSlug } = await params
  const profile = await fetchProfile(profileSlug)

  if (!profile) notFound()

  const celebrities = (profile.celebrity_examples ?? []) as CelebrityExample[]
  const color = profile.color ?? '#20808D'

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#E8F4F5] to-white">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        {/* En-tête MINND */}
        <div className="mb-8 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[#20808D]">
          <div className="h-2 w-2 rounded-full bg-[#20808D]" />
          MINND Mental Performance
        </div>

        {/* Profile header */}
        <div className="mb-8">
          <Badge
            className="mb-3"
            style={{ backgroundColor: color, color: '#FFFFFF' }}
          >
            Profil mental
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-bold text-[#1A1A2E] mb-2">
            {profile.name}
          </h1>
          {profile.family && (
            <p className="text-base text-muted-foreground mb-4">
              Famille · {profile.family}
            </p>
          )}
          {profile.tagline && (
            <p className="text-xl sm:text-2xl italic text-[#1A1A2E]">
              « {profile.tagline} »
            </p>
          )}
        </div>

        {/* Description */}
        {profile.description && (
          <Card
            className="p-6 mb-6 border-2"
            style={{ borderLeftColor: color, borderLeftWidth: '6px' }}
          >
            <h2 className="text-lg font-semibold text-[#1A1A2E] mb-3">
              Qui sont les {profile.name}&nbsp;?
            </h2>
            <p className="text-base text-[#1A1A2E] leading-relaxed whitespace-pre-line">
              {profile.description}
            </p>
          </Card>
        )}

        {/* Celebrity examples */}
        {celebrities.length > 0 && (
          <Card className="p-6 mb-8">
            <h2 className="text-lg font-semibold text-[#1A1A2E] mb-4">
              Athlètes emblématiques
            </h2>
            <div className="space-y-4">
              {celebrities.map((celeb) => (
                <div key={celeb.name} className="border-l-4 border-[#E8F4F5] pl-4">
                  <p className="font-semibold text-[#1A1A2E]">
                    {celeb.name}
                    {celeb.sport && (
                      <span className="text-sm font-normal text-muted-foreground ml-2">
                        · {celeb.sport}
                      </span>
                    )}
                  </p>
                  {celeb.reason && (
                    <p className="text-sm text-[#1A1A2E] mt-1 leading-relaxed">
                      {celeb.reason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* CTA */}
        <Card className="p-8 bg-gradient-to-r from-[#20808D] to-[#1a6b76] text-white text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">
            Découvrez votre profil
          </h2>
          <p className="text-base mb-6 text-white/90">
            Passez le PMA gratuitement. 155 questions, 15-20 minutes.
          </p>
          <Button
            asChild
            size="lg"
            className="bg-[#FFC553] text-[#1A1A2E] hover:bg-[#e6b14b] h-12 px-8"
          >
            <Link href="/register/athlete">
              Passez le test gratuitement <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </Card>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          <Link href="/" className="hover:underline">
            Retour à l&apos;accueil
          </Link>
          <span className="mx-2">·</span>
          <Link href="/marketplace" className="hover:underline">
            Trouver un préparateur mental
          </Link>
        </p>
      </div>
    </div>
  )
}
