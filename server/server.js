/*
 * =========================================================
 * MOMENT — SERVER
 * =========================================================
 * VERSION : pré-0.1.0 — corrections RDV + horaires +
 * présence + déductions + chronologie
 * =========================================================
 */

require('dotenv').config({
  path: __dirname + '/.env',
});

const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const {
  normalizeText,
  escapeRegExp,
  createId,
  getCreatedAt,
  getMemoryId,
  getMemoryText,
} = require('./utils/core');

const {
  PARIS_TIMEZONE,
  DAYS,
  DAY_TO_INDEX,
  MONTHS,
  getCurrentParisDate,
  parseISODate,
  formatISODate,
  getWeekdayIndexFromISO,
  shiftISODate,
  resolveWeekdayToDate,
  extractExplicitDateFromText,
  extractCalendarDateFromText,
  getWeekStartISODate,
  getRelativePeriodFromText,
  extractRelativeTimeReference,
  getMemoryCalendarDate,
  enrichMemoryWithCalendarDate,
  getTemporalSortValue,
  getDaysFromTemporalQuestion,
  getISOWeekRange,
  buildTemporalQuestionContext,
} = require('./utils/calendar');

const {
  KNOWN_PEOPLE,
  memoryContainsPerson,
  memoryContainsDay,
  getMemoryLocation,
  memoryIsAboutWork,
  memoryIsAppointmentLike,
  getMemoryTimes,
  normalizeTimeValue,
  extractSituation,
  getDaysFromQuestion,
  findPersonInQuestion,
  findDayInQuestion,
  isHistoricalQuestion,
  isCurrentStateQuestion,
} = require('./utils/memory');

const {
  isDeduction,
  getDeductionStatus,
  isRejectedDeduction,
  isPendingDeduction,
  isValidatedDeduction,
  isUsableExplicitMemory,
  isUsableValidatedDeduction,
  getDeductionSourceIds,
  getValidatedDeductionText,
  tokenizeForMatching,
  getImportantQuestionWords,
  selectRelevantMemoriesForQuestion,
  getValidationHistory,
  getRefutationHistory,
  isRefutationText,
  isValidationText,
  findDeductionForRefutation,
  findDeductionForValidation,
  rejectDeduction,
  validateDeduction,
} = require('./utils/deductions');

const {
  isWithMeQuestion,
  findPersonDayMemories,
  explicitlyIndicatesTogether,
} = require('./utils/presence');

const {
  findContradiction,
  buildCorrectedMemory,
  isCorrectionRequest,
  correctionContextMatchesMemory,
  correctionDateMatchesMemory,
  memoryMatchesCalendarDate,
  correctionOldValueMatchesMemory,
  scoreCorrectionCandidate,
  buildCorrectionCandidates,
  buildCorrectedDescription,
  buildCorrectionHistoryEntry,
} = require('./utils/corrections');

const {
  findWorkEvents,
  findLatestWorkEvent,
} = require('./utils/work');

const {
  getCorrectionHistory,
  buildHistoricalAnswer,
  collectValidatedClaims,
  collectValidatedDeductions,
  findValidatedDeductionForQuestion,
  buildValidatedDeductionAnswer,
} = require('./utils/history');
const {
  getDiagnosticsByIds,
} = require('./utils/diagnostics');

const {
  logDiagnostic:
    logTransportDiagnostic,

  sanitizeDiagnosticPayload:
    sanitizeTransportDiagnosticPayload,
} = require('./utils/diagnostics');

const {
  createCreditRequest,
  getCreditRequestStatus,
  redeemRechargeCode,
  getQuotaFeedbackSnapshot,
} = require('./utils/openai-alpha-quota');

const app = express();

app.use(cors());
app.use(express.json());


/*
 * =========================================================
 * DIAGNOSTIC TRANSPORT
 * =========================================================
 *
 * Ce middleware garantit une trace minimale
 * même si une route métier retourne plus tôt
 * que prévu.
 */

