# MEMENTO 002 — Optimisation Local First / réduction OpenAI

**Projet :** Moment  
**État :** EN COURS  
**Version actuelle :** pré-alpha 0.2.3  
**Étape actuelle :** MEMENTO 002-03 — TERMINÉ  
**Prochaine étape :** MEMENTO 002-04 — pré-alpha 0.2.4  
**Progression :** 3 / 23 étapes terminées

## Objectif global

Optimiser le fonctionnement de Moment afin de réduire au maximum les accès et appels à OpenAI, sans dégrader les comportements déjà validés.

## Priorité immédiate — interface alpha

Avant de poursuivre les dictionnaires, **MEMENTO 002-04** doit modifier l’interface très rapidement afin que les pré-testeurs disposent immédiatement de deux repères essentiels :

1. un accès clair à **« Envoyer le feedback »**, qui servira ensuite à exporter automatiquement le dossier de diagnostic ;
2. un écran clair dans **Préviens-moi**, actuellement non opérationnel, indiquant que la fonctionnalité est en cours de développement / arrive prochainement.

L’objectif est qu’un testeur qui ouvre Préviens-moi ne pense pas que l’application est cassée ou que l’onglet ne fonctionne pas.

## Architecture retenue

**Dictionnaires conceptuels partagés → moteur local commun → confiance suffisante = traitement local → sinon fallback OpenAI.**

## Feedback alpha automatique

Moment doit enregistrer en arrière-plan les informations nécessaires au diagnostic des échecs locaux et des fallbacks, sans demander au testeur de prendre des notes.

Le testeur doit pouvoir appuyer sur un seul bouton **« Envoyer le feedback »** pour générer un paquet de diagnostic complet et exportable.

Le paquet doit permettre de reconstruire et analyser une session sans recontacter le testeur.

Exemple de paquet :

```text
moment-feedback-YYYY-MM-DD-session.zip
├── feedback.json
├── interactions.jsonl
├── local-fallbacks.jsonl
├── errors.jsonl
└── app-info.json
```

## Plan actualisé

| Étape | Version | Objectif | État |
|---:|---|---|---|
| **002-01** | pré-alpha 0.2.1 | Synchroniser le suivi projet et ouvrir officiellement MEMENTO 002 | 🟢 **TERMINÉ** |
| **002-02** | pré-alpha 0.2.2 | Auditer /understand et identifier les appels OpenAI évitables | 🟢 **TERMINÉ** |
| **002-03** | pré-alpha 0.2.3 | Mettre en place et valider l’architecture Local First → fallback OpenAI | 🟢 **TERMINÉ** |
| **002-04** | pré-alpha 0.2.4 | Modifier immédiatement l’interface alpha : bouton « Envoyer le feedback », accès au diagnostic, et écran explicatif pour l’onglet Préviens-moi non encore opérationnel | 🔵 **PROCHAINE ÉTAPE** |
| **002-05** | pré-alpha 0.2.5 | Créer la journalisation automatique des interactions, essais locaux, fallbacks OpenAI et erreurs | ⚪ **À FAIRE** |
| **002-06** | pré-alpha 0.2.6 | Créer le paquet de diagnostic alpha exportable en un bouton | ⚪ **À FAIRE** |
| **002-07** | pré-alpha 0.2.7 | Créer l’architecture des dictionnaires conceptuels partagés et le dossier server/knowledge/ | ⚪ **À FAIRE** |
| **002-08** | pré-alpha 0.2.8 | Créer les dictionnaires fondamentaux : possessifs, pronoms, famille, négation, incertitude, relations | ⚪ **À FAIRE** |
| **002-09** | pré-alpha 0.2.9 | Étendre les dictionnaires : lieux/résidence, travail, rendez-vous, invitations, actions | ⚪ **À FAIRE** |
| **002-10** | pré-alpha 0.2.10 | Construire le moteur commun d’analyse lexicale + conceptuelle + structurelle | ⚪ **À FAIRE** |
| **002-11** | pré-alpha 0.2.11 | Mettre en place confiance et sécurité : local si suffisamment certain, sinon OpenAI | ⚪ **À FAIRE** |
| **002-12** | pré-alpha 0.2.12 | Intégrer complètement ce moteur à Souviens-toi | ⚪ **À FAIRE** |
| **002-13** | pré-alpha 0.2.13 | Comprendre localement les relations familiales/personnelles | ⚪ **À FAIRE** |
| **002-14** | pré-alpha 0.2.14 | Construire et exploiter le réseau de connaissances entre personnes, faits, lieux et dates | ⚪ **À FAIRE** |
| **002-15** | pré-alpha 0.2.15 | Intégrer le Local First à Rappelle-moi et répondre localement lorsque possible | ⚪ **À FAIRE** |
| **002-16** | pré-alpha 0.2.16 | Gérer localement ambiguïtés, négations, incertitudes, confirmations et réfutations | ⚪ **À FAIRE** |
| **002-17** | pré-alpha 0.2.17 | Préparer le moteur commun pour l’activation future de Préviens-moi | ⚪ **À FAIRE** |
| **002-18** | pré-alpha 0.2.18 | Optimiser le fallback OpenAI restant et réduire le contexte/tokens envoyés | ⚪ **À FAIRE** |
| **002-19** | pré-alpha 0.2.19 | Mesurer appels locaux/OpenAI, causes de fallback, temps et économies | ⚪ **À FAIRE** |
| **002-20** | pré-alpha 0.2.20 | Exploiter les feedbacks alpha pour enrichir dictionnaires et règles sans recontacter le testeur | ⚪ **À FAIRE** |
| **002-21** | pré-alpha 0.2.21 | Rejouer le scénario complet Élise/Axelle avec objectif 0 appel OpenAI | ⚪ **À FAIRE** |
| **002-22** | pré-alpha 0.2.22 | Tests de non-régression et validation globale du Local First | ⚪ **À FAIRE** |
| **002-23** | pré-alpha 0.2.23 | Clôturer MEMENTO 002 : bilan, documentation, architecture et état final du projet | ⚪ **À FAIRE** |

## Scénario de référence

Le scénario **Élise / Axelle** reste le test cible de fin de MEMENTO 002, avec un objectif de **0 appel OpenAI** lorsque la chaîne est suffisamment structurée et couverte localement.

## Prochaine étape

### MEMENTO 002-04 — pré-alpha 0.2.4

Modifier immédiatement l’interface alpha :

- ajouter un accès clair **Envoyer le feedback** ;
- préparer l’intégration du futur paquet de diagnostic ;
- remplacer l’état actuel de **Préviens-moi** par un écran explicatif propre indiquant que la fonctionnalité est à venir / en cours de développement ;
- éviter qu’un testeur interprète cet onglet non opérationnel comme un bug.
