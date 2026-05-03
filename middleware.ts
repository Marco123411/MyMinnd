import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { z } from 'zod'
import type { UserRole } from '@/types'

const roleSchema = z.enum(['client', 'coach', 'admin'])

// Routes publiques — accessibles sans session
const PUBLIC_ROUTES = ['/', '/login', '/register', '/register/athlete', '/forgot-password', '/reset-password', '/complete-profile']

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((r) => pathname === r)
    || pathname.startsWith('/auth/')
    || pathname.startsWith('/test/invite/')
    || pathname.startsWith('/marketplace')   // Annuaire public des experts MINND
    || pathname.startsWith('/profil/')        // Pages publiques de profils-types MINND
    || pathname === '/api/stripe/webhooks' // Stripe envoie sans cookie de session (exact match)
    || pathname.startsWith('/api/og/')        // Génération d'images OG (public)
    || pathname.startsWith('/api/cron/')      // Endpoints cron protégés par CRON_SECRET
}

// Redirige vers l'espace approprié selon le rôle
function roleHome(role: UserRole): string {
  if (role === 'coach') return '/coach'
  if (role === 'admin') return '/admin'
  return '/client'
}

// Vérifie que le chemin est autorisé pour ce rôle
function isRouteAllowed(pathname: string, role: UserRole): boolean {
  if (pathname.startsWith('/test')) return true // accessible à tous les utilisateurs authentifiés
  if (pathname.startsWith('/client')) return role === 'client'
  if (pathname.startsWith('/coach')) return role === 'coach'
  if (pathname.startsWith('/admin')) return role === 'admin'
  return true
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Rafraîchit la session (token refresh automatique)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Routes publiques — toujours accessibles
  if (isPublicRoute(pathname)) {
    return response
  }

  // Pas de session → redirection vers /login
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Récupère le rôle depuis public.users pour les routes protégées
  const { data: userData } = await supabase
    .from('users')
    .select('role, context')
    .eq('id', user.id)
    .single()

  if (!userData) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // F1: validation du rôle avec Zod (cohérent avec auth/callback)
  const parsedRole = roleSchema.safeParse(userData.role)
  if (!parsedRole.success) {
    return NextResponse.redirect(new URL('/login?error=invalid_role', request.url))
  }
  const role: UserRole = parsedRole.data

  // Mauvais rôle pour cette route → redirection vers l'espace approprié
  if (!isRouteAllowed(pathname, role)) {
    return NextResponse.redirect(new URL(roleHome(role), request.url))
  }

  // F2: Client sans contexte → onboarding obligatoire (couvre /client/* ET /test/*)
  // Exception : /accept-invite permet au client invité de définir son mot de passe avant l'onboarding
  if (
    role === 'client' &&
    userData.context === null &&
    !pathname.startsWith('/client/onboarding') &&
    pathname !== '/accept-invite'
  ) {
    return NextResponse.redirect(new URL('/client/onboarding', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
