# Étape 22 — Interface client coach-centrique

## Contexte & motivation

MINND est un SaaS B2B2C. Le **coach est l'acheteur**, le **client est l'exécutant**.
Le client ne doit jamais voir de prix, ni de CTA vers des offres payantes, ni des sections vides.
Il voit uniquement ce que son coach lui a assigné, et peut faire uniquement ce que son coach a programmé.

**Trois problèmes à corriger en V1 :**

1. **Upsell visible** — `ProfileCard` affiche "Passer au test Complet" avec un lien vers un test payant
2. **Nav à 7 onglets vides** — Le nav client affiche toujours 7 items même si le coach n'a rien assigné
3. **CTA "Repasser le test" en autonomie** — Le dashboard laisse le client relancer un test sans que le coach l'ait décidé

---

## Ce qui existe déjà (ne pas retoucher sauf si dit explicitement)

| Fichier | État |
|---------|------|
| `src/app/(client)/layout.tsx` | Layout client — à modifier pour passer nav visibility |
| `src/components/client/ClientNav.tsx` | Nav bottom — à modifier pour accepter props |
| `src/components/client/ProfileCard.tsx` | Card profil — à modifier (supprimer upsell) |
| `src/app/(client)/client/profile/page.tsx` | Page profil — à modifier (supprimer showUpsell) |
| `src/app/(client)/client/results/[testId]/page.tsx` | Résultats test — à modifier (supprimer showUpsell) |
| `src/app/(client)/client/page.tsx` | Dashboard home — à modifier (supprimer CTA autonome) |

---

## Tâche 1 — Supprimer l'upsell de `ProfileCard`

**Fichier :** `src/components/client/ProfileCard.tsx`

**Problème :** Lignes 15-33 — quand `isDiscovery || !profile`, le composant affiche un bloc "Débloquez votre profil mental" avec un bouton "Passer au test Complet" qui redirige vers un test payant.

**Comportement attendu :** Quand Discovery ou pas de profil, retourner `null` (le composant n'affiche rien). Le coach est responsable d'assigner un test complet si nécessaire.

**Modifier ainsi :**

```tsx
export function ProfileCard({ profile, levelSlug, testSlug, showUpsell }: ProfileCardProps) {
  const isDiscovery = levelSlug === 'discovery'

  // Pas de profil disponible pour ce niveau → rien à afficher
  if (isDiscovery || !profile) {
    return null
  }

  // ... reste du composant inchangé
```

**Supprimer aussi** la prop `showUpsell` de l'interface `ProfileCardProps` et du destructuring — elle ne sert plus à rien.

---

## Tâche 2 — Supprimer `showUpsell` des pages qui l'utilisent

### 2a — `src/app/(client)/client/profile/page.tsx`

**Ligne 104 :** Supprimer la prop `showUpsell` de `<ProfileCard>`.

```tsx
// AVANT :
<ProfileCard
  profile={data.profile}
  levelSlug={data.selectedTest.level_slug}
  testSlug={data.selectedTest.definition_slug}
  showUpsell
/>

// APRÈS :
<ProfileCard
  profile={data.profile}
  levelSlug={data.selectedTest.level_slug}
/>
```

Supprimer aussi `testSlug` puisque il n'est utilisé que pour le lien upsell.

### 2b — `src/app/(client)/client/results/[testId]/page.tsx`

**Ligne 117 :** Supprimer `showUpsell={isDiscovery}` et `testSlug`.

```tsx
// AVANT :
<ProfileCard
  profile={profile}
  levelSlug={test.level_slug}
  testSlug={test.definition_slug}
  showUpsell={isDiscovery}
/>

// APRÈS :
<ProfileCard
  profile={profile}
  levelSlug={test.level_slug}
/>
```

Supprimer aussi la variable `isDiscovery` si elle n'est plus utilisée nulle part dans ce fichier (vérifier avant de supprimer — elle conditionne aussi l'affichage du "Détail par compétence" ligne 121).

---

## Tâche 3 — Nav client en progressive disclosure

**Objectif :** Afficher uniquement les onglets qui ont du contenu pour ce client.

### Règles d'affichage

| Onglet | Toujours visible | Visible si... |
|--------|-----------------|---------------|
| Accueil | ✅ | — |
| Profil | ✅ | — |
| Exercices | ❌ | Au moins 1 exercice assigné |
| Séances | ❌ | Au moins 1 séance planifiée |
| Historique | ❌ | Au moins 1 test complété |
| Cognitif | ❌ | Au moins 1 session cognitive |
| Coach | ✅ | — |

