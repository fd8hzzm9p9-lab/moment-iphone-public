/* ========================================================= */
/* VERSION / HISTORIQUE DES MODIFICATIONS                    */
/* ========================================================= */
/*
 * Moment — Rappelle-moi
 *
 * VERSION : V.pré-0.1.0
 *
 * HISTORIQUE DES MODIFICATIONS DE CETTE VERSION :
 *
 * [1] DÉDUCTIONS — VALIDATION
 *     Lorsqu'une déduction est validée par l'utilisateur,
 *     Moment enregistre désormais cette information comme
 *     un fait explicitement confirmé.
 *
 * [2] DÉDUCTIONS — CONSERVATION DES ÉVÉNEMENTS SOURCES
 *     L'événement créé lors d'une validation conserve les
 *     identifiants des événements ayant servi de base à
 *     la déduction.
 *
 * [3] DÉDUCTIONS — DISTINCTION VALIDATION / RÉFUTATION
 *     Une information validée et une information réfutée
 *     sont désormais enregistrées comme deux états distincts.
 *
 * [4] DÉDUCTIONS — STRUCTURE DES ÉVÉNEMENTS DE DÉCISION
 *     Les événements créés lors d'une validation ou d'une
 *     réfutation utilisent une structure cohérente avec
 *     les autres événements de la mémoire.
 *
 * [5] RECHERCHES RÉCENTES
 *     Conservation de l'historique des cinq dernières
 *     recherches avec :
 *       - la question ;
 *       - la réponse ;
 *       - le temps de traitement ;
 *       - les éventuelles déductions ;
 *       - leur état de validation ou de réfutation.
 *
 * [6] SUPPRESSION D'UNE RECHERCHE
 *     Une recherche récente peut être supprimée sans
 *     supprimer les souvenirs enregistrés dans la mémoire.
 *
 * [7] ANNULATION D'UNE RECHERCHE
 *     Le bouton « Rappelle-moi » devient « Annuler »
 *     pendant le traitement.
 *
 *     L'utilisation de « Annuler » interrompt la requête
 *     en cours via AbortController et remet l'interface
 *     dans son état normal sans enregistrer une réponse
 *     d'erreur comme nouvelle recherche.
 *
 * [8] MESSAGES DE TRAITEMENT
 *     Les messages affichés pendant une recherche sont
 *     centralisés dans config/text.ts.
 *
 *     Moment affiche progressivement :
 *       - l'analyse de la question ;
 *       - la recherche dans les souvenirs ;
 *       - la vérification de ce que la mémoire permet
 *         de confirmer ;
 *       - la préparation de la réponse.
 *
 * [9] COMPTEUR DE TEMPS
 *     Affichage en temps réel du temps écoulé pendant
 *     une recherche.
 *
 *     Le compteur est indépendant du temps réellement
 *     nécessaire au serveur pour répondre.
 *
 * [10] TEMPS DE TRAITEMENT
 *      Le temps total réellement écoulé entre le lancement
 *      de la recherche et la réception de la réponse est
 *      enregistré dans l'historique des recherches.
 *
 * [11] DÉTECTION DES DÉDUCTIONS
 *      Les éléments retournés par le serveur avec le statut
 *      « implied » sont identifiés comme des déductions.
 *
 *      Ils peuvent ensuite être présentés à l'utilisateur
 *      pour validation ou réfutation.
 *
 * [12] DISTINCTION DES NIVEAUX DE CERTITUDE
 *      Moment conserve la distinction entre :
 *        - explicit      : information explicitement connue ;
 *        - implied       : information déduite ;
 *        - not_confirmed : information non confirmée.
 *
 *      Cette distinction est essentielle au comportement
 *      attendu de la mémoire.
 *
 * [13] RAISONNEMENT TEMPOREL
 *      Les recherches peuvent exploiter les dates explicites
 *      ainsi que les dates résolues à partir d'expressions
 *      temporelles telles que « samedi prochain ».
 *
 * [14] MÉMOIRE PERSONNE-CENTRÉE
 *      Les recherches peuvent regrouper plusieurs souvenirs
 *      concernant une même personne tout en conservant les
 *      événements individuels et leur contexte.
 *
 * [15] GESTION DES ERREURS
 *      En cas d'échec de communication avec le serveur,
 *      Moment affiche :
 *
 *        « Impossible de consulter la mémoire pour le moment. »
 *
 *      L'erreur est également enregistrée dans l'historique
 *      avec son temps de traitement.
 *
 * [16] PRÉPARATION DE LA CONFIGURATION DU TEMPS LIMITE
 *      Le délai maximal d'attente d'une requête ne doit pas
 *      être codé directement dans cet écran.
 *
 *      Il doit être centralisé dans un fichier de configuration
 *      du dossier config afin de pouvoir être modifié sans
 *      modifier la logique de Rappelle-moi.
 *
 * [17] CONSERVATION DU COMPORTEMENT EXISTANT
 *      Les fonctionnalités suivantes restent conservées :
 *        - recherche dans la mémoire ;
 *        - historique des recherches ;
 *        - suppression d'une recherche ;
 *        - affichage du temps de réponse ;
 *        - détection des déductions ;
 *        - validation d'une déduction ;
 *        - réfutation d'une déduction ;
 *        - stockage AsyncStorage ;
 *        - annulation d'une requête en cours ;
 *        - messages de traitement ;
 *        - compteur de temps.
 *
 * =========================================================
 *
 * OBJECTIF DE V.pré-0.1.0
 *
 * Stabiliser le comportement de Rappelle-moi avant le passage
 * à la première version 0.1.0, en particulier :
 *
 *   - fiabilité des réponses ;
 *   - distinction fait / déduction / information inconnue ;
 *   - raisonnement temporel ;
 *   - mémoire personne-centrée ;
 *   - gestion des requêtes longues ;
 *   - cohérence de l'interface ;
 *   - gestion propre des erreurs et annulations.
 *
 * =========================================================
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  useNavigation,
} from 'expo-router';

import {
  getAlphaCreditStatus,
} from '../../services/alphaCreditService';

import {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';


/* ========================================================= */
/* CONFIGURATION                                             */
/* ========================================================= */


