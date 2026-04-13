# Étape 30 — Frontend cognitif V2 : Paramètres dynamiques + 8 nouveaux drills

## Contexte

Adapter le frontend cognitif pour supporter les paramètres dynamiques (durée et intensité
configurables par le coach), implémenter les 8 nouveaux drills, et connecter l'exécution
des tests au module de programmation quand le test est lancé depuis un programme.

## Prérequis et état du codebase

**Step-29 terminée — ces éléments EXISTENT déjà :**
- `src/lib/cognitive/load.ts` — `computeCognitiveLoad`, `getCognitiveLoadZone`, `getCognitiveLoadColor`
- `src/components/cognitive/CognitiveLoadBadge.tsx`, `CognitiveLoadBar.tsx`, `SessionLoadSummary.tsx`
- `src/components/coach/DrillConfigurator.tsx`, `PhaseColumnView.tsx`, `PeriodizationChart.tsx`
- `ProgramExercise` type dans `src/types/index.ts`
- `src/hooks/useTrialRecorder.ts` — hook de batch-recording (10 trials ou 30s flush)
- `src/components/cognitive/CognitiveTestShell.tsx` — wrapper fullscreen + progress + abandon
- Migration `program_exercises` créée mais **non encore appliquée**

**Tests existants (à adapter, NE PAS réécrire) :**
- `PVTTest.tsx` — déjà paramétrable via `config.duration_seconds` ✅ (minimal)
- `StroopTest.tsx` — trials fixes, ISI fixe — à rendre dynamiques
- `SimonTest.tsx` — même pattern que Stroop
- `DigitalSpanTest.tsx` — span de départ et digit_display_ms à interpoler

---

## Ordre d'implémentation

1. Migration SQL — `cognitive_sessions.program_exercise_id`
2. `src/lib/cognitive/resolve-params.ts` — résolution des paramètres
3. `src/lib/cognitive/intensity-interpolation.ts` — interpolation linéaire
4. Composants partagés — `TestTimer`, `PhaseIndicator`, `IntensityDisplay`
5. Route client — `/client/program/exercise/[exId]/run` + actions serveur
6. Adaptation des tests existants (Stroop, Simon, DigitalSpan)
7. 6 drills simples/modérés — Go/No-Go, Flanker, Visual Choice 4, 2-Back, Spatial Span, Mackworth
8. Visual Search
9. Stop Signal Task (plus complexe — SSD staircase adaptatif)

---

## 1. Migration SQL

```sql
-- supabase/migrations/20260410000000_cognitive_sessions_program_link.sql

-- Lien optionnel cognitive_session → program_exercise
-- NULL quand le test est lancé en autonome
ALTER TABLE public.cognitive_sessions
  ADD COLUMN IF NOT EXISTS program_exercise_id UUID
    REFERENCES public.program_exercises(id) ON DELETE SET NULL;

-- Index pour les requêtes coach (chargement des sessions d'un programme)
CREATE INDEX IF NOT EXISTS idx_cognitive_sessions_program_exercise_id
  ON public.cognitive_sessions(program_exercise_id)
  WHERE program_exercise_id IS NOT NULL;
```

---

## 2. `src/lib/cognitive/resolve-params.ts`

```typescript
import type { CognitiveTestDefinition, ProgramExercise } from '@/types'

export interface ResolvedTestParams {
  durationSec: number
  intensityPercent: number
  phaseContext: 'pre' | 'in' | 'post' | null
  programExerciseId: string | null
}

/**
 * Résout les paramètres d'un test cognitif depuis deux sources :
 * - Source A (autonome) : valeurs par défaut du test_definition
 * - Source B (depuis programme) : override de program_exercise
 */
export function resolveTestParams(
  testDef: CognitiveTestDefinition,
  programExercise?: ProgramExercise | null
): ResolvedTestParams {
  return {
    durationSec:
      programExercise?.configured_duration_sec ??
      testDef.default_duration_sec ??
      300,
    intensityPercent:
      programExercise?.configured_intensity_percent ??
      testDef.default_intensity_percent ??
      100,
    phaseContext: programExercise?.phase ?? null,
    programExerciseId: programExercise?.id ?? null,
  }
}
```

---

## 3. `src/lib/cognitive/intensity-interpolation.ts`

