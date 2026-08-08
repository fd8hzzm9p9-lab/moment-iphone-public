import React, {
  useCallback,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  useFocusEffect,
} from '@react-navigation/native';

import {
  APP_NAME,
  APP_VERSION,
} from '../../config/app';

import {
  RELEASE_NOTES,
} from '../../config/releaseNotes';

import {
  getPendingDiagnosticCount,
  markDiagnosticInteractionsAsSent,
} from '../../services/diagnosticService';

import {
  exportMomentFeedback,
} from '../../services/feedbackExportService';

export default function PreventMeScreen() {
  const [
    exporting,
    setExporting,
  ] =
    useState(false);

  const [
    pendingCount,
    setPendingCount,
  ] =
    useState(0);

  const [
    showReleaseNotes,
    setShowReleaseNotes,
  ] =
    useState(false);

  const refreshPendingCount =
    useCallback(
      async () => {
        const count =
          await getPendingDiagnosticCount();

        setPendingCount(
          count
        );
      },
      []
    );

  useFocusEffect(
    useCallback(
      () => {
        void refreshPendingCount();
      },
      [
        refreshPendingCount,
      ]
    )
  );

  const confirmFeedbackSent =
    (
      diagnosticIds:
        string[]
    ) => {
      Alert.alert(
        'Ton feedback a-t-il bien été envoyé ?',

        'Confirme uniquement si tu as réellement terminé l’envoi du fichier.',

        [
          {
            text:
              'Non, pas encore',

            style:
              'cancel',
          },

          {
            text:
              'Oui, il est envoyé',

            onPress:
              async () => {
                const result =
                  await markDiagnosticInteractionsAsSent(
                    diagnosticIds
                  );

                setPendingCount(
                  result.remaining
                );

                Alert.alert(
                  'Feedback confirmé',

                  result.remaining > 0
                    ? `Merci ! Il reste ${result.remaining} interaction(s) à envoyer plus tard.`
                    : 'Merci ! Toutes les interactions de ce lot ont été marquées comme envoyées.'
                );
              },
          },
        ]
      );
    };

  const sendFeedback =
    async () => {
      if (
        exporting ||
        pendingCount === 0
      ) {
        return;
      }

      setExporting(
        true
      );

      try {
        const result =
          await exportMomentFeedback();

        confirmFeedbackSent(
          result
            .diagnostic_ids
        );

      } catch (error) {
        console.error(
          '❌ Export feedback impossible :',
          error
        );

        Alert.alert(
          'Feedback non envoyé',

          'Impossible de préparer ou partager le feedback pour le moment. Les interactions restent enregistrées.'
        );

      } finally {
        setExporting(
          false
        );
      }
    };

  return (
    <View
      style={
        styles.container
      }
    >
      <View
        style={
          styles.page
        }
      >

        {/* ================================================= */}
        {/* IDENTITÉ MOMENT                                   */}
        {/* ================================================= */}
        <View
          style={
            styles.appHeader
          }
        >
          <Text
            style={
              styles.logo
            }
          >
            {APP_NAME}
          </Text>

          <View
            style={
              styles.versionContainer
            }
          >
            <Text
              style={
                styles.headerVersion
              }
            >
              {APP_VERSION}
            </Text>
          </View>
        </View>

{/* ================================================= */}
        {/* ZONE 1 — PRÉVIENS-MOI                             */}
        {/* ================================================= */}

        <View
          style={
            styles.sectionCard
          }
        >
          <Text
            style={
              styles.icon
            }
          >
            🔔
          </Text>

          <Text
            style={
              styles.title
            }
          >
            Préviens-moi
          </Text>

          <Text
            style={
              styles.status
            }
          >
            Fonctionnalité en cours de développement
          </Text>

          <Text
            style={
              styles.description
            }
          >
            Préviens-moi permettra bientôt à Moment de
            t’aider à anticiper les événements, échéances
            et informations importantes.
          </Text>

          <Text
            style={
              styles.alphaNotice
            }
          >
            Cet onglet n’est pas encore opérationnel dans
            cette version pré-alpha.
          </Text>
        </View>

        {/* ================================================= */}
        {/* ZONE 2 — NOUVEAUTÉS                               */}
        {/* ================================================= */}

        <View
          style={
            styles.newsCard
          }
        >
          <View
            style={
              styles.newsHeader
            }
          >
            <View
              style={
                styles.newsHeaderText
              }
            >
              <Text
                style={
                  styles.newsTitle
                }
              >
                ✨ Nouveautés
              </Text>

              <Text
                style={
                  styles.newsText
                }
              >
                Découvre les dernières évolutions de Moment.
              </Text>
            </View>

            <Pressable
              onPress={
                () =>
                  setShowReleaseNotes(
                    true
                  )
              }
              style={
                styles.newsButton
              }
            >
              <Text
                style={
                  styles.newsButtonText
                }
              >
                Voir
              </Text>
            </Pressable>
          </View>
        </View>

        {/* ================================================= */}
        {/* ZONE 3 — FEEDBACK                                 */}
        {/* ================================================= */}

        <View
          style={
            styles.sectionCard
          }
        >
          <Text
            style={
              styles.feedbackTitle
            }
          >
            Tu testes Moment ?
          </Text>

          <Text
            style={
              styles.feedbackText
            }
          >
            Envoie régulièrement ton feedback pendant tes tests,
            même si tout fonctionne correctement.
            {'\n'}
            Cela nous permet d’analyser et améliorer le
            fonctionnement réel de Moment.
          </Text>

          <View
            style={
              styles.feedbackBottom
            }
          >
            <View
              style={
                styles.counterBox
              }
            >
              <Text
                style={
                  styles.counterNumber
                }
              >
                {pendingCount}
              </Text>

              <Text
                style={
                  styles.counterLabel
                }
              >
                {
                  pendingCount > 1
                    ? 'interactions en attente'
                    : 'interaction en attente'
                }
              </Text>
            </View>

            <Pressable
              disabled={
                exporting ||
                pendingCount === 0
              }
              onPress={
                sendFeedback
              }
              style={
                ({
                  pressed,
                }) => [
                  styles.feedbackButton,

                  (
                    pressed ||
                    exporting
                  ) &&
                    styles.buttonPressed,

                  pendingCount === 0 &&
                    styles.feedbackButtonDisabled,
                ]
              }
            >
              {
                exporting
                  ? (
                    <ActivityIndicator
                      color="#FFFFFF"
                    />
                  )
                  : (
                    <Text
                      style={
                        styles.feedbackButtonText
                      }
                    >
                      Envoyer le feedback
                    </Text>
                  )
              }
            </Pressable>
          </View>

          {
            pendingCount === 0
              ? (
                <Text
                  style={
                    styles.noPendingText
                  }
                >
                  Aucun feedback en attente.
                </Text>
              )
              : null
          }
        </View>
      </View>

      {/* =================================================== */}
      {/* MODALE NOUVEAUTÉS — ELLE PEUT DÉFILER              */}
      {/* =================================================== */}

      <Modal
        animationType="slide"
        transparent
        visible={
          showReleaseNotes
        }
        onRequestClose={
          () =>
            setShowReleaseNotes(
              false
            )
        }
      >
        <View
          style={
            styles.modalBackdrop
          }
        >
          <View
            style={
              styles.modalCard
            }
          >
            <View
              style={
                styles.modalHeader
              }
            >
              <Text
                style={
                  styles.modalTitle
                }
              >
                Nouveautés Moment
              </Text>

              <Pressable
                onPress={
                  () =>
                    setShowReleaseNotes(
                      false
                    )
                }
              >
                <Text
                  style={
                    styles.closeButton
                  }
                >
                  Fermer
                </Text>
              </Pressable>
            </View>

            <ScrollView>
              {
                RELEASE_NOTES.map(
                  note => (
                    <View
                      key={
                        note.version
                      }
                      style={
                        styles.releaseBlock
                      }
                    >
                      <Text
                        style={
                          styles.releaseVersion
                        }
                      >
                        {note.version}
                      </Text>

                      <Text
                        style={
                          styles.releaseTitle
                        }
                      >
                        {note.title}
                      </Text>

                      {
                        note.changes.map(
                          (
                            change,
                            index
                          ) => (
                            <Text
                              key={
                                `${note.version}-${index}`
                              }
                              style={
                                styles.releaseChange
                              }
                            >
                              • {change}
                            </Text>
                          )
                        )
                      }
                    </View>
                  )
                )
              }
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles =
  StyleSheet.create({

    /*
     * En-tête aligné exactement sur Rappelle-moi.
     */

    appHeader: {
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

    headerVersion: {
      fontSize: 12,
      color: '#999999',
      fontWeight: '500',
    },

    container: {
      flex: 1,
      backgroundColor: '#F7F5F2',
    },

    page: {
      flex: 1,

      width: '100%',
      maxWidth: 500,

      alignSelf: 'center',
      alignItems: 'center',

      paddingHorizontal: 25,
      paddingTop: 70,
      paddingBottom: 16,

      gap: 12,
    },

    sectionCard: {
      width:
        '100%',

      alignItems:
        'center',

      backgroundColor:
        '#FFFFFF',

      borderRadius:
        20,

      paddingHorizontal:
        20,

      paddingVertical:
        18,

      shadowColor:
        '#000',

      shadowOpacity:
        0.06,

      shadowRadius:
        10,

      shadowOffset: {
        width: 0,
        height: 4,
      },

      elevation:
        2,
    },

    icon: {
      fontSize:
        32,

      marginBottom:
        4,
    },

    title: {
      fontSize:
        25,

      fontWeight:
        '800',

      color:
        '#0F172A',

      textAlign:
        'center',
    },

    status: {
      marginTop:
        5,

      fontSize:
        15,

      fontWeight:
        '700',

      color:
        '#2563EB',

      textAlign:
        'center',
    },

    description: {
      marginTop:
        8,

      fontSize:
        14,

      lineHeight:
        19,

      color:
        '#475569',

      textAlign:
        'center',
    },

    alphaNotice: {
      marginTop:
        6,

      fontSize:
        12,

      lineHeight:
        17,

      color:
        '#64748B',

      textAlign:
        'center',
    },

    newsCard: {
      width:
        '100%',

      backgroundColor:
        '#FFFFFF',

      borderRadius:
        20,

      paddingHorizontal:
        20,

      paddingVertical:
        15,

      shadowColor:
        '#000',

      shadowOpacity:
        0.06,

      shadowRadius:
        10,

      shadowOffset: {
        width: 0,
        height: 4,
      },

      elevation:
        2,
    },

    newsHeader: {
      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        14,
    },

    newsHeaderText: {
      flex:
        1,
    },

    newsTitle: {
      fontSize:
        18,

      fontWeight:
        '800',

      color:
        '#0F172A',
    },

    newsText: {
      marginTop:
        3,

      fontSize:
        13,

      lineHeight:
        17,

      color:
        '#64748B',
    },

    newsButton: {
      minWidth:
        84,

      minHeight:
        44,

      paddingHorizontal:
        18,

      borderRadius:
        13,

      backgroundColor:
        '#2563EB',

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    newsButtonText: {
      color:
        '#FFFFFF',

      fontSize:
        15,

      fontWeight:
        '800',
    },

    feedbackTitle: {
      fontSize:
        18,

      fontWeight:
        '800',

      color:
        '#0F172A',

      textAlign:
        'center',
    },

    feedbackText: {
      marginTop:
        6,

      fontSize:
        13,

      lineHeight:
        18,

      color:
        '#64748B',

      textAlign:
        'center',
    },

    feedbackBottom: {
      width:
        '100%',

      marginTop:
        12,

      flexDirection:
        'row',

      alignItems:
        'center',

      gap:
        14,
    },

    counterBox: {
      minWidth:
        105,

      alignItems:
        'center',
    },

    counterNumber: {
      fontSize:
        27,

      fontWeight:
        '800',

      color:
        '#0F172A',
    },

    counterLabel: {
      marginTop:
        1,

      fontSize:
        11,

      color:
        '#64748B',

      textAlign:
        'center',
    },

    feedbackButton: {
      flex:
        1,

      minHeight:
        46,

      borderRadius:
        13,

      backgroundColor:
        '#2563EB',

      alignItems:
        'center',

      justifyContent:
        'center',

      paddingHorizontal:
        15,
    },

    feedbackButtonDisabled: {
      backgroundColor:
        '#CBD5E1',
    },

    buttonPressed: {
      opacity:
        0.72,
    },

    feedbackButtonText: {
      color:
        '#FFFFFF',

      fontSize:
        15,

      fontWeight:
        '800',

      textAlign:
        'center',
    },

    noPendingText: {
      marginTop:
        7,

      fontSize:
        11,

      color:
        '#94A3B8',
    },

    version: {
      marginTop:
        8,

      fontSize:
        11,

      color:
        '#94A3B8',

      textAlign:
        'center',
    },

    modalBackdrop: {
      flex:
        1,

      backgroundColor:
        'rgba(15,23,42,0.45)',

      justifyContent:
        'flex-end',
    },

    modalCard: {
      maxHeight:
        '82%',

      backgroundColor:
        '#FFFFFF',

      borderTopLeftRadius:
        24,

      borderTopRightRadius:
        24,

      paddingHorizontal:
        22,

      paddingTop:
        20,

      paddingBottom:
        30,
    },

    modalHeader: {
      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'space-between',

      marginBottom:
        16,
    },

    modalTitle: {
      fontSize:
        21,

      fontWeight:
        '800',

      color:
        '#0F172A',
    },

    closeButton: {
      fontSize:
        15,

      fontWeight:
        '700',

      color:
        '#2563EB',
    },

    releaseBlock: {
      paddingVertical:
        16,

      borderBottomWidth:
        1,

      borderBottomColor:
        '#E2E8F0',
    },

    releaseVersion: {
      fontSize:
        13,

      fontWeight:
        '700',

      color:
        '#2563EB',
    },

    releaseTitle: {
      marginTop:
        4,

      fontSize:
        18,

      fontWeight:
        '700',

      color:
        '#0F172A',
    },

    releaseChange: {
      marginTop:
        8,

      fontSize:
        15,

      lineHeight:
        21,

      color:
        '#475569',
    },
  });
