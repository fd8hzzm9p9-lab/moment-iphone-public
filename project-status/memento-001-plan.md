# MEMENTO 001 — Restructuration du serveur

**Projet :** Moment  
**État :** TERMINÉ  
**Nombre d’étapes :** 10  
**Version obtenue :** pré-alpha 0.1.10

## Objectif

Restructurer le serveur Moment en modules spécialisés, sans modification volontaire du comportement métier déjà validé.

MEMENTO 001 a transformé le fichier serveur monolithique en une architecture organisée autour de routes et de modules utilitaires spécialisés.

## Convention de version

**MEMENTO Y, étape X → pré-alpha `0.Y.X`**

MEMENTO 001 s’étant terminé à l’étape 10, la version obtenue est **pré-alpha 0.1.10**.

## Étapes réellement réalisées

| Étape | Résultat |
|---:|---|
| 001-01 | Extraction des utilitaires généraux vers server/utils/core.js |
| 001-02 | Extraction du moteur calendrier / chronologie vers server/utils/calendar.js |
| 001-03 | Extraction des helpers mémoire / entités / questions vers server/utils/memory.js |
| 001-04 | Extraction du moteur de déductions vers server/utils/deductions.js |
| 001-05 | Extraction de la présence stricte vers server/utils/presence.js |
| 001-06 | Extraction du moteur de corrections vers server/utils/corrections.js |
| 001-07 | Extraction des helpers travail vers server/utils/work.js |
| 001-08 | Extraction historique / claims / déductions validées vers server/utils/history.js |
| 001-09 | Extraction complète de la route /recall vers server/routes/recall.js |
| 001-10 | Extraction complète de la route /understand vers server/routes/understand.js |

## Architecture obtenue

```text
server/
├── server.js
├── routes/
│   ├── understand.js
│   └── recall.js
└── utils/
    ├── core.js
    ├── calendar.js
    ├── memory.js
    ├── deductions.js
    ├── presence.js
    ├── corrections.js
    ├── work.js
    └── history.js
```

Le fichier principal `server/server.js` a été ramené à environ **201 lignes** et sert désormais principalement à assembler et démarrer le serveur.

## Résultat final

- Moteur calendrier isolé.
- Gestion mémoire / entités isolée.
- Déductions isolées.
- Présence stricte isolée.
- Corrections isolées.
- Gestion du travail isolée.
- Historique et claims isolés.
- Route `/recall` isolée.
- Route `/understand` isolée.
- Architecture prête à servir de base à MEMENTO 002.

## Clôture

**MEMENTO 001 : TERMINÉ → pré-alpha 0.1.10**

La suite du développement est portée par **MEMENTO 002**, consacré à l’optimisation du fonctionnement de Moment afin de réduire au maximum les appels à OpenAI.