import MomentThinkingAnimation from '../../components/MomentThinkingAnimation';

import { SERVER_URL } from '../../config/server';

import {
  createDiagnosticId,
  getMomentDeviceId,
  recordDiagnosticInteraction,
} from '../../services/diagnosticService';


import {
  RECENT_SEARCHES_KEY,
  STORAGE_KEY,
} from '../../config/storage';

import {
  RECALL_PROCESSING_STEP_DELAYS,
  RECALL_REQUEST_TIMEOUT,
} from '../../config/timing';


/* ========================================================= */
/* TEXTES                                                    */
/* ========================================================= */

import {
  APP_NAME,
  APP_VERSION,
} from '../../config/app';

import {
  RECALL_PROCESSING_STEPS,
  SEARCH_PLACEHOLDER,
} from '../../config/text';


const PAGE_TITLE =
  'Rappelle-moi';

const SEARCH_BUTTON =
  'Rappelle-moi';

const RECENT_SEARCHES_TITLE =
  'Dernières recherches';

const EMPTY_ANSWER =
  "Je n'ai rien trouvé.";

const ERROR_ANSWER =
  'Impossible de consulter la mémoire pour le moment.';

const INFERENCE_TITLE =
  '🧠 Déduction de Moment';

const VALIDATE_BUTTON =
  '✓ Valider cette information';

const REJECT_BUTTON =
  '✕ Réfuter cette information';

const VALIDATED_LABEL =
  '✓ Information confirmée';

const REJECTED_LABEL =
  '✕ Information réfutée';

const DELETE_SEARCH_LABEL =
  'Supprimer cette recherche';


/* ========================================================= */
/* TYPES                                                     */
/* ========================================================= */

type Evidence = {
  event_id: string;

  status:
    | 'explicit'
    | 'implied'
    | 'not_confirmed';

  claim: string;
};

type Inference = {
  claim: string;
  eventIds: string[];
};

type RecentSearch = {
  question: string;
  answer: string;

  inference?: Inference;

  inferenceValidated?: boolean;
  inferenceRejected?: boolean;

  processingTime?: number;
};


/* ========================================================= */
/* AFFICHAGE DES RÉPONSES                                   */
/* ========================================================= */

/*
 * Affichage des réponses avec une indentation naturelle.
 *
 * Les éléments numérotés restent alignés à gauche.
 * Les puces sont indentées.
 * Les lignes normales restent alignées à gauche.
 *
 * Exemple :
 *
 * 1. Premier fait
 *    • détail
 *    • autre détail
 *
 * 2. Deuxième fait
 */

function AnswerText({
  text,
}: {
  text: string;
}) {
  const lines =
    text
      .split('\n')
      .map(line => line.trimEnd());

  return (
    <View>
      {lines.map(
        (line, index) => {
          const trimmed =
            line.trim();

          /*
           * Ligne vide
           */
          if (!trimmed) {
            return (
              <View
                key={`space-${index}`}
                style={
                  styles.answerSpacer
                }
              />
            );
          }

          /*
           * Détection d'une puce.
           */
          const bulletMatch =
            trimmed.match(
              /^[-•]\s+(.*)$/
            );

          /*
           * Détection d'une liste numérotée.
           *
           * Accepte :
           * 1. texte
           * 1) texte
           */
          const numberedMatch =
            trimmed.match(
              /^\d+[.)]\s+(.*)$/
            );

          /*
           * PUCE
           */
          if (bulletMatch) {
            return (
              <View
                key={index}
                style={
                  styles.answerBulletRow
                }
              >
                <Text
                  style={
                    styles.answerBullet
                  }
                >
                  •
                </Text>

                <Text
                  style={
                    styles.answerBulletText
                  }
                >
                  {bulletMatch[1]}
                </Text>
              </View>
            );
          }

          /*
           * LISTE NUMÉROTÉE
           */
          if (numberedMatch) {
            return (
              <View
                key={index}
                style={
                  styles.answerBulletRow
                }
              >
                <Text
                  style={
                    styles.answerNumber
                  }
                >
                  {
                    trimmed.match(
                      /^\d+/
                    )?.[0]
                  }.
                </Text>

                <Text
                  style={
                    styles.answerBulletText
                  }
                >
                  {numberedMatch[1]}
                </Text>
              </View>
            );
          }

          /*
           * TEXTE NORMAL
           */
          return (
            <Text
              key={index}
              style={
                styles.recentAnswerText
              }
            >
              {trimmed}
            </Text>
          );
        }
      )}
    </View>
  );
}


/* ========================================================= */
/* ÉCRAN                                                     */
/* ========================================================= */

