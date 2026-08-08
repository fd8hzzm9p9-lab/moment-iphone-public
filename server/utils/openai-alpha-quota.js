const fs = require('fs');
const path = require('path');

const {
  logDiagnostic,
} = require('./diagnostics');

/*
 * =========================================================
 * MOMENT — QUOTA OPENAI PRE-ALPHA
 * =========================================================
 *
 * 1 crédit = 1 tentative réellement envoyée à OpenAI.
 *
 * Les traitements purement locaux ne passent jamais ici
 * et ne consomment donc aucun crédit.
 */

const DEFAULT_OPENAI_QUOTA =
  Number(
    process.env
      .MOMENT_ALPHA_OPENAI_QUOTA ||
    50
  );

const dataDirectory =
  path.join(
    __dirname,
    '..',
    'data'
  );

const quotaFile =
  path.join(
    dataDirectory,
    'alpha-openai-quotas.json'
  );

function ensureStore() {
  if (
    !fs.existsSync(
      dataDirectory
    )
  ) {
    fs.mkdirSync(
      dataDirectory,
      {
        recursive: true,
      }
    );
  }

  if (
    !fs.existsSync(
      quotaFile
    )
  ) {
    fs.writeFileSync(
      quotaFile,
      JSON.stringify(
        {
          devices: {},
        },
        null,
        2
      ),
      'utf8'
    );
  }
}

function readStore() {
  ensureStore();

  try {
    const parsed =
      JSON.parse(
        fs.readFileSync(
          quotaFile,
          'utf8'
        )
      );

    if (
      !parsed ||
      typeof parsed !==
        'object'
    ) {
      return {
        devices: {},
      };
    }

    if (
      !parsed.devices ||
      typeof parsed.devices !==
        'object'
    ) {
      parsed.devices = {};
    }

    return parsed;

  } catch {
    return {
      devices: {},
    };
  }
}

function writeStore(
  store
) {
  ensureStore();

  const tempFile =
    quotaFile + '.tmp';

  fs.writeFileSync(
    tempFile,
    JSON.stringify(
      store,
      null,
      2
    ),
    'utf8'
  );

  fs.renameSync(
    tempFile,
    quotaFile
  );
}

function normalizeDeviceId(
  deviceId
) {
  return String(
    deviceId || ''
  ).trim();
}

function createDeviceState(
  deviceId
) {
  const now =
    new Date()
      .toISOString();

  return {
    device_id:
      deviceId,

    initial_quota:
      DEFAULT_OPENAI_QUOTA,

    credits_granted:
      DEFAULT_OPENAI_QUOTA,

    credits_used:
      0,

    created_at:
      now,

    updated_at:
      now,

    usage: {
      request_count:
        0,

      input_tokens:
        0,

      output_tokens:
        0,

      total_tokens:
        0,

      understand_requests:
        0,

      recall_requests:
        0,
    },
  };
}

function getOrCreateDevice(
  store,
  deviceId
) {
  if (
    !store.devices[
      deviceId
    ]
  ) {
    store.devices[
      deviceId
    ] =
      createDeviceState(
        deviceId
      );
  }

  return store.devices[
    deviceId
  ];
}

function getRemaining(
  state
) {
  return Math.max(
    0,

    Number(
      state.credits_granted ||
      0
    ) -
    Number(
      state.credits_used ||
      0
    )
  );
}

function createQuotaError() {
  const error =
    new Error(
      'Quota OpenAI pré-alpha épuisé'
    );

  error.code =
    'ALPHA_OPENAI_QUOTA_EXHAUSTED';

  error.status =
    429;

  return error;
}

function getQuotaSnapshot(
  deviceId
) {
  const cleanDeviceId =
    normalizeDeviceId(
      deviceId
    );

  if (!cleanDeviceId) {
    return {
      device_id:
        '',

      quota_active:
        false,

      reason:
        'missing_device_id',
    };
  }

  const store =
    readStore();

  const state =
    getOrCreateDevice(
      store,
      cleanDeviceId
    );

  writeStore(
    store
  );

  return {
    device_id:
      cleanDeviceId,

    quota_active:
      true,

    initial_quota:
      state.initial_quota,

    credits_granted:
      state.credits_granted,

    credits_used:
      state.credits_used,

    credits_remaining:
      getRemaining(
        state
      ),

    usage:
      state.usage,
  };
}

/*
 * =========================================================
 * PROXY OPENAI
 * =========================================================
 *
 * Il expose volontairement la même interface :
 *
 * quotaOpenai.responses.create(...)
 *
 * afin de ne pas réécrire la logique actuelle des routes.
 */

