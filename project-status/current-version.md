# Moment — État d’avancement

**Opération :** MEMENTO 001  
**Version de travail :** 0.1.0  
**Commit de référence :** `f06f1f7`  
**État global :** EN COURS

Ce fichier fait partie du projet et doit voyager avec les exports/imports de Moment.

## 1. Corrections fonctionnelles

| Type | Tâche | État | Priorité | Version cible |
|---|---|---|---|---|
| Temps / calendrier | Références déterministes : demain, hier, après-demain, aujourd'hui → aucune confirmation si non ambigu | En cours | Haute | 0.1.0 |
| Temps / calendrier | Cette semaine → lundi 3/08/2026 au dimanche 9/08/2026 | OK | - | 0.1.0 |
| Temps / calendrier | Semaine prochaine → bornes correctes | OK | - | 0.1.0 |
| Temps / calendrier | Numéros de semaine ISO : semaine 32, 42, etc. | OK / À valider | Moyenne | 0.1.0 |
| Temps / calendrier | Semaine XX sans année → demander l'année | OK | - | 0.1.0 |
| Temps / calendrier | Semaine XX avec année → calcul correct | OK | - | 0.1.0 |
| Rendez-vous | Correction d'un rendez-vous : personne + événement + ancienne heure + nouvelle heure | En cours | Haute | 0.1.0 |
| Rendez-vous | Aucun rendez-vous correspondant → expliquer clairement qu'il n'est pas mémorisé | À améliorer | Haute | 0.1.0 |
| Rendez-vous | Correction avec aucun candidat → ne pas considérer la correction comme réussie | À valider | Haute | 0.1.0 |
| Horaires de travail | Correction ancien horaire → nouvel horaire | À tester | Haute | 0.1.0 |
| Horaires de travail | Sélection parmi plusieurs horaires | À tester | Haute | 0.1.0 |
| Horaires de travail | Gestion des ambiguïtés entre plusieurs horaires | À tester | Haute | 0.1.0 |

## 2. Déductions

| Type | Tâche | État | Priorité | Version cible |
|---|---|---|---|---|
| Déductions | Détection d'une information implied | OK | - | 0.1.0 |
| Déductions | Affichage d'une déduction en attente | OK | - | 0.1.0 |
| Déductions | Validation d'une déduction | OK / À tester | Haute | 0.1.0 |
| Déductions | Réfutation d'une déduction | OK / À tester | Haute | 0.1.0 |
| Déductions | Déduction rejetée jamais utilisée comme preuve | OK | - | 0.1.0 |
| Déductions | Déduction validée considérée comme acquise | OK | - | 0.1.0 |
| Déductions | Réfuter une déduction ne réfute pas les sources | OK | - | 0.1.0 |
| Déductions | Tester validation puis rappel | À tester | Haute | 0.1.0 |
| Déductions | Tester réfutation puis rappel | À tester | Haute | 0.1.0 |

## 3. Présence / personnes

| Type | Tâche | État | Priorité | Version cible |
|---|---|---|---|---|
| Présence | « J'ai vu Marc » ≠ « Marc était avec moi » | OK | - | 0.1.0 |
| Présence | « Avec moi » nécessite une preuve relationnelle explicite | OK | - | 0.1.0 |
| Présence | Personne mentionnée mais présence non confirmée → réponse explicite | OK | - | 0.1.0 |
| Mémoire personne-centrée | Reconnaître une même personne dans plusieurs événements distincts | À poursuivre | Haute | 0.1.0 |
| Contexte | Utiliser les événements proches comme contexte sans les confondre | À tester | Moyenne | 0.1.0 |

## 4. Chronologie / calendrier

| Type | Tâche | État | Priorité | Version cible |
|---|---|---|---|---|
| Chronologie | Utiliser la date réelle de l'événement plutôt que created_at | OK | - | 0.1.0 |
| Chronologie | Utiliser les bornes serveur des périodes relatives | OK | - | 0.1.0 |
| Chronologie | GPT ne recalcule pas les périodes relatives | OK | - | 0.1.0 |
| Chronologie | Distinguer confirmé / non documenté / absence de preuve | OK | - | 0.1.0 |
| Chronologie | Questions « dernier », « premier », « depuis », « entre » | À tester | Haute | 0.1.0 |
| Chronologie | Questions « combien de fois / combien de jours » | À tester | Haute | 0.1.0 |
| Calendrier | Consolider les semaines ISO dans tout le raisonnement temporel | À faire | Haute | 0.1.0 |
| Calendrier | Références déterministes sans confirmation | À corriger | Haute | 0.1.0 |

## 5. Interface / UX

