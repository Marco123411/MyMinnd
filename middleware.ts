import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import type { UserRole } from '@/types'

// Routes publiques — accessibles sans session
const PUBLIC_ROUTES = ['/', '/login', '/register', '/forgot-password', '/reset-password', '/complete-profile']

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((r) => pathname === r) || pathname.startsWith('/auth/') || pathname.startsWith('/test/invite/')
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
    .select('role')
    .eq('id', user.id)
    .single()

  if (!userData) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const role = userData.role as UserRole

  // Mauvais rôle pour cette route → redirection vers l'espace approprié
  if (!isRouteAllowed(pathname, role)) {
    return NextResponse.redirect(new URL(roleHome(role), request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