function createQuotaOpenAI(
  openai,
  {
    deviceId,
    feature,
    diagnosticId,
  }
) {
  const cleanDeviceId =
    normalizeDeviceId(
      deviceId
    );

  return {
    responses: {
      create:
        async (
          ...args
        ) => {

          /*
           * PHASE 1 :
           *
           * tant que le client n'envoie pas encore
           * moment_device_id, on laisse fonctionner
           * OpenAI normalement.
           *
           * La PHASE 2 rendra le quota effectif
           * en transmettant cet identifiant.
           */

          if (
            !cleanDeviceId
          ) {
            logDiagnostic({
              diagnostic_id:
                diagnosticId ||
                '',

              feature:
                feature ||
                '',

              event:
                'openai_quota_unattributed',

              reason:
                'missing_device_id',
            });

            const response =
              await openai
                .responses
                .create(
                  ...args
                );

            const usage =
              response?.usage ||
              {};

            logDiagnostic({
              diagnostic_id:
                diagnosticId ||
                '',

              feature:
                feature ||
                '',

              event:
                'openai_usage',

              quota_active:
                false,

              model:
                response?.model ||
                args?.[0]?.model ||
                '',

              input_tokens:
                Number(
                  usage.input_tokens ||
                  0
                ),

              output_tokens:
                Number(
                  usage.output_tokens ||
                  0
                ),

              total_tokens:
                Number(
                  usage.total_tokens ||
                  0
                ),
            });

            return response;
          }

          const store =
            readStore();

          const state =
            getOrCreateDevice(
              store,
              cleanDeviceId
            );

          const remainingBefore =
            getRemaining(
              state
            );

          if (
            remainingBefore <=
            0
          ) {
            logDiagnostic({
              diagnostic_id:
                diagnosticId ||
                '',

              feature:
                feature ||
                '',

              event:
                'openai_quota_exhausted',

              device_id:
                cleanDeviceId,

              credits_remaining:
                0,
            });

            throw createQuotaError();
          }

          /*
           * On réserve le crédit AVANT l'appel.
           *
           * Objectif principal :
           * garantir le plafond budgétaire.
           */

          state.credits_used =
            Number(
              state.credits_used ||
              0
            ) + 1;

          state.updated_at =
            new Date()
              .toISOString();

          writeStore(
            store
          );

          const remainingAfterReservation =
            getRemaining(
              state
            );

          logDiagnostic({
            diagnostic_id:
              diagnosticId ||
              '',

            feature:
              feature ||
              '',

            event:
              'openai_credit_consumed',

            device_id:
              cleanDeviceId,

            credits_used:
              state.credits_used,

            credits_remaining:
              remainingAfterReservation,
          });

          try {
            const response =
              await openai
                .responses
                .create(
                  ...args
                );

            const usage =
              response?.usage ||
              {};

            const inputTokens =
              Number(
                usage.input_tokens ||
                0
              );

            const outputTokens =
              Number(
                usage.output_tokens ||
                0
              );

            const totalTokens =
              Number(
                usage.total_tokens ||
                (
                  inputTokens +
                  outputTokens
                )
              );

            /*
             * On relit le store au cas où plusieurs
             * requêtes arrivent presque simultanément.
             */

            const finalStore =
              readStore();

            const finalState =
              getOrCreateDevice(
                finalStore,
                cleanDeviceId
              );

            finalState
              .usage
              .request_count +=
                1;

            finalState
              .usage
              .input_tokens +=
                inputTokens;

            finalState
              .usage
              .output_tokens +=
                outputTokens;

            finalState
              .usage
              .total_tokens +=
                totalTokens;

            if (
              feature ===
              'understand'
            ) {
              finalState
                .usage
                .understand_requests +=
                  1;
            }

            if (
              feature ===
              'recall'
            ) {
              finalState
                .usage
                .recall_requests +=
                  1;
            }

            finalState.updated_at =
              new Date()
                .toISOString();

            writeStore(
              finalStore
            );

            logDiagnostic({
              diagnostic_id:
                diagnosticId ||
                '',

              feature:
                feature ||
                '',

              event:
                'openai_usage',

              quota_active:
                true,

              device_id:
                cleanDeviceId,

              model:
                response?.model ||
                args?.[0]?.model ||
                '',

              input_tokens:
                inputTokens,

              output_tokens:
                outputTokens,

              total_tokens:
                totalTokens,

              credits_used:
                finalState
                  .credits_used,

              credits_remaining:
                getRemaining(
                  finalState
                ),
            });

            return response;

          } catch (
            error
          ) {
            logDiagnostic({
              diagnostic_id:
                diagnosticId ||
                '',

              feature:
                feature ||
                '',

              event:
                'openai_request_error_after_credit',

              device_id:
                cleanDeviceId,

              credits_remaining:
                remainingAfterReservation,

              error_code:
                error?.code ||
                '',

              status:
                error?.status ||
                null,
            });

            throw error;
          }
        },
    },
  };
}

module.exports = {
  DEFAULT_OPENAI_QUOTA,
  createQuotaOpenAI,
  getQuotaSnapshot,
};
