# Moment — Knowledge

Ce dossier contient l’architecture des connaissances conceptuelles partagées du moteur Local First.

## Principe

Les connaissances définies ici ont vocation à être consommées par les différents traitements de Moment sans dupliquer les mêmes listes et règles dans plusieurs routes.

Architecture cible :

```text
server/knowledge/
├── index.js
├── registry.js
├── README.md
├── fundamental/
├── domains/
└── shared/
```

### fundamental/

Réservé aux connaissances fondamentales et transversales :

- possessifs ;
- pronoms ;
- famille ;
- négation ;
- incertitude ;
- relations.

Le contenu réel de ces dictionnaires appartient à MEMENTO 002-08.

### domains/

Réservé aux connaissances liées à des domaines fonctionnels :

- lieux / résidence ;
- travail ;
- rendez-vous ;
- invitations ;
- actions.

Le contenu réel de ces dictionnaires appartient à MEMENTO 002-09.

### shared/

Réservé aux éléments réellement communs à plusieurs familles de connaissances.

## Règles d’architecture

1. Une connaissance partagée ne doit pas être recopiée dans plusieurs modules.
2. Les modules de connaissance restent déclaratifs autant que possible.
3. Les règles métier complexes restent dans le moteur ou les utilitaires adaptés.
4. Un dictionnaire ne doit pas déclencher lui-même d’appel OpenAI.
5. Une connaissance inconnue ou insuffisante ne doit jamais être transformée artificiellement en certitude.
6. L’architecture doit rester exploitable par Souviens-toi, Rappelle-moi et, plus tard, Préviens-moi.
7. MEMENTO 002-07 ne modifie aucun comportement fonctionnel existant.
