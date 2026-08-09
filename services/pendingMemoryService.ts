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

export const
  PENDING_MEMORY_REFORMULATION_THRESHOLD =
    3;

/*
 * Compatibilité temporaire :
 * 3 n'est plus une limite bloquante.
 */
export const
  MAX_PENDING_MEMORY_ATTEMPTS =
    PENDING_MEMORY_REFORMULATION_THRESHOLD;

export type PendingMemoryEvent =
  | 'created'
  | 'retry'
  | 'retry_failed'
  | 'resolved'
  | 'deleted'
  | 'restored'
  | 'edited';

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

  old_text?:
    string;

  new_text?:
    string;
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

  /*
   * Optionnel pour rester compatible avec les
   * souvenirs créés avant l'ajout de ce compteur.
   */
  consecutive_failure_count?:
    number;

  last_edited_at?:
    string;

  last_edited_app_version?:
    string;

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

export function
getPendingMemoryFailureCount(
  memory:
    PendingMemory
) {
  const stored =
    Number(
      memory
        .consecutive_failure_count
    );

  if (
    Number.isFinite(
      stored
    ) &&
    stored >=
      0
  ) {
    return Math.floor(
      stored
    );
  }

  /*
   * Migration douce :
   * un ancien souvenir encore en attente
   * a échoué lors de ses tentatives passées.
   */
  const attempts =
    Number(
      memory.attempt_count
    );

  return (
    Number.isFinite(
      attempts
    ) &&
    attempts >=
      0
  )
    ? Math.floor(
        attempts
      )
    : 0;
}

export function
shouldSuggestPendingMemoryEdit(
  memory:
    PendingMemory
) {
  return (
    getPendingMemoryFailureCount(
      memory
    ) >=
    PENDING_MEMORY_REFORMULATION_THRESHOLD
  );
}

/*
 * Conservé pour compatibilité avec d'anciens imports.
 * Un retry n'est plus bloqué par un compteur :
 * il doit seulement être déclenché explicitement.
 */
