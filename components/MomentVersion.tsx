import {
  useEffect,
  useState,
} from 'react';

import AsyncStorage
  from '@react-native-async-storage/async-storage';

import {
  DevSettings,
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
} from 'react-native';

import {
  APP_REVISION,
  APP_VERSION,
} from '../config/app';

import {
  SERVER_URL,
} from '../config/server';

type Props = {
  textStyle?:
    StyleProp<TextStyle>;
};

const UPDATE_ATTEMPT_KEY =
  'moment_update_attempt_v1';

const UPDATE_RETRY_DELAY_MS =
  30000;

let globalUpdateModalOwner =
  false;

type StoredUpdateAttempt = {
  expected_revision:
    string;

  attempted_at:
    number;
};

async function getRecentUpdateAttempt(
  expectedRevision:
    string
) {
  try {
    const raw =
      await AsyncStorage
        .getItem(
          UPDATE_ATTEMPT_KEY
        );

    if (!raw) {
      return false;
    }

    const parsed:
      StoredUpdateAttempt =
        JSON.parse(
          raw
        );

    if (
      parsed
        ?.expected_revision !==
        expectedRevision
    ) {
      return false;
    }

    const age =
      Date.now() -
      Number(
        parsed
          ?.attempted_at ||
        0
      );

    return (
      age >= 0 &&
      age <
        UPDATE_RETRY_DELAY_MS
    );

  } catch {
    return false;
  }
}

async function saveUpdateAttempt(
  expectedRevision:
    string
) {
  try {
    await AsyncStorage
      .setItem(
        UPDATE_ATTEMPT_KEY,

        JSON.stringify({
          expected_revision:
            expectedRevision,

          attempted_at:
            Date.now(),
        })
      );

  } catch {
    /*
     * Failure to persist the anti-loop marker
     * must never block the actual reload.
     */
  }
}

async function clearUpdateAttempt() {
  try {
    await AsyncStorage
      .removeItem(
        UPDATE_ATTEMPT_KEY
      );

  } catch {
    /*
     * No user-facing error needed.
     */
  }
}

function parseRevision(
  revision:
    string
): number[] {
  const values =
    String(
      revision || ''
    )
      .toUpperCase()
      .match(
        /\d+/g
      );

  if (
    !values ||
    values.length ===
      0
  ) {
    return [];
  }

  return values.map(
    value =>
      Number(
        value
      )
  );
}

function isRevisionNewer(
  candidate:
    string,
  current:
    string
) {
  const candidateParts =
    parseRevision(
      candidate
    );

  const currentParts =
    parseRevision(
      current
    );

  /*
   * Une revision illisible ne doit jamais
   * provoquer une fausse proposition de MAJ.
   */
  if (
    candidateParts.length ===
      0 ||
    currentParts.length ===
      0
  ) {
    return false;
  }

  const length =
    Math.max(
      candidateParts.length,
      currentParts.length
    );

  for (
    let index = 0;
    index < length;
    index += 1
  ) {
    const candidateValue =
      candidateParts[
        index
      ] ??
      0;

    const currentValue =
      currentParts[
        index
      ] ??
      0;

    if (
      candidateValue >
      currentValue
    ) {
      return true;
    }

    if (
      candidateValue <
      currentValue
    ) {
      return false;
    }
  }

  return false;
}

