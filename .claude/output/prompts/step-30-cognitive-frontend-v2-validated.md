# Étape 30 — Frontend cognitif V2 : Paramètres dynamiques + 8 nouveaux drills
## Version validée — état réel de l'implémentation (2026-04-03)

> Ce document est la version **post-implémentation** du prompt original.
> Chaque section indique ce qui a été réalisé, les divergences avec le spec initial, et les points ouverts.

---

## Statut global

| Catégorie | Spec | Implémenté | Statut |
|-----------|------|------------|--------|
| Résolution des paramètres | ✓ | ✓ avec clamping renforcé | ✅ |
| Interpolation d'intensité | ✓ | ✓ + clamping t∈[0,1] | ✅ |
| 8 nouveaux drills | ✓ | ✓ tous les 8 | ✅ |
| Page briefing programme | `/test/program/[exId]/run` | `/test/program/[exId]` | ✅ (route sans `/run`) |
| Lien cognitive_session ↔ program_exercise | ✓ | ✓ + vérif. ownership | ✅ |
| Adaptation tests existants (Stroop, Simon, DigitalSpan) | ✓ | ✓ + memoization | ✅ |
| TestTimer visible pendant le test | ✓ | ⚠️ Composant créé, non intégré | ⚠️ |
| Session reuse en mode programme | Non mentionné | ✅ Corrigé (bug critique) | ✅ |

---

## 1. Moteur de test adaptatif

### 1.1 Fichiers implémentés

```
src/lib/cognitive/resolve-params.ts        ← resolveTestParams()
src/lib/cognitive/intensity-interpolation.ts ← interpolate(), computeTrialCount()
```

### 1.2 Résolution des paramètres — état réel

```typescript
// src/lib/cognitive/resolve-params.ts
export function resolveTestParams(
  testDef: CognitiveTestDefinition,
  programExercise?: ProgramExercise | null
): ResolvedTestParams {
  const rawDuration = programExercise?.configured_duration_sec
    ?? testDef.default_duration_sec ?? 300
  const rawIntensity = programExercise?.configured_intensity_percent
    ?? testDef.default_intensity_percent ?? 100
  return {
    durationSec: Math.max(10, rawDuration),           // clamped ≥ 10s
    intensityPercent: Math.max(10, Math.min(100, rawIntensity)), // clamped [10,100]
    phaseContext: programExercise?.phase ?? null,
    programExerciseId: programExercise?.id ?? null,
  }
}
```

**Divergence vs spec initial :** clamping ajouté (protection contre valeurs invalides BDD).

### 1.3 Interpolation — état réel

```typescript
// src/lib/cognitive/intensity-interpolation.ts
export function interpolate(intensityPercent: number, range: [number, number]): number {
  const t = Math.max(0, Math.min(1, (intensityPercent - 10) / 90)) // clamped 0.0–1.0
  return Math.round(range[0] + t * (range[1] - range[0]))
}
```

**Divergence vs spec initial :** `t` est maintenant clampé pour éviter ISI nul/négatif si intensité hors plage.

---

## 2. Les 8 nouveaux drills

Tous implémentés dans `src/components/cognitive/drills/`.

| Drill | Fichier | Particularités implémentées |
|-------|---------|----------------------------|
| Go/No-Go Visual | `GoNoGoVisual.tsx` | ISI variable, noGoRatio interpolé |
| Mackworth Clock | `MackworthClock.tsx` | SVG 24 positions, doubleJumpFreq interpolé, dernier trial enregistré |
| Flanker | `FlankerTest.tsx` | 5 flèches, congruentRatio interpolé, clavier + mobile |
| Stop Signal | `StopSignalTask.tsx` | SSD staircase adaptatif (corrigé), Web Audio API, AudioContext cleanup |
| Spatial Span | `SpatialSpan.tsx` | Grille 3×3 ou 4×4, doublons rejetés |
| 2-Back | `NBackTest.tsx` | Lettres A-Z (sauf I,O,Q), 30% targets |
| Visual Choice 4 | `VisualChoice4.tsx` | 4 stimuli SVG, touches 1-4 + tap |
| Visual Search | `VisualSearch.tsx` | 70% target-present, 30% target-absent (Absent ✗ fonctionnel) |

### Corrections appliquées post-review

- **Stop Signal SSD staircase** : logique était inversée → corrigée (succès=SSD+50, échec=SSD-50)
- **Stop Signal RAF race** : `phase` retiré des deps de useEffect → une seule boucle RAF
- **Stop Signal AudioContext** : fermé proprement au unmount
- **MackworthClock** : dernier trial enregistré avant `completeTest()`
- **Visual Search** : 30% de trials sans cible → bouton "Absent" correct
- **SpatialSpan** : doublons de tap rejetés, état mort `tapTimes` supprimé

---

## 3. Route d'exécution depuis un programme

### Route réelle (≠ spec initial)

| | Spec original | Implémenté |
|-|---------------|------------|
| Route | `/test/program/[exId]/run` | `/test/program/[exId]` |
| Fichier page | — | `src/app/(test)/test/program/[exId]/page.tsx` |
| Composant briefing | — | `src/app/(test)/test/program/[exId]/ProgramDrillBriefing.tsx` |

### Flux complet (tel qu'implémenté)

```
/test/program/[exId]
  → Server: auth + charge program_exercise + testDef + vérifie ownership
  → resolveTestParams() → ResolvedTestParams
  → ProgramDrillBriefing (client)
      ├── PhaseIndicator (PRÉ/IN/POST)
      ├── Durée + IntensityDisplay
      ├── CognitiveLoadBadge (CLS 1-26)
      ├── Instructions du test
      └── [Commencer] → createCognitiveSessionAction(slug, deviceInfo, exId)
            → navigate /test/cognitive/[slug]/[sessionId]?exId=[exId]
              → CognitiveTestRunner (dispatch par slug)
                → drill spécifique (onComplete callback)
                  → completeCognitiveSessionAction(sessionId)
                  → markProgramExerciseCompleteAction(exId)
                  → router.push('/client/programme')
```

