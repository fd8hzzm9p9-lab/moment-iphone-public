# MEMENTO 002 — Optimisation Local First / réduction OpenAI

**Projet :** Moment  
**État :** EN COURS  
**Version actuelle :** pré-alpha 0.2.8  
**Étape actuelle :** MEMENTO 002-08 — TERMINÉ  
**Prochaine étape :** MEMENTO 002-09 — moteur hybride Local partiel / OpenAI ciblé  
**Progression :** 8 / 23 étapes terminées  
**Date du fichier :** 08/08/2026  
**Heure du fichier :** 12:20

## Objectif global

Optimiser le fonctionnement de Moment afin de réduire au maximum les accès et appels à OpenAI, sans dégrader les comportements déjà validés.

## Priorité immédiate — interface alpha

Avant de poursuivre les dictionnaires, **MEMENTO 002-04** devait modifier l’interface afin que les pré-testeurs disposent immédiatement de repères clairs pour comprendre les fonctions encore en développement et transmettre leurs résultats de test.

Cette base est maintenant opérationnelle et a été enrichie pendant la pré-alpha 0.2.7 par :

1. un accès clair à **« Envoyer le feedback »** ;
2. un écran structuré dans **Préviens-moi** ;
3. un accès **« Comment tester Moment ? »** destiné à permettre au pré-testeur de comprendre seul le principe de Moment, les objectifs des tests et les limites actuelles de la pré-alpha ;
4. une gestion des souvenirs qui n’ont pas pu être enregistrés.

L’objectif est qu’un testeur puisse utiliser Moment avec un minimum d’explications extérieures et ne considère pas automatiquement un comportement encore non pris en charge comme une panne globale de l’application.

## Architecture retenue

**Dictionnaires conceptuels partagés → moteur local commun → confiance suffisante = traitement local → sinon fallback OpenAI.**

## Feedback alpha automatique

Moment doit enregistrer en arrière-plan les informations nécessaires au diagnostic des échecs locaux et des fallbacks, sans demander au testeur de prendre des notes.

Le testeur doit pouvoir appuyer sur un seul bouton **« Envoyer le feedback »** pour générer un paquet de diagnostic complet et exportable.

Le paquet doit permettre de reconstruire et analyser une session sans recontacter le testeur.

Les souvenirs temporairement placés en attente ainsi que leur historique de tentative doivent également pouvoir être intégrés au feedback afin de mesurer les progrès du moteur Local First entre plusieurs versions de Moment.

Exemple de paquet :

```text
moment-feedback-YYYY-MM-DD-session.zip
├── feedback.json
├── interactions.jsonl
├── local-fallbacks.jsonl
├── errors.jsonl
└── app-info.json