### 3a — Créer une action serveur `getClientNavVisibility`

**Fichier :** `src/app/actions/client-data.ts` — Ajouter à la fin du fichier existant.

```typescript
export interface ClientNavVisibility {
  hasExercises: boolean
  hasSessions: boolean
  hasTests: boolean
  hasCognitive: boolean
}

export async function getClientNavVisibility(): Promise<ClientNavVisibility> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { hasExercises: false, hasSessions: false, hasTests: false, hasCognitive: false }
  }

  // Requêtes parallèles — on veut juste savoir si count > 0
  const [exercises, sessions, tests, cognitive] = await Promise.all([
    supabase
      .from('exercises')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', user.id)
      .limit(1),
    supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', user.id)
      .limit(1),
    supabase
      .from('test_results')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .limit(1),
    supabase
      .from('cognitive_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .limit(1),
  ])

  return {
    hasExercises: (exercises.count ?? 0) > 0,
    hasSessions: (sessions.count ?? 0) > 0,
    hasTests: (tests.count ?? 0) > 0,
    hasCognitive: (cognitive.count ?? 0) > 0,
  }
}
```

**Important :** Vérifier les noms exacts des tables dans les migrations Supabase avant d'écrire ce code. Si les noms diffèrent, utiliser les bons noms.

### 3b — Modifier `src/app/(client)/layout.tsx`

Ce layout est un Server Component — il peut fetcher des données directement.

```tsx
import type { ReactNode } from 'react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ClientNav } from '@/components/client/ClientNav'
import { getClientNavVisibility } from '@/app/actions/client-data'

export default async function ClientLayout({ children }: { children: ReactNode }) {
  const navVisibility = await getClientNavVisibility()

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-6 max-w-2xl pb-24">
        {children}
      </main>
      <Footer />
      <ClientNav visibility={navVisibility} />
    </div>
  )
}
```

### 3c — Modifier `src/components/client/ClientNav.tsx`

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Brain, Clock, UserCheck, Dumbbell, CalendarDays, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ClientNavVisibility } from '@/app/actions/client-data'

interface ClientNavProps {
  visibility: ClientNavVisibility
}

