import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  useFocusEffect,
} from '@react-navigation/native';

import {
  useLocalSearchParams,
} from 'expo-router';

import {
  APP_NAME,
  APP_VERSION,
} from '../../config/app';

import {
  RELEASE_NOTES,
} from '../../config/releaseNotes';

import {
  getMomentDeviceId,
  getPendingDiagnosticCount,
  markDiagnosticInteractionsAsSent,
} from '../../services/diagnosticService';

import {
  exportMomentFeedback,
} from '../../services/feedbackExportService';

import {
  getAlphaCreditStatus,
  getCachedAlphaCreditRequest,
  redeemAlphaCredits,
  requestAlphaCredits,
  type AlphaCreditStatus,
} from '../../services/alphaCreditService';

export default function PreventMeScreen() {
  const {
    openCredit,
  } =
    useLocalSearchParams<{
      openCredit?: string;
    }>();
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

  const [
    showCreditModal,
    setShowCreditModal,
  ] =
    useState(false);

  const [
    creditLoading,
    setCreditLoading,
  ] =
    useState(false);

  const [
    creditStatus,
    setCreditStatus,
  ] =
    useState<AlphaCreditStatus | null>(
      null
    );

  const [
    rechargeCode,
    setRechargeCode,
  ] =
    useState('');

  const [
    showTestHelp,
    setShowTestHelp,
  ] =
    useState(false);

  const [
    openHelpSection,
    setOpenHelpSection,
  ] =
    useState<string | null>(
      null
    );

  const toggleHelpSection =
    (
      section: string
    ) => {
      setOpenHelpSection(
        current =>
          current === section
            ? null
            : section
      );
    };

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

        void getAlphaCreditStatus()
          .then(
            status => {
              setCreditStatus(
                status
              );
            }
          )
          .catch(
            () => {
              /*
               * Pas d'erreur visible :
               * l'absence du serveur ne doit
               * pas polluer Préviens-moi.
               */
            }
          );
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

  const openCreditModal =
    async () => {
      setShowCreditModal(
        true
      );

      const cached =
        await getCachedAlphaCreditRequest();

      if (cached) {
        setCreditStatus({
          pending: true,
          request: cached,
        });
      }

      try {
        const status =
          await getAlphaCreditStatus();

        setCreditStatus(
          status
        );
      } catch {
        /*
         * Si le serveur est momentanément indisponible,
         * le code de demande mis en cache reste visible.
         */
      }
    };

  const createCreditRequestAction =
    async () => {
      if (creditLoading) {
        return;
      }

      setCreditLoading(
        true
      );

      try {
        const status =
          await requestAlphaCredits();

        setCreditStatus(
          status
        );
      } catch (error) {
        Alert.alert(
          'Demande impossible',
          error instanceof Error
            ? error.message
            : 'Impossible de créer la demande pour le moment.'
        );
      } finally {
        setCreditLoading(
          false
        );
      }
    };

  const shareCreditRequest =
    async () => {
      const requestCode =
        creditStatus
          ?.request
          ?.request_code;

      if (
        !requestCode
      ) {
        Alert.alert(
          'Demande introuvable',
          'Aucune demande de crédit n’est actuellement disponible.'
        );

        return;
      }

      try {
        const momentDeviceId =
          await getMomentDeviceId();

        const message =
          [
            '🎟️ Demande de crédit Moment',
            '',
            `Code : ${requestCode}`,
            `Identifiant : ${momentDeviceId}`,
            `Version : ${APP_VERSION}`,
            '',
            'Merci de générer un code de recharge pour cette demande.',
          ].join(
            '\n'
          );

        await Share.share({
          title:
            'Demande de crédit Moment',

          message,
        });

      } catch (error) {
        console.error(
          '❌ Partage demande crédit impossible :',
          error
        );

        Alert.alert(
          'Partage impossible',
          'La demande est toujours enregistrée. Tu peux réessayer plus tard.'
        );
      }
    };

  const validateRechargeCode =
    async () => {
      if (
        creditLoading ||
        !rechargeCode.trim()
      ) {
        return;
      }

      setCreditLoading(
        true
      );

      try {
        await redeemAlphaCredits(
          rechargeCode
        );

        setRechargeCode('');

        const status =
          await getAlphaCreditStatus();

        setCreditStatus(
          status
        );

        Alert.alert(
          'Crédit ajouté',
          'Tu peux poursuivre tes tests.'
        );
      } catch (error) {
        Alert.alert(
          'Code refusé',
          error instanceof Error
            ? error.message
            : 'Ce code ne peut pas être utilisé.'
        );
      } finally {
        setCreditLoading(
          false
        );
      }
    };

  useEffect(
    () => {
      if (
        openCredit ===
        '1'
      ) {
        void openCreditModal();
      }
    },
    [
      openCredit,
    ]
  );

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

          <Pressable
            onPress={() => {
              setOpenHelpSection(
                null
              );

              setShowTestHelp(
                true
              );
            }}
            style={
              ({
                pressed,
              }) => [
                styles.testHelpButton,
                pressed &&
                  styles.buttonPressed,
              ]
            }
          >
            <Text
              style={
                styles.testHelpButtonText
              }
            >
              ❓ Comment tester Moment ?
            </Text>
          </Pressable>

          {
            creditStatus
              ?.credit_needed ===
                true
              ? (
                <Pressable
                  onPress={
                    openCreditModal
                  }
                  style={
                    ({
                      pressed,
                    }) => [
                      styles.creditAccessButton,

                      pressed &&
                        styles.buttonPressed,
                    ]
                  }
                >
                  <Text
                    style={
                      styles.creditAccessButtonText
                    }
                  >
                    🎟️ Crédit de tests
                  </Text>
                </Pressable>
              )
              : null
          }

          <Text
            style={
              styles.feedbackText
            }
          >
            Aide-nous à améliorer cette pré-version pendant tes essais.
            {'\n'}
            Envoie régulièrement ton feedback, même lorsque tout fonctionne correctement.
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
      {/* CRÉDITS DE TEST — MEMENTO 002-08                   */}
      {/* =================================================== */}

      <Modal
        animationType="slide"
        transparent
        visible={
          showCreditModal
        }
        onRequestClose={() =>
          setShowCreditModal(
            false
          )
        }
      >
        <KeyboardAvoidingView
          style={
            styles.creditKeyboardAvoider
          }
          behavior={
            Platform.OS === 'ios'
              ? 'padding'
              : 'height'
          }
          keyboardVerticalOffset={
            Platform.OS === 'ios'
              ? 20
              : 0
          }
        >
          <View
            style={
              styles.modalBackdrop
            }
          >
            <View
              style={
                styles.creditModalCard
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
                Crédit de tests
              </Text>

              <Pressable
                onPress={() =>
                  setShowCreditModal(
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

            {
              creditStatus?.pending &&
              creditStatus.request?.request_code
                ? (
                  <>
                    <Text
                      style={
                        styles.creditModalText
                      }
                    >
                      Transmets ce code pour demander une recharge. Tu peux fermer cette fenêtre : le même code sera conservé.
                    </Text>

                    <View
                      style={
                        styles.creditRequestCodeBox
                      }
                    >
                      <Text
                        selectable
                        style={
                          styles.creditRequestCode
                        }
                      >
                        {
                          creditStatus.request.request_code
                        }
                      </Text>
                    </View>

                    <Pressable
                      onPress={
                        shareCreditRequest
                      }
                      style={
                        ({
                          pressed,
                        }) => [
                          styles.creditShareButton,

                          pressed &&
                            styles.buttonPressed,
                        ]
                      }
                    >
                      <Text
                        style={
                          styles.creditShareButtonText
                        }
                      >
                        📤 Envoyer ma demande
                      </Text>
                    </Pressable>

                    <TextInput
                      autoCapitalize="characters"
                      autoCorrect={
                        false
                      }
                      placeholder="Code de recharge reçu"
                      value={
                        rechargeCode
                      }
                      onChangeText={
                        setRechargeCode
                      }
                      style={
                        styles.creditRechargeInput
                      }
                    />

                    <Pressable
                      disabled={
                        creditLoading ||
                        !rechargeCode.trim()
                      }
                      onPress={
                        validateRechargeCode
                      }
                      style={
                        ({ pressed }) => [
                          styles.creditPrimaryButton,
                          (
                            pressed ||
                            creditLoading ||
                            !rechargeCode.trim()
                          ) &&
                            styles.buttonPressed,
                        ]
                      }
                    >
                      {
                        creditLoading
                          ? (
                            <ActivityIndicator
                              color="#FFFFFF"
                            />
                          )
                          : (
                            <Text
                              style={
                                styles.creditPrimaryButtonText
                              }
                            >
                              Valider le code
                            </Text>
                          )
                      }
                    </Pressable>
                  </>
                )
                : (
                  <>
                    <Text
                      style={
                        styles.creditModalText
                      }
                    >
                      Si tu as besoin de poursuivre les tests, crée une demande de crédit.
                    </Text>

                    <Pressable
                      disabled={
                        creditLoading
                      }
                      onPress={
                        createCreditRequestAction
                      }
                      style={
                        ({ pressed }) => [
                          styles.creditPrimaryButton,
                          (
                            pressed ||
                            creditLoading
                          ) &&
                            styles.buttonPressed,
                        ]
                      }
                    >
                      {
                        creditLoading
                          ? (
                            <ActivityIndicator
                              color="#FFFFFF"
                            />
                          )
                          : (
                            <Text
                              style={
                                styles.creditPrimaryButtonText
                              }
                            >
                              Créer une demande
                            </Text>
                          )
                      }
                    </Pressable>
                  </>
                )
            }
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* =================================================== */}
      {/* AIDE PRÉ-TESTEUR                                    */}
      {/* =================================================== */}

      <Modal
        animationType="slide"
        transparent
        visible={
          showTestHelp
        }
        onRequestClose={
          () =>
            setShowTestHelp(
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
              styles.testHelpModalCard
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
                Comment tester Moment ?
              </Text>

              <Pressable
                onPress={
                  () =>
                    setShowTestHelp(
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

            <Text
              style={
                styles.testHelpIntro
              }
            >
              Pas besoin de tout lire avant de commencer :
              utilise Moment naturellement. Ouvre simplement
              les rubriques qui t’intéressent.
            </Text>

            <ScrollView
              showsVerticalScrollIndicator={
                false
              }
            >
              <HelpSection
                title="🧠 À quoi sert Moment ?"
                open={
                  openHelpSection ===
                  'purpose'
                }
                onPress={() =>
                  toggleHelpSection(
                    'purpose'
                  )
                }
              >
                Moment est une application de mémoire personnelle.
                {'\n\n'}
                Dans « Souviens-toi », raconte-lui naturellement
                ce que tu souhaites garder en mémoire : un événement,
                une personne, un rendez-vous, un lieu ou une information.
                {'\n\n'}
                Dans « Rappelle-moi », pose ensuite tes questions
                naturellement pour retrouver ce que Moment a mémorisé.
              </HelpSection>

              <HelpSection
                title="🧪 Comment dois-je le tester ?"
                open={
                  openHelpSection ===
                  'testing'
                }
                onPress={() =>
                  toggleHelpSection(
                    'testing'
                  )
                }
              >
                Utilise Moment comme tu aurais réellement envie
                de l’utiliser.
                {'\n\n'}
                Ne cherche surtout pas les « bonnes phrases ».
                Écris comme tu parlerais normalement : phrases
                courtes ou longues, précises ou imprécises.
                {'\n\n'}
                Utilise tes propres exemples, puis demande à Moment
                de retrouver les informations que tu lui as données.
              </HelpSection>

              <HelpSection
                title="🚧 Pourquoi certaines choses ne fonctionnent pas ?"
                open={
                  openHelpSection ===
                  'limits'
                }
                onPress={() =>
                  toggleHelpSection(
                    'limits'
                  )
                }
              >
                Tu utilises une pré-alpha : Moment est encore en
                plein développement.
                {'\n\n'}
                Certaines situations fonctionnent déjà, d’autres
                seulement en partie, et certaines ne sont pas encore
                prises en charge.
                {'\n\n'}
                Nous travaillons actuellement à permettre à Moment
                de comprendre et retrouver un maximum d’informations
                directement avec son moteur local, sans dépendre
                systématiquement d’une intelligence artificielle
                en ligne.
                {'\n\n'}
                Une phrase non comprise ou une question sans réponse
                peut donc arriver. Trouver ces limites fait justement
                partie du test.
              </HelpSection>

              <HelpSection
                title="📤 Quand envoyer mon feedback ?"
                open={
                  openHelpSection ===
                  'feedback'
                }
                onPress={() =>
                  toggleHelpSection(
                    'feedback'
                  )
                }
              >
                Envoie régulièrement ton feedback après plusieurs
                essais, même lorsque tout semble fonctionner.
                {'\n\n'}
                Fais-le aussi lorsqu’une réponse, une compréhension
                ou un comportement te paraît étrange ou incorrect.
                {'\n\n'}
                Pas besoin de prendre des notes ni de nous expliquer
                techniquement le problème : Moment conserve les
                informations de diagnostic utiles à l’analyse de
                tes derniers essais.
              </HelpSection>

              <HelpSection
                title="🎯 Qu’est-ce qui nous intéresse particulièrement ?"
                open={
                  openHelpSection ===
                  'targets'
                }
                onPress={() =>
                  toggleHelpSection(
                    'targets'
                  )
                }
              >
                Tout ce qui ne correspond pas à ce que tu attendais :
                mauvaise compréhension, souvenir mal enregistré,
                réponse incorrecte, absence de réponse, comportement
                surprenant ou lenteur inhabituelle.
                {'\n\n'}
                Mais ce qui fonctionne bien nous intéresse aussi :
                cela permet de savoir quelles parties de Moment
                deviennent suffisamment fiables.
              </HelpSection>
            </ScrollView>
          </View>
        </View>
      </Modal>

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

                      {
                        note.date
                          ? (
                            <Text
                              style={
                                styles.releaseDate
                              }
                            >
                              (Ajoutée le {note.date})
                            </Text>
                          )
                          : null
                      }

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

type HelpSectionProps = {
  title: string;
  open: boolean;
  onPress: () => void;
  children: React.ReactNode;
};

function HelpSection({
  title,
  open,
  onPress,
  children,
}: HelpSectionProps) {
  return (
    <View
      style={
        styles.helpSection
      }
    >
      <Pressable
        onPress={
          onPress
        }
        style={
          ({
            pressed,
          }) => [
            styles.helpSectionHeader,
            pressed &&
              styles.helpSectionPressed,
          ]
        }
      >
        <Text
          style={
            styles.helpSectionTitle
          }
        >
          {title}
        </Text>

        <Text
          style={
            styles.helpSectionArrow
          }
        >
          {open ? '▲' : '▼'}
        </Text>
      </Pressable>

      {
        open
          ? (
            <Text
              style={
                styles.helpSectionContent
              }
            >
              {children}
            </Text>
          )
          : null
      }
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

    testHelpButton: {
      width:
        '100%',

      minHeight:
        44,

      marginTop:
        10,

      paddingHorizontal:
        16,

      borderWidth:
        1,

      borderColor:
        '#2563EB',

      borderRadius:
        13,

      backgroundColor:
        '#EFF6FF',

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    testHelpButtonText: {
      fontSize:
        14,

      fontWeight:
        '800',

      color:
        '#1D4ED8',

      textAlign:
        'center',
    },

    creditAccessButton: {
      width:
        '100%',

      minHeight:
        44,

      marginTop:
        8,

      paddingHorizontal:
        16,

      borderWidth:
        1,

      borderColor:
        '#D7DCE3',

      borderRadius:
        13,

      backgroundColor:
        '#F8FAFC',

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    creditAccessButtonText: {
      fontSize:
        14,

      fontWeight:
        '800',

      color:
        '#475569',

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

    testHelpModalCard: {
      maxHeight:
        '86%',

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

    testHelpIntro: {
      marginBottom:
        14,

      fontSize:
        14,

      lineHeight:
        20,

      color:
        '#64748B',
    },

    helpSection: {
      marginBottom:
        9,

      borderWidth:
        1,

      borderColor:
        '#E2E8F0',

      borderRadius:
        14,

      overflow:
        'hidden',

      backgroundColor:
        '#FFFFFF',
    },

    helpSectionHeader: {
      minHeight:
        50,

      paddingHorizontal:
        14,

      paddingVertical:
        12,

      flexDirection:
        'row',

      alignItems:
        'center',
    },

    helpSectionPressed: {
      backgroundColor:
        '#F8FAFC',
    },

    helpSectionTitle: {
      flex:
        1,

      paddingRight:
        10,

      fontSize:
        14,

      fontWeight:
        '700',

      color:
        '#0F172A',
    },

    helpSectionArrow: {
      fontSize:
        10,

      color:
        '#64748B',
    },

    helpSectionContent: {
      paddingHorizontal:
        14,

      paddingBottom:
        15,

      fontSize:
        14,

      lineHeight:
        20,

      color:
        '#475569',
    },

    creditKeyboardAvoider: {
      flex:
        1,
    },

    creditModalCard: {
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

    creditModalText: {
      fontSize:
        14,

      lineHeight:
        20,

      color:
        '#475569',

      textAlign:
        'center',
    },

    creditRequestCodeBox: {
      marginTop:
        16,

      marginBottom:
        16,

      paddingVertical:
        14,

      paddingHorizontal:
        14,

      borderRadius:
        13,

      borderWidth:
        1,

      borderColor:
        '#CBD5E1',

      backgroundColor:
        '#F8FAFC',
    },

    creditRequestCode: {
      fontSize:
        19,

      fontWeight:
        '800',

      letterSpacing:
        1,

      color:
        '#0F172A',

      textAlign:
        'center',
    },

    creditShareButton: {
      width:
        '100%',

      minHeight:
        46,

      marginBottom:
        14,

      paddingHorizontal:
        16,

      borderRadius:
        13,

      backgroundColor:
        '#2563EB',

      alignItems:
        'center',

      justifyContent:
        'center',
    },

    creditShareButtonText: {
      color:
        '#FFFFFF',

      fontSize:
        14,

      fontWeight:
        '800',

      textAlign:
        'center',
    },

    creditRechargeInput: {
      width:
        '100%',

      minHeight:
        48,

      paddingHorizontal:
        14,

      borderWidth:
        1,

      borderColor:
        '#CBD5E1',

      borderRadius:
        13,

      backgroundColor:
        '#FFFFFF',

      fontSize:
        15,

      color:
        '#0F172A',
    },

    creditPrimaryButton: {
      width:
        '100%',

      minHeight:
        48,

      marginTop:
        12,

      borderRadius:
        13,

      backgroundColor:
        '#2563EB',

      alignItems:
        'center',

      justifyContent:
        'center',

      paddingHorizontal:
        16,
    },

    creditPrimaryButtonText: {
      color:
        '#FFFFFF',

      fontSize:
        15,

      fontWeight:
        '800',

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

    releaseDate: {
      marginTop:
        2,

      fontSize:
        12,

      fontStyle:
        'italic',

      color:
        '#94A3B8',
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