export default function RecallScreen() {
  const creditNavigation =
    useNavigation<any>();
  const abortControllerRef =
    useRef<AbortController | null>(null);

  const [rechercheOuverte, setRechercheOuverte] =
    useState<number | null>(null);

  const [recherche, setRecherche] =
    useState('');

  const [recherchesRecentes, setRecherchesRecentes] =
    useState<RecentSearch[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [tempsEcoule, setTempsEcoule] =
    useState(0);

  const [etapeTraitement, setEtapeTraitement] =
    useState(0);

  const [validationEnCours, setValidationEnCours] =
    useState(false);

  const [inferenceValidee, setInferenceValidee] =
    useState(false);

  const [inferenceRefutee, setInferenceRefutee] =
    useState(false);

  const [inferenceActuelle, setInferenceActuelle] =
    useState<Inference | null>(null);


  /* ======================================================= */
  /* COMPTEUR                                                */
  /* ======================================================= */

  useEffect(() => {
    if (!loading) {
      return;
    }

    const debut = Date.now();

    setTempsEcoule(0);
    setEtapeTraitement(0);

    const interval =
      setInterval(() => {
        const secondes =
          Math.floor(
            (Date.now() - debut) / 1000
          );

        setTempsEcoule(secondes);

        const elapsedMs =
          Date.now() - debut;

        let nouvelleEtape = 0;

        for (
          let i = 0;
          i < RECALL_PROCESSING_STEP_DELAYS.length;
          i++
        ) {
          if (
            elapsedMs >=
            RECALL_PROCESSING_STEP_DELAYS[i]
          ) {
            nouvelleEtape = i;
          }
        }

        setEtapeTraitement(
          Math.min(
            nouvelleEtape,
            RECALL_PROCESSING_STEPS.length - 1
          )
        );
      }, 500);

    return () => {
      clearInterval(interval);
    };
  }, [loading]);


  /* ======================================================= */
  /* CHARGEMENT DES RECHERCHES                               */
  /* ======================================================= */

  useEffect(() => {
    const charger = async () => {
      try {
        const saved =
          await AsyncStorage.getItem(
            RECENT_SEARCHES_KEY
          );

        if (!saved) {
          return;
        }

        const parsed =
          JSON.parse(saved);

        if (Array.isArray(parsed)) {
          setRecherchesRecentes(parsed);
        }
      } catch (error) {
        console.log(
          'Erreur de chargement des recherches récentes :',
          error
        );
      }
    };

    charger();
  }, []);


  /* ======================================================= */
  /* OUVERTURE D'UNE RECHERCHE RÉCENTE                       */
  /* ======================================================= */

  const ouvrirRecherche = (
    item: RecentSearch,
    index: number
  ) => {
    const ouverte =
      rechercheOuverte === index;

    if (ouverte) {
      setRechercheOuverte(null);
      return;
    }

    setRechercheOuverte(index);

    setRecherche(item.question);

    if (item.inference) {
      setInferenceActuelle({
        claim: item.inference.claim,
        eventIds: [
          ...(item.inference.eventIds || []),
        ],
      });

      setInferenceValidee(
        item.inferenceValidated === true
      );

      setInferenceRefutee(
        item.inferenceRejected === true
      );
    } else {
      setInferenceActuelle(null);
      setInferenceValidee(false);
      setInferenceRefutee(false);
    }
  };


  /* ======================================================= */
  /* ENREGISTREMENT D'UNE DÉCISION                           */
  /* ======================================================= */

  const enregistrerDecision = async (
    decision: 'validated' | 'rejected'
  ) => {
    if (
      !inferenceActuelle ||
      validationEnCours ||
      inferenceValidee ||
      inferenceRefutee
    ) {
      return;
    }

    setValidationEnCours(true);

    try {
      const saved =
        await AsyncStorage.getItem(
          STORAGE_KEY
        );

      const evenements =
        saved
          ? JSON.parse(saved)
          : [];

      const estValidation =
        decision === 'validated';

      const decisionEvent = {
        id: `${
          estValidation
            ? 'validated'
            : 'rejected'
        }_${Date.now()}_${Math.random()
          .toString(36)
          .substring(2, 9)}`,

        type: estValidation
          ? 'fact'
          : 'rejected_inference',

        description:
          inferenceActuelle.claim,

        date_reference: '',
        date_precision: 'unknown',
        context: '',

        people: [],
        places: [],
        objects: [],
        subjects: [],
        thoughts: [],
        actions: [],
        intentions: [],

        facts: estValidation
          ? [inferenceActuelle.claim]
          : [],

        relations: [],

        source_text:
          estValidation
            ? `Information explicitement confirmée par l'utilisateur : ${inferenceActuelle.claim}`
            : `Information réfutée par l'utilisateur : ${inferenceActuelle.claim}`,

        confidence:
          estValidation
            ? 1
            : 0,

        created_at:
          new Date().toISOString(),

        is_deduction:
          false,

        pending_validation:
          false,

        status:
          estValidation
            ? 'explicit'
            : 'rejected',

        validated_by_user:
          estValidation,

        rejected_by_user:
          !estValidation,

        source_event_ids:
          [
            ...inferenceActuelle.eventIds,
          ],

        validated_from_event_ids:
          estValidation
            ? [
                ...inferenceActuelle.eventIds,
              ]
            : [],

        rejected_from_event_ids:
          !estValidation
            ? [
                ...inferenceActuelle.eventIds,
              ]
            : [],
      };

      const updated = [
        decisionEvent,
        ...evenements,
      ];

      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(updated)
      );

      const questionActuelle =
        recherche.trim();

      const nouvellesRecherches =
        recherchesRecentes.map(
          (item) => {
            if (
              item.question !==
              questionActuelle
            ) {
              return item;
            }

            return {
              ...item,

              inference: item.inference
                ? {
                    ...item.inference,

                    eventIds: [
                      ...(item.inference.eventIds || []),
                    ],
                  }
                : {
                    claim:
                      inferenceActuelle.claim,

                    eventIds: [
                      ...inferenceActuelle.eventIds,
                    ],
                  },

              inferenceValidated:
                estValidation,

              inferenceRejected:
                !estValidation,
            };
          }
        );

      await AsyncStorage.setItem(
        RECENT_SEARCHES_KEY,
        JSON.stringify(
          nouvellesRecherches
        )
      );

      setRecherchesRecentes(
        nouvellesRecherches
      );

      setInferenceValidee(
        estValidation
      );

      setInferenceRefutee(
        !estValidation
      );

      console.log(
        estValidation
          ? '✅ Déduction validée :'
          : '❌ Déduction réfutée :',
        inferenceActuelle.claim
      );

      console.log(
        '🧠 Événement de décision :',
        decisionEvent
      );

      console.log(
        '💾 Recherche récente sauvegardée :',
        nouvellesRecherches
      );

      if (estValidation) {
        Alert.alert(
          'Information confirmée',
          'Moment pourra désormais considérer cette information comme explicitement confirmée.'
        );
      } else {
        Alert.alert(
          'Information réfutée',
          'Moment enregistrera que cette déduction a été réfutée.'
        );
      }
    } catch (error) {
      console.log(
        'Erreur lors de l’enregistrement de la décision :',
        error
      );

      Alert.alert(
        'Erreur',
        "Impossible d'enregistrer cette information."
      );
    } finally {
      setValidationEnCours(false);
    }
  };


  /* ======================================================= */
  /* VALIDATION                                              */
  /* ======================================================= */

  const validerDeduction = async () => {
    await enregistrerDecision(
      'validated'
    );
  };


  /* ======================================================= */
  /* RÉFUTATION                                              */
  /* ======================================================= */

  const refuterDeduction = async () => {
    await enregistrerDecision(
      'rejected'
    );
  };


  /* ======================================================= */
  /* RECHERCHE                                               */
  /* ======================================================= */

const annulerRecherche = () => {
  if (!abortControllerRef.current) {
    return;
  }

  console.log(
    '🛑 Annulation de la requête demandée'
  );

  abortControllerRef.current.abort();
  abortControllerRef.current = null;

  setLoading(false);

  setInferenceActuelle(null);
  setInferenceValidee(false);
  setInferenceRefutee(false);
};

const ensureTestCreditsAvailable =
  async () => {
    try {
      const status =
        await getAlphaCreditStatus();

      if (
        status
          ?.credit_needed !==
        true
      ) {
        return true;
      }

      Alert.alert(
        'Crédits de test nécessaires',

        'Pour continuer les tests de Moment, demande de nouveaux crédits.',

        [
          {
            text:
              'Plus tard',

            style:
              'cancel',
          },

          {
            text:
              'Demander des crédits',

            onPress:
              () => {
                creditNavigation.navigate(
                  'préviens-moi',
                  {
                    openCredit:
                      '1',
                  }
                );
              },
          },
        ]
      );

      return false;

    } catch {
      return true;
    }
  };

const lancerRecherche = async () => {
  if (
    !recherche.trim() ||
    loading
  ) {
    return;
  }

  const creditsAvailable =
    await ensureTestCreditsAvailable();

  if (
    !creditsAvailable
  ) {
    return;
  }

  await new Promise(
    resolve =>
      requestAnimationFrame(
        resolve
      )
  );

  const controller =
    new AbortController();

    abortControllerRef.current =
      controller;

    const question =
      recherche.trim();

    const diagnosticId =
      createDiagnosticId(
        'recall'
      );

    const momentDeviceId =
      await getMomentDeviceId();

    void recordDiagnosticInteraction({
      diagnostic_id:
        diagnosticId,

      feature:
        'recall',

      input:
        question,

      created_at:
        new Date()
          .toISOString(),

      app_version:
        APP_VERSION,
    });

    const debutRecherche =
      Date.now();

    let timeoutId:
      ReturnType<typeof setTimeout> | null =
      null;

    setLoading(true);
    setTempsEcoule(0);
    setEtapeTraitement(0);

    setRechercheOuverte(null);

    setInferenceActuelle(null);
    setInferenceValidee(false);
    setInferenceRefutee(false);

    try {
      const saved =
        await AsyncStorage.getItem(
          STORAGE_KEY
        );

      const evenements =
        saved
          ? JSON.parse(saved)
          : [];

      console.log(
        '🔎 Question envoyée à Moment :',
        question
      );

      /*
       * Timeout automatique.
       *
       * Le délai est centralisé dans
       * config/timing.ts.
       */

      timeoutId =
        setTimeout(() => {
          console.log(
            `⏰ Timeout de la requête Moment après ${
              RECALL_REQUEST_TIMEOUT / 1000
            } s`
          );

          controller.abort();
        }, RECALL_REQUEST_TIMEOUT);

      const response =
        await fetch(
          `${SERVER_URL}/recall`,
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              question,
              memories: evenements,

              diagnostic_id:
                diagnosticId,

              moment_device_id:
                momentDeviceId,
            }),

            signal:
              controller.signal,
          }
        );

      if (!response.ok) {
        throw new Error(
          `Serveur Moment : ${response.status}`
        );
      }

      const data =
        await response.json();

      const tempsFinal =
        (Date.now() -
          debutRecherche) /
        1000;

      console.log(
        '⏱️ Temps de traitement :',
        tempsFinal.toFixed(1),
        's'
      );

      console.log(
        '🧠 Réponse de Moment :',
        data
      );

      const answerBrute =
        data.answer ||
        data.response ||
        data.message ||
        EMPTY_ANSWER;

      /*
       * La réponse brute est conservée telle quelle.
       *
       * L'affichage est ensuite assuré par AnswerText,
       * qui gère l'indentation visuelle.
       */
      const answer =
        answerBrute;


      /* =================================================== */
      /* DÉTECTION D'UNE DÉDUCTION                           */
      /* =================================================== */

      const impliedEvidence =
  Array.isArray(data.evidence)
    ? data.evidence.filter(
        (item: Evidence) =>
          item &&
          item.status ===
            'implied' &&
          typeof item.claim ===
            'string' &&
          item.claim.trim()
            .length > 0
      )
    : [];

