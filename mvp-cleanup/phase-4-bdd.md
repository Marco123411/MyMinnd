# Phase 4 — Migrations BDD : drop des tables hors MVP

## ⚠️ Phase à risque : à exécuter avec un développeur, sur staging d'abord

## Pré-requis

- Phases 1, 2 et 3 complétées et **mergées sur `mvp-launch`**
- `npm run build` et `npm run lint` passent
- L'application fonctionne entièrement en local sur `mvp-launch` (toutes les vérifs manuelles passent)
- **Aucune** ligne de code Phase 3 ne référence les tables qu'on va drop
- Un environnement de **staging** existe et est connecté à une base Supabase distincte de la prod
- Une **sauvegarde complète** de la base de prod a été prise dans les dernières 24h

## Contexte projet

Projet : **MINND Mental Performance**.

**BDD** : Supabase (Postgres). Migrations dans `supabase/migrations/`.

**Règles** :
- Tables en `snake_case`
- Toujours créer des migrations versionnées, jamais de modification directe via le dashboard Supabase
- Respecter l'ordre des foreign keys lors des `DROP`

## Tables à supprimer

### Bloc cognitif (ordre des FK respecté)
1. `cognitive_trials`
2. `cognitive_sessions`
3. `cognitive_baselines`
4. `cognitive_normative_stats`
5. `cognitive_test_definitions`

### Liaison programmes ↔ cognitif
6. `program_exercise_cognitive_types`

### Marketplace experts
7. `expert_profiles`

### Profile Intelligence avancé
8. `profile_intelligence`
9. `profile_centroids`
10. `profile_compatibility`
11. `study_reference_data`
12. `elite_markers`
13. `global_predictors`

## Tables à conserver et simplifier (PAS de drop)

- `dispatches` : conserver, simplifier les statuts
- `payments` : conserver, simplifier la colonne `tier`
- `test_definitions`, `tests`, `responses`, `test_scores`, `questions`, `competency_tree`, `profiles` (simple), `normative_stats` : tous conservés
- `users`, `clients`, `programmes`, `programme_exercises`, `exercises`, `exercise_responses`, `cabinet_sessions`, `autonomous_sessions`, `recurring_templates`, `recurring_executions`, `test_coach_notes` : tous conservés

## Tâches à exécuter

### Tâche 4.1 — Audit préalable des dépendances FK

Avant toute migration, identifier toutes les contraintes de foreign key qui pointent vers les tables à drop.

Pour chaque table à supprimer, exécuter :

```sql
SELECT
  tc.table_name AS dependent_table,
  kcu.column_name AS dependent_column,
  ccu.table_name AS referenced_table
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = '<TABLE_A_DROP>';
```

Si une contrainte est trouvée depuis une table qu'on **conserve**, **arrêter** et signaler à l'utilisateur. Cela signifie qu'une dépendance n'a pas été retirée en Phase 3.

### Tâche 4.2 — Création de la migration de drop

Créer un fichier de migration unique :

```
supabase/migrations/<timestamp>_mvp_cleanup_drop_unused_tables.sql
```

Structure du fichier :

```sql
-- MVP cleanup : drop des tables des features retirées
-- Phases 1-3 ont retiré tout le code applicatif. Cette migration nettoie la BDD.

BEGIN;

-- 1. Bloc cognitif (ordre FK)
DROP TABLE IF EXISTS public.cognitive_trials CASCADE;
DROP TABLE IF EXISTS public.cognitive_sessions CASCADE;
DROP TABLE IF EXISTS public.cognitive_baselines CASCADE;
DROP TABLE IF EXISTS public.cognitive_normative_stats CASCADE;
DROP TABLE IF EXISTS public.cognitive_test_definitions CASCADE;

-- 2. Liaison programmes <-> cognitif
DROP TABLE IF EXISTS public.program_exercise_cognitive_types CASCADE;

-- 3. Marketplace experts
DROP TABLE IF EXISTS public.expert_profiles CASCADE;

-- 4. Profile Intelligence avancé
DROP TABLE IF EXISTS public.profile_intelligence CASCADE;
DROP TABLE IF EXISTS public.profile_centroids CASCADE;
DROP TABLE IF EXISTS public.profile_compatibility CASCADE;
DROP TABLE IF EXISTS public.study_reference_data CASCADE;
DROP TABLE IF EXISTS public.elite_markers CASCADE;
DROP TABLE IF EXISTS public.global_predictors CASCADE;

COMMIT;
```

**Note** : `CASCADE` n'est utilisé qu'en dernier recours. Si l'audit 4.1 montre que des FK extérieures pointent vers ces tables, traiter les FK explicitement avant le DROP plutôt que d'utiliser `CASCADE` aveuglément.

> **Note** : la simplification de `dispatches.status` et `payments.type` (ex-Tâche 4.3) est **reportée à une Phase 5** — voir `mvp-cleanup/phase-5-simplifications.md`. Ces deux tables sont conservées telles quelles pour le launch ; leurs valeurs actuelles fonctionnent avec le code MVP. La simplification sera tranchée après le retour d'expérience opérationnel.

### Tâche 4.4 — Test sur staging

1. Appliquer la migration 4.2 sur staging : `supabase db push` (ou méthode équivalente du projet)
2. Vérifier qu'aucune erreur n'apparaît
3. Lancer l'application contre staging et exécuter les flows MVP critiques :
   - Login coach + client
   - Invitation client
   - Distribution + passation d'un test
   - Annotation + publication
   - Programme + séance
   - Souscription Stripe
4. Si un test échoue : `git revert` la migration et investiguer

### Tâche 4.5 — Application en production

À ne faire que **après validation complète sur staging**, et **après accord explicite de l'utilisateur**.

1. Vérifier qu'une sauvegarde récente existe
2. Annoncer la fenêtre de maintenance (si nécessaire)
3. Appliquer la migration 4.2 en prod
4. Vérifier l'application
5. Communiquer la fin de l'opération

## Critères de validation

- [ ] Audit FK passé sans dépendance résiduelle
- [ ] Migration 4.2 appliquée sur staging avec succès
- [ ] Tous les flows MVP fonctionnent sur staging après migration
- [ ] Sauvegarde prod confirmée avant application
- [ ] Migration appliquée en prod sans incident
- [ ] Branche `mvp-launch` mergée dans `main` après validation finale

## Pièges à éviter

- **Ne jamais** exécuter de DROP en prod sans avoir testé en staging
- **Ne jamais** utiliser `CASCADE` sans avoir audité les FK avant
- **Ne pas** drop `dispatches`, `payments`, `profiles` ou `normative_stats` (ces tables sont conservées)
- Si une migration échoue à mi-parcours, le `BEGIN/COMMIT` permet un rollback ; ne pas continuer manuellement
- Si l'utilisateur n'a pas de staging configuré, **arrêter** et demander d'en créer un avant de toucher la prod

## Fin de phase

Une fois en prod et validé :
1. Merger `mvp-launch` dans `main`
2. Tag de release : `git tag v1.0.0-mvp` et `git push --tags` (à confirmer avec l'utilisateur)
3. Mettre à jour le `README.md` du projet pour refléter le périmètre MVP
4. Conserver `archive/v1-full` indéfiniment comme référence

Le projet est désormais en périmètre MVP, prêt pour l'intervention du nouveau développeur.