app.use(
  (
    req,
    res,
    next
  ) => {
    if (
      req.path !==
        '/understand' &&
      req.path !==
        '/recall'
    ) {
      return next();
    }

    const diagnosticId =
      typeof req.body
        ?.diagnostic_id ===
        'string'
        ? req.body
            .diagnostic_id
            .trim()
        : '';

    if (
      !diagnosticId
    ) {
      return next();
    }

    const startedAt =
      Date.now();

    logTransportDiagnostic({
      diagnostic_id:
        diagnosticId,

      feature:
        req.path ===
          '/understand'
          ? 'understand'
          : 'recall',

      event:
        'transport_request',

      input:
        req.body?.text ||
        req.body?.question ||
        '',
    });

    const originalJson =
      res.json.bind(
        res
      );

    res.json =
      payload => {
        logTransportDiagnostic({
          diagnostic_id:
            diagnosticId,

          feature:
            req.path ===
              '/understand'
              ? 'understand'
              : 'recall',

          event:
            'transport_response',

          duration_ms:
            Date.now() -
            startedAt,

          status_code:
            res.statusCode,

          diagnostic_payload:
            sanitizeTransportDiagnosticPayload(
              payload
            ),
        });

        return originalJson(
          payload
        );
      };

    return next();
  }
);

const {
  registerRecallRoute,
} = require('./routes/recall');

const {
  registerUnderstandRoute,
} = require('./routes/understand');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* ========================================================= */
/* OUTILS                                                     */
/* ========================================================= */

/* ========================================================= */
/* ACCUEIL                                                     */
/* ========================================================= */

app.get(
  '/',
  (req, res) => {
    res.json({
      message:
        'Le cerveau de Moment fonctionne !',
    });
  }
);

registerUnderstandRoute(
  app,
  openai
);

registerRecallRoute(
  app,
  openai
);


/* ========================================================= */
/* CRÉDITS DE TEST — MEMENTO 002-08                           */
/* ========================================================= */

app.post(
  '/alpha-credit/status',
  (req, res) => {
    try {
      return res.json(
        getCreditRequestStatus(
          req.body?.moment_device_id
        )
      );
    } catch (error) {
      return res
        .status(error?.status || 500)
        .json({
          error: error?.message || 'Statut indisponible.',
          code: error?.code || 'ALPHA_CREDIT_STATUS_ERROR',
        });
    }
  }
);

app.post(
  '/alpha-credit/request',
  (req, res) => {
    try {
      return res.json(
        createCreditRequest(
          req.body?.moment_device_id
        )
      );
    } catch (error) {
      return res
        .status(error?.status || 500)
        .json({
          error: error?.message || 'Demande impossible.',
          code: error?.code || 'ALPHA_CREDIT_REQUEST_ERROR',
        });
    }
  }
);

app.post(
  '/alpha-credit/redeem',
  (req, res) => {
    try {
      return res.json(
        redeemRechargeCode(
          req.body?.moment_device_id,
          req.body?.recharge_code
        )
      );
    } catch (error) {
      return res
        .status(error?.status || 500)
        .json({
          error: error?.message || 'Code refusé.',
          code: error?.code || 'ALPHA_CREDIT_REDEEM_ERROR',
        });
    }
  }
);

app.post(
  '/alpha-credit/feedback',
  (req, res) => {
    try {
      return res.json(
        getQuotaFeedbackSnapshot(
          req.body?.moment_device_id
        )
      );
    } catch (error) {
      return res
        .status(error?.status || 500)
        .json({
          available: false,
          error: error?.message || 'Données indisponibles.',
        });
    }
  }
);

/* ========================================================= */
/* EXPORT DIAGNOSTIC ALPHA                                    */
/* ========================================================= */

app.post(
  '/diagnostics/export',
  (req, res) => {
    const ids =
      Array.isArray(
        req.body?.diagnostic_ids
      )
        ? req.body
            .diagnostic_ids
        : [];

    const entries =
      getDiagnosticsByIds(
        ids
      );

    return res.json({
      generated_at:
        new Date()
          .toISOString(),

      requested_ids:
        ids,

      diagnostic_count:
        entries.length,

      diagnostics:
        entries,
    });
  }
);

/* ========================================================= */
/* SERVEUR                                                    */
/* ========================================================= */

const PORT =
  process.env.PORT ||
  3000;

app.listen(
  PORT,
  '0.0.0.0',
  () => {
    console.log(
      `🧠 Serveur Moment lancé sur le port ${PORT}`
    );

    console.log(
      '🚨 VERSION STRICTE PRESENCE + DEDUCTIONS VALIDEES ACTIVE'
    );

    console.log(
      '✏️ CORRECTIONS RDV + HORAIRES DE TRAVAIL ACTIVEES'
    );

    console.log(
      '📅 ANCRAGE CALENDAIRE RÉEL ACTIF'
    );

    console.log(
      '🗓️ Date Paris actuelle :',
      getCurrentParisDate()
    );
  }
);