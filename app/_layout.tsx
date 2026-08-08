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
} from 'react-native';

import 'react-native-reanimated';

import {
  useColorScheme,
} from '@/hooks/use-color-scheme';

import {
  FEEDBACK_ALERT_THRESHOLD,
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