```typescript
/**
 * Interpolation linéaire d'un paramètre selon le pourcentage d'intensité.
 * range[0] = valeur à 10% d'intensité, range[1] = valeur à 100% d'intensité
 *
 * Exemples :
 *   interpolate(60, [0.7, 0.3]) → 0.47 (ratio congruent Stroop à 60%)
 *   interpolate(60, [2500, 1000]) → 1667 (ISI ms à 60%)
 */
export function interpolate(
  intensityPercent: number,
  range: [number, number]
): number {
  const t = (intensityPercent - 10) / 90 // 0.0 à 1.0
  return Math.round(range[0] + t * (range[1] - range[0]))
}

/**
 * Calcule le nombre de trials selon la durée et l'ISI.
 * avgTrialDuration = ISI + 500ms (stimulus moyen + feedback)
 */
export function computeTrialCount(durationSec: number, isiMs: number): number {
  const totalMs = durationSec * 1000
  const avgTrialDuration = isiMs + 500
  return Math.floor(totalMs / avgTrialDuration)
}
```

---

## 4. Composants partagés

### 4.1 `src/components/cognitive/TestTimer.tsx`

```typescript
// Props : durationSec: number, onExpire: () => void
// Countdown visuel : barre de progression (de 100% → 0%) + texte "mm:ss restant"
// Utilise setInterval (pas requestAnimationFrame — précision 1s suffit)
// Appelle onExpire() quand le temps est écoulé
// Overlay fixé en haut de l'écran pendant le test (position sticky)
```

### 4.2 `src/components/cognitive/PhaseIndicator.tsx`

```typescript
// Props : phase: 'pre' | 'in' | 'post'
// Badge coloré affiché dans le briefing ET en overlay pendant le test
// PRÉ → teal (#20808D), IN → gold (#FFC553), POST → mauve (#944454)
// Exemple : <span className="rounded-full px-2 py-0.5 text-xs font-bold text-white"
//              style={{ backgroundColor: PHASE_COLORS[phase] }}>PRÉ</span>
```

### 4.3 `src/components/cognitive/IntensityDisplay.tsx`

```typescript
// Props : percent: number
// Barre verticale avec graduation 10-100%
// Affiché dans l'écran de briefing uniquement (pas pendant le test)
// Couleur selon la zone : teal (basse), gold (moyenne), mauve (haute)
```

---

## 5. Route programme : `/client/program/exercise/[exId]/run`

### 5.1 Server Component — `src/app/(test)/test/program/[exId]/page.tsx`

Pourquoi dans `(test)` et non `(client)` : ce layout gère le fullscreen et les styles d'exécution.

```typescript
// 1. Auth : getUser() → redirect si non connecté
// 2. Charger program_exercise avec cognitive_test_definitions joint
//    SELECT * FROM program_exercises
//      JOIN cognitive_test_definitions ON cognitive_test_id
//    WHERE id = exId AND programme_etapes.programme.client_id = user.id (sécurité)
// 3. resolveTestParams(testDef, programExercise) → ResolvedTestParams
// 4. Rendre <ProgramDrillBriefing params={resolvedParams} testDef={testDef} />
```

### 5.2 Client Component — `ProgramDrillBriefing.tsx`

Écran affiché AVANT le test :

```
┌──────────────────────────────────────┐
│  [PhaseIndicator]  PRÉ               │
│                                      │
│  Stroop                              │
│  Test d'inhibition cognitive         │
│                                      │
│  ⏱  5 minutes                       │
│  ⚡ 80% intensité                    │
│  🧠 CLS: 10 — MODERATE              │
│                                      │
│  [IntensityDisplay]                  │
│                                      │
│  Instructions :                      │
│  "Appuyez sur la touche gauche si…"  │
│                                      │
│  [Commencer le test]                 │
└──────────────────────────────────────┘
```

- Bouton "Commencer" → appelle `createCognitiveSessionAction(slug, deviceInfo, programExerciseId)`
- Après création de session → navigate vers l'exécution du test avec `sessionId`
- À la fin du test → appelle `markProgramExerciseCompleteAction(exId)` → redirige vers `/client/programme`

### 5.3 Actions serveur à créer dans `src/app/actions/programmes.ts`

```typescript
// Marquer un program_exercise comme complété
export async function markProgramExerciseCompleteAction(programExerciseId: string): Promise<ActionResult>

// Charger un program_exercise avec sa définition de test
export async function getProgramExerciseAction(id: string): Promise<ProgramExercise | null>
```

### 5.4 Modifier `createCognitiveSessionAction` dans `src/app/actions/cognitive.ts`

Ajouter `programExerciseId?: string` en paramètre. Si fourni, inclure dans l'INSERT :

