import AsyncStorage
  from '@react-native-async-storage/async-storage';

import * as Crypto
  from 'expo-crypto';

export const DIAGNOSTIC_STORAGE_KEY =
  'moment_diagnostic_interactions_v1';

export const DIAGNOSTIC_SENT_HISTORY_KEY =
  'moment_diagnostic_sent_history_v1';

export const MOMENT_DEVICE_ID_KEY =
  'moment_device_id_v1';

export const FEEDBACK_ALERT_THRESHOLD =
  20;

const MAX_DIAGNOSTIC_INTERACTIONS =
  500;

const MAX_SENT_HISTORY =
  500;

export type DiagnosticInteraction = {
  diagnostic_id: string;

  feature:
    | 'understand'
    | 'recall'
    | 'prevent';

  input: string;

  created_at: string;

  app_version?: string;
};

async function readArray(
  key: string
): Promise<DiagnosticInteraction[]> {
  try {
    const raw =
      await AsyncStorage
        .getItem(
          key
        );

    if (!raw) {
      return [];
    }

    const parsed =
      JSON.parse(
        raw
      );

    return Array.isArray(
      parsed
    )
      ? parsed
      : [];

  } catch {
    return [];
  }
}

export function createDiagnosticId(
  feature:
    | 'understand'
    | 'recall'
    | 'prevent'
) {
  return (
    `diag_${feature}_${Date.now()}_` +
    Math.random()
      .toString(36)
      .substring(
        2,
        10
      )
  );
}

export async function getMomentDeviceId() {
  const existing =
    await AsyncStorage
      .getItem(
        MOMENT_DEVICE_ID_KEY
      );

  if (
    existing &&
    existing.trim()
  ) {
    return existing.trim();
  }

  const newId =
    `moment_${Crypto.randomUUID()}`;

  await AsyncStorage
    .setItem(
      MOMENT_DEVICE_ID_KEY,
      newId
    );

  return newId;
}

export async function recordDiagnosticInteraction(
  interaction:
    DiagnosticInteraction
) {
  try {
    const existing =
      await readArray(
        DIAGNOSTIC_STORAGE_KEY
      );

    /*
     * Une même interaction ne doit pas
     * être ajoutée deux fois.
     */

    const withoutDuplicate =
      existing.filter(
        item =>
          item
            .diagnostic_id !==
          interaction
            .diagnostic_id
      );

    const next = [
      interaction,
      ...withoutDuplicate,
    ].slice(
      0,
      MAX_DIAGNOSTIC_INTERACTIONS
    );

    await AsyncStorage
      .setItem(
        DIAGNOSTIC_STORAGE_KEY,
        JSON.stringify(
          next
        )
      );

  } catch (error) {
    console.error(
      '❌ Impossible d’enregistrer le diagnostic local :',
      error
    );
  }
}

export async function getDiagnosticInteractions() {
  return readArray(
    DIAGNOSTIC_STORAGE_KEY
  );
}

export async function getPendingDiagnosticInteractions() {
  return getDiagnosticInteractions();
}

export async function getPendingDiagnosticCount() {
  const interactions =
    await getPendingDiagnosticInteractions();

  return interactions.length;
}

export async function markDiagnosticInteractionsAsSent(
  diagnosticIds:
    string[]
) {
  const wanted =
    new Set(
      diagnosticIds
        .filter(Boolean)
    );

  if (
    wanted.size === 0
  ) {
    return {
      removed:
        0,

      remaining:
        await getPendingDiagnosticCount(),
    };
  }

  const existing =
    await getPendingDiagnosticInteractions();

  const sent =
    existing.filter(
      item =>
        wanted.has(
          item
            .diagnostic_id
        )
    );

  const remaining =
    existing.filter(
      item =>
        !wanted.has(
          item
            .diagnostic_id
        )
    );

  /*
   * On conserve un petit historique
   * technique séparé.
   */

  const oldHistory =
    await readArray(
      DIAGNOSTIC_SENT_HISTORY_KEY
    );

  const nextHistory = [
    ...sent,
    ...oldHistory,
  ].slice(
    0,
    MAX_SENT_HISTORY
  );

  await AsyncStorage
    .multiSet([
      [
        DIAGNOSTIC_STORAGE_KEY,
        JSON.stringify(
          remaining
        ),
      ],

      [
        DIAGNOSTIC_SENT_HISTORY_KEY,
        JSON.stringify(
          nextHistory
        ),
      ],
    ]);

  return {
    removed:
      sent.length,

    remaining:
      remaining.length,
  };
}

export async function getSentDiagnosticHistory() {
  return readArray(
    DIAGNOSTIC_SENT_HISTORY_KEY
  );
}

export async function clearDiagnosticInteractions() {
  /*
   * Conservé pour compatibilité,
   * mais le feedback normal ne doit
   * plus utiliser cette fonction.
   */

  await AsyncStorage
    .removeItem(
      DIAGNOSTIC_STORAGE_KEY
    );
}
