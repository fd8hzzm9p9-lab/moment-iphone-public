# MEMENTO 002 — Plan d’optimisation OpenAI

**Projet :** Moment  
**État :** EN COURS  
**Objectif :** réduire au maximum les accès/appels à OpenAI sans dégrader les comportements déjà validés.

## Principe directeur

**Moment comprend localement si possible → raisonne localement si possible → répond localement si possible → OpenAI uniquement si nécessaire.**

OpenAI devient un niveau 2 : il n’intervient que lorsque le moteur local ne peut pas comprendre, relier ou répondre avec suffisamment de certitude.

## Convention de version

**MEMENTO Y, étape X → pré-alpha `0.Y.X`**

## Étapes prévues

| Étape | Version | Objectif | Résultat attendu |
|---:|---|---|---|
| 002-01 | pré-alpha 0.2.1 | Mise à jour du suivi projet | project-status synchronisé avec la fin de MEMENTO 001 |
| 002-02 | pré-alpha 0.2.2 | Auditer /understand avant l’appel OpenAI | Identifier ce que Moment sait déjà détecter localement et dans quels cas OpenAI est appelé |
| 002-03 | pré-alpha 0.2.3 | Créer la décision local ou OpenAI pour /understand | Une saisie déterministe contourne complètement OpenAI |
| 002-04 | pré-alpha 0.2.4 | Compréhension locale des faits simples | Personne, fait, lieu, date, heure, événement simple enregistrables sans API |
| 002-05 | pré-alpha 0.2.5 | Relations entre personnes | Comprendre localement sœur, frère, parent, enfant, nièce, neveu, etc. |
| 002-06 | pré-alpha 0.2.6 | Construction du réseau de relations | Moment relie localement les personnes et faits entre plusieurs souvenirs |
| 002-07 | pré-alpha 0.2.7 | Identités possibles et ambiguïtés | Distinguer identité certaine, rapprochement possible et identité inconnue |
| 002-08 | pré-alpha 0.2.8 | Confirmation locale d’une identité/déduction | « Oui, c’est Axelle » consolide localement le lien sans OpenAI |
| 002-09 | pré-alpha 0.2.9 | /recall local-first | Réponse locale lorsque la mémoire structurée suffit |
| 002-10 | pré-alpha 0.2.10 | Raisonnement relationnel local | Réponses issues du réseau de personnes/faits sans API si la preuve suffit |
| 002-11 | pré-alpha 0.2.11 | Gestion locale de l’incertitude | « Je ne peux pas le confirmer » + proposition de confirmation sans OpenAI |
| 002-12 | pré-alpha 0.2.12 | Optimiser le fallback OpenAI | N’envoyer à OpenAI que les souvenirs/contexte pertinents |
| 002-13 | pré-alpha 0.2.13 | Instrumenter les appels OpenAI | Compter appels évités/effectués, raison de l’appel, tokens/contexte transmis |
| 002-14 | pré-alpha 0.2.14 | Tests comparatifs local/OpenAI | Vérifier les économies sans régression |
| 002-15 | pré-alpha 0.2.15 | Validation du scénario familial complet | Le scénario Élise/Axelle fonctionne idéalement avec 0 appel OpenAI |
| 002-16 | pré-alpha 0.2.16 | Clôture MEMENTO 002 | Mise à jour project-status, bilan des économies et état final |

## Scénario de référence Élise / Axelle

Ce scénario sert de test cible pour vérifier qu’une chaîne complète peut être traitée localement :

1. « J'ai une sœur qui s'appelle Élise »
2. « Élise a trois enfants »
3. « Ma nièce s'appelle Axelle »
4. « Mes parents n'ont eu que deux enfants »
5. « La fille d'Élise est née le 22 août 2014 »
6. « Quand est née Axelle ? »
7. « Oui, c'est Axelle »
8. « Quand est née Axelle ? »

Objectif final : **0 appel OpenAI** sur ce scénario lorsque les formulations restent suffisamment structurées et déterministes.

## Point de départ

- MEMENTO 002-01 : synchronisation de `project-status` — terminé.
- Prochaine étape : **MEMENTO 002-02 / pré-alpha 0.2.2**.
- Première cible : auditer `/understand` avant l’appel OpenAI pour déterminer ce qui peut déjà être traité localement.

## Règle de sécurité

Aucune optimisation ne doit supprimer un appel OpenAI si cela réduit la fiabilité de Moment. Le moteur local doit avoir une confiance suffisante ; sinon OpenAI reste le fallback.
