# Implémentation : Page `/coach/rapports`

## Contexte

Page "Command Center" pour le coach — vue transversale sur tous ses clients et leurs rapports.
Valeur unique vs `/coach/clients/[id]` : vision multi-clients simultanée avec alertes de priorité.

## Architecture de la page

### Route
`src/app/(dashboard)/coach/rapports/page.tsx`

### Layout en 3 sections

```
┌─ Section 1 : Alertes (3 cards stat en haut)
├─ Section 2 : Tableau des rapports complétés (filtrable)
└─ Section 3 : Tests en cours (non complétés, action requise)
```

---

## Section 1 — Alertes prioritaires

3 cards `shadcn/ui` (`Card` component) côte à côte :

| Card | Condition | Couleur | CTA |
|------|-----------|---------|-----|
| Clients inactifs | Pas de test complété depuis 90+ jours | Rouge / destructive | Lien vers liste filtrée |
| Tests en attente | Test envoyé, status `pending`, créé depuis 7+ jours | Ambre / warning | Bouton "Relancer" |
| PDFs à générer | Test `completed` mais `report_url` est null, niveau Complete ou Expert | Bleu / info | Bouton "Générer" |

Afficher le count dans chaque card. Si count = 0 → card en gris avec checkmark.

---

## Section 2 — Tableau des rapports complétés

### Colonnes

| Colonne | Donnée | Notes |
|---------|--------|-------|
| Client | `nom + prenom` | Lien vers `/coach/clients/[id]` |
| Test | `definition_name` (ex: "Profilage MINND") | — |
| Niveau | `level_slug` | Badge : Discovery / Complete / Expert |
| Score | `score_global` (1 décimale) | Coloré par percentile |
| Profil MINND | `profile_name` + `profile_color` | Badge coloré, vide si Discovery |
| Date | `completed_at` | Format `DD MMM YYYY` |
| PDF | `report_url` | Bouton "Voir PDF" ou "Générer PDF" |
| Actions | — | Icône lien vers profil client |

### Filtres (au-dessus du tableau)

- **Niveau** : All / Discovery / Complete / Expert (`Select` shadcn)
- **Période** : 30 jours / 90 jours / 1 an / Tout (`Select` shadcn)
- **Profil** : liste des profils MINND distincts (`Select` shadcn) — affiché seulement si données disponibles
- **Recherche** : input texte sur nom du client

### Comportements

- Trié par `completed_at` DESC par défaut
- Bouton "Voir PDF" → ouvre `report_url` dans un nouvel onglet
- Bouton "Générer PDF" → appelle `POST /api/reports/generate/[testId]`, affiche un spinner, rafraîchit la ligne après succès
- Lien client → `href="/coach/clients/[id]"`
- Comparaison longitudinale : **NE PAS afficher dans le tableau** — elle est dans le PDF (page 7)

---

## Section 3 — Tests en cours

Liste simple (pas de tableau) des tests avec `status = 'pending'` ou `status = 'sent'`.

### Colonnes

| Colonne | Donnée |
|---------|--------|
| Client | `nom + prenom` |
| Test | `definition_name` + `level_slug` |
| Envoyé le | `created_at` |
| Jours d'attente | `now - created_at` en jours |
| Actions | Bouton "Relancer" (appelle `resendInvitationAction`) + Bouton "Copier lien" |

Afficher seulement si la liste n'est pas vide. Si vide → ne pas afficher la section.

---

## Server Actions à créer

### Fichier : `src/app/actions/reports.ts`

```typescript
// Tous les tests complétés de tous les clients du coach
// avec les infos enrichies pour le tableau
export async function getCoachReportsSummary(): Promise<CoachReportRow[]>

// Alertes calculées pour les 3 cards
export async function getCoachAlerts(): Promise<{
  inactifs: number        // clients sans test complété depuis 90+ jours
  pendingOld: number      // tests pending depuis 7+ jours
  pdfMissing: number      // tests Complete/Expert complétés sans report_url
}>
```

### Type `CoachReportRow`

```typescript
type CoachReportRow = {
  testId: string
  clientId: string
  clientNom: string
  clientPrenom: string
  definitionName: string
  levelSlug: 'discovery' | 'complete' | 'expert'
  scoreGlobal: number | null
  scorePercentile: number | null
  profileName: string | null
  profileColor: string | null
  completedAt: string
  reportUrl: string | null
}
```

---

## Contraintes techniques

- **Jamais de `any` TypeScript**
- **shadcn/ui uniquement** pour les composants UI : `Card`, `Table`, `Badge`, `Button`, `Select`, `Input`
- **RLS Supabase** : les queries filtrent déjà par `coach_id = auth.uid()` — ne pas bypasser
- **Pas de mélange Prisma/Supabase** — utiliser Supabase direct (cohérent avec le reste du module coach)
- **Gestion d'erreur explicite** — pas de silent catch
- **Validation Zod** sur les inputs utilisateur (filtres)
- **Commentaires** : logique métier en français, code technique en anglais

---

## Ce qu'on ne fait PAS dans cette version

- Pas d'analytics de cohorte (prématuré, données insuffisantes au lancement)
- Pas de graphiques radar ou de trends dans la page (→ restent sur `/coach/clients/[id]`)
- Pas de comparaison longitudinale inline (→ dans le PDF généré)
- Pas de génération PDF en lot (à évaluer en v2 selon usage)
- Pas de données Bonhomme/Figure dans cette page (→ onglet Séances du detail client)

---

## Références codebase existantes

| Besoin | Fichier existant |
|--------|-----------------|
| Types de base | `src/types/index.ts` |
| Génération PDF (API) | `src/app/api/reports/generate/[testId]/route.ts` |
| Composant PDF | `src/components/pdf/ReportDocument.tsx` |
| Action relancer invitation | `src/app/actions/tests-invite.ts` → `resendInvitationAction` |
| Liste clients (référence UI) | `src/app/(dashboard)/coach/clients/ClientsPageClient.tsx` |
| Detail client (référence UI) | `src/app/(dashboard)/coach/clients/[id]/page.tsx` |
| Historique tests (composant) | `src/components/coach/TestHistoryCoach.tsx` |
| Dashboard coach (référence alertes) | `src/app/(dashboard)/coach/page.tsx` |

---

## Ajouter dans la navigation

Fichier : `src/components/layout/Sidebar.tsx`

Ajouter un lien "Rapports" dans le menu coach, entre "Clients" et "Dispatch" (ou à la fin selon l'ordre actuel).

```tsx
{ href: '/coach/rapports', label: 'Rapports', icon: FileText }
```
