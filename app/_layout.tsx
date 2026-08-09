import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native';

import {
  Stack,
} from 'expo-router';

import {
  StatusBar,
} from 'expo-status-bar';

import React, {
  useEffect,
} from 'react';

import {
  Alert,
  AppState,
} from 'react-native';

import 'react-native-reanimated';

import {
  useColorScheme,
} from '@/hooks/use-color-scheme';

import {
  SERVER_URL,
} from '../config/server';


import {
  FEEDBACK_ALERT_THRESHOLD,
  getMomentDeviceId,
  getPendingDiagnosticCount,
} from '../services/diagnosticService';

export const unstable_settings = {
  anchor:
    '(tabs)',
};

export default function RootLayout() {
  const colorScheme =
    useColorScheme();

  useEffect(
    () => {
      /*
       * Le RootLayout est monté au véritable
       * lancement de l'application.
       *
       * On ne déclenche donc pas ce contrôle
       * à chaque changement d'onglet.
       */

      const checkPendingFeedback =
        async () => {
          const count =
            await getPendingDiagnosticCount();

          if (
            count >=
            FEEDBACK_ALERT_THRESHOLD
          ) {
            Alert.alert(
              'Feedback en attente',

              `Tu as ${count} interactions qui n’ont pas encore été envoyées. Pense à envoyer régulièrement ton feedback pour nous aider à améliorer Moment.`,

              [
                {
                  text:
                    'OK',
                },
              ]
            );
          }
        };

      const timer =
        setTimeout(
          () => {
            void checkPendingFeedback();
          },
          500
        );

      return () =>
        clearTimeout(
          timer
        );
    },
    []
  );

  useEffect(
    () => {
      /*
       * Présence testeur :
       *
       * - ping immédiat quand Moment est actif ;
       * - ping toutes les 60 secondes ;
       * - aucun ping lorsque l'app est en arrière-plan.
       */

      let heartbeatInterval:
        ReturnType<typeof setInterval> |
        null =
          null;

      const sendHeartbeat =
        async () => {
          try {
            const momentDeviceId =
              await getMomentDeviceId();

            await fetch(
              `${SERVER_URL}/alpha-presence/heartbeat`,
              {
                method:
                  'POST',

                headers: {
                  'Content-Type':
                    'application/json',
                },

                body:
                  JSON.stringify({
                    moment_device_id:
                      momentDeviceId,
                  }),
              }
            );
          } catch {
            /*
             * Le heartbeat ne doit jamais gêner
             * l'utilisation normale de Moment.
             */
          }
        };

      const stopHeartbeat =
        () => {
          if (
            heartbeatInterval
          ) {
            clearInterval(
              heartbeatInterval
            );

            heartbeatInterval =
              null;
          }
        };

      const startHeartbeat =
        () => {
          stopHeartbeat();

          void sendHeartbeat();

          heartbeatInterval =
            setInterval(
              () => {
                void sendHeartbeat();
              },
              60000
            );
        };

      /*
       * Au montage du RootLayout, on démarre
       * immédiatement le heartbeat.
       *
       * Sur Android, AppState.currentState peut
       * ne pas encore être "active" au tout premier
       * rendu. Attendre uniquement AppState pouvait
       * donc empêcher complètement le heartbeat.
       */
      startHeartbeat();

      const subscription =
        AppState.addEventListener(
          'change',
          nextState => {
            if (
              nextState ===
              'active'
            ) {
              startHeartbeat();
            } else {
              stopHeartbeat();
            }
          }
        );

      return () => {
        stopHeartbeat();

        subscription.remove();
      };
    },
    []
  );

  return (
    <ThemeProvider
      value={
        colorScheme ===
        'dark'
          ? DarkTheme
          : DefaultTheme
      }
    >
      <Stack>
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown:
              false,
          }}
        />

        <Stack.Screen
          name="modal"
          options={{
            presentation:
              'modal',

            title:
              'Modal',
          }}
        />
      </Stack>

      <StatusBar
        style="auto"
      />
    </ThemeProvider>
  );
}
