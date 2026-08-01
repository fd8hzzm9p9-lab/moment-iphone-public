import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
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

const STORAGE_KEY = 'moment_memory_events';
const RECENT_SEARCHES_KEY = 'moment_recent_searches';
const SERVER_URL = 'https://moment-iphone.onrender.com';

/* ========================================================= */
/* TEXTES                                                    */
/* ========================================================= */

const APP_NAME = 'Moment';
const PAGE_TITLE = 'Rappelle-moi';

const SEARCH_PLACEHOLDER = 'Que veux-tu savoir ?';
const SEARCH_BUTTON = 'Rappelle-moi';

const RECENT_SEARCHES_TITLE = 'Dernières recherches';

const THINKING_MESSAGE = '🧠 Moment réfléchit…';

const EMPTY_ANSWER = "Je n'ai rien trouvé.";

const ERROR_ANSWER =
  'Impossible de consulter la mémoire pour le moment.';

const INFERENCE_TITLE = '🧠 Déduction de Moment';

const VALIDATE_BUTTON = '✓ Valider cette information';

const VALIDATED_LABEL = '✓ Information confirmée';

/* ========================================================= */
/* TYPES                                                     */
/* ========================================================= */

type EvidenceStatus =
  | 'explicit'
  | 'implied'
  | 'not_confirmed';

type Evidence = {
  event_id: string;
  status: EvidenceStatus;
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
};

/* ========================================================= */
/* ÉCRAN RAPPEL                                              */
/* ========================================================= */

