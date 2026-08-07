# MEMENTO 002-02 — Audit de `/understand`

**Version :** pré-alpha 0.2.2  
**État :** TERMINÉ

## Objectif

Auditer `/understand` avant les appels OpenAI afin d’identifier les chemins déjà locaux et les premiers bypass possibles.

## Résultat principal

`/understand` contient actuellement **deux appels OpenAI**.

| Zone | Situation actuelle | Potentiel d’économie |
|---|---|---|
| Corrections | La demande est détectée localement avec `isCorrectionRequest()`, puis OpenAI extrait personne, date, contexte, ancienne valeur et nouvelle valeur | Élevé pour les formulations structurées |
| Compréhension générale | Toute saisie qui n’a pas déjà produit un retour local passe par OpenAI pour créer les événements structurés | Très élevé |

## Ce qui fonctionne déjà localement

- Validation d’une déduction lorsqu’une déduction cible est trouvée.
- Réfutation d’une déduction lorsqu’une déduction cible est trouvée.
- Détection d’une demande de correction.
- Enrichissement calendrier.
- Détection de contradictions.

## Limite actuelle importante

Les enrichissements calendrier et les contrôles de contradictions arrivent **après** la structuration GPT.

Autrement dit, Moment sait déjà faire beaucoup de traitement déterministe, mais il reçoit généralement ses données structurées **après avoir payé l’appel OpenAI**.

## Conclusion d’architecture

Pour réduire réellement les appels API, il faut placer avant le bloc `ANALYSE GPT` un moteur local capable de produire directement un événement structuré lorsque la formulation est suffisamment déterministe.

Le flux cible devient :

```text
Saisie utilisateur
      ↓
Analyse locale
      ↓
Compréhension certaine ?
   ├── OUI → événement structuré local → enrichissements → réponse
   └── NON → OpenAI → événement structuré → enrichissements → réponse
```

## Décision pour la suite

**MEMENTO 002-03 / pré-alpha 0.2.3**

Créer la décision **Local First → OpenAI fallback** avant `ANALYSE GPT` et faire contourner OpenAI à une première famille de saisies déterministes.

La première famille devra rester volontairement limitée et à forte certitude pour éviter toute régression.
