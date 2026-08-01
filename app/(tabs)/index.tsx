import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
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
const SERVER_URL = 'https://moment-iphone.onrender.com';

/* ========================================================= */
/* TEXTES DE L'APPLICATION                                   */
/* ========================================================= */

const APP_NAME = 'Moment';

const APP_TAGLINE = 'Votre mémoire, simplement.';

const MEMORY_PLACEHOLDER =
  'Racontez-moi quelque chose...';

const MEMORY_BUTTON = 'Souviens-toi';

const MEMORY_TITLE = 'Ma mémoire';

const UNDERSTOOD_LABEL =
  '🧠 Moment a compris';

const CLEAR_MEMORY_LABEL =
  'Effacer la mémoire';

const FORGET_MEMORY_LABEL =
  '🗑️ Oublier ce souvenir';

const CLEAR_INPUT_LABEL = '×';

/* ========================================================= */
/* TYPES                                                     */
/* ========================================================= */

type Relation = {
  from: string;
  relation: string;
  to: string;
};

type MemoryEvent = {
  id: string;
  type: string;
  description: string;
  date_reference: string;
  date_precision: string;
  context: string;
  people: string[];
  places: string[];
  objects: string[];
  subjects: string[];
  thoughts: string[];
  actions: string[];
  intentions: string[];
  facts: string[];
  relations: Relation[];
  source_text: string;
  confidence: number;
  created_at: string;
};

type MemoryInput = {
  input: string;
  events: MemoryEvent[];
};

/* ========================================================= */
/* NORMALISATION                                             */
/* ========================================================= */

function normalizeEvent(
  event: Partial<MemoryEvent>,
  input: string
): MemoryEvent {
  return {
    id: `memory_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 9)}`,

    type: event.type || 'event',

    description:
      event.description || input,

    date_reference:
      event.date_reference || '',

    date_precision:
      event.date_precision || 'unknown',

    context:
      event.context || '',

    people:
      event.people || [],

    places:
      event.places || [],

    objects:
      event.objects || [],

    subjects:
      event.subjects || [],

    thoughts:
      event.thoughts || [],

    actions:
      event.actions || [],

    intentions:
      event.intentions || [],

    facts:
      event.facts || [],

    relations:
      event.relations || [],

    source_text:
      event.source_text || input,

    confidence:
      typeof event.confidence === 'number'
        ? event.confidence
        : 0,

    created_at:
      new Date().toISOString(),
  };
}

/* ========================================================= */
/* DÉTAILS D'UN SOUVENIR                                    */
/* ========================================================= */

function EventDetails({
  event,
}: {
  event: MemoryEvent;
}) {
  return (
    <>
      {event.date_reference && (
        <Text style={styles.detail}>
          🕐 {event.date_reference}
        </Text>
      )}

      {event.context && (
        <Text style={styles.detail}>
          📍 {event.context}
        </Text>
      )}

      {event.people.length > 0 && (
        <Text style={styles.detail}>
          👤 {event.people.join(', ')}
        </Text>
      )}

      {event.places.length > 0 && (
        <Text style={styles.detail}>
          📌 {event.places.join(', ')}
        </Text>
      )}

      {event.subjects.length > 0 && (
        <Text style={styles.detail}>
          🎯 {event.subjects.join(', ')}
        </Text>
      )}

      {event.thoughts.length > 0 && (
        <Text style={styles.detail}>
          💭 {event.thoughts.join(' ; ')}
        </Text>
      )}

      {event.actions.length > 0 && (
        <Text style={styles.detail}>
          🔨 {event.actions.join(' ; ')}
        </Text>
      )}

      {event.intentions.length > 0 && (
        <Text style={styles.detail}>
          📋 {event.intentions.join(' ; ')}
        </Text>
      )}

      {event.objects.length > 0 && (
        <Text style={styles.detail}>
          📦 {event.objects.join(', ')}
        </Text>
      )}

      {event.facts.length > 0 && (
        <Text style={styles.detail}>
          ℹ️ {event.facts.join(' ; ')}
        </Text>
      )}

      {event.relations.length > 0 && (
        <Text style={styles.detail}>
          🔗{' '}
          {event.relations
            .map(
              (relation) =>
                `${relation.from} ${relation.relation} ${relation.to}`
            )
            .join(' ; ')}
        </Text>
      )}
    </>
  );
}