### Session reuse — bug corrigé

**Avant (bug) :** `createCognitiveSessionAction` réutilisait toute session pending/in_progress du même test, même si elle appartenait à un autre `program_exercise`.

**Après (corrigé) :** La réutilisation ne s'applique qu'en mode autonome (`program_exercise_id IS NULL`). En mode programme, une session distincte est toujours créée.

---

## 4. Adaptation des tests existants

### Stroop & Simon

- Props ajoutées : `durationSec?: number`, `intensityPercent?: number`
- Valeurs dérivées **memoizées** (`useMemo`) pour éviter reset du rafLoop
- Condition de génération dynamique corrigée : `&&` → `||` (une seule prop suffit)
- Arrêt par timer ou par épuisement des trials (le premier atteint)

### DigitalSpan

- Props ajoutées : `durationSec?: number`, `intensityPercent?: number`
- `minSpan` et `digitDisplayMs` interpolés selon intensité
- Arrêt par timer ou après 2 échecs consécutifs

### PVT

- Non modifié dans ce step (durée fixe, pas d'intensité)
- À traiter dans un step ultérieur si besoin

---

## 5. Composants partagés

### Implémentés

| Composant | Fichier | Usage réel |
|-----------|---------|------------|
| `ProgramDrillBriefing` | `(test)/test/program/[exId]/ProgramDrillBriefing.tsx` | Briefing avant drill programme |
| `PhaseIndicator` | `components/cognitive/PhaseIndicator.tsx` | Badge PRÉ/IN/POST dans briefing |
| `IntensityDisplay` | `components/cognitive/IntensityDisplay.tsx` | Barre verticale % dans briefing |
| `CognitiveLoadBadge` | `components/cognitive/CognitiveLoadBadge.tsx` | Score CLS 1-26 |
| `TestTimer` | `components/cognitive/TestTimer.tsx` | ⚠️ Créé mais **non intégré** dans les drills |

### TestTimer — point ouvert

Le composant `TestTimer` est implémenté (countdown mm:ss + barre de progression) mais **n'est intégré dans aucun test ou drill**. Les tests utilisent des barres de progression internes sans afficher le temps restant sous forme lisible.

**Impact UX :** L'athlète ne voit pas le temps restant en mm:ss pendant l'exécution.
**Décision :** À intégrer dans un prochain step ou laisser tel quel selon priorité UX.

---

## 6. Migrations DB

| Fichier | Contenu | Statut |
|---------|---------|--------|
| `20260408000000_cognitive_schema_v2.sql` | Champs phase_tags, cognitive_category, configurable_durations, etc. | ✅ |
| `20260409000000_program_exercises_cognitive.sql` | Table program_exercises avec configured_duration_sec, configured_intensity_percent, cognitive_load_score | ✅ |
| `20260410000000_cognitive_sessions_program_link.sql` | `program_exercise_id UUID REFERENCES program_exercises(id)` sur cognitive_sessions | ✅ |
| `20260411000000_program_exercises_completed_at.sql` | `completed_at TIMESTAMPTZ` sur program_exercises | ✅ |

---

## 7. Critères d'acceptation — état réel

### Paramètres dynamiques
- [x] Chaque test accepte une durée et une intensité en props
- [x] Le nombre de trials est calculé dynamiquement selon la durée et l'ISI
- [x] Les paramètres de stimulus s'interpolent selon l'intensité (avec clamping)
- [x] Le test s'arrête quand la durée est atteinte (timer interne par RAF)
- [~] Timer visible en mm:ss pendant le test → composant créé, non intégré

### 8 nouveaux drills
- [x] Go/No-Go Visual : hit/miss/false_alarm/correct_rejection
- [x] Mackworth Clock : horloge SVG animée, détection double-sauts
- [x] Flanker : 5 flèches, réponse flèche centrale
- [x] Stop Signal : staircase SSD adaptatif (corrigé)
- [x] Spatial Span : séquences croissantes, arrêt 2 échecs consécutifs
- [x] 2-Back : flux lettres, N=2
- [x] Visual Choice 4 : 4 stimuli SVG, touches 1-4
- [x] Visual Search : cible T bleu, 70/30 présent/absent

### Intégration programme
- [x] Test lancé depuis programme → paramètres coach appliqués
- [x] cognitive_session liée au program_exercise (FK)
- [x] program_exercise marqué completed à la fin
- [x] Ownership vérifié côté serveur (IDOR patch)
- [x] Session reuse bug corrigé (programme crée toujours une session distincte)
- [ ] Formulaire d'évaluation athlète après le test → **non implémenté** (step futur)

### UX
- [x] Tous les tests : mobile (tap) + desktop (clavier)
- [x] Briefing avec phase, durée, intensité, CLS, instructions
- [x] Feedback adapté : visuel pour Stroop/Simon/Spatial, audio pour Stop Signal
- [~] Timer visible pendant le test → barres de progression internes uniquement

---

## 8. Points ouverts pour steps futurs

| Priorité | Item |
|----------|------|
| P1 | **TestTimer** : intégrer dans les drills pour afficher mm:ss restant |
| P1 | **Formulaire d'évaluation athlète** après drill (si step 26 l'exige) |
| P2 | **PVT dynamique** : support durée variable (3/5/10 min) |
| P2 | **Scoring step 31** : calcul SSRT (Stop Signal), Max Span, etc. |
| P3 | **Résultats après drill programme** : actuellement redirige vers `/client/programme` sans afficher les résultats |
