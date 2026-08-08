# PROCEDURE INTER-ETAPES MEMENTO

**Projet :** Moment  
**Role :** procedure obligatoire de cloture et de transition entre chaque etape MEMENTO.

## Regle generale

Une etape MEMENTO ne doit jamais etre declaree totalement cloturee avant l'execution et la verification de l'ensemble de cette procedure.

L'ordre des operations doit etre respecte afin d'eviter toute perte de travail et toute incoherence entre le code, les fichiers de suivi, la version de l'application et les depots Git.

## 1. Sauvegarde complete AVANT cloture

Avant toute modification de cloture, nettoyage, suppression de fichier ou operation Git :

- creer une sauvegarde complete horodatee du projet ;
- stocker cette sauvegarde hors du dossier du depot de travail ;
- exclure uniquement les elements regenerables et volumineux comme `node_modules`, `.git` et `.expo` ;
- conserver le code source, les fichiers non suivis utiles, les fichiers de suivi, les configurations, les diagnostics et les fichiers temporaires existants ;
- verifier le resultat de la copie ;
- verifier qu'aucun fichier n'a echoue pendant la sauvegarde.

Aucune operation de nettoyage ne doit commencer avant validation de cette sauvegarde.

Convention conseillee :

```text
Moment-backups/
  moment-MEMENTO-XXX-XX-avant-cloture-YYYYMMDD-HHMMSS/
```

## 2. Validation fonctionnelle

Avant de cloturer l'etape :

- verifier que l'objectif prevu est atteint ;
- effectuer les tests reels necessaires ;
- verifier les comportements deja valides afin d'eviter les regressions ;
- analyser les feedbacks disponibles ;
- analyser les diagnostics disponibles ;
- consigner les anomalies restantes ;
- distinguer les anomalies bloquantes, non bloquantes et reportees.

Une anomalie bloquante maintient l'etape en cours.

## 3. Tableaux d'evolution

Mettre a jour tous les tableaux de suivi concernes.

Verifier notamment :

- etat reel de chaque tache ;
- etapes terminees ;
- etapes en cours ;
- etapes a tester ;
- anomalies ;
- priorites ;
- versions cibles ;
- nouvelles taches apparues pendant le developpement ;
- taches reportees.

Les tableaux doivent toujours refleter l'etat reel du projet.

## 4. Plan MEMENTO Markdown et JSON

Mettre a jour les fichiers de suivi de l'etape, notamment :

```text
project-status/memento-XXX-plan.md
project-status/memento-XXX-plan.json
```

Verifier :

- version actuelle ;
- etape actuelle ;
- etat de l'etape ;
- prochaine etape ;
- progression globale ;
- objectif de la prochaine etape.

Les versions Markdown et JSON doivent etre coherentes entre elles.

## 5. Date et heure des fichiers de suivi

A chaque cloture, mettre a jour :

- date du fichier ;
- heure du fichier ;
- fuseau `Europe/Paris` lorsque le format le permet.

## 6. Version de l'application

Verifier :

```text
config/app.ts
```

La version affichee dans Moment doit correspondre a l'etat reel du developpement.

Convention MEMENTO 002 :

```text
MEMENTO 002-06 -> pre-alpha 0.2.6
MEMENTO 002-07 -> pre-alpha 0.2.7
```

Ne jamais modifier la version sans verifier sa coherence avec l'etape MEMENTO.

## 7. Nouveautes / changelog utilisateur

Verifier :

```text
config/releaseNotes.ts
```

Si l'etape apporte des changements visibles ou utiles aux testeurs, mettre a jour les Nouveautes.

Inclure uniquement des informations pertinentes pour l'utilisateur :

- nouvelles fonctions ;
- changements d'interface ;
- corrections de bugs visibles ;
- ameliorations de rapidite ;
- ameliorations de fiabilite ;
- nouvelles possibilites de test.

Ne pas inclure :

- noms de scripts de patch ;
- details Git ;
- noms de fichiers MEMENTO ;
- refactorisations purement internes ;
- details techniques sans interet pour le testeur.

## 8. Feedback et diagnostics

Lorsque l'etape concerne les tests, diagnostics ou traitements Local First :

- verifier les interactions client ;
- verifier les `diagnostic_id` ;
- verifier la correspondance telephone / serveur ;
- verifier les diagnostics serveur ;
- verifier les evenements terminaux ;
- verifier les fallbacks ;
- verifier la classification des erreurs ;
- verifier que le feedback contient suffisamment d'informations pour analyser un probleme sans devoir recontacter le testeur.

## 9. Nettoyage du projet

Uniquement APRES validation de la sauvegarde initiale :

- identifier les scripts de patch temporaires ;
- identifier les fichiers `.bak` ;
- identifier les diagnostics temporaires ;
- identifier les fichiers de debug ;
- identifier les fichiers de test devenus inutiles.