/*
 * Une résolution temporelle calculée par le serveur
 * n'est pas une déduction à valider par l'utilisateur.
 *
 * Exemple :
 * "Cette semaine va du lundi 3 août 2026
 *  au dimanche 9 août 2026."
 *
 * Les bornes ont déjà été déterminées par le moteur
 * temporel du serveur. Elles ne constituent donc pas
 * une déduction personnelle à confirmer ou réfuter.
 */
const isDeterministicTemporalAnswer =
  /(?:cette semaine|la semaine prochaine|la semaine dernière|semaine suivante|semaine précédente|semaine\s+\d{1,2}(?:\s+(?:de\s+)?\d{4})?)/i.test(
    question
  ) &&
  /(?:du|de)\s+\w+\s+\d{1,2}\s+\w+\s+\d{4}.*(?:au|à)\s+\w+\s+\d{1,2}\s+\w+\s+\d{4}/i.test(
    answer
  );

if (
  isDeterministicTemporalAnswer
) {
  setInferenceActuelle(null);
  setInferenceValidee(false);
  setInferenceRefutee(false);
}

      let inference:
  | Inference
  | undefined;

if (
  impliedEvidence.length > 0 &&
  !isDeterministicTemporalAnswer
) {
        const claims =
          impliedEvidence
            .map(
              (item: Evidence) =>
                item.claim.trim()
            )
            .filter(Boolean);

        const eventIds =
          Array.isArray(
            data.event_ids
          )
            ? data.event_ids.filter(
                (id: unknown) =>
                  typeof id ===
                    'string' &&
                  id.trim().length > 0
              )
            : [];

        if (
          claims.length > 0
        ) {
          inference = {
            claim:
              claims.join(' '),

            eventIds,
          };

          setInferenceActuelle(
            inference
          );

          setInferenceValidee(
            false
          );

          setInferenceRefutee(
            false
          );
        }
      } else {
        setInferenceActuelle(null);
        setInferenceValidee(false);
        setInferenceRefutee(false);
      }


      /* =================================================== */
      /* RECHERCHE RÉCENTE                                   */
      /* =================================================== */

      const nouvelleRecherche:
        RecentSearch = {
        question,
        answer,
        inference,

        inferenceValidated:
          false,

        inferenceRejected:
          false,

        processingTime:
          tempsFinal,
      };

      const nouvellesRecherches =
        [
          nouvelleRecherche,

          ...recherchesRecentes.filter(
            (item) =>
              item.question !==
              question
          ),
        ].slice(0, 5);

      setRecherchesRecentes(
        nouvellesRecherches
      );

      await AsyncStorage.setItem(
        RECENT_SEARCHES_KEY,
        JSON.stringify(
          nouvellesRecherches
        )
      );

      setRechercheOuverte(0);

    } catch (error) {
      if (
        error instanceof Error &&
        error.name === 'AbortError'
      ) {
        const tempsFinal =
          (Date.now() -
            debutRecherche) /
          1000;

        const timeout =
          tempsFinal >=
          RECALL_REQUEST_TIMEOUT / 1000 - 1;

        if (timeout) {
          console.log(
            `⏰ Requête Moment interrompue automatiquement après ${
              tempsFinal.toFixed(1)
            } s`
          );
        } else {
          console.log(
            '🛑 Requête Moment annulée par l’utilisateur.'
          );
        }

        return;
      }

      console.log(
        'Erreur lors de la recherche :',
        error
      );

      const tempsFinal =
        (Date.now() -
          debutRecherche) /
        1000;

      const nouvelleRecherche:
        RecentSearch = {
        question,

        answer:
          ERROR_ANSWER,

        processingTime:
          tempsFinal,
      };

      const nouvellesRecherches =
        [
          nouvelleRecherche,

          ...recherchesRecentes.filter(
            (item) =>
              item.question !==
              question
          ),
        ].slice(0, 5);

      setRecherchesRecentes(
        nouvellesRecherches
      );

      await AsyncStorage.setItem(
        RECENT_SEARCHES_KEY,
        JSON.stringify(
          nouvellesRecherches
        )
      );

      setRechercheOuverte(0);

    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (
        abortControllerRef.current ===
        controller
      ) {
        abortControllerRef.current = null;
      }

      setLoading(false);
    }
  };


  /* ======================================================= */
  /* SUPPRESSION                                             */
  /* ======================================================= */

  const supprimerRecherche = (
    indexRecherche: number
  ) => {
    const rechercheASupprimer =
      recherchesRecentes[
        indexRecherche
      ];

    if (!rechercheASupprimer) {
      console.log(
        '⚠️ Recherche introuvable à supprimer :',
        indexRecherche
      );

      return;
    }

    const effectuerSuppression =
      async () => {
        try {
          console.log(
            '🗑️ Suppression demandée pour :',
            rechercheASupprimer.question
          );

          const nouvellesRecherches =
            recherchesRecentes.filter(
              (_, index) =>
                index !==
                indexRecherche
            );

          await AsyncStorage.setItem(
            RECENT_SEARCHES_KEY,
            JSON.stringify(
              nouvellesRecherches
            )
          );

          setRecherchesRecentes(
            nouvellesRecherches
          );

          setRechercheOuverte(null);

          setInferenceActuelle(null);
          setInferenceValidee(false);
          setInferenceRefutee(false);

          if (
            recherche.trim() ===
            rechercheASupprimer.question
          ) {
            setRecherche('');
          }

          console.log(
            '✅ Recherche supprimée :',
            rechercheASupprimer.question
          );

          console.log(
            '💾 Recherches restantes :',
            nouvellesRecherches
          );
        } catch (error) {
          console.log(
            '❌ Erreur lors de la suppression :',
            error
          );

          if (
            typeof window !==
              'undefined' &&
            typeof window.alert ===
              'function'
          ) {
            window.alert(
              'Impossible de supprimer cette recherche.'
            );
          } else {
            Alert.alert(
              'Erreur',
              'Impossible de supprimer cette recherche.'
            );
          }
        }
      };


    /* ==================================================== */
    /* VERSION WEB / PC                                     */
    /* ==================================================== */

    if (
      typeof window !==
        'undefined' &&
      typeof window.confirm ===
        'function'
    ) {
      console.log(
        '🌐 Confirmation de suppression via window.confirm()'
      );

      const confirmation =
        window.confirm(
          `Supprimer cette recherche ?\n\n"${rechercheASupprimer.question}"\n\nCette recherche et sa réponse seront supprimées de la liste des dernières recherches.`
        );

      if (confirmation) {
        void effectuerSuppression();
      } else {
        console.log(
          '↩️ Suppression annulée'
        );
      }

      return;
    }


    /* ==================================================== */
    /* VERSION IOS / ANDROID                                */
    /* ==================================================== */

    Alert.alert(
      'Supprimer cette recherche ?',
      'Cette recherche et sa réponse seront supprimées de la liste des dernières recherches.',
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            void effectuerSuppression();
          },
        },
      ]
    );
  };


  /* ======================================================= */
  /* EFFACER                                                 */
  /* ======================================================= */

  const effacerRecherche = () => {
    setRecherche('');

    setRechercheOuverte(null);

    setInferenceActuelle(null);

    setInferenceValidee(false);

    setInferenceRefutee(false);
  };


  /* ======================================================= */
  /* AFFICHAGE                                               */
  /* ======================================================= */

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={
          styles.content
        }
        keyboardShouldPersistTaps="handled"
      >

        {/* ================================================= */}
        {/* EN-TÊTE                                           */}
        {/* ================================================= */}

        <View style={styles.header}>
          <Text style={styles.logo}>
            {APP_NAME}
          </Text>

          <View
            style={
              styles.versionContainer
            }
          >
            <Text style={styles.version}>
              {APP_VERSION}
            </Text>
          </View>

          <Text style={styles.title}>
            {PAGE_TITLE}
          </Text>
        </View>


        {/* ================================================= */}
        {/* RECHERCHE                                         */}
        {/* ================================================= */}

        <View
          style={
            styles.searchSection
          }
        >
