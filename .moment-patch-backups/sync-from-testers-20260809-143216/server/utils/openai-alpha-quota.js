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
    0
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
            /*
             * L'appel OpenAI n'a pas abouti.
             *
             * Le crédit avait été réservé AVANT
             * l'appel pour protéger le budget.
             *
             * Comme aucune réponse OpenAI exploitable
             * n'a été obtenue, on rend maintenant
             * automatiquement ce crédit.
             */

            const refundStore =
              readStore();

            const refundState =
              getOrCreateDevice(
                refundStore,
                cleanDeviceId
              );

            refundState.credits_used =
              Math.max(
                0,
                Number(
                  refundState
                    .credits_used ||
                  0
                ) - 1
              );

            refundState.updated_at =
              new Date()
                .toISOString();

            writeStore(
              refundStore
            );

            const remainingAfterRefund =
              getRemaining(
                refundState
              );

            logDiagnostic({
              diagnostic_id:
                diagnosticId ||
                '',

              feature:
                feature ||
                '',

              event:
                'openai_credit_refunded',

              device_id:
                cleanDeviceId,

              reason:
                'openai_request_failed',

              error_code:
                error?.code ||
                '',

              status:
                error?.status ||
                null,

              credits_used:
                refundState
                  .credits_used,

              credits_remaining:
                remainingAfterRefund,
            });

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
                remainingAfterRefund,

              credit_refunded:
                true,

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


/*
 * =========================================================
 * MEMENTO 002-08 — CRÉDITS DE TEST
 * =========================================================
 */

function normalizeCreditCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase();
}

function ensureCreditFields(state) {
  if (!Array.isArray(state.credit_history)) {
    state.credit_history = [];
  }

  if (
    !state.pending_credit_request ||
    typeof state.pending_credit_request !== 'object'
  ) {
    state.pending_credit_request = null;
  }

  return state;
}

function createCreditRequestCode() {
  return (
    'MOM-' +
    require('crypto')
      .randomBytes(5)
      .toString('hex')
      .toUpperCase()
  );
}

function getRechargeSecret() {
  const secret = String(
    process.env.MOMENT_ALPHA_RECHARGE_SECRET || ''
  ).trim();

  if (!secret) {
    const error = new Error(
      'Secret de recharge serveur non configuré'
    );
    error.code = 'RECHARGE_SECRET_MISSING';
    error.status = 503;
    throw error;
  }

  return secret;
}

function createCreditRequest(deviceId) {
  const cleanDeviceId = normalizeDeviceId(deviceId);

  if (!cleanDeviceId) {
    const error = new Error('Identifiant appareil manquant');
    error.code = 'MISSING_DEVICE_ID';
    error.status = 400;
    throw error;
  }

  const store = readStore();
  const state = ensureCreditFields(
    getOrCreateDevice(store, cleanDeviceId)
  );

  if (
    state.pending_credit_request &&
    state.pending_credit_request.status === 'pending'
  ) {
    writeStore(store);
    return {
      created: false,
      request: state.pending_credit_request,
    };
  }

  const now = new Date().toISOString();

  state.pending_credit_request = {
    request_code: createCreditRequestCode(),
    status: 'pending',
    created_at: now,
    updated_at: now,
  };

  state.updated_at = now;
  writeStore(store);

  logDiagnostic({
    diagnostic_id: '',
    feature: 'alpha_credit',
    event: 'alpha_credit_request_created',
    device_id: cleanDeviceId,
    request_code: state.pending_credit_request.request_code,
  });

  return {
    created: true,
    request: state.pending_credit_request,
  };
}