/* ========================================================= */
/* ÉCRAN SOUVIENS-TOI                                       */
/* ========================================================= */

export default function MemoryScreen() {
  const [souvenir, setSouvenir] =
    useState('');

  const [evenements, setEvenements] =
    useState<MemoryEvent[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [
    souvenirEnCours,
    setSouvenirEnCours,
  ] = useState(false);

  /* ======================================================= */
  /* CHARGEMENT DE LA MÉMOIRE                                */
  /* ======================================================= */

  useEffect(() => {
    const loadMemory = async () => {
      try {
        const saved =
          await AsyncStorage.getItem(
            STORAGE_KEY
          );

        if (saved) {
          setEvenements(
            JSON.parse(saved)
          );
        }
      } catch (error) {
        console.log(
          'Erreur de chargement de la mémoire :',
          error
        );
      } finally {
        setLoading(false);
      }
    };

    loadMemory();
  }, []);

  /* ======================================================= */
  /* SAUVEGARDE DE LA MÉMOIRE                                */
  /* ======================================================= */

  useEffect(() => {
    if (loading) {
      return;
    }

    const saveMemory = async () => {
      try {
        await AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(evenements)
        );
      } catch (error) {
        console.log(
          'Erreur de sauvegarde de la mémoire :',
          error
        );
      }
    };

    saveMemory();
  }, [
    evenements,
    loading,
  ]);

  /* ======================================================= */
  /* SOUVIENS-TOI                                            */
  /* ======================================================= */

  const souviensToi = async () => {
    if (
      !souvenir.trim() ||
      souvenirEnCours
    ) {
      return;
    }

    const texte =
      souvenir.trim();

    setSouvenirEnCours(true);

    try {
      console.log(
        '📤 Envoi à Moment...'
      );

      const response =
        await fetch(
          `${SERVER_URL}/understand`,
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              text: texte,
            }),
          }
        );

      if (!response.ok) {
        throw new Error(
          `Serveur Moment : ${response.status}`
        );
      }

      const data: MemoryInput =
        await response.json();

      console.log(
        '🧠 Événements reçus :',
        data.events
      );

      const nouveauxEvenements =
        (data.events || []).map(
          (event) =>
            normalizeEvent(
              event,
              texte
            )
        );

      if (
        nouveauxEvenements.length === 0
      ) {
        throw new Error(
          'Moment n’a produit aucun événement'
        );
      }

      setEvenements(
        (current) => [
          ...nouveauxEvenements,
          ...current,
        ]
      );

      setSouvenir('');
    } catch (error) {
      console.log(
        '❌ Impossible de contacter Moment :',
        error
      );
    } finally {
      setSouvenirEnCours(
        false
      );
    }
  };

  /* ======================================================= */
  /* OUBLIER UN SOUVENIR                                     */
  /* ======================================================= */

  const oublierSouvenir = (
    eventId: string
  ) => {
    const supprimer = () => {
      setEvenements(
        (current) =>
          current.filter(
            (event) =>
              event.id !== eventId
          )
      );
    };

    if (Platform.OS === 'web') {
      const confirmation =
        window.confirm(
          'Ce souvenir sera supprimé de la mémoire de Moment. Cette action est irréversible.'
        );

      if (confirmation) {
        supprimer();
      }

      return;
    }

    Alert.alert(
      'Oublier ce souvenir ?',

      'Cette information sera supprimée de la mémoire de Moment. Cette action est irréversible.',

      [
        {
          text: 'Annuler',
          style: 'cancel',
        },

        {
          text: 'Oublier',
          style: 'destructive',
          onPress:
            supprimer,
        },
      ]
    );
  };

  /* ======================================================= */
  /* EFFACER LA MÉMOIRE                                      */
  /* ======================================================= */

  const effacerMemoire =
    async () => {
      const supprimer =
        async () => {
          try {
            await AsyncStorage.removeItem(
              STORAGE_KEY
            );

            setEvenements([]);
            setSouvenir('');

            if (
              Platform.OS === 'web'
            ) {
              window.alert(
                'Mémoire effacée'
              );
            } else {
              Alert.alert(
                'Mémoire effacée',
                'Tous les souvenirs ont été supprimés.'
              );
            }
          } catch (error) {
            console.log(
              "Erreur lors de l'effacement de la mémoire :",
              error
            );

            if (
              Platform.OS === 'web'
            ) {
              window.alert(
                "Impossible d'effacer la mémoire."
              );
            } else {
              Alert.alert(
                'Erreur',
                "Impossible d'effacer la mémoire."
              );
            }
          }
        };

      if (
        Platform.OS === 'web'
      ) {
        const confirmation =
          window.confirm(
            'Tous les souvenirs enregistrés sur cet appareil seront supprimés. Cette action est irréversible.'
          );

        if (confirmation) {
          await supprimer();
        }

        return;
      }

      Alert.alert(
        'Effacer la mémoire',

        'Tous les souvenirs enregistrés sur cet appareil seront supprimés. Cette action est irréversible.',

        [
          {
            text: 'Annuler',
            style: 'cancel',
          },

          {
            text: 'Effacer',
            style: 'destructive',
            onPress:
              supprimer,
          },
        ]
      );
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

          <Text
            style={styles.subtitle}
          >
            {APP_TAGLINE}
          </Text>

          <Image
            source={require(
              '../../assets/images/moment-memory-banner.png'
            )}
            style={
              styles.memoryBanner
            }
            resizeMode="cover"
          />
        </View>

        {/* ================================================= */}
        {/* SAISIE MÉMOIRE                                    */}
        {/* ================================================= */}

        <View
          style={
            styles.memoryInputContainer
          }
        >
          <TextInput
            style={styles.input}
            placeholder={
              MEMORY_PLACEHOLDER
            }
            placeholderTextColor="#999999"
            value={souvenir}
            onChangeText={
              setSouvenir
            }
            multiline
          />

          {souvenir.length > 0 && (
            <Pressable
              style={
                styles.clearMemoryInputButton
              }
              onPress={() => {
                setSouvenir('');
              }}
            >
              <Text
                style={
                  styles.clearMemoryInputText
                }
              >
                {CLEAR_INPUT_LABEL}
              </Text>
            </Pressable>
          )}
        </View>

        {/* ================================================= */}
        {/* ACTIONS                                           */}
        {/* ================================================= */}

        <View
          style={
            styles.memoryActions
          }
        >
          <Pressable
            style={[
              styles.button,
              souvenirEnCours &&
                styles.buttonDisabled,
            ]}
            onPress={
              souviensToi
            }
            disabled={
              souvenirEnCours
            }
          >
            {souvenirEnCours ? (
              <ActivityIndicator
                color="#FFFFFF"
              />
            ) : (
              <Text
                style={
                  styles.buttonText
                }
              >
                {MEMORY_BUTTON}
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

        {/* ================================================= */}
        {/* EFFACEMENT                                       */}
        {/* ================================================= */}

        <Pressable
          style={
            styles.clearMemoryButton
          }
          onPress={
            effacerMemoire
          }
        >
          <Text
            style={
              styles.clearMemoryButtonText
            }
          >
            {CLEAR_MEMORY_LABEL}
          </Text>
        </Pressable>

        {/* ================================================= */}
        {/* MA MÉMOIRE                                       */}
        {/* ================================================= */}

        {!loading &&
          evenements.length > 0 && (
            <View
              style={
                styles.memorySection
              }
            >
              <Text
                style={
                  styles.memoryTitle
                }
              >
                {MEMORY_TITLE}
              </Text>

              {evenements.map(
                (event) => (
                  <View
                    style={
                      styles.memoryCard
                    }
                    key={event.id}
                  >
                    <Text
                      style={
                        styles.memoryText
                      }
                    >
                      {
                        event.description
                      }
                    </Text>

                    <View
                      style={
                        styles.divider
                      }
                    />

                    <Text
                      style={
                        styles.understoodLabel
                      }
                    >
                      {
                        UNDERSTOOD_LABEL
                      }
                    </Text>

                    <EventDetails
                      event={event}
                    />

                    <Pressable
                      style={
                        styles.forgetButton
                      }
                      onPress={() =>
                        oublierSouvenir(
                          event.id
                        )
                      }
                    >
                      <Text
                        style={
                          styles.forgetButtonText
                        }
                      >
                        {
                          FORGET_MEMORY_LABEL
                        }
                      </Text>
                    </Pressable>
                  </View>
                )
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

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        '#F7F5F2',
    },

    content: {
      flexGrow: 1,
      alignItems: 'center',
      padding: 25,
      paddingTop: 70,
      paddingBottom: 50,
    },

    header: {
      alignItems: 'center',
      width: '100%',
    },

    logo: {
      fontSize: 42,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: 12,
      letterSpacing: -1,
    },

    subtitle: {
      fontSize: 17,
      color: '#666666',
      textAlign: 'center',
      lineHeight: 25,
      marginBottom: 30,
    },

    memoryBanner: {
      width: '100%',
      maxWidth: 500,
      height: 180,
      borderRadius: 24,
      marginBottom: 25,
    },

    memoryInputContainer: {
      width: '100%',
      maxWidth: 500,
      position: 'relative',
    },

    input: {
      width: '100%',
      minHeight: 160,
      backgroundColor: '#F8F7F4',
      borderRadius: 24,
      paddingHorizontal: 22,
      paddingTop: 20,
      paddingBottom: 20,
      paddingRight: 65,
      fontSize: 18,
      lineHeight: 27,
      color: '#24211D',
      textAlignVertical: 'top',
      borderWidth: 1,
      borderColor: '#E3DFD8',
    },

    clearMemoryInputButton: {
      position: 'absolute',
      right: 1,
      top: 1,
      bottom: 1,
      width: 48,
      backgroundColor: '#F0EFEC',
      borderTopRightRadius: 23,
      borderBottomRightRadius: 23,
      alignItems: 'center',
      justifyContent: 'center',
    },

    clearMemoryInputText: {
      fontSize: 23,
      color: '#888888',
      fontWeight: '400',
    },

    memoryActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      marginTop: 14,
      marginBottom: 12,
    },

    button: {
      backgroundColor: '#1F2937',
      paddingVertical: 16,
      paddingHorizontal: 45,
      borderRadius: 14,
      minWidth: 150,
      alignItems: 'center',
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

    clearMemoryButton: {
      marginTop: 4,
      paddingVertical: 12,
      alignItems: 'center',
    },

    clearMemoryButtonText: {
      fontSize: 14,
      color: '#999999',
    },

    memorySection: {
      width: '100%',
      maxWidth: 500,
      marginTop: 25,
    },

    memoryTitle: {
      fontSize: 21,
      fontWeight: '700',
      color: '#1F2937',
      marginBottom: 15,
    },

    memoryCard: {
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      padding: 18,
      marginBottom: 15,
      borderWidth: 1,
      borderColor: '#E5E1DC',
    },

    memoryText: {
      fontSize: 17,
      color: '#333333',
      lineHeight: 25,
    },

    divider: {
      height: 1,
      backgroundColor: '#E5E1DC',
      marginVertical: 16,
    },

    understoodLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: '#1F2937',
      marginBottom: 12,
    },

    detail: {
      fontSize: 16,
      color: '#555555',
      marginBottom: 7,
    },

    forgetButton: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: '#E5E1DC',
      alignItems: 'center',
    },

    forgetButtonText: {
      fontSize: 14,
      color: '#999999',
    },
  });