<View
  style={
    styles.searchInputContainer
  }
>
  <TextInput
              style={styles.input}
              placeholder={
                SEARCH_PLACEHOLDER
              }
              placeholderTextColor="#999999"
              value={recherche}
              onChangeText={
                setRecherche
              }
              multiline
              textAlignVertical="top"
            />

            {recherche.length >
              0 && (
              <Pressable
                style={
                  styles.clearSearchButton
                }
                onPress={
                  effacerRecherche
                }
              >
                <Text
                  style={
                    styles.clearSearchText
                  }
                >
                  ×
                </Text>
              </Pressable>
            )}
          </View>


          <View
            style={styles.actions}
          >

            {/* ============================================= */}
            {/* BOUTON RECHERCHE / ANNULER                   */}
            {/* ============================================= */}

            <Pressable
              style={[
                styles.button,
                loading &&
                  styles.cancelButton,
              ]}
              onPress={
                loading
                  ? annulerRecherche
                  : lancerRecherche
              }
            >
              {loading ? (
                <Text
                  style={
                    styles.buttonText
                  }
                >
                  Annuler
                </Text>
              ) : (
                <Text
                  style={
                    styles.buttonText
                  }
                >
                  {SEARCH_BUTTON}
                </Text>
              )}
            </Pressable>


            <Pressable
              style={
                styles.microButton
              }
              onPress={() => {}}
            >
              <Text
                style={
                  styles.microIcon
                }
              >
                🎙️
              </Text>
            </Pressable>

          </View>
        </View>

        {/* ================================================= */}
        {/* DÉDUCTION                                         */}
        {/* ================================================= */}

        {!loading &&
          inferenceActuelle && (
            <View
              style={
                styles.inferenceCard
              }
            >
              <Text
                style={
                  styles.inferenceTitle
                }
              >
                {INFERENCE_TITLE}
              </Text>

              <Text
                style={
                  styles.inferenceText
                }
              >
                {
                  inferenceActuelle.claim
                }
              </Text>

              {inferenceValidee ? (
                <Text
                  style={
                    styles.validatedText
                  }
                >
                  {VALIDATED_LABEL}
                </Text>
              ) : inferenceRefutee ? (
                <Text
                  style={
                    styles.rejectedText
                  }
                >
                  {REJECTED_LABEL}
                </Text>
              ) : (
                <View
                  style={
                    styles.inferenceActions
                  }
                >
                  <Pressable
                    style={[
                      styles.validateButton,
                      validationEnCours &&
                        styles.buttonDisabled,
                    ]}
                    onPress={
                      validerDeduction
                    }
                    disabled={
                      validationEnCours
                    }
                  >
                    {validationEnCours ? (
                      <ActivityIndicator
                        color="#FFFFFF"
                      />
                    ) : (
                      <Text
                        style={
                          styles.validateButtonText
                        }
                      >
                        {
                          VALIDATE_BUTTON
                        }
                      </Text>
                    )}
                  </Pressable>


                  <Pressable
                    style={[
                      styles.rejectButton,
                      validationEnCours &&
                        styles.buttonDisabled,
                    ]}
                    onPress={
                      refuterDeduction
                    }
                    disabled={
                      validationEnCours
                    }
                  >
                    <Text
                      style={
                        styles.rejectButtonText
                      }
                    >
                      {REJECT_BUTTON}
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}


        {/* ================================================= */}
        {/* RECHERCHES RÉCENTES                              */}
        {/* ================================================= */}

        {recherchesRecentes.length >
          0 && (
          <View
            style={
              styles.recentSection
            }
          >
            <Text
              style={
                styles.recentTitle
              }
            >
              {
                RECENT_SEARCHES_TITLE
              }
            </Text>

            {recherchesRecentes.map(
              (
                item,
                index
              ) => {
                const ouverte =
                  rechercheOuverte ===
                  index;

                return (
                  <View
                    key={`${item.question}-${index}`}
                    style={
                      styles.recentItem
                    }
                  >
                    <Pressable
                      onPress={() =>
                        ouvrirRecherche(
                          item,
                          index
                        )
                      }
                    >
                      <View
                        style={
                          styles.recentQuestionRow
                        }
                      >
                        <Text
                          style={
                            styles.recentText
                          }
                        >
                          {
                            item.question
                          }
                        </Text>

<View
  style={
    styles.recentArrowButton
  }
>
  <Text
    style={
      styles.recentArrow
    }
  >
    {ouverte
      ? '▲'
      : '▼'}
  </Text>
</View>
                      </View>
                    </Pressable>


                    {ouverte && (
                      <View
                        style={
                          styles.recentAnswer
                        }
                      >

                        {/* ================================= */}
                        {/* RÉPONSE                            */}
                        {/* ================================= */}

                        <AnswerText
                          text={
                            item.answer
                          }
                        />


                        {/* ================================= */}
                        {/* TEMPS DE RÉPONSE                   */}
                        {/* ================================= */}

                        {item.processingTime !==
                          undefined && (
                          <Text
                            style={
                              styles.processingTimeFinal
                            }
                          >
                            ⏱️ Réponse obtenue en{' '}
                            {item.processingTime.toFixed(
                              1
                            )}{' '}
                            s
                          </Text>
                        )}


                        {/* ================================= */}
                        {/* DÉDUCTION                         */}
                        {/* ================================= */}

                        {item.inference && (
                          <View
                            style={
                              styles.recentInference
                            }
                          >
                            <Text
                              style={
                                styles.recentInferenceTitle
                              }
                            >
                              {
                                INFERENCE_TITLE
                              }
                            </Text>

                            <Text
                              style={
                                styles.recentInferenceText
                              }
                            >
                              {
                                item
                                  .inference
                                  .claim
                              }
                            </Text>

                            {item.inferenceValidated ? (
                              <Text
                                style={
                                  styles.recentValidatedText
                                }
                              >
                                {
                                  VALIDATED_LABEL
                                }
                              </Text>
                            ) : item.inferenceRejected ? (
                              <Text
                                style={
                                  styles.recentRejectedText
                                }
                              >
                                {
                                  REJECTED_LABEL
                                }
                              </Text>
                            ) : (
                              <Text
                                style={
                                  styles.recentPendingText
                                }
                              >
                                Déduction en attente de validation
                              </Text>
                            )}
                          </View>
                        )}


                        {/* ================================= */}
                        {/* SUPPRESSION                        */}
                        {/* ================================= */}

                        <Pressable
                          style={
                            styles.deleteSearchButton
                          }
                          onPress={() => {
                            console.log(
                              '🗑️ Bouton supprimer cliqué, index =',
                              index
                            );

                            supprimerRecherche(
                              index
                            );
                          }}
                        >
                          <Text
                            style={
                              styles.deleteSearchButtonText
                            }
                          >
                            {
                              DELETE_SEARCH_LABEL
                            }
                          </Text>
                        </Pressable>

                      </View>
                    )}
                  </View>
                );
              }
            )}
          </View>
                )}
      </ScrollView>

      {loading && (
        <View
          style={
            styles.fullScreenThinking
          }
          pointerEvents="none"
        >
          <MomentThinkingAnimation
            text={
              recherche
            }
          />
        </View>
      )}
    </View>
  );
}

/* ========================================================= */
/* STYLES                                                    */
/* ========================================================= */

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#F7F5F2',
    },

    fullScreenThinking: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 5,
    },

    content: {
      flexGrow: 1,
      alignItems: 'center',
      padding: 25,
      paddingTop: 70,
      paddingBottom: 50,
    },

    header: {
      width: '100%',
      maxWidth: 500,
      alignItems: 'center',
    },

    logo: {
      fontSize: 42,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: 0,
      letterSpacing: -1,
      color: '#1F2937',
    },

    versionContainer: {
      width: '100%',
      alignItems: 'flex-end',
      paddingRight: 55,
      marginTop: 2,
      marginBottom: 8,
    },

    version: {
      fontSize: 12,
      color: '#999999',
      fontWeight: '500',
    },

    title: {
      fontSize: 28,
      fontWeight: '700',
      color: '#1F2937',
      textAlign: 'center',
      marginBottom: 30,
    },

    searchSection: {
      width: '100%',
      maxWidth: 500,
    },

    searchInputContainer: {
      width: '100%',
      position: 'relative',
    },

    input: {
      width: '100%',
      minHeight: 130,
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      padding: 18,
      paddingRight: 50,
      fontSize: 17,
      color: '#1F2937',
      borderWidth: 1,
      borderColor: '#E5E1DC',
    },

    clearSearchButton: {
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      width: 48,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#F1F0EE',
      borderTopRightRadius: 16,
      borderBottomRightRadius: 16,
    },

    clearSearchText: {
      fontSize: 22,
      color: '#888888',
    },

    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      marginTop: 12,
    },