function getCreditRequestStatus(deviceId) {
  const cleanDeviceId =
    normalizeDeviceId(
      deviceId
    );

  if (!cleanDeviceId) {
    return {
      credit_needed:
        true,

      pending:
        false,

      request:
        null,

      quota_snapshot:
        null,
    };
  }

  const store =
    readStore();

  const state =
    ensureCreditFields(
      getOrCreateDevice(
        store,
        cleanDeviceId
      )
    );

  writeStore(
    store
  );

  const remaining =
    getRemaining(
      state
    );

  const creditHistory =
    Array.isArray(
      state.credit_history
    )
      ? state.credit_history
      : [];

  const rechargeCount =
    creditHistory.length;

  const totalRecharged =
    creditHistory.reduce(
      (
        total,
        item
      ) =>
        total +
        Number(
          item
            ?.credits_added ||
          0
        ),
      0
    );

  return {
    credit_needed:
      remaining <= 0,

    pending:
      Boolean(
        state.pending_credit_request &&
        state.pending_credit_request.status ===
          'pending'
      ),

    request:
      state.pending_credit_request &&
      state.pending_credit_request.status ===
        'pending'
        ? state.pending_credit_request
        : null,

    /*
     * Snapshot technique envoyé au téléphone.
     *
     * Il N'EST PAS affiché au testeur.
     * Il sert à la synchronisation et au feedback.
     */
    quota_snapshot: {
      synced_at:
        new Date()
          .toISOString(),

      initial_quota:
        Number(
          state.initial_quota ||
          0
        ),

      credits_granted:
        Number(
          state.credits_granted ||
          0
        ),

      credits_used:
        Number(
          state.credits_used ||
          0
        ),

      credits_remaining:
        remaining,

      recharge_count:
        rechargeCount,

      total_recharged:
        totalRecharged,

      usage:
        state.usage || {
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
    },
  };
}

function findPendingRequest(requestCode) {
  const cleanRequest = normalizeCreditCode(requestCode);
  const store = readStore();

  for (const state of Object.values(store.devices || {})) {
    ensureCreditFields(state);

    if (
      state.pending_credit_request &&
      state.pending_credit_request.status === 'pending' &&
      normalizeCreditCode(
        state.pending_credit_request.request_code
      ) === cleanRequest
    ) {
      return {
        store,
        state,
      };
    }
  }

  return null;
}

function buildRechargeSignature(
  requestCode,
  deviceId,
  credits
) {
  return require('crypto')
    .createHmac(
      'sha256',
      getRechargeSecret()
    )
    .update(
      [
        normalizeCreditCode(requestCode),
        normalizeDeviceId(deviceId),
        String(credits),      ].join(':')
    )
    .digest('hex')
    .slice(0, 20)
    .toUpperCase();
}

function createRechargeCode(requestCode, credits) {
  const amount = Math.floor(Number(credits));

  if (
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 1000
  ) {
    throw new Error('Nombre de crédits invalide');
  }

  const found = findPendingRequest(requestCode);

  if (!found) {
    const error = new Error(
      'Demande introuvable ou déjà traitée'
    );
    error.code = 'CREDIT_REQUEST_NOT_FOUND';
    throw error;
  }

  const signature = buildRechargeSignature(
    found.state.pending_credit_request.request_code,
    found.state.device_id,
    amount
  );

  return 'MRC-' + amount + '-' + signature;
}

function redeemRechargeCode(deviceId, rechargeCode) {
  const cleanDeviceId = normalizeDeviceId(deviceId);
  const cleanRecharge = normalizeCreditCode(rechargeCode);

  if (!cleanDeviceId) {
    const error = new Error('Identifiant appareil manquant');
    error.code = 'MISSING_DEVICE_ID';
    error.status = 400;
    throw error;
  }

  const match = cleanRecharge.match(
    /^MRC-(\d{1,4})-([A-F0-9]{20})$/
  );

  if (!match) {
    const error = new Error('Code de recharge invalide');
    error.code = 'INVALID_RECHARGE_CODE';
    error.status = 400;
    throw error;
  }

  const credits = Number(match[1]);

  if (credits <= 0 || credits > 1000) {
    const error = new Error('Nombre de crédits invalide');
    error.code = 'INVALID_RECHARGE_AMOUNT';
    error.status = 400;
    throw error;
  }

  const store = readStore();
  const state = ensureCreditFields(
    getOrCreateDevice(store, cleanDeviceId)
  );
  const request = state.pending_credit_request;

  if (!request || request.status !== 'pending') {
    const error = new Error(
      'Aucune demande de crédit en attente'
    );
    error.code = 'NO_PENDING_CREDIT_REQUEST';
    error.status = 409;
    throw error;
  }

  const expectedSignature = buildRechargeSignature(
    request.request_code,
    cleanDeviceId,
    credits
  );

  const received = Buffer.from(match[2], 'utf8');
  const expected = Buffer.from(expectedSignature, 'utf8');

  const valid =
    received.length === expected.length &&
    require('crypto').timingSafeEqual(
      received,
      expected
    );

  if (!valid) {
    const error = new Error(
      'Ce code ne correspond pas à cette demande'
    );
    error.code = 'INVALID_RECHARGE_SIGNATURE';
    error.status = 403;
    throw error;
  }

  const now = new Date().toISOString();

  state.credits_granted =
    Number(state.credits_granted || 0) + credits;

  state.credit_history.push({
    request_code: request.request_code,
    credits_added: credits,
    redeemed_at: now,
  });

  state.pending_credit_request = {
    ...request,
    status: 'redeemed',
    credits_added: credits,
    redeemed_at: now,
    updated_at: now,
  };

  state.updated_at = now;
  writeStore(store);

  logDiagnostic({
    diagnostic_id: '',
    feature: 'alpha_credit',
    event: 'alpha_credit_redeemed',
    device_id: cleanDeviceId,
    request_code: request.request_code,
    credits_added: credits,
    credits_remaining: getRemaining(state),
  });

  return {
    ok: true,
    credits_added: credits,
  };
}

function getQuotaFeedbackSnapshot(deviceId) {
  const cleanDeviceId =
    normalizeDeviceId(
      deviceId
    );

  if (!cleanDeviceId) {
    return {
      available:
        false,

      reason:
        'missing_device_id',
    };
  }

  const store =
    readStore();

  const state =
    ensureCreditFields(
      getOrCreateDevice(
        store,
        cleanDeviceId
      )
    );

  writeStore(
    store
  );

  const history =
    Array.isArray(
      state.credit_history
    )
      ? state.credit_history
      : [];

  const rechargeCount =
    history.length;

  const totalRecharged =
    history.reduce(
      (
        total,
        item
      ) =>
        total +
        Number(
          item
            ?.credits_added ||
          0
        ),
      0
    );

  const remaining =
    getRemaining(
      state
    );

  return {
    available:
      true,

    initial_quota:
      Number(
        state.initial_quota ||
        0
      ),

    credits_granted:
      Number(
        state.credits_granted ||
        0
      ),

    credits_used:
      Number(
        state.credits_used ||
        0
      ),

    credits_remaining:
      remaining,

    recharge_count:
      rechargeCount,

    total_recharged:
      totalRecharged,

    tester_status:
      rechargeCount === 0
        ? 'NEW'
        : remaining <= 0
          ? 'RECHARGE_REQUIRED'
          : 'ACTIVE',

    usage:
      state.usage || {},

    pending_credit_request:
      state.pending_credit_request &&
      state.pending_credit_request.status ===
        'pending'
        ? {
            request_code:
              state.pending_credit_request
                .request_code,

            created_at:
              state.pending_credit_request
                .created_at,

            status:
              'pending',
          }
        : null,

    credit_history:
      history.map(
        item => ({
          request_code:
            item
              ?.request_code ||
            '',

          credits_added:
            Number(
              item
                ?.credits_added ||
              0
            ),

          redeemed_at:
            item
              ?.redeemed_at ||
            null,
        })
      ),
  };
}

module.exports = {
  DEFAULT_OPENAI_QUOTA,
  createQuotaOpenAI,
  getQuotaSnapshot,
  createCreditRequest,
  getCreditRequestStatus,
  createRechargeCode,
  redeemRechargeCode,
  getQuotaFeedbackSnapshot,
};
