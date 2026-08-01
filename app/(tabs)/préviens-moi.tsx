import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

const REMINDERS_STORAGE_KEY =
  'moment_reminders';

/* ========================================================= */
/* TEXTES DE L'APPLICATION                                   */
/* ========================================================= */

const APP_NAME = 'Moment';

const PAGE_TITLE = 'Préviens-moi';

const SEARCH_PLACEHOLDER =
  'De quoi veux-tu que je te prévienne ?';

const REMINDER_BUTTON = 'Préviens-moi';

const REMINDERS_TITLE = 'Mes rappels';

const EMPTY_REMINDERS =
  'Aucun rappel pour le moment.';

const CLEAR_INPUT_LABEL = '×';

/* ========================================================= */
/* TYPES                                                     */
/* ========================================================= */

type Reminder = {
  id: string;
  text: string;
  date_reference: string;
  date_precision: string;
  context: string;
  created_at: string;
  active: boolean;
};

/* ========================================================= */
/* NORMALISATION                                             */
/* ========================================================= */

function normalizeReminder(
  reminder: Partial<Reminder>,
  input: string
): Reminder {
  return {
    id:
      reminder.id ||
      `reminder_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 9)}`,

    text:
      reminder.text || input,

    date_reference:
      reminder.date_reference || '',

    date_precision:
      reminder.date_precision || 'unknown',

    context:
      reminder.context || '',

    created_at:
      reminder.created_at ||
      new Date().toISOString(),

    active:
      typeof reminder.active === 'boolean'
        ? reminder.active
        : true,
  };
}

/* ========================================================= */
/* ÉCRAN PRÉVIENS-MOI                                        */
/* ========================================================= */

