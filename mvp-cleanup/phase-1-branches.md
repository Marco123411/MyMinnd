# Phase 1 — Création des branches d'archivage et de travail

## Objectif

Sécuriser l'état actuel du projet sur une branche d'archive, puis créer une branche de travail dédiée au retrait des features hors MVP.

## Contexte

Le projet va être réduit à son périmètre MVP en plusieurs phases. Avant de toucher quoi que ce soit, on doit :
1. Préserver l'état complet actuel sur une branche `archive/v1-full`
2. Créer une branche `mvp-launch` à partir du même point, sur laquelle se feront les retraits

## Tâches à exécuter

### 1. Vérifier l'état du dépôt

- Exécuter `git status`
- S'assurer que le working tree est propre (aucun fichier modifié non committé)
- Si des changements existent, **arrêter** et signaler à l'utilisateur

### 2. Identifier la branche actuelle

- Exécuter `git branch --show-current`
- Noter le nom de la branche actuelle (référence pour la suite)

### 3. Mettre à jour la branche principale

- Exécuter `git fetch origin`
- Vérifier qu'on est synchronisé avec `origin/main`

### 4. Créer la branche d'archive

- Exécuter `git branch archive/v1-full main` (depuis `main`, sans switcher)
- Pousser : `git push -u origin archive/v1-full`
- Vérifier : `git branch -a | grep archive`

### 5. Créer la branche de travail MVP

- Exécuter `git checkout -b mvp-launch main`
- Pousser : `git push -u origin mvp-launch`
- Vérifier : `git branch --show-current` doit retourner `mvp-launch`

### 6. Confirmer

- Lister les branches locales : `git branch`
- Confirmer à l'utilisateur que les deux branches existent et qu'on est positionné sur `mvp-launch`

## Critères de validation

- [ ] La branche `archive/v1-full` existe en local et sur le remote
- [ ] La branche `mvp-launch` existe en local et sur le remote
- [ ] Le HEAD est positionné sur `mvp-launch`
- [ ] Le working tree est propre
- [ ] Aucun fichier n'a été modifié

## En cas de problème

- Si `archive/v1-full` existe déjà : demander à l'utilisateur s'il faut la conserver ou la recréer
- Si `mvp-launch` existe déjà : demander à l'utilisateur avant de la supprimer
- Ne **jamais** force-push, ne **jamais** supprimer une branche sans confirmation explicite

## Fin de phase

Une fois validé, signaler à l'utilisateur :
- Que les branches sont prêtes
- Qu'il peut maintenant lancer la Phase 2 avec le fichier `phase-2-ui.md`
