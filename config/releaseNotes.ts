export type ReleaseNote = {
  version: string;
  title: string;
  changes: string[];
};

export const RELEASE_NOTES:
  ReleaseNote[] = [
    {
      version:
        'pré-alpha 0.2.6',

      title:
        'Feedback et suivi des tests',

      changes: [
        'Ajout de l’envoi d’un feedback de test directement depuis Moment.',
        'Ajout d’un compteur des interactions en attente de feedback.',
        'Ajout d’un rappel au lancement lorsque trop d’interactions attendent d’être envoyées.',
        'Ajout d’une identification anonyme et stable de l’appareil de test.',
        'Amélioration des informations utiles au diagnostic des tests.',
        'Ajout d’un accès aux nouveautés de Moment.',
        'Réorganisation de la page Préviens-moi pour mieux séparer les informations, les nouveautés et la zone de test.',
        'Amélioration de l’affichage des échecs et du temps de traitement dans Souviens-toi.',
      ],
    },

    {
      version:
        'pré-alpha 0.2.5',

      title:
        'Meilleur suivi des tests',

      changes: [
        'Moment mémorise automatiquement les interactions réalisées pendant les tests.',
        'Les traitements réussis, les erreurs et les passages vers le traitement en ligne sont mieux suivis.',
      ],
    },

    {
      version:
        'pré-alpha 0.2.4',

      title:
        'Évolution de Préviens-moi',

      changes: [
        'Nouvel écran temporaire pour Préviens-moi.',
        'Ajout de l’accès au feedback des pré-testeurs.',
        'Clarification des fonctionnalités encore en cours de développement.',
      ],
    },

    {
      version:
        'pré-alpha 0.2.3',

      title:
        'Premiers traitements locaux',

      changes: [
        'Moment commence à traiter certaines informations directement sans dépendre systématiquement du traitement en ligne.',
        'Premières améliorations visant à accélérer les réponses et réduire les appels externes.',
      ],
    },
  ];
