# Plan de retrait MVP — MINND Mental Performance

Ce dossier contient les 4 prompts à donner à Claude Code dans l'ordre pour réduire le projet à son périmètre MVP.

## Contexte

Le projet contient des fonctionnalités au-delà du MVP cible. On retire ce qui n'est pas nécessaire pour réduire la maintenance, sans rien perdre : tout reste accessible sur la branche `archive/v1-full`.

## Périmètre MVP final

### Conservé
- Auth coach + client
- CRM coach (invitation, activation, archive, niveaux client)
- Tests psychométriques (moteur, scoring, résultats) — un seul niveau, pas de Discovery/Complete/Expert
- Annotations coach + publication contrôlée des résultats
- Programmes / exercices / séances (cabinet + autonomes), sans séquences cognitives
- Espace client (résultats publiés, séances, exercices, onboarding)
- Rapports PDF
- Profil coach + paramètres
- Emails transactionnels Resend
- Stripe : un seul abonnement coach (SaaS B2B)
- Admin minimal (création/activation de coachs)

### Retiré
- Tests cognitifs (PVT, Simon, Stroop, Digital Span)
- Marketplace experts
- Workflow expert externe (dispatch admin/expert, emails dispatch)
- Niveaux PMA Discovery/Complete/Expert (paywall test)
- Profile Intelligence avancé (centroïdes K-Means, compatibility, predictors)
- Admin étendu : monitoring, content, experts, cognitive-presets, dispatch
- Stripe checkout-test (achat unique de tests)

## Ordre d'exécution

| Phase | Fichier | Quand |
|---|---|---|
| 1 | [phase-1-branches.md](phase-1-branches.md) | À faire en premier (5 min) |
| 2 | [phase-2-ui.md](phase-2-ui.md) | Après validation Phase 1 |
| 3 | [phase-3-api.md](phase-3-api.md) | Après validation Phase 2 (build OK) |
| 4 | [phase-4-bdd.md](phase-4-bdd.md) | À faire avec ton développeur, sur staging d'abord |

## Règles transverses (toutes phases)

- Travailler **uniquement** sur la branche `mvp-launch`
- Faire un commit atomique après chaque sous-tâche (faciliter le rollback)
- Vérifier que `npm run build` passe avant de committer
- **Ne pas toucher la BDD avant la Phase 4**
- Tester manuellement les flows MVP critiques après chaque phase
