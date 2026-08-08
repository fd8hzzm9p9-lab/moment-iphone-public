import {
  useEffect,
  useState,
} from 'react';

import {
  StyleProp,
  Text,
  TextStyle,
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

            const version =
              typeof data
                ?.server_version ===
                'string'
                ? data
                    .server_version
                    .trim()
                : '';

            if (
              active
            ) {
              setServerVersion(
                version ||
                'S?'
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

      /*
       * Permet de voir rapidement un changement
       * après redémarrage du serveur sans avoir
       * à relancer complètement l'application.
       */
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
      };
    },
    []
  );

  return (
    <Text
      style={
        textStyle
      }
    >
      {APP_VERSION}{' '}
      {APP_REVISION}{' '}
      {serverVersion}
    </Text>
  );
}
