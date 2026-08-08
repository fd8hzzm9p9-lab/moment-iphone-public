export type ReleaseNote = {
  version: string;
  date?: string;
  title: string;
  changes: string[];
};

export const RELEASE_NOTES:
  ReleaseNote[] = [
    {
      version:
        'pré-alpha 0.2.9',

      date:
        '8 août 2026',

      title:
        'Mises à jour et contrôle des versions',

      changes: [
        'Ajout d’un numéro de révision de l’application pour vérifier que le téléphone utilise bien la dernière mise à jour.',
        'Ajout d’une version indépendante du serveur pour identifier le serveur réellement utilisé.',
        'La version affichée distingue maintenant la version de Moment, la révision de l’application et la version du serveur.',
        'Pendant les pré-tests avec Expo Go, un simple Reload permet de charger la dernière révision de Moment sans fermer complètement Expo Go.',
        'Le feedback enregistre la révision réellement exécutée sur le téléphone et la compare à celle attendue par le serveur.',
        'Le feedback permet maintenant de savoir si le testeur doit effectuer un Reload pour être totalement à jour.',
      ],
    },

    {
      version:
        'pré-alpha 0.2.8',

      date:
        '8 août 2026',

      title:
        'Crédits et suivi des pré-tests',

      changes: [
        'Ajout d’un système individuel de crédits de test pour les appels OpenAI.',
        'Les nouveaux pré-testeurs commencent sans crédit et doivent effectuer une première demande avant de poursuivre les traitements en ligne.',
        'Ajout d’une demande de crédit persistante avec un code unique conservé jusqu’à la recharge.',
        'Ajout de codes de recharge signés et liés à un appareil, une demande et un nombre précis de crédits.',
        'Ajout d’un accès Crédit de tests dans Préviens-moi.',
        'Lorsqu’un testeur sans crédit tente une action concernée, Moment lui propose automatiquement de demander des crédits.',
        'Une erreur OpenAI ne consomme plus définitivement un crédit de test : le crédit est rendu lorsque l’appel échoue.',
        'Ajout du suivi des appels OpenAI et de la consommation des tokens.',
        'Ajout du nombre de recharges et du total des crédits attribués dans le suivi des testeurs.',
        'Ajout d’un tableau administrateur pour suivre les crédits, consommations, demandes et recharges de chaque testeur.',
        'Le feedback contient les informations de quota du serveur ainsi que l’état synchronisé sur le téléphone.',
        'Les traitements entièrement réalisés en local restent hors quota OpenAI.',
      ],
    },

    {
      version:
        'pré-alpha 0.2.7',

      date:
        '8 août 2026',

      title:
        'Tests et souvenirs en attente',

      changes: [
        'Ajout d’un guide interactif Comment tester Moment ? pour accompagner les pré-testeurs.',
        'Ajout d’une FAQ expliquant le fonctionnement de Moment, les objectifs des tests et les limites actuelles de la pré-alpha.',
        'Ajout de la possibilité de conserver un souvenir que Moment n’a pas réussi à enregistrer.',
        'Ajout d’une liste repliable des souvenirs en attente.',
        'Ajout d’un compteur des souvenirs restant à traiter.',
        'Ajout du réessai des souvenirs en attente avec le moteur local de Moment uniquement.',
        'Les souvenirs désormais compris sont automatiquement enregistrés dans Ma mémoire et retirés de la liste d’attente.',
        'Les souvenirs toujours incompris restent disponibles pour être réessayés après de futures améliorations de Moment.',
        'Ajout de la cause de l’échec dans le détail des souvenirs en attente.',
        'Ajout de l’historique des souvenirs en attente dans les feedbacks de test.',
      ],
    },

    {
      version:
        'pré-alpha 0.2.6',

      date:
        '8 août 2026',

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

      date:
        '7 août 2026',

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

      date:
        '7 août 2026',

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

      date:
        '7 août 2026',

      title:
        'Premiers traitements locaux',

      changes: [
        'Moment commence à traiter certaines informations directement sans dépendre systématiquement du traitement en ligne.',
        'Premières améliorations visant à accélérer les réponses et réduire les appels externes.',
      ],
    },
  ];
