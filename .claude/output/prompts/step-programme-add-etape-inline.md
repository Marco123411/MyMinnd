# Prompt d'implémentation — AddEtapeDialog inline (création sans pré-requis)

## Contexte & Problème

Le coach ne peut pas ajouter une étape à un programme vide car `AddEtapeDialog` exige des séances pré-existantes.
L'objectif : **créer la séance ET l'ajouter au programme en une seule action**, depuis le dialog.

**Fichiers existants à connaître absolument :**

| Fichier | Rôle |
|---------|------|
| `src/components/coach/AddEtapeDialog.tsx` | Dialog actuel (select from existing) — à refondre |
| `src/app/actions/programmes.ts` | `addEtapeAction` — ajoute une étape avec FK existante |
| `src/app/actions/sessions.ts` | `createCabinetSessionAction`, `createAutonomousSessionAction`, `createRecurringTemplateAction` |
| `src/app/(dashboard)/coach/clients/[id]/page.tsx` | Passe `cabinetSessions`, `autonomousSessions`, `recurringTemplates` à `AddEtapeDialog` |
| `src/components/coach/ProgrammeEtapesList.tsx` | Reçoit `AddEtapeDialog` et les listes de séances en props |
| `src/types/index.ts` | `TypeSeance = 'cabinet' | 'autonomie' | 'recurrente'` |

---

## Ce qui doit changer

### 1. Nouvelle server action dans `src/app/actions/programmes.ts`

Ajouter **`createAndAddEtapeAction`** qui regroupe : créer la séance + insérer l'étape en un appel.

```ts
// Schémas de validation pour chaque type
const createCabinetEtapeSchema = z.object({
  programme_id: z.string().uuid(),
  objectif:     z.string().min(1, 'L\'objectif est requis'),
  date_seance:  z.string().min(1),
  contenu:      z.string().optional(),
})

const createAutonomeEtapeSchema = z.object({
  programme_id: z.string().uuid(),
  titre:        z.string().min(1, 'Le titre est requis'),
  objectif:     z.string().min(1, 'L\'objectif est requis'),
  date_cible:   z.string().optional().nullable(),
})

const createRecurrenteEtapeSchema = z.object({
  programme_id: z.string().uuid(),
  titre:        z.string().min(1, 'Le titre est requis'),
  description:  z.string().optional(),
})

export async function createAndAddEtapeAction(
  type: TypeSeance,
  data: Record<string, unknown>
): Promise<{ error: string | null }>
```

**Logique interne :**
1. `requireCoach()` — vérifier auth
2. Valider `data` selon `type` (cabinet / autonomie / recurrente)
3. Récupérer le programme → `prog.client_id` (user_id du client)
4. Créer la séance dans la table correspondante (`cabinet_sessions` / `autonomous_sessions` / `recurring_templates`) avec `coach_id = user.id`, `client_id = prog.client_id`
5. `addEtapeAction(...)` avec l'ID nouvellement créé
6. `revalidatePath` sur la page client coach

⚠️ Utiliser `createAdminClient()` pour les inserts (RLS).
⚠️ Si la création de séance réussit mais que l'insert d'étape échoue → supprimer la séance créée (rollback manuel).

---

### 2. Refonte de `src/components/coach/AddEtapeDialog.tsx`

**Nouvelle interface props (simplifiée) :**
```ts
interface AddEtapeDialogProps {
  programmeId: string
  onAdded?: () => void
}
// Supprimer : cabinetSessions, autonomousSessions, recurringTemplates
```

**Nouveau flux UI en 2 étapes :**

**Étape 1 — Sélection du type** (3 cards visuelles) :
```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  🏥 Cabinet  │  │  🏃 Autonome │  │  🔁 Routine  │
│   (coach)    │  │  (client)    │  │ (récurrente) │
└──────────────┘  └──────────────┘  └──────────────┘
```

**Étape 2 — Formulaire inline selon le type :**

Pour `cabinet` :
- `objectif` (input, required)
- `date_seance` (input type="date", required)
- `contenu` (textarea, optional)

Pour `autonomie` :
- `titre` (input, required)
- `objectif` (input, required)
- `date_cible` (input type="date", optional)