| Type | Tâche | État | Priorité | Version cible |
|---|---|---|---|---|
| UX | Actualiser correctement les étapes de traitement affichées | À améliorer | Haute | 0.1.0 |
| UX | Corriger le temps de traitement aberrant, ex. 20367 s | À corriger | Haute | 0.1.0 |
| UX | Vérifier que le temps affiché correspond au temps réel | À corriger | Haute | 0.1.0 |
| UX | Messages adaptés à chaque étape réelle du traitement | À améliorer | Moyenne | 0.1.0 |
| UX | Bouton Annuler pendant une requête | OK | - | 0.1.0 |
| UX | Annulation sans enregistrement | OK | - | 0.1.0 |
| UX | Harmoniser le bouton Annuler de Souviens-toi avec Rappelle-moi | À faire | Moyenne | 0.1.0 |
| UX | Corriger warning pointerEvents deprecated | À faire | Faible | 0.1.0 |
| UX | Corriger Unexpected text node dans View | À corriger | Moyenne | 0.1.0 |

## 6. Rappelle-moi

| Type | Tâche | État | Priorité | Version cible |
|---|---|---|---|---|
| Rappelle-moi | Questions temporelles simples | OK | - | 0.1.0 |
| Rappelle-moi | Ne pas créer artificiellement une déduction pour une réponse calendaire | OK / À surveiller | Moyenne | 0.1.0 |
| Rappelle-moi | Réponse naturelle sans informations techniques | OK | - | 0.1.0 |
| Rappelle-moi | Utilisation correcte des déductions validées | À tester | Haute | 0.1.0 |
| Rappelle-moi | Questions ambiguës / inconnues / non confirmées | À tester | Moyenne | 0.1.0 |

## 7. Stockage / mémoire

| Type | Tâche | État | Priorité | Version cible |
|---|---|---|---|---|
| Stockage | Conservation des événements sources d'une déduction | OK | - | 0.1.0 |
| Stockage | Historique de validation | OK | - | 0.1.0 |
| Stockage | Historique de réfutation | OK | - | 0.1.0 |
| Stockage | Correction d'un événement sans perdre son historique | À vérifier | Haute | 0.1.0 |
| Stockage | Oublier un souvenir | OK | - | 0.1.0 |

## 8. Tests

| Type | Tâche | État | Priorité | Version cible |
|---|---|---|---|---|
| Test | Création rendez-vous → correction heure | En cours | Haute | 0.1.0 |
| Test | Correction rendez-vous inexistant | À tester | Moyenne | 0.1.0 |
| Test | Plusieurs rendez-vous possibles | À tester | Haute | 0.1.0 |
| Test | Correction horaire de travail | À tester | Haute | 0.1.0 |
| Test | Plusieurs horaires possibles | À tester | Haute | 0.1.0 |
| Test | Validation déduction → rappel | À tester | Haute | 0.1.0 |
| Test | Réfutation déduction → rappel | À tester | Haute | 0.1.0 |
| Test | Cette semaine / semaine prochaine / précédente | OK | - | 0.1.0 |
| Test | Semaine ISO avec année | OK | - | 0.1.0 |
| Test | Semaine ISO sans année | OK | - | 0.1.0 |
| Test | « Demain » sans confirmation | À corriger puis tester | Haute | 0.1.0 |
| Test | Questions temporelles combinées aux événements | À tester | Haute | 0.1.0 |

## 9. État général du projet

| Domaine | État | Version cible |
|---|---|---|
| Interface générale | OK | 0.1.0 |
| Souviens-toi | OK | 0.1.0 |
| Stockage mémoire | OK | 0.1.0 |
| Oublier un souvenir | OK | 0.1.0 |
| Rappelle-moi | OK / À valider | 0.1.0 |
| Historique des recherches | OK | 0.1.0 |
| Suppression d'une recherche | OK | 0.1.0 |
| Préviens-moi | En cours | 0.2.0 |
| Déductions | En cours | 0.1.0 |
| Raisonnement temporel | En cours | 0.1.0 |
| Mémoire personne-centrée | En cours | 0.1.0 |
| Voix | En cours | 0.2.0 |
| Notifications réelles | KO | 0.2.0 |
| Finitions UX | En cours | 0.1.0 |

## 10. Ordre de travail actuel

| Ordre | Tâche | Priorité | État | Version cible |
|---:|---|---|---|---|
| 1 | Supprimer les confirmations inutiles pour « demain », « hier », etc. | Haute | En cours | 0.1.0 |
| 2 | Tester création → correction d'un rendez-vous | Haute | En cours | 0.1.0 |
| 3 | Corriger les corrections d'horaires de travail | Haute | À faire | 0.1.0 |
| 4 | Tester validation / réfutation des déductions | Haute | À faire | 0.1.0 |
| 5 | Approfondir le raisonnement temporel / semaines ISO | Haute | En cours | 0.1.0 |
| 6 | Corriger l'affichage des étapes et du temps de traitement | Haute | À faire | 0.1.0 |
| 7 | Corriger les erreurs/warnings React Native Web | Moyenne | À faire | 0.1.0 |
| 8 | Poursuivre les éléments en cours du pré-0.1.0 | Moyenne | En cours | 0.1.0 |
| 9 | Finaliser Préviens-moi, voix et notifications réelles | Haute | À faire | 0.2.0 |
