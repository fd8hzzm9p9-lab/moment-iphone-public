import Constants from 'expo-constants';

﻿export const APP_NAME =
  Constants.expoConfig?.name ||
  'Moment';

export const APP_ENVIRONMENT_LABEL =
  APP_NAME.toLowerCase().includes('dev')
    ? 'DEV'
    : '';
export const APP_VERSION =
  'pré-alpha 0.2.9';

export const APP_REVISION =
  'A6';
export const APP_TAGLINE =
  'Votre mémoire, simplement.';