button: {
  backgroundColor: '#1F2937',
  paddingVertical: 16,
  paddingHorizontal: 45,
  borderRadius: 14,
  minWidth: 150,
  alignItems: 'center',
},

cancelButton: {
  backgroundColor: '#B7791F',
},

buttonDisabled: {
  opacity: 0.6,
},

buttonText: {
  color: '#FFFFFF',
  fontSize: 17,
  fontWeight: '600',
},

    microButton: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: '#F8F7F4',
      borderWidth: 1,
      borderColor: '#E3DFD8',
      alignItems: 'center',
      justifyContent: 'center',
    },

    microIcon: {
      fontSize: 22,
    },

    processingTimeFinal: {
      fontSize: 13,
      color: '#999999',
      marginTop: 10,
      fontStyle: 'italic',
    },

    inferenceCard: {
      width: '100%',
      maxWidth: 500,
      backgroundColor: '#F1F5F9',
      borderRadius: 16,
      padding: 18,
      marginTop: 22,
      borderWidth: 1,
      borderColor: '#D7DEE7',
    },

    inferenceTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: '#374151',
      marginBottom: 10,
    },

    inferenceText: {
      fontSize: 16,
      lineHeight: 23,
      color: '#4B5563',
      marginBottom: 15,
    },

    inferenceActions: {
      gap: 10,
    },

    validateButton: {
      backgroundColor: '#1F2937',
      paddingVertical: 12,
      paddingHorizontal: 18,
      borderRadius: 10,
      alignItems: 'center',
    },

    validateButtonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '600',
    },

    rejectButton: {
      backgroundColor: '#FFFFFF',
      paddingVertical: 11,
      paddingHorizontal: 18,
      borderRadius: 10,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#D1D5DB',
    },

    rejectButtonText: {
      color: '#6B7280',
      fontSize: 15,
      fontWeight: '600',
    },

    validatedText: {
      fontSize: 15,
      fontWeight: '600',
      color: '#4B5563',
      textAlign: 'center',
      paddingVertical: 5,
    },

    rejectedText: {
      fontSize: 15,
      fontWeight: '600',
      color: '#6B7280',
      textAlign: 'center',
      paddingVertical: 5,
    },

    recentSection: {
      width: '100%',
      maxWidth: 500,
      marginTop: 28,
    },

    recentTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: '#1F2937',
      marginBottom: 12,
    },

    recentItem: {
      backgroundColor: '#FFFFFF',
      borderRadius: 12,
      padding: 14,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: '#E5E1DC',
    },

