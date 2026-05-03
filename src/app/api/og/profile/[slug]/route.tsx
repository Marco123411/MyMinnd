import { ImageResponse } from 'next/og'
import { createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ slug: string }>
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { slug } = await params

  if (!slug || slug.length > 100) {
    return new Response('Invalid slug', { status: 400 })
  }

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('name, family, color, tagline, description')
    .eq('slug', slug)
    .maybeSingle()

  if (!profile) {
    return new Response('Profile not found', { status: 404 })
  }

  const color = profile.color ?? '#20808D'

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: `linear-gradient(135deg, #E8F4F5 0%, #FFFFFF 60%)`,
          padding: 72,
          position: 'relative',
        }}
      >
        {/* Bande de couleur gauche */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 16,
            background: color,
          }}
        />

        {/* Logo / header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 999,
              background: '#20808D',
            }}
          />
          <span
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: '#1A1A2E',
              letterSpacing: 2,
            }}
          >
            MINND
          </span>
        </div>

        {/* Badge profil mental */}
        <div
          style={{
            display: 'flex',
            alignSelf: 'flex-start',
            padding: '8px 18px',
            borderRadius: 999,
            background: color,
            color: '#FFFFFF',
            fontSize: 20,
            fontWeight: 600,
            marginBottom: 20,
          }}
        >
          Profil mental
        </div>

        {/* Nom profil */}
        <div
          style={{
            display: 'flex',
            fontSize: 96,
            fontWeight: 800,
            color: '#1A1A2E',
            lineHeight: 1.1,
            marginBottom: 16,
          }}
        >
          {profile.name}
        </div>

        {/* Family */}
        {profile.family && (
          <div
            style={{
              display: 'flex',
              fontSize: 28,
              color: '#6B6B7D',
              marginBottom: 24,
            }}
          >
            Famille · {profile.family}
          </div>
        )}

        {/* Tagline */}
        {profile.tagline && (
          <div
            style={{
              display: 'flex',
              fontSize: 32,
              fontStyle: 'italic',
              color: '#1A1A2E',
              lineHeight: 1.3,
              maxWidth: 900,
            }}
          >
            « {profile.tagline} »
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: 'auto',
            gap: 6,
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 24,
              color: '#20808D',
              fontWeight: 600,
            }}
          >
            Découvrez votre profil sur myminnd.com
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 18,
              color: '#6B6B7D',
            }}
          >
            155 questions · 15-20 minutes · Gratuit
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      },
    }
  )
}
