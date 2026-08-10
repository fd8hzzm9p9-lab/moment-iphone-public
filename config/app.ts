import Constants from 'expo-constants';

﻿export const APP_NAME =
  Constants.expoConfig?.name ||
  'Moment';

export const APP_ENVIRONMENT_LABEL =
  APP_NAME.toLowerCase().includes('dev')
    ? 'DEV — MEMENTO 002-08B'
    : '';
export const APP_VERSION =
  'pré-alpha 0.2.11';

export const APP_REVISION =
  'A7';
export const APP_TAGLINE =
  'Votre mémoire, simplement.';