recentQuestionRow: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
},

recentText: {
  flex: 1,
  fontSize: 15,
  color: '#4B5563',
},

recentArrowButton: {
  marginLeft: 8,
  width: 32,
  height: 30,
  backgroundColor: '#F0EFEC',
  borderRadius: 8,
  borderWidth: 1,
  borderColor: '#E3DFD8',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
},

recentArrow: {
  fontSize: 17,
  color: '#888888',
  fontWeight: '600',
},

    recentAnswer: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: '#E5E1DC',
    },

    recentAnswerText: {
      fontSize: 15,
      lineHeight: 22,
      color: '#555555',
    },

    /*
     * Styles utilisés par AnswerText
     */

    answerBulletRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 4,
      paddingLeft: 12,
    },

    answerBullet: {
      width: 18,
      fontSize: 15,
      lineHeight: 22,
      color: '#555555',
    },

    answerNumber: {
      width: 28,
      fontSize: 15,
      lineHeight: 22,
      color: '#555555',
    },

    answerBulletText: {
      flex: 1,
      fontSize: 15,
      lineHeight: 22,
      color: '#555555',
    },

    answerSpacer: {
      height: 8,
    },

    recentInference: {
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: '#E5E1DC',
    },

    recentInferenceTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: '#374151',
      marginBottom: 6,
    },

    recentInferenceText: {
      fontSize: 14,
      lineHeight: 21,
      color: '#555555',
    },

    recentValidatedText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#4B5563',
      marginTop: 10,
    },

    recentRejectedText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#6B7280',
      marginTop: 10,
    },

    recentPendingText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#6B7280',
      marginTop: 10,
    },

    deleteSearchButton: {
      marginTop: 16,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: '#E5E1DC',
      alignItems: 'center',
    },

    deleteSearchButtonText: {
      fontSize: 14,
      color: '#999999',
    },
  });