export default function MomentVersion({
  textStyle,
}: Props) {
  const [
    serverVersion,
    setServerVersion,
  ] =
    useState(
      'S?'
    );

  const [
    expectedAppRevision,
    setExpectedAppRevision,
  ] =
    useState(
      ''
    );

  const [
    updateModalVisible,
    setUpdateModalVisible,
  ] =
    useState(
      false
    );

  const [
    dismissedRevision,
    setDismissedRevision,
  ] =
    useState(
      ''
    );

  useEffect(
    () => {
      let active =
        true;

      const refresh =
        async () => {
          try {
            const response =
              await fetch(
                `${SERVER_URL}/version`
              );

            if (
              !response.ok
            ) {
              throw new Error(
                `HTTP ${response.status}`
              );
            }

            const data =
              await response
                .json();

            const currentServerVersion =
              typeof data
                ?.server_version ===
                'string'
                ? data
                    .server_version
                    .trim()
                : '';

            const expectedRevision =
              typeof data
                ?.expected_app_revision ===
                'string'
                ? data
                    .expected_app_revision
                    .trim()
                : '';

            if (
              !active
            ) {
              return;
            }

            setServerVersion(
              currentServerVersion ||
              'S?'
            );

            setExpectedAppRevision(
              expectedRevision
            );

            const updateNeeded =
              Boolean(
                expectedRevision &&
                isRevisionNewer(
                  expectedRevision,
                  APP_REVISION
                )
              );

            /*
             * App is now up to date:
             * close automatically and clear
             * every anti-loop marker.
             */
            if (
              !updateNeeded
            ) {
              setUpdateModalVisible(
                false
              );

              setDismissedRevision(
                ''
              );

              globalUpdateModalOwner =
                false;

              await clearUpdateAttempt();

              return;
            }

            const recentAttempt =
              await getRecentUpdateAttempt(
                expectedRevision
              );

            /*
             * A Reload was just attempted.
             *
             * If Expo temporarily served the old bundle again,
             * do NOT immediately reopen the modal.
             */
            if (
              recentAttempt
            ) {
              setUpdateModalVisible(
                false
              );

              globalUpdateModalOwner =
                false;

              return;
            }

            if (
              dismissedRevision !==
                expectedRevision &&
              !globalUpdateModalOwner
            ) {
              globalUpdateModalOwner =
                true;

              setUpdateModalVisible(
                true
              );
            }

          } catch {
            if (
              active
            ) {
              setServerVersion(
                'S?'
              );
            }
          }
        };

      void refresh();

      const interval =
        setInterval(
          () => {
            void refresh();
          },
          10000
        );

      return () => {
        active =
          false;

        clearInterval(
          interval
        );

        globalUpdateModalOwner =
          false;
      };
    },
    [
      dismissedRevision,
    ]
  );

  const closeUpdateModal =
    () => {
      setUpdateModalVisible(
        false
      );

      setDismissedRevision(
        expectedAppRevision
      );

      globalUpdateModalOwner =
        false;
    };

  const reloadMoment =
    async () => {
      if (
        !expectedAppRevision
      ) {
        return;
      }

      /*
       * Hide BEFORE reload.
       */
      setUpdateModalVisible(
        false
      );

      globalUpdateModalOwner =
        false;

      /*
       * Persist BEFORE reload.
       *
       * This survives the JS bundle restart.
       */
      await saveUpdateAttempt(
        expectedAppRevision
      );

      try {
        DevSettings.reload();

      } catch {
        /*
         * Allow another proposal quickly
         * if reload cannot be triggered.
         */
        await clearUpdateAttempt();
      }
    };

  return (
    <>
      <Text
        style={
          textStyle
        }
      >
        {APP_VERSION}{' '}
        {APP_REVISION}{' '}
        {serverVersion}
      </Text>

      <Modal
        animationType="fade"
        transparent
        visible={
          updateModalVisible
        }
        onRequestClose={
          closeUpdateModal
        }
      >
        <View
          style={
            styles.backdrop
          }
        >
          <View
            style={
              styles.card
            }
          >
            <Text
              style={
                styles.title
              }
            >
              Mise à jour de Moment disponible
            </Text>

            <Text
              style={
                styles.message
              }
            >
              Une nouvelle version de Moment est disponible.
              {'\n\n'}
              Version actuelle : {APP_REVISION}
              {'\n'}
              Version disponible : {expectedAppRevision}
              {'\n\n'}
              Actualise Moment pour continuer avec la dernière version.
            </Text>

            <Pressable
              onPress={
                reloadMoment
              }
              style={
                ({
                  pressed,
                }) => [
                  styles.primaryButton,

                  pressed &&
                    styles.pressed,
                ]
              }
            >
              <Text
                style={
                  styles.primaryButtonText
                }
              >
                Actualiser
              </Text>
            </Pressable>

            <Pressable
              onPress={
                closeUpdateModal
              }
              style={
                ({
                  pressed,
                }) => [
                  styles.secondaryButton,

                  pressed &&
                    styles.pressed,
                ]
              }
            >
              <Text
                style={
                  styles.secondaryButtonText
                }
              >
                Plus tard
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles =
  StyleSheet.create({
    backdrop: {
      flex:
        1,

      backgroundColor:
        'rgba(15,23,42,0.45)',

      alignItems:
        'center',

      justifyContent:
        'center',

      paddingHorizontal:
        24,
    },

    card: {
      width:
        '100%',

      maxWidth:
        420,

      backgroundColor:
        '#FFFFFF',

      borderRadius:
        20,

      paddingHorizontal:
        22,

      paddingVertical:
        24,

      shadowColor:
        '#000000',

      shadowOpacity:
        0.15,

      shadowRadius:
        18,

      shadowOffset: {
        width:
          0,

        height:
          8,
      },

      elevation:
        8,
    },

    title: {
      fontSize:
        21,

      fontWeight:
        '800',

      color:
        '#0F172A',

      textAlign:
        'center',
    },

    message: {
      marginTop:
        14,

      fontSize:
        15,

      lineHeight:
        21,

      color:
        '#475569',

      textAlign:
        'center',
    },

    primaryButton: {
      minHeight:
        48,

      marginTop:
        20,

      borderRadius:
        13,

      backgroundColor:
        '#2563EB',

      alignItems:
        'center',

      justifyContent:
        'center',

      paddingHorizontal:
        18,
    },

    primaryButtonText: {
      color:
        '#FFFFFF',

      fontSize:
        15,

      fontWeight:
        '800',
    },

    secondaryButton: {
      minHeight:
        44,

      marginTop:
        8,

      borderRadius:
        13,

      alignItems:
        'center',

      justifyContent:
        'center',

      paddingHorizontal:
        18,
    },

    secondaryButtonText: {
      color:
        '#64748B',

      fontSize:
        14,

      fontWeight:
        '700',
    },

    pressed: {
      opacity:
        0.7,
    },
  });