Pour `recurrente` :
- `titre` (input, required)
- `description` (textarea, optional)

**Bouton submit :** "Créer et ajouter au programme" → appelle `createAndAddEtapeAction(type, formData)`

**Gestion des états :**
- `step: 1 | 2` — navigation entre sélection type et formulaire
- `isPending` via `useTransition`
- Affichage d'erreur si la server action retourne `error`
- Réinitialisation complète à la fermeture du dialog

---

### 3. Mise à jour de `src/components/coach/ProgrammeEtapesList.tsx`

Retirer les props `cabinetSessions`, `autonomousSessions`, `recurringTemplates` de l'interface `ProgrammeEtapesListProps`.

Mettre à jour `AddEtapeDialog` dans le JSX :
```tsx
// Avant
<AddEtapeDialog
  programmeId={prog.id}
  cabinetSessions={cabinetSessions ?? []}
  autonomousSessions={autonomousSessions ?? []}
  recurringTemplates={recurringTemplates ?? []}
/>

// Après
<AddEtapeDialog programmeId={programme.id} onAdded={onUpdate} />
```

Mettre à jour le message vide :
```tsx
// Avant
"Aucune étape ajoutée. Créez des séances puis ajoutez-les au programme."
// Après
"Aucune étape pour l'instant. Ajoutez une première étape."
```

---

### 4. Mise à jour de `src/app/(dashboard)/coach/clients/[id]/page.tsx`

**a) Supprimer les props devenues inutiles :**

Dans les `Promise.all(...)`, supprimer la requête `getClientSessionsForProgramme` (ligne ~140) qui alimentait `cabinetSessions`, `autonomousSessions`, `recurringTemplates` pour `AddEtapeDialog`.

> ⚠️ Vérifier que ces données ne sont pas utilisées ailleurs dans la page. Si elles le sont (ex: dans les modals `PlanCabinetSessionModal`), les conserver séparément pour ces usages.

**b) Simplifier les props vers `ProgrammeEtapesList` / `AddEtapeDialog` :**

`ProgrammeEtapesList` ne prend plus les listes de séances — nettoyer en conséquence.

**c) Nettoyer la section "Historique des séances" :**

Les 3 boutons `PlanCabinetSessionModal`, `AssignAutonomousSessionModal`, `CreateRecurringTemplateModal` peuvent rester dans l'historique mais **ne sont plus nécessaires pour le programme**. Aucune suppression requise — ils servent pour les séances hors-programme.

---

## Contraintes techniques

- **TypeScript strict** — aucun `any`. Les schémas Zod doivent couvrir tous les champs.
- **shadcn/ui uniquement** — utiliser `Card` ou `Button` pour les type-cards, pas de custom CSS.
- **Couleurs MINND** : `#7069F4` (violet), `#20808D` (teal), `#3C3CD6` (bleu autonome), `#FF9F40` (orange routine).
- **Pas de `revalidatePath` dans les composants client** — uniquement dans la server action.
- **Rollback manuel** si `addEtapeAction` échoue après création de la séance.

---

## Fichiers à modifier (dans l'ordre)

1. `src/app/actions/programmes.ts` — ajouter `createAndAddEtapeAction`
2. `src/components/coach/AddEtapeDialog.tsx` — refonte complète
3. `src/components/coach/ProgrammeEtapesList.tsx` — retirer props séances
4. `src/app/(dashboard)/coach/clients/[id]/page.tsx` — nettoyer imports et props

## Fichiers à NE PAS toucher

- `AddDrillDialog.tsx` — gère les drills cognitifs (inchangé)
- `PhaseColumnView.tsx` — gère le PRÉ/IN/POST (inchangé)
- `DrillConfigurator.tsx` — inchangé
- `createCabinetSessionAction`, `createAutonomousSessionAction`, `createRecurringTemplateAction` dans `sessions.ts` — réutiliser leur logique dans la nouvelle action (ne pas les appeler directement pour éviter la double-auth)

---

## Critère d'acceptation

> Un coach avec un programme vide peut cliquer "Ajouter une étape", choisir "Autonome", remplir titre + objectif, cliquer "Créer et ajouter" — et voir l'étape apparaître dans le programme **sans avoir créé de séance au préalable**.
