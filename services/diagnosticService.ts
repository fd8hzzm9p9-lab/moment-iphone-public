
import AsyncStorage from '@react-native-async-storage/async-storage';

export const DIAGNOSTIC_STORAGE_KEY =
  'moment_diagnostic_interactions_v1';

const MAX_DIAGNOSTIC_INTERACTIONS =
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
      .substring(2, 10)
  );
}

export async function recordDiagnosticInteraction(
  interaction: DiagnosticInteraction
) {
  try {
    const raw =
      await AsyncStorage.getItem(
        DIAGNOSTIC_STORAGE_KEY
      );

    const existing:
      DiagnosticInteraction[] =
        raw
          ? JSON.parse(raw)
          : [];

    const next = [
      interaction,
      ...existing,
    ].slice(
      0,
      MAX_DIAGNOSTIC_INTERACTIONS
    );

    await AsyncStorage.setItem(
      DIAGNOSTIC_STORAGE_KEY,
      JSON.stringify(next)
    );
  } catch (error) {
    console.error(
      '❌ Impossible d’enregistrer le diagnostic local :',
      error
    );
  }
}

export async function getDiagnosticInteractions() {
  try {
    const raw =
      await AsyncStorage.getItem(
        DIAGNOSTIC_STORAGE_KEY
      );

    return raw
      ? JSON.parse(raw)
      : [];
  } catch {
    return [];
  }
}

export async function clearDiagnosticInteractions() {
  await AsyncStorage.removeItem(
    DIAGNOSTIC_STORAGE_KEY
  );
}