```typescript
const sessionData = {
  user_id: user.id,
  cognitive_test_id: testDef.id,
  status: 'pending',
  ...(programExerciseId ? { program_exercise_id: programExerciseId } : {}),
}
```

---

## 6. Adaptation des tests existants

### 6.1 Contrat commun

Chaque test existant doit accepter deux nouvelles props optionnelles :

```typescript
interface DynamicTestProps {
  durationSec?: number        // override de la durée fixe
  intensityPercent?: number   // 10-100, pour interpolation des params internes
}
```

Le test s'arrête quand `elapsed >= durationSec * 1000` (pattern RAF existant dans PVTTest).

### 6.2 PVTTest — minimal

`config.duration_seconds` accepte déjà une durée variable. Aucun changement nécessaire si
`resolveTestParams` passe la durée dans la config avant le rendu.

### 6.3 StroopTest — à modifier

Paramètres à interpoler selon `intensityPercent` :

```typescript
// lib/cognitive/intensity-interpolation.ts
const congruentRatio = interpolate(intensityPercent, [0.7, 0.3])
// 10% → 70% congruent (facile), 100% → 30% congruent (difficile)

const isiMs = interpolate(intensityPercent, [2500, 1000])
// 10% → 2500ms ISI (lent), 100% → 1000ms ISI (rapide)

const trialCount = computeTrialCount(durationSec, isiMs)
```

Remplacer `trials_per_condition` fixe par `trialCount` calculé dynamiquement.
Le test s'arrête soit au `trialCount`, soit quand `elapsed >= durationSec * 1000`.

### 6.4 SimonTest — même pattern que Stroop

```typescript
const congruentRatio = interpolate(intensityPercent, [0.7, 0.3])
const isiMs = interpolate(intensityPercent, [2500, 1000])
const trialCount = computeTrialCount(durationSec, isiMs)
```

### 6.5 DigitalSpanTest — à modifier

```typescript
const startSpan = interpolate(intensityPercent, [3, 6])
// 10% → commence à span 3, 100% → commence à span 6

const digitDisplayMs = interpolate(intensityPercent, [1200, 700])
// 10% → affichage lent, 100% → affichage rapide

// Arrêt : 2 échecs consécutifs à la même longueur OU elapsed >= durationSec * 1000
```

---

## 7. Les 8 nouveaux drills

Chaque drill est un composant React dans `src/components/cognitive/drills/`.
Chaque composant utilise `useTrialRecorder(sessionId)` pour persister les trials.
Chaque composant appelle `onComplete(trials)` à la fin.

Interface commune :

```typescript
interface DrillProps {
  sessionId: string
  durationSec: number
  intensityPercent: number
  onComplete: () => void
}
```

### 7.1 `GoNoGoVisual.tsx`

**Mécanique :**
- Cercle centré : vert (Go) → taper/cliquer vite, rouge (No-Go) → ne pas répondre
- Ratio No-Go : `interpolate(intensityPercent, [0.2, 0.45])` (20% → 45%)
- ISI : `interpolate(intensityPercent, [2000, 800])` ms

