# Phase 5 — Simplifications post-MVP : `dispatches.status` et `payments.type`

## Statut : reportée — à exécuter après le launch

Cette phase regroupe les simplifications de schéma qui étaient initialement prévues dans la Tâche 4.3 mais qui ont été **reportées au post-launch** :

- ces deux tables fonctionnent telles quelles avec le code MVP ;
- la simplification dépend de décisions business qui seront plus claires une fois l'app MVP en production ;
- le refactor touche `actions/admin.ts`, `api/stripe/webhooks/route.ts` et `types/index.ts` — risque non nécessaire avant le launch.

## Pré-requis

- Phase 4 BDD appliquée en prod (les tables hors MVP sont effectivement drop).
- App MVP en prod depuis suffisamment de temps pour qu'on connaisse les valeurs réellement utilisées.
- Décision business prise sur les deux mappings ci-dessous.

## Contexte projet

Projet : **MINND Mental Performance**.

**BDD** : Supabase (Postgres). Migrations dans `supabase/migrations/`.

## État actuel des colonnes (à la sortie de Phase 4)

### `dispatches.status`

- `varchar(20)` + CHECK constraint (PAS un enum).
- Valeurs autorisées : `nouveau, en_cours, dispatche, accepte, en_session, termine, annule` (7 valeurs).
- Default : `nouveau`.
- Définie dans `supabase/migrations/20260331000000_create_dispatches.sql`.

### `payments`

- Colonne réelle : **`type`** (la spec d'origine parlait de `tier`, qui n'existe pas).
- `varchar(20)` + CHECK : `subscription, test_l2, test_l3, expert_payout` (4 valeurs).
- Colonne `status` séparée : `pending, succeeded, failed, refunded`.
- Avec Phase 4 :
  - `expert_profiles` est drop → `expert_payout` n'a plus de cible.
  - Niveaux PMA unifiés (commit `bd382ab`) → `test_l2` / `test_l3` obsolètes.
- Code applicatif qui lit/écrit `type` :
  - `src/app/actions/admin.ts:64-66, 109, 114`
  - `src/app/api/stripe/webhooks/route.ts:63, 71, 145, 149`
  - `src/types/index.ts:371` (union TS)

## Tâches à exécuter

### Tâche 5.1 — Inventaire des valeurs réelles en prod

```sql
SELECT status, count(*) FROM dispatches GROUP BY status ORDER BY count(*) DESC;
SELECT type,   count(*) FROM payments   GROUP BY type   ORDER BY count(*) DESC;
```

À exécuter contre la prod (read-only). Le résultat conditionne le mapping.

### Tâche 5.2 — Décision business sur `dispatches.status`

Cible spec d'origine : `draft / released / archived` (3 valeurs).

Mappings candidats à arbitrer :

| Option | Mapping |
|---|---|
| **A — conservateur** | `nouveau, en_cours, dispatche, accepte, en_session → draft` ; `termine → released` ; `annule → archived` |
| **B — publication-centric** | `nouveau, en_cours, dispatche, accepte → draft` ; `en_session, termine → released` ; `annule → archived` |
| **C** | autre — à définir avec l'utilisateur |

### Tâche 5.3 — Décision business sur `payments.type`

Options :

| Option | Action | Impact code |
|---|---|---|
| **A — collapse total** | DROP COLUMN `type` ; tout est implicitement coach | Update lectures dans `actions/admin.ts`, écritures dans `webhooks/route.ts`, retirer l'union TS |
| **B — réduction** | UPDATE des vieilles valeurs vers `subscription` ; CHECK réduit à `subscription` seul | Idem mais minime |
| **C** | autre | |

### Tâche 5.4 — Création de la migration

Créer :

```
supabase/migrations/<timestamp>_mvp_simplify_dispatches_and_payments.sql
```

Structure attendue :

1. `BEGIN;`
2. Drop CHECK constraint `dispatches_status_check` (ou nom équivalent).
3. UPDATE des données selon le mapping retenu en 5.2.
4. ADD CHECK avec les nouvelles valeurs (`NOT VALID` puis `VALIDATE` pour limiter le verrou).
5. UPDATE / DROP COLUMN sur `payments.type` selon 5.3.
6. ADD CHECK sur `payments.type` si conservé.
7. `COMMIT;`

### Tâche 5.5 — Refactor du code applicatif

Selon les décisions 5.2 / 5.3 :

- Mettre à jour `src/types/index.ts:371` (union `Payment.type`).
- Mettre à jour `src/app/actions/admin.ts:64-66, 109, 114` (lectures de `type`).
- Mettre à jour `src/app/api/stripe/webhooks/route.ts:63, 71, 145, 149` (écritures de `type`).
- Mettre à jour les références à `dispatches.status` (à inventorier le moment venu).

### Tâche 5.6 — Test sur staging puis prod

Même procédure que Tâche 4.4 / 4.5 : staging d'abord, validation des flows critiques (Stripe webhook en particulier), backup prod < 24h, puis prod.

## Pièges à éviter

- **Ne pas** modifier `payments.type` sans avoir refait tourner les flows Stripe complets sur staging — un webhook qui pose silencieusement la mauvaise valeur pendant 24h est un incident métier difficile à reconstruire.
- **Ne pas** appliquer cette phase pendant un cycle de souscription Stripe actif sans fenêtre de maintenance.
- Pour `dispatches.status`, vérifier qu'aucune query côté UI ne filtre sur les anciennes valeurs (`status = 'en_session'` etc.) avant migration.

## Fin de phase

Une fois en prod et validé : pas de tag de release particulier — c'est de l'ajustement post-MVP.
