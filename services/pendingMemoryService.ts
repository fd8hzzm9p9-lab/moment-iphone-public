import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  APP_VERSION,
} from '../config/app';

export const
  PENDING_MEMORY_STORAGE_KEY =
    'moment_pending_memories_v1';

export const
  PENDING_MEMORY_HISTORY_KEY =
    'moment_pending_memories_history_v1';

export type PendingMemoryEvent =
  | 'created'
  | 'retry'
  | 'retry_failed'
  | 'resolved'
  | 'deleted';

export type PendingMemoryHistoryEntry = {
  event:
    PendingMemoryEvent;

  at:
    string;

  app_version:
    string;

  diagnostic_id?:
    string;

  reason?:
    string;

  parser?:
    string;

  memory_ids?:
    string[];
};

export type PendingMemory = {
  id:
    string;

  text:
    string;

  created_at:
    string;

  created_app_version:
    string;

  last_attempt_at:
    string;

  last_attempt_app_version:
    string;

  attempt_count:
    number;

  initial_reason:
    string;

  last_reason:
    string;

  initial_diagnostic_id?:
    string;

  last_diagnostic_id?:
    string;

  history:
    PendingMemoryHistoryEntry[];
};

function createPendingId() {
  return (
    'pending_' +
    Date.now() +
    '_' +
    Math.random()
      .toString(36)
      .slice(
        2,
        10
      )
  );
}

async function readArray(
  key: string
): Promise<any[]> {
  try {
    const raw =
      await AsyncStorage.getItem(
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

async function writeArray(
  key: string,
  data: any[]
) {
  await AsyncStorage.setItem(
    key,
    JSON.stringify(
      data
    )
  );
}

export async function
getPendingMemories():
Promise<PendingMemory[]> {
  return (
    await readArray(
      PENDING_MEMORY_STORAGE_KEY
    )
  ) as PendingMemory[];
}

export async function
getPendingMemoryCount() {
  const memories =
    await getPendingMemories();

  return memories.length;
}

export async function
addPendingMemory(
  text: string,
  reason:
    string = 'local_failed',
  diagnosticId?:
    string
) {
  const cleanText =
    String(
      text || ''
    ).trim();

  if (!cleanText) {
    return null;
  }

  const current =
    await getPendingMemories();

  /*
   * Même texte déjà en attente :
   * pas de doublon.
   */

  const duplicate =
    current.find(
      item =>
        item.text ===
        cleanText
    );

  if (duplicate) {
    return duplicate;
  }

  const now =
    new Date()
      .toISOString();

  const item:
    PendingMemory = {
      id:
        createPendingId(),

      text:
        cleanText,

      created_at:
        now,

      created_app_version:
        APP_VERSION,

      last_attempt_at:
        now,

      last_attempt_app_version:
        APP_VERSION,

      attempt_count:
        1,

      initial_reason:
        reason,

      last_reason:
        reason,

      initial_diagnostic_id:
        diagnosticId,

      last_diagnostic_id:
        diagnosticId,

      history: [
        {
          event:
            'created',

          at:
            now,

          app_version:
            APP_VERSION,

          diagnostic_id:
            diagnosticId,

          reason,
        },
      ],
    };

  await writeArray(
    PENDING_MEMORY_STORAGE_KEY,
    [
      item,
      ...current,
    ]
  );

  return item;
}

export async function
recordPendingRetry(
  id: string,
  diagnosticId:
    string
) {
  const current =
    await getPendingMemories();

  const now =
    new Date()
      .toISOString();

  const next =
    current.map(
      item => {
        if (
          item.id !== id
        ) {
          return item;
        }

        return {
          ...item,

          attempt_count:
            item.attempt_count +
            1,

          last_attempt_at:
            now,

          last_attempt_app_version:
            APP_VERSION,

          last_diagnostic_id:
            diagnosticId,

          history: [
            ...item.history,

            {
              event:
                'retry' as const,

              at:
                now,

              app_version:
                APP_VERSION,

              diagnostic_id:
                diagnosticId,
            },
          ],
        };
      }
    );

  await writeArray(
    PENDING_MEMORY_STORAGE_KEY,
    next
  );
}

export async function
recordPendingRetryFailure(
  id: string,
  reason:
    string,
  diagnosticId?:
    string
) {
  const current =
    await getPendingMemories();

  const now =
    new Date()
      .toISOString();

  const next =
    current.map(
      item => {
        if (
          item.id !== id
        ) {
          return item;
        }

        return {
          ...item,

          last_reason:
            reason,

          last_attempt_at:
            now,

          last_attempt_app_version:
            APP_VERSION,

          last_diagnostic_id:
            diagnosticId ||
            item.last_diagnostic_id,

          history: [
            ...item.history,

{
  event: 'retry_failed' as const,

  at:
    now,

              app_version:
                APP_VERSION,

              diagnostic_id:
                diagnosticId,

              reason,
            },
          ],
        };
      }
    );

  await writeArray(
    PENDING_MEMORY_STORAGE_KEY,
    next
  );
}

export async function
resolvePendingMemory(
  id: string,
  memoryIds:
    string[],
  diagnosticId?:
    string,
  parser?:
    string
) {
  const current =
    await getPendingMemories();

  const item =
    current.find(
      candidate =>
        candidate.id === id
    );

  if (!item) {
    return;
  }

  const now =
    new Date()
      .toISOString();

  const history =
    await readArray(
      PENDING_MEMORY_HISTORY_KEY
    );

  const resolved = {
    ...item,

    resolved_at:
      now,

    resolved_app_version:
      APP_VERSION,

    resolved_memory_ids:
      memoryIds,

    resolved_diagnostic_id:
      diagnosticId,

    resolved_parser:
      parser || '',

    history: [
      ...item.history,

      {
        event:
          'resolved',

        at:
          now,

        app_version:
          APP_VERSION,

        diagnostic_id:
          diagnosticId,

        parser:
          parser || '',

        memory_ids:
          memoryIds,
      },
    ],
  };

  /*
   * On écrit d'abord l'historique.
   *
   * Le souvenir n'est retiré de la
   * file qu'ensuite.
   */

  await writeArray(
    PENDING_MEMORY_HISTORY_KEY,
    [
      resolved,
      ...history,
    ].slice(
      0,
      500
    )
  );

  await writeArray(
    PENDING_MEMORY_STORAGE_KEY,
    current.filter(
      candidate =>
        candidate.id !== id
    )
  );
}

export async function
deletePendingMemory(
  id: string
) {
  const current =
    await getPendingMemories();

  const item =
    current.find(
      candidate =>
        candidate.id === id
    );

  if (item) {
    const history =
      await readArray(
        PENDING_MEMORY_HISTORY_KEY
      );

    const now =
      new Date()
        .toISOString();

    await writeArray(
      PENDING_MEMORY_HISTORY_KEY,
      [
        {
          ...item,

          deleted_at:
            now,

          deleted_app_version:
            APP_VERSION,

          history: [
            ...item.history,

            {
              event:
                'deleted',

              at:
                now,

              app_version:
                APP_VERSION,
            },
          ],
        },

        ...history,
      ].slice(
        0,
        500
      )
    );
  }

  await writeArray(
    PENDING_MEMORY_STORAGE_KEY,
    current.filter(
      candidate =>
        candidate.id !== id
    )
  );
}

export async function
getPendingMemoryDiagnosticSnapshot() {
  const pending =
    await getPendingMemories();

  const history =
    await readArray(
      PENDING_MEMORY_HISTORY_KEY
    );

  return {
    pending_count:
      pending.length,

    pending,

    history_count:
      history.length,

    history,
  };
}