**Cycle par trial :**
1. Fixation `+` (500ms)
2. Stimulus (jusqu'à réponse ou 1500ms)
3. Feedback (300ms)

**Enregistrer par trial :**
```typescript
{
  rt: number | null,          // null si pas de réponse
  response: 'hit' | 'miss' | 'false_alarm' | 'correct_rejection',
  stimulus_type: 'go' | 'nogo'
}
```

**UI :** Cercle 120px centré, fond `#1A1A2E`, tap/clic/espace pour répondre.

### 7.2 `MackworthClock.tsx`

**Mécanique :**
- Horloge SVG : 24 positions en cercle, point lumineux qui avance
- Normal : avance d'1 position. Cible (double-saut) : avance de 2 positions
- Fréquence double-saut : `interpolate(intensityPercent, [0.08, 0.15])`
- Intervalle de tick : `interpolate(intensityPercent, [1500, 800])` ms
- L'athlète clique/tape quand il détecte un double-saut

**Enregistrer par tick :**
```typescript
{
  position: number,       // 0-23
  is_target: boolean,
  response: 'hit' | 'miss' | 'false_alarm' | 'correct_rejection',
  rt: number | null
}
```

**UI :**
- Cercle SVG de 300px, 24 points gris, point actif en teal lumineux
- Animation fluide avec `requestAnimationFrame`
- Bouton central ou tap n'importe où

### 7.3 `FlankerTest.tsx`

**Mécanique :**
- 5 flèches horizontales : `> > > > >` (congruent) ou `< < > < <` (incongruent)
- L'athlète indique la direction de la flèche CENTRALE (← ou →)
- Ratio congruent : `interpolate(intensityPercent, [0.7, 0.3])`
- ISI : `interpolate(intensityPercent, [2000, 800])` ms

**Cycle :** Fixation (500ms) → Stimulus (jusqu'à réponse ou 2000ms) → Feedback (300ms) → ISI

**Enregistrer :**
```typescript
{
  rt: number | null,
  correct: boolean,
  congruency: 'congruent' | 'incongruent',
  target_direction: 'left' | 'right'
}
```

**UI :** Flèches larges (font-size 3rem), fond sombre.
Touches ← → clavier + boutons gauche/droite mobile.

### 7.4 `StopSignalTask.tsx`

**Mécanique :**
- Go trial (75%) : flèche ← ou →, répondre vite
- Stop trial (25%) : même flèche, mais un bip sonore apparaît après `ssdMs`
- SSD (Stop Signal Delay) adaptatif : démarre à 250ms
  - +50ms si l'athlète s'arrête avec succès
  - -50ms si l'athlète ne s'arrête pas
  - Bornes : [50ms, 700ms]
- Pas de feedback visuel sur les stop trials

**Implémentation du bip (Web Audio API) :**
```typescript
const audioCtx = new AudioContext()
const osc = audioCtx.createOscillator()
osc.frequency.value = 1000 // Hz
osc.connect(audioCtx.destination)
osc.start(); osc.stop(audioCtx.currentTime + 0.2) // 200ms
```

**Cycle :**
1. Fixation (500ms)
2. Go stimulus (flèche)
3. [Si stop trial] : bip après `ssdMs`
4. Réponse ou timeout (1500ms)

**Enregistrer :**
```typescript
{
  rt: number | null,      // null si stop trial réussi
  is_stop_trial: boolean,
  ssd_ms: number,
  stop_success: boolean,
  response: 'go' | 'stopped' | 'timeout'
}
```

**SSRT (calculé en scoring step-31) :** `mean_go_rt - mean_ssd_at_convergence`

### 7.5 `SpatialSpan.tsx`

**Mécanique :**
- Grille `interpolate(intensityPercent, [3, 4])` × 3 ou 4 (arrondi)
  - intensité < 55% → grille 3×3, sinon 4×4
- Séquence de cases qui s'illuminent une par une
- L'athlète reproduit la séquence dans l'ordre (tap/clic)
- Longueur initiale : `interpolate(intensityPercent, [2, 4])`
- Succès → longueur +1, Échec → longueur -1
- Arrêt après 2 échecs consécutifs à la même longueur

**Timing :**
- Affichage par item : `interpolate(intensityPercent, [800, 400])` ms
- Pause entre séquence et réponse : 500ms

**Enregistrer par essai :**
```typescript
{
  sequence_length: number,
  correct: boolean,
  response_sequence: number[],   // indices des cases tappées
  rt_per_tap: number[]
}
```

**UI :** Grille centrée, cases grises 60×60px, illumination teal, gap 8px.

### 7.6 `NBackTest.tsx` (2-Back)

**Mécanique :**
- Flux de lettres (A-Z sauf I/O/Q), une par une
- ~30% de targets (lettre actuelle = celle d'il y a 2 positions)
- L'athlète appuie sur Espace/tap quand il détecte un match
- Réponse acceptée pendant le stimulus + ISI

**Timing :**
- Affichage lettre : `interpolate(intensityPercent, [2000, 1000])` ms
- ISI : `interpolate(intensityPercent, [1000, 500])` ms

**Enregistrer par lettre :**
```typescript
{
  letter: string,
  is_target: boolean,
  response: 'hit' | 'miss' | 'false_alarm' | 'correct_rejection',
  rt: number | null
}
```

**UI :** Lettre géante (font-size 6rem, gras) au centre, fond `#1A1A2E`.
Bouton "MATCH" en bas + touche Espace clavier. Compteur de progression.

### 7.7 `VisualChoice4.tsx`

**Mécanique :**
- 4 stimuli : cercle rouge, carré vert, triangle bleu, losange doré
- Un stimulus apparaît, l'athlète appuie sur 1/2/3/4 ou tape le bouton correspondant
- ISI : `interpolate(intensityPercent, [2000, 700])` ms

**Cycle :** Fixation (300ms) → Stimulus (jusqu'à réponse ou 3000ms) → Feedback (200ms) → ISI

**Enregistrer :**
```typescript
{
  stimulus_id: 1 | 2 | 3 | 4,
  response_key: number | null,
  correct: boolean,
  rt: number | null
}
```

**UI :**
- Stimulus 120px au centre (SVG)
- 4 boutons colorés en bas avec raccourcis clavier (1, 2, 3, 4)
- Sur mobile : 4 grandes zones de tap côte à côte

### 7.8 `VisualSearch.tsx`

**Mécanique :**
- Grille de lettres/formes. Cible : T bleu. Distracteurs : L bleus + T rouges
- Nombre de distracteurs : `interpolate(intensityPercent, [8, 24])`
- L'athlète clique/tape sur la cible (ou bouton "Absent" si pas trouvée)
- Timeout : 8000ms

**Enregistrer :**
```typescript
{
  target_position: number,      // index dans la grille
  response_position: number | null,
  correct: boolean,
  rt: number | null,
  distractor_count: number
}
```

**UI :**
- Grille responsive (adapte à `distractor_count + 1` items)
- Items : 44×44px minimum (accessible mobile)
- Highlight de la cible en rouge 1s après réponse (feedback)

---

## 8. Types à ajouter dans `src/types/index.ts`

```typescript
// Paramètres résolus pour l'exécution d'un test
export interface ResolvedTestParams {
  durationSec: number
  intensityPercent: number
  phaseContext: 'pre' | 'in' | 'post' | null
  programExerciseId: string | null
}
```

---

## 9. Critères d'acceptation

### Paramètres dynamiques
- [ ] `resolve-params.ts` et `intensity-interpolation.ts` exportent leurs fonctions correctement
- [ ] Stroop, Simon, DigitalSpan acceptent `durationSec` et `intensityPercent` dynamiques
- [ ] Le nombre de trials est calculé via `computeTrialCount` (plus de valeur fixe)
- [ ] Les paramètres de stimulus s'interpolent selon l'intensité
- [ ] Chaque test s'arrête quand `elapsed >= durationSec * 1000` (timer RAF)

### 8 nouveaux drills
- [ ] Go/No-Go : détection hit/miss/false_alarm/correct_rejection, ratio No-Go variable
- [ ] Mackworth Clock : horloge SVG animée, détection double-saut
- [ ] Flanker : 5 flèches, ratio congruent variable, touches ← →
- [ ] Stop Signal : SSD staircase adaptatif, bip Web Audio API
- [ ] Spatial Span : grille 3×3/4×4, séquences croissantes, 2 échecs consécutifs → stop
- [ ] 2-Back : flux de lettres, détection N-2 match
- [ ] Visual Choice 4 : 4 stimuli SVG, 4 boutons numérotés
- [ ] Visual Search : grille responsive, distracteurs variables

### Intégration programme
- [ ] Migration `cognitive_sessions.program_exercise_id` appliquée
- [ ] `createCognitiveSessionAction` accepte `programExerciseId` optionnel
- [ ] Route `/test/program/[exId]/page.tsx` : charge `program_exercise` + `resolveTestParams`
- [ ] Écran de briefing : nom, phase (badge), durée, intensité, CLS, instructions, bouton Commencer
- [ ] À la fin du test : `markProgramExerciseCompleteAction(exId)` appelée, redirect `/client/programme`
- [ ] La `cognitive_session` enregistrée contient `program_exercise_id`

### UX
- [ ] Tous les drills fonctionnent au clavier (desktop) ET au tap (mobile)
- [ ] `TestTimer` : countdown visible pendant le test
- [ ] `PhaseIndicator` : badge affiché dans le briefing
- [ ] Animations fluides — pas de jank pendant les trials (RAF pour les timings critiques)
- [ ] `npm run build` sans erreurs TypeScript

---

## Notes d'implémentation

- **Timing précis** : utiliser `performance.now()` + RAF pour les RT. Jamais `Date.now()` ni `setTimeout` pour les timings de stimulus.
- **Stop Signal** : implémenter en dernier — le SSD staircase et l'API Web Audio sont les parties les plus complexes.
- **Grille Spatial Span** : générer la séquence côté client avec `Math.random()`, ne pas la persister avant la réponse.
- **useTrialRecorder** : batch de 10 trials ou flush toutes les 30s — tous les nouveaux drills l'utilisent.
- **Pas de `any`** : typer les `intensity_params` de `CognitiveTestDefinition` comme `Record<string, [number, number]>` si utilisé.