export default function ReminderScreen() {
  const [rappel, setRappel] =
    useState('');

  const [rappels, setRappels] =
    useState<Reminder[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [rappelEnCours, setRappelEnCours] =
    useState(false);

  /* ======================================================= */
  /* CHARGEMENT DES RAPPELS                                  */
  /* ======================================================= */

  useEffect(() => {
    const loadReminders = async () => {
      try {
        const saved =
          await AsyncStorage.getItem(
            REMINDERS_STORAGE_KEY
          );

        if (saved) {
          setRappels(
            JSON.parse(saved)
          );
        }
      } catch (error) {
        console.log(
          'Erreur de chargement des rappels :',
          error
        );
      } finally {
        setLoading(false);
      }
    };

    loadReminders();
  }, []);

  /* ======================================================= */
  /* SAUVEGARDE DES RAPPELS                                  */
  /* ======================================================= */

  useEffect(() => {
    if (loading) {
      return;
    }

    const saveReminders = async () => {
      try {
        await AsyncStorage.setItem(
          REMINDERS_STORAGE_KEY,
          JSON.stringify(rappels)
        );
      } catch (error) {
        console.log(
          'Erreur de sauvegarde des rappels :',
          error
        );
      }
    };

    saveReminders();
  }, [rappels, loading]);

  /* ======================================================= */
  /* CRÉER UN RAPPEL                                         */
  /* ======================================================= */

  const creerRappel = async () => {
    if (
      !rappel.trim() ||
      rappelEnCours
    ) {
      return;
    }

    const texte = rappel.trim();

    setRappelEnCours(true);

    try {
      /*
       * POUR L'INSTANT :
       * on crée simplement le rappel localement.
       *
       * L'interprétation intelligente par Moment
       * viendra ensuite.
       */

      const nouveauRappel =
        normalizeReminder(
          {
            text: texte,
          },
          texte
        );

      setRappels((current) => [
        nouveauRappel,
        ...current,
      ]);

      setRappel('');
    } catch (error) {
      console.log(
        'Erreur lors de la création du rappel :',
        error
      );
    } finally {
      setRappelEnCours(false);
    }
  };

  /* ======================================================= */
  /* SUPPRIMER UN RAPPEL                                     */
  /* ======================================================= */

  const supprimerRappel = (
    reminderId: string
  ) => {
    const supprimer = () => {
      setRappels((current) =>
        current.filter(
          (reminder) =>
            reminder.id !== reminderId
        )
      );
    };

    if (Platform.OS === 'web') {
      const confirmation =
        window.confirm(
          'Ce rappel sera supprimé. Cette action est irréversible.'
        );

      if (confirmation) {
        supprimer();
      }

      return;
    }

    Alert.alert(
      'Supprimer ce rappel ?',
      'Cette action est irréversible.',
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: supprimer,
        },
      ]
    );
  };

  /* ======================================================= */
  /* ACTIVER / DÉSACTIVER                                    */
  /* ======================================================= */

  const toggleRappel = (
    reminderId: string
  ) => {
    setRappels((current) =>
      current.map((reminder) =>
        reminder.id === reminderId
          ? {
              ...reminder,
              active: !reminder.active,
            }
          : reminder
      )
    );
  };

  /* ======================================================= */
  /* EFFACER LE TEXTE                                        */
  /* ======================================================= */

  const effacerRappel = () => {
    setRappel('');
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

        <Text style={styles.logo}>
          {APP_NAME}
        </Text>

        <Text style={styles.title}>
          {PAGE_TITLE}
        </Text>

        {/* ================================================= */}
        {/* SAISIE DU RAPPEL                                  */}
        {/* ================================================= */}

        <View
          style={
            styles.reminderInputContainer
          }
        >
          <TextInput
            style={styles.input}
            placeholder={
              SEARCH_PLACEHOLDER
            }
            placeholderTextColor="#999999"
            value={rappel}
            onChangeText={setRappel}
            multiline
            textAlignVertical="top"
          />

          {rappel.length > 0 && (
            <Pressable
              style={
                styles.clearInputButton
              }
              onPress={
                effacerRappel
              }
            >
              <Text
                style={
                  styles.clearInputText
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
            styles.reminderActionsTop
          }
        >
          <Pressable
            style={[
              styles.button,
              rappelEnCours &&
                styles.buttonDisabled,
            ]}
            onPress={
              creerRappel
            }
            disabled={
              rappelEnCours
            }
          >
            {rappelEnCours ? (
              <ActivityIndicator
                color="#FFFFFF"
              />
            ) : (
              <Text
                style={
                  styles.buttonText
                }
              >
                {REMINDER_BUTTON}
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
        {/* MES RAPPELS                                       */}
        {/* ================================================= */}

        {!loading && (
          <View
            style={
              styles.remindersSection
            }
          >
            <Text
              style={
                styles.remindersTitle
              }
            >
              {REMINDERS_TITLE}
            </Text>

            {rappels.length === 0 ? (
              <Text
                style={
                  styles.emptyText
                }
              >
                {EMPTY_REMINDERS}
              </Text>
            ) : (
              rappels.map(
                (reminder) => (
                  <View
                    key={
                      reminder.id
                    }
                    style={[
                      styles.reminderCard,
                      !reminder.active &&
                        styles.reminderInactive,
                    ]}
                  >

                    {/* =================================== */}
                    {/* TEXTE DU RAPPEL                     */}
                    {/* =================================== */}

                    <Text
                      style={
                        styles.reminderText
                      }
                    >
                      {
                        reminder.text
                      }
                    </Text>

                    {/* =================================== */}
                    {/* INFORMATIONS                         */}
                    {/* =================================== */}

                    {reminder.date_reference && (
                      <Text
                        style={
                          styles.detail
                        }
                      >
                        🕐{' '}
                        {
                          reminder.date_reference
                        }
                      </Text>
                    )}

                    {reminder.context && (
                      <Text
                        style={
                          styles.detail
                        }
                      >
                        📍{' '}
                        {
                          reminder.context
                        }
                      </Text>
                    )}

                    {/* =================================== */}
                    {/* ACTIONS                              */}
                    {/* =================================== */}

                    <View
                      style={
                        styles.reminderActions
                      }
                    >
                      <Pressable
                        onPress={() =>
                          toggleRappel(
                            reminder.id
                          )
                        }
                      >
                        <Text
                          style={
                            styles.toggleText
                          }
                        >
                          {reminder.active
                            ? '✓ Actif'
                            : '○ Désactivé'}
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() =>
                          supprimerRappel(
                            reminder.id
                          )
                        }
                      >
                        <Text
                          style={
                            styles.deleteText
                          }
                        >
                          Supprimer
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )
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

    reminderInputContainer: {
      width: '100%',
      maxWidth: 500,
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

    clearInputButton: {
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

    clearInputText: {
      fontSize: 22,
      color: '#888888',
    },

    reminderActionsTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      marginTop: 14,
    },

    button: {
      backgroundColor: '#1F2937',
      paddingVertical: 15,
      paddingHorizontal: 35,
      borderRadius: 14,
      minWidth: 170,
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

    remindersSection: {
      width: '100%',
      maxWidth: 500,
      marginTop: 35,
    },

    remindersTitle: {
      fontSize: 21,
      fontWeight: '700',
      color: '#1F2937',
      marginBottom: 15,
    },

    emptyText: {
      fontSize: 15,
      color: '#999999',
    },

    reminderCard: {
      backgroundColor: '#FFFFFF',
      borderRadius: 16,
      padding: 18,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: '#E5E1DC',
    },

    reminderInactive: {
      opacity: 0.55,
    },

    reminderText: {
      fontSize: 17,
      lineHeight: 25,
      color: '#333333',
      marginBottom: 12,
    },

    detail: {
      fontSize: 15,
      color: '#666666',
      marginBottom: 7,
    },

    reminderActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: '#E5E1DC',
    },

    toggleText: {
      fontSize: 14,
      color: '#4B5563',
    },

    deleteText: {
      fontSize: 14,
      color: '#999999',
    },
  });
  