export function
canRetryPendingMemory(
  memory:
    PendingMemory
) {
  return Boolean(
    memory &&
    memory.id
  );
}

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

      consecutive_failure_count:
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

          /*
           * On matérialise le compteur des anciens
           * souvenirs avant d'incrémenter la tentative.
           */
          consecutive_failure_count:
            getPendingMemoryFailureCount(
              item
            ),

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

          consecutive_failure_count:
            getPendingMemoryFailureCount(
              item
            ) +
            1,

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
updatePendingMemoryText(
  id: string,
  text: string
) {
  const cleanText =
    String(
      text || ''
    ).trim();

  if (!cleanText) {
    throw new Error(
      'PENDING_MEMORY_EMPTY_TEXT'
    );
  }

  const current =
    await getPendingMemories();

  const duplicate =
    current.find(
      item =>
        item.id !== id &&
        item.text ===
          cleanText
    );

  if (duplicate) {
    throw new Error(
      'PENDING_MEMORY_DUPLICATE_TEXT'
    );
  }

  const now =
    new Date()
      .toISOString();

  let updated:
    PendingMemory | null =
      null;

  const next =
    current.map(
      item => {
        if (
          item.id !== id
        ) {
          return item;
        }

        if (
          item.text ===
            cleanText
        ) {
          updated =
            item;

          return item;
        }

        const oldText =
          item.text;

        const nextItem:
          PendingMemory = {
            ...item,

            text:
              cleanText,

            consecutive_failure_count:
              0,

            last_reason:
              'PENDING_MEMORY_EDITED',

            last_edited_at:
              now,

            last_edited_app_version:
              APP_VERSION,

            history: [
              ...item.history,

              {
                event:
                  'edited',

                at:
                  now,

                app_version:
                  APP_VERSION,

                old_text:
                  oldText,

                new_text:
                  cleanText,
              },
            ],
          };

        updated =
          nextItem;

        return nextItem;
      }
    );

  if (!updated) {
    return null;
  }

  await writeArray(
    PENDING_MEMORY_STORAGE_KEY,
    next
  );

  return updated;
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

function getLatestDeletedBatch(
  history:
    any[]
): any[] {
  const firstRelevantIndex =
    history.findIndex(
      item =>
        item &&
        typeof item === 'object' &&
        (
          typeof item.deleted_at ===
            'string' ||
          typeof item.restored_at ===
            'string'
        )
    );

  if (
    firstRelevantIndex <
      0
  ) {
    return [];
  }

  const firstRelevant =
    history[
      firstRelevantIndex
    ];

  /*
   * Une restauration plus récente ferme
   * la dernière suppression disponible.
   */
  if (
    typeof firstRelevant
      .restored_at ===
      'string'
  ) {
    return [];
  }

  const latestDeletedAt =
    Date.parse(
      firstRelevant.deleted_at
    );

  if (
    Number.isNaN(
      latestDeletedAt
    )
  ) {
    return [];
  }

  const batch:
    any[] = [];

  for (
    let index =
      firstRelevantIndex;
    index <
      history.length;
    index += 1
  ) {
    const item =
      history[index];

    if (
      !item ||
      typeof item !==
        'object' ||
      typeof item.deleted_at !==
        'string'
    ) {
      break;
    }

    const deletedAt =
      Date.parse(
        item.deleted_at
      );

    if (
      Number.isNaN(
        deletedAt
      ) ||
      Math.abs(
        latestDeletedAt -
        deletedAt
      ) >
        5000
    ) {
      break;
    }

    batch.push(
      item
    );
  }

  return batch;
}

export async function
getLatestDeletedPendingMemoryCount() {
  const history =
    await readArray(
      PENDING_MEMORY_HISTORY_KEY
    );

  return getLatestDeletedBatch(
    history
  ).length;
}

export async function
restoreLatestDeletedPendingMemories() {
  const history =
    await readArray(
      PENDING_MEMORY_HISTORY_KEY
    );

  const deletedBatch =
    getLatestDeletedBatch(
      history
    );

  if (
    deletedBatch.length ===
      0
  ) {
    return 0;
  }

  const current =
    await getPendingMemories();

  const existingIds =
    new Set(
      current.map(
        item =>
          item.id
      )
    );

  const existingTexts =
    new Set(
      current.map(
        item =>
          item.text
      )
    );

  const now =
    new Date()
      .toISOString();

  const restored:
    PendingMemory[] =
      deletedBatch
        .filter(
          item =>
            typeof item.id ===
              'string' &&
            typeof item.text ===
              'string' &&
            !existingIds.has(
              item.id
            ) &&
            !existingTexts.has(
              item.text
            )
        )
        .map(
          item => ({
            id:
              item.id,

            text:
              item.text,

            created_at:
              item.created_at,

            created_app_version:
              item.created_app_version,

            last_attempt_at:
              item.last_attempt_at,

            last_attempt_app_version:
              item.last_attempt_app_version,

            attempt_count:
              item.attempt_count,

            consecutive_failure_count:
              typeof item
                .consecutive_failure_count ===
                'number'
                ? item
                    .consecutive_failure_count
                : item.attempt_count,

            last_edited_at:
              item.last_edited_at,

            last_edited_app_version:
              item.last_edited_app_version,

            initial_reason:
              item.initial_reason,

            last_reason:
              item.last_reason,

            initial_diagnostic_id:
              item.initial_diagnostic_id,

            last_diagnostic_id:
              item.last_diagnostic_id,

            history: [
              ...(Array.isArray(
                item.history
              )
                ? item.history
                : []),

              {
                event:
                  'restored' as const,

                at:
                  now,

                app_version:
                  APP_VERSION,
              },
            ],
          })
        );

  if (
    restored.length ===
      0
  ) {
    return 0;
  }

  await writeArray(
    PENDING_MEMORY_STORAGE_KEY,
    [
      ...restored,
      ...current,
    ]
  );

  await writeArray(
    PENDING_MEMORY_HISTORY_KEY,
    [
      {
        restored_at:
          now,

        restored_app_version:
          APP_VERSION,

        restored_pending_ids:
          restored.map(
            item =>
              item.id
          ),

        history: [
          {
            event:
              'restored',

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

  return restored.length;
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