export function ClientNav({ visibility }: ClientNavProps) {
  const pathname = usePathname()

  // Construction dynamique des onglets selon ce qui est disponible
  const navItems = [
    { href: '/client', label: 'Accueil', icon: Home, exact: true, show: true },
    { href: '/client/profile', label: 'Profil', icon: Brain, exact: false, show: true },
    { href: '/client/exercises', label: 'Exercices', icon: Dumbbell, exact: false, show: visibility.hasExercises },
    { href: '/client/sessions', label: 'Séances', icon: CalendarDays, exact: false, show: visibility.hasSessions },
    { href: '/client/history', label: 'Historique', icon: Clock, exact: false, show: visibility.hasTests },
    { href: '/client/cognitive', label: 'Cognitif', icon: Activity, exact: false, show: visibility.hasCognitive },
    { href: '/client/coach', label: 'Coach', icon: UserCheck, exact: false, show: true },
  ].filter((item) => item.show)

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background shadow-[0_-1px_10px_rgba(0,0,0,0.06)]">
      <div className="mx-auto flex max-w-2xl items-center justify-around px-2 py-2">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const isActive = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1 text-xs transition-colors',
                isActive
                  ? 'text-[#20808D]'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className={cn('h-5 w-5', isActive && 'stroke-[2.5px]')} />
              <span>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
```

---

## Tâche 4 — Supprimer le CTA "Repasser le test" du dashboard home

**Fichier :** `src/app/(client)/client/page.tsx`

**Problème :** Lignes 88-99 — quand un test existe, deux boutons sont affichés :
1. "Voir mes résultats" → `/client/results/${data.latestTest.id}` ✅ (conserver)
2. "Repasser le test" → `/test/${data.latestTest.definition_slug}` ❌ (supprimer)

Le client ne doit pas pouvoir relancer un test de sa propre initiative.

**Modifier ainsi :**

```tsx
{/* AVANT — deux boutons côte à côte */}
<div className="mt-4 flex flex-col gap-2 sm:flex-row">
  <Link href={`/client/results/${data.latestTest.id}`} className="flex-1">
    <Button variant="outline" className="w-full" size="sm">
      Voir mes résultats
    </Button>
  </Link>
  <Link href={`/test/${data.latestTest.definition_slug}`} className="flex-1">
    <Button className="w-full bg-[#20808D] hover:bg-[#186870]" size="sm">
      Repasser le test
    </Button>
  </Link>
</div>

{/* APRÈS — un seul bouton */}
<div className="mt-4">
  <Link href={`/client/results/${data.latestTest.id}`}>
    <Button variant="outline" className="w-full" size="sm">
      Voir mes résultats
    </Button>
  </Link>
</div>
```

---

## Tâche 5 — Supprimer le CTA "Passer votre premier test" du dashboard home (état vide)

**Fichier :** `src/app/(client)/client/page.tsx`

**Problème :** Lignes 104-121 — quand aucun test n'a été complété, une card teal avec CTA "Passer votre premier test" → `/test/pma` est affichée.

Le client ne doit pas avoir un CTA autonome vers un test. L'état vide doit juste informer que le coach va lui envoyer du contenu.

**Remplacer la card d'état vide ainsi :**

```tsx
{/* AVANT */}
<Card className="border-2 border-[#20808D] bg-[#E8F4F5]">
  <CardContent className="pt-6 pb-6 text-center">
    ...
    <Link href="/test/pma" className="mt-4 inline-block">
      <Button className="bg-[#20808D] hover:bg-[#186870]">
        Passer votre premier test
      </Button>
    </Link>
  </CardContent>
</Card>

{/* APRÈS — état vide neutre, pas de CTA */}
<Card>
  <CardContent className="pt-6 pb-6 text-center">
    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
      <ClipboardList className="h-7 w-7 text-muted-foreground" />
    </div>
    <h2 className="text-lg font-bold text-[#1A1A2E]">Bienvenue sur MINND</h2>
    <p className="mt-2 text-sm text-muted-foreground">
      Votre coach va bientôt vous envoyer vos premiers contenus.
    </p>
  </CardContent>
</Card>
```

**Remarque :** Supprimer l'import `Button` si il n'est plus utilisé ailleurs dans ce fichier après cette modification.

---

## Résumé des fichiers à toucher

| Fichier | Action | Priorité |
|---------|--------|----------|
| `src/components/client/ProfileCard.tsx` | Supprimer bloc upsell + prop `showUpsell` | P0 |
| `src/app/(client)/client/profile/page.tsx` | Supprimer `showUpsell` + `testSlug` de ProfileCard | P0 |
| `src/app/(client)/client/results/[testId]/page.tsx` | Supprimer `showUpsell` + `testSlug` de ProfileCard | P0 |
| `src/app/actions/client-data.ts` | Ajouter `getClientNavVisibility()` | P1 |
| `src/app/(client)/layout.tsx` | Fetcher visibility + passer à ClientNav | P1 |
| `src/components/client/ClientNav.tsx` | Accepter `visibility` prop + filter dynamique | P1 |
| `src/app/(client)/client/page.tsx` | Supprimer "Repasser le test" + état vide neutre | P0 |

---

## Critères d'acceptation

- [ ] Aucun prix, aucune mention "Complet", "Expert", "19 €", "79 €" visible dans l'interface client
- [ ] Aucun bouton ne redirige le client vers un test payant sans que le coach l'ait décidé
- [ ] Un client sans exercices assignés voit 3 onglets : Accueil, Profil, Coach
- [ ] Un client avec exercices assignés voit Exercices dans le nav
- [ ] Un client avec séances planifiées voit Séances dans le nav
- [ ] Un client avec tests complétés voit Historique dans le nav
- [ ] Un client avec sessions cognitives voit Cognitif dans le nav
- [ ] Dashboard home sans test : message neutre "Votre coach va vous envoyer du contenu"
- [ ] Dashboard home avec test : un seul bouton "Voir mes résultats", pas de "Repasser le test"
- [ ] Pas de `any` TypeScript
- [ ] shadcn/ui uniquement pour les composants

---

## Contraintes globales (CLAUDE.md)

- `NEVER` utiliser `any` en TypeScript
- `NEVER` silent catch — toujours gérer les erreurs explicitement
- Valider les inputs avec Zod
- shadcn/ui pour tous les composants UI
- Commentaires logique métier en **français**, code technique en **anglais**
- Vérifier les noms de tables dans `supabase/migrations/` avant d'écrire les requêtes Supabase