Ne jamais supprimer automatiquement un fichier dont l'utilite n'est pas certaine.

Conserver les outils permanents et les fichiers necessaires a la reprise du projet.

## 10. Controles techniques

Effectuer les controles adaptes aux fichiers modifies.

Pour le serveur, verifier au minimum lorsque ces fichiers sont concernes :

```powershell
node --check server/server.js
node --check server/routes/understand.js
node --check server/routes/recall.js
```

Effectuer egalement les tests fonctionnels necessaires avant le commit.

## 11. Etat Git avant commit

Executer :

```powershell
git status
```

Verifier individuellement :

- fichiers modifies ;
- nouveaux fichiers ;
- fichiers supprimes ;
- fichiers locaux a ne pas versionner ;
- fichiers sensibles ;
- backups ;
- scripts temporaires.

Ne jamais effectuer un `git add .` sans avoir controle l'etat du depot.

## 12. Preparation du commit

Ajouter uniquement les fichiers voulus.

Verifier ensuite :

```powershell
git status
```

S'assurer qu'aucun fichier local ou sensible n'est stage par erreur.

## 13. Commit

Utiliser un message explicite.

Convention :

```text
MEMENTO XXX-XX - description courte
```

Exemple :

```text
MEMENTO 002-06 - diagnostics alpha et feedback intelligent
```

## 14. Push du depot principal

Apres le commit :

```powershell
git push origin main
```

Verifier explicitement que le push est reussi.

## 15. Push Hub

Apres validation de `origin/main` :

```powershell
git push hub main
```

Verifier explicitement que `hub/main` est synchronise.

Une etape n'est pas totalement archivee tant que les depots qui doivent etre synchronises ne le sont pas.

## 16. Etat Git final

Executer :

```powershell
git status
```

Tout fichier restant modifie ou non suivi doit etre identifie.

L'etat final doit etre compris et volontaire.

## 17. Sauvegarde complete FINALE

Une fois :

- les modifications validees ;
- les tableaux synchronises ;
- la version verifiee ;
- le commit effectue ;
- `origin/main` synchronise ;
- `hub/main` synchronise ;

creer une seconde sauvegarde complete horodatee correspondant exactement a l'etat final valide de l'etape.

Convention conseillee :

```text
Moment-backups/
  moment-MEMENTO-XXX-XX-final-YYYYMMDD-HHMMSS/
```

Verifier la copie et confirmer qu'aucun fichier n'a echoue.

Cette sauvegarde finale constitue le point de restauration officiel de l'etape.

## 18. Bilan de cloture

Le bilan final doit indiquer :

- etape terminee ;
- version ;
- resultat principal ;
- tests effectues ;
- anomalies restantes ;
- progression globale ;
- etat Git ;
- sauvegarde initiale ;
- sauvegarde finale ;
- prochaine etape.

## 19. Preparation de l'etape suivante

Avant de commencer la nouvelle etape :

- rappeler son objectif ;
- rappeler le resultat attendu ;
- identifier les fichiers susceptibles d'etre concernes ;
- conserver les comportements deja valides ;
- ne pas modifier inutilement des fonctions reservees a des etapes ulterieures.

# CHECKLIST OBLIGATOIRE

- [ ] Sauvegarde complete AVANT cloture effectuee
- [ ] Sauvegarde initiale verifiee
- [ ] Objectif de l'etape atteint
- [ ] Tests fonctionnels valides
- [ ] Regressions verifiees
- [ ] Feedbacks analyses si disponibles
- [ ] Diagnostics analyses si disponibles
- [ ] Anomalies consignees
- [ ] Tableaux d'evolution mis a jour
- [ ] Plan MEMENTO Markdown mis a jour
- [ ] Plan MEMENTO JSON mis a jour
- [ ] Progression globale mise a jour
- [ ] Date et heure mises a jour
- [ ] Version de Moment verifiee
- [ ] Nouveautes / releaseNotes mises a jour si necessaire
- [ ] Fichiers temporaires identifies
- [ ] Backups temporaires identifies
- [ ] Nettoyage effectue uniquement apres sauvegarde
- [ ] .gitignore verifie
- [ ] Controles syntaxe effectues
- [ ] Tests techniques effectues
- [ ] git status avant commit verifie
- [ ] Fichiers stages verifies
- [ ] Commit effectue
- [ ] Push origin/main effectue
- [ ] Push hub/main effectue
- [ ] git status final verifie
- [ ] Sauvegarde complete FINALE effectuee
- [ ] Sauvegarde finale verifiee
- [ ] Bilan de cloture effectue
- [ ] Etape suivante definie

## Regle absolue

Ne jamais annoncer qu'une etape MEMENTO est totalement cloturee avant d'avoir verifie toute cette checklist, y compris la sauvegarde initiale, la synchronisation Git / Hub et la sauvegarde finale.