export default function RecallScreen() {
  const [rechercheOuverte, setRechercheOuverte] =
    useState<number | null>(null);

  const [recherche, setRecherche] = useState('');

  const [recherchesRecentes, setRecherchesRecentes] =
    useState<RecentSearch[]>([]);

  const [loading, setLoading] = useState(false);

  const [validationEnCours, setValidationEnCours] =
    useState(false);

  const [inferenceValidee, setInferenceValidee] =
    useState(false);

  const [inferenceActuelle, setInferenceActuelle] =
    useState<Inference | null>(null);

  /* ======================================================= */
  /* CHARGEMENT DES RECHERCHES RÉCENTES                      */
  /* ======================================================= */

  useEffect(() => {
    const chargerRecherchesRecentes = async () => {
      try {
        const saved = await AsyncStorage.getItem(
          RECENT_SEARCHES_KEY
        );

        if (!saved) {
          return;
        }

        const parsed = JSON.parse(saved);

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

    chargerRecherchesRecentes();
  }, []);

  /* ======================================================= */
  /* VALIDATION D'UNE DÉDUCTION                              */
  /* ======================================================= */

  const validerDeduction = async () => {
    if (
      !inferenceActuelle ||
      validationEnCours ||
      inferenceValidee
    ) {
      return;
    }

    setValidationEnCours(true);

    try {
      const saved = await AsyncStorage.getItem(
        STORAGE_KEY
      );

      const evenements = saved
        ? JSON.parse(saved)
        : [];

      const validationEvent = {
        id: `validated_${Date.now()}_${Math.random()
          .toString(36)
          .substring(2, 9)}`,

        type: 'fact',

        description: inferenceActuelle.claim,

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

        facts: [
          inferenceActuelle.claim,
        ],

        relations: [],

        source_text:
          `Information explicitement confirmée par l'utilisateur : ${inferenceActuelle.claim}`,

        confidence: 1,

        created_at:
          new Date().toISOString(),

        validated_by_user: true,

        derived_from_events:
          inferenceActuelle.eventIds,
      };

      const updatedEvents = [
        validationEvent,
        ...evenements,
      ];

      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(updatedEvents)
      );

      setInferenceValidee(true);

      console.log(
        '✅ Information confirmée :',
        inferenceActuelle.claim
      );

      Alert.alert(
        'Information confirmée',
        'Moment considérera désormais cette information comme explicitement mémorisée.'
      );
    } catch (error) {
      console.log(
        'Erreur lors de la validation :',
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
  /* RECHERCHE                                               */
  /* ======================================================= */

  const lancerRecherche = async () => {
    if (!recherche.trim() || loading) {
      return;
    }

    const question = recherche.trim();

    setLoading(true);
    setRechercheOuverte(null);
    setInferenceActuelle(null);
    setInferenceValidee(false);

    try {
      const saved = await AsyncStorage.getItem(
        STORAGE_KEY
      );

      const evenements = saved
        ? JSON.parse(saved)
        : [];

      console.log(
        '🔎 Question envoyée à Moment :',
        question
      );

      const response = await fetch(
        `${SERVER_URL}/recall`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            question,
            memories: evenements,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Serveur Moment : ${response.status}`
        );
      }

      const data = await response.json();

      console.log(
        '🧠 Réponse de Moment :',
        data
      );

      const answer =
        data.answer ||
        data.response ||
        data.message ||
        EMPTY_ANSWER;

      /* =================================================== */
      /* DÉTECTION DES DÉDUCTIONS                            */
      /* =================================================== */

      const impliedEvidence: Evidence[] =
        Array.isArray(data.evidence)
          ? data.evidence.filter(
              (item: Evidence) =>
                item &&
                item.status === 'implied' &&
                typeof item.claim === 'string' &&
                item.claim.trim().length > 0
            )
          : [];

      let inference: Inference | undefined;

      if (impliedEvidence.length > 0) {
        const claims = impliedEvidence
          .map(
            (item) => item.claim.trim()
          )
          .filter(Boolean);

        const eventIds = impliedEvidence
          .map(
            (item) => item.event_id
          )
          .filter(Boolean);

        if (claims.length > 0) {
          inference = {
            claim: claims.join(' '),
            eventIds,
          };

          setInferenceActuelle(
            inference
          );
        }
      }

      /* =================================================== */
      /* HISTORIQUE                                          */
      /* =================================================== */

      const nouvelleRecherche: RecentSearch = {
        question,
        answer,
        inference,
      };

      const nouvellesRecherches = [
        nouvelleRecherche,
        ...recherchesRecentes.filter(
          (item) =>
            item.question !== question
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
      console.log(
        '❌ Erreur lors de la recherche :',
        error
      );

      const nouvelleRecherche: RecentSearch = {
        question,
        answer: ERROR_ANSWER,
      };

      const nouvellesRecherches = [
        nouvelleRecherche,
        ...recherchesRecentes.filter(
          (item) =>
            item.question !== question
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
      setLoading(false);
    }
  };

  /* ======================================================= */
  /* EFFACER                                                */
  /* ======================================================= */

  const effacerRecherche = () => {
    setRecherche('');
    setRechercheOuverte(null);
    setInferenceActuelle(null);
    setInferenceValidee(false);
  };

  /* ======================================================= */
  /* AFFICHAGE                                               */
  /* ======================================================= */

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* ================================================= */}
        {/* EN-TÊTE                                           */}
        {/* ================================================= */}

        <Text style={styles.logo}>
          {APP_NAME}
        </Text>

        <Text style={styles.title}>
          {PAGE_TITLE}
        </Text>

        {/* ================================================= */}
        {/* RECHERCHE                                         */}
        {/* ================================================= */}

        <View style={styles.searchSection}>
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
              onChangeText={setRecherche}
              multiline
              textAlignVertical="top"
            />

            {recherche.length > 0 && (
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

          <View style={styles.actions}>
            <Pressable
              style={[
                styles.button,
                loading &&
                  styles.buttonDisabled,
              ]}
              onPress={
                lancerRecherche
              }
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator
                  color="#FFFFFF"
                />
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
        {/* RÉFLEXION                                         */}
        {/* ================================================= */}

        {loading && (
          <Text
            style={
              styles.thinkingText
            }
          >
            {THINKING_MESSAGE}
          </Text>
        )}

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
                {inferenceActuelle.claim}
              </Text>

              {!inferenceValidee ? (
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
                      {VALIDATE_BUTTON}
                    </Text>
                  )}
                </Pressable>
              ) : (
                <Text
                  style={
                    styles.validatedText
                  }
                >
                  {VALIDATED_LABEL}
                </Text>
              )}
            </View>
          )}

        {/* ================================================= */}
        {/* RECHERCHES RÉCENTES                               */}
        {/* ================================================= */}

        {recherchesRecentes.length > 0 && (
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
              {RECENT_SEARCHES_TITLE}
            </Text>

            {recherchesRecentes.map(
              (item, index) => {
                const ouverte =
                  rechercheOuverte ===
                  index;

                return (
                  <Pressable
                    key={`${item.question}-${index}`}
                    style={
                      styles.recentItem
                    }
                    onPress={() => {
                      setRechercheOuverte(
                        ouverte
                          ? null
                          : index
                      );

                      if (
                        item.inference
                      ) {
                        setInferenceActuelle(
                          item.inference
                        );

                        setInferenceValidee(
                          false
                        );
                      } else {
                        setInferenceActuelle(
                          null
                        );

                        setInferenceValidee(
                          false
                        );
                      }
                    }}
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
                        {item.question}
                      </Text>

                      <Text
                        style={
                          styles.recentArrow
                        }
                      >
                        {ouverte
                          ? '⌃'
                          : '⌄'}
                      </Text>
                    </View>

                    {ouverte && (
                      <View
                        style={
                          styles.recentAnswer
                        }
                      >
                        <Text
                          style={
                            styles.recentAnswerText
                          }
                        >
                          {item.answer}
                        </Text>

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
                              {INFERENCE_TITLE}
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
                          </View>
                        )}
                      </View>
                    )}
                  </Pressable>
                );
              }
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/* ========================================================= */
/* STYLES                                                    */
/* ========================================================= */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F5F2',
  },

  content: {
    flexGrow: 1,
    alignItems: 'center',
    padding: 25,
    paddingTop: 70,
    paddingBottom: 50,
  },

  logo: {
    fontSize: 42,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -1,
    color: '#1F2937',
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
    backgroundColor: '#4B5563',
    paddingVertical: 13,
    paddingHorizontal: 25,
    borderRadius: 12,
    minWidth: 150,
    alignItems: 'center',
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
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

  thinkingText: {
    width: '100%',
    textAlign: 'center',
    fontSize: 16,
    color: '#777777',
    marginTop: 16,
    marginBottom: 8,
  },

  /* ======================================================= */
  /* DÉDUCTION                                              */
  /* ======================================================= */

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

  validatedText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4B5563',
    textAlign: 'center',
    paddingVertical: 5,
  },

  /* ======================================================= */
  /* RECHERCHES RÉCENTES                                    */
  /* ======================================================= */

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

  recentArrow: {
    fontSize: 20,
    color: '#999999',
    marginLeft: 10,
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
});