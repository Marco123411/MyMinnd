/**
 * Script de vérification de la configuration Supabase + Resend
 * Usage: node scripts/check-config.mjs
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

// Charger .env.local manuellement
function loadEnv() {
  try {
    const env = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    for (const line of env.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const [key, ...rest] = trimmed.split('=')
      if (key && rest.length > 0) {
        process.env[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '')
      }
    }
  } catch {
    console.error('❌  .env.local introuvable — assure-toi d\'être à la racine du projet')
    process.exit(1)
  }
}

loadEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const RESEND_API_KEY = process.env.RESEND_API_KEY

let ok = true

function pass(msg) { console.log(`  ✅  ${msg}`) }
function fail(msg) { console.log(`  ❌  ${msg}`); ok = false }
function warn(msg) { console.log(`  ⚠️   ${msg}`) }
function section(title) { console.log(`\n── ${title} ${'─'.repeat(40 - title.length)}`) }

// ── 1. Variables d'environnement ─────────────────────────────
section('Variables d\'environnement')

SUPABASE_URL ? pass(`NEXT_PUBLIC_SUPABASE_URL = ${SUPABASE_URL}`) : fail('NEXT_PUBLIC_SUPABASE_URL manquante')
SUPABASE_ANON_KEY ? pass(`NEXT_PUBLIC_SUPABASE_ANON_KEY = ${SUPABASE_ANON_KEY.slice(0, 20)}...`) : fail('NEXT_PUBLIC_SUPABASE_ANON_KEY manquante')
SUPABASE_SERVICE_KEY ? pass(`SUPABASE_SERVICE_ROLE_KEY = ${SUPABASE_SERVICE_KEY.slice(0, 20)}...`) : fail('SUPABASE_SERVICE_ROLE_KEY manquante')
RESEND_API_KEY ? pass(`RESEND_API_KEY = ${RESEND_API_KEY.slice(0, 12)}...`) : warn('RESEND_API_KEY manquante (emails non fonctionnels)')
process.env.NEXT_PUBLIC_APP_URL ? pass(`NEXT_PUBLIC_APP_URL = ${process.env.NEXT_PUBLIC_APP_URL}`) : warn('NEXT_PUBLIC_APP_URL manquante (utilise localhost:3000 par défaut)')

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_KEY) {
  console.log('\n🛑  Variables Supabase manquantes — vérification abandonnée.')
  process.exit(1)
}

// ── 2. Connexion Supabase (anon) ──────────────────────────────
section('Supabase — connexion')

const pingRes = await fetch(`${SUPABASE_URL}/rest/v1/`, {
  headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
})
pingRes.ok ? pass(`Projet Supabase accessible (${SUPABASE_URL})`) : fail(`Projet inaccessible — statut ${pingRes.status}`)

// ── 3. Tables principales ─────────────────────────────────────
section('Supabase — tables')

const tables = ['test_definitions', 'competency_tree', 'users', 'tests', 'test_scores', 'responses', 'profiles', 'clients']

for (const table of tables) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?limit=1&select=count`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      Prefer: 'count=exact',
    },
  })
  if (res.ok) {
    const count = res.headers.get('content-range')?.split('/')[1] ?? '?'
    pass(`${table} — ${count} lignes`)
  } else {
    const body = await res.text()
    fail(`${table} — ${res.status} ${body.slice(0, 80)}`)
  }
}

// ── 4. Données de seed ────────────────────────────────────────
section('Supabase — données de seed')

const defRes = await fetch(`${SUPABASE_URL}/rest/v1/test_definitions?select=slug,name,is_active&is_active=eq.true`, {
  headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
})
if (defRes.ok) {
  const defs = await defRes.json()
  if (defs.length > 0) {
    pass(`${defs.length} test(s) actif(s) : ${defs.map(d => d.slug).join(', ')}`)
  } else {
    warn('Aucun test_definition actif — seed non appliqué ?')
  }
} else {
  fail('Impossible de lire test_definitions')
}

const profilesRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=count&limit=1`, {
  headers: {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    Prefer: 'count=exact',
  },
})
if (profilesRes.ok) {
  const count = profilesRes.headers.get('content-range')?.split('/')[1] ?? '?'
  count !== '0' ? pass(`${count} profils K-Means en base`) : warn('Aucun profil — seed normatives non appliqué ?')
}

// ── 5. Storage bucket reports ─────────────────────────────────
section('Supabase — Storage')

const bucketRes = await fetch(`${SUPABASE_URL}/storage/v1/bucket/reports`, {
  headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
})
if (bucketRes.ok) {
  const bucket = await bucketRes.json()
  bucket.public === false ? pass('Bucket "reports" existe et est PRIVÉ ✓') : warn('Bucket "reports" existe mais est PUBLIC — migration à re-appliquer')
} else if (bucketRes.status === 404) {
  fail('Bucket "reports" introuvable — migration 000006 non appliquée')
} else {
  fail(`Storage inaccessible — ${bucketRes.status}`)
}

// ── 6. Resend ─────────────────────────────────────────────────
section('Resend — API')

if (RESEND_API_KEY) {
  const resendRes = await fetch('https://api.resend.com/domains', {
    headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
  })
  if (resendRes.ok) {
    const { data: domains } = await resendRes.json()
    if (domains?.length > 0) {
      for (const d of domains) {
        d.status === 'verified'
          ? pass(`Domaine vérifié : ${d.name}`)
          : warn(`Domaine non vérifié : ${d.name} (statut: ${d.status})`)
      }
    } else {
      warn('API Resend accessible mais aucun domaine configuré')
    }
  } else {
    fail(`Resend API key invalide — statut ${resendRes.status}`)
  }
} else {
  warn('Resend non testé (clé absente)')
}

// ── Résultat final ────────────────────────────────────────────
console.log('\n' + '═'.repeat(44))
if (ok) {
  console.log('✅  Tout est correctement configuré !')
} else {
  console.log('❌  Des problèmes ont été détectés — corrige les erreurs ci-dessus.')
}
console.log('═'.repeat(44) + '\n')
