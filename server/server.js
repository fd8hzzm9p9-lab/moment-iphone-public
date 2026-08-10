/*
 * =========================================================
 * MOMENT â€” SERVER
 * =========================================================
 * VERSION : prÃ©-0.1.0 â€” corrections RDV + horaires +
 * prÃ©sence + dÃ©ductions + chronologie
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
  recordTesterHeartbeat,
  getTesterAdminSnapshot,
} = require('./utils/openai-alpha-quota');

const app = express();

app.use(cors());
app.use(express.json());
/*
 * =========================================================
 * ADMIN — TESTEURS MOMENT
 * =========================================================
 */

app.get(
  '/admin/testeurs',
  (req, res) => {
    const adminKey =
      String(
        process.env
          .MOMENT_ADMIN_KEY ||
        'moment-admin'
      );

    const providedKey =
      String(
        req.query.key ||
        ''
      );

    if (
      providedKey !==
      adminKey
    ) {
      return res
        .status(403)
        .send(
          'Accès refusé'
        );
    }

    const testers =
      getTesterAdminSnapshot();

    const formatDate =
      value => {
        if (!value) {
          return 'Jamais';
        }

        try {
          return new Intl
            .DateTimeFormat(
              'fr-FR',
              {
                timeZone:
                  'Europe/Paris',
                day:
                  '2-digit',
                month:
                  '2-digit',
                year:
                  'numeric',
                hour:
                  '2-digit',
                minute:
                  '2-digit',
                second:
                  '2-digit',
              }
            )
            .format(
              new Date(
                value
              )
            );
        } catch {
          return value;
        }
      };

    const activeCount =
      testers.filter(
        tester =>
          tester
            .presence_status ===
          'ACTIF'
      ).length;

    const recentCount =
      testers.filter(
        tester =>
          tester
            .presence_status ===
          'RECENT'
      ).length;
const testerNames = {
  '50e5003f': 'Nom du testeur 1',
  'xxxxxxxx': 'Nom du testeur 2',
  'yyyyyyyy': 'Nom du testeur 3',
};
    const rows =
      testers
        .map(
          tester => {
            const icon =
              tester
                .presence_status ===
              'ACTIF'
                ? '🟢'
                : tester
                      .presence_status ===
                    'RECENT'
                  ? '🟠'
                  : '⚫';

return `
  <div class="tester">
    <div class="title">
      ${icon}
${tester.tester_name}
    </div>

    <div>
      ID : ${tester.short_id}
    </div>

    <div>
      ${tester.presence_status}
    </div>

                <div>
                  Dernière activité :
                  <strong>
                    ${formatDate(
                      tester.last_seen_at
                    )}
                  </strong>
                </div>

                <div>
                  Crédits restants :
                  <strong>
                    ${tester.credits_remaining}
                  </strong>
                </div>

                <div>
                  Crédits utilisés :
                  ${tester.credits_used}
                </div>

                <div class="device">
                  ${tester.moment_device_id}
                </div>
              </div>
            `;
          }
        )
        .join('');

    res.send(`
      <!DOCTYPE html>

      <html lang="fr">

      <head>
        <meta charset="UTF-8">

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        >

        <title>
          Moment — Testeurs
        </title>

        <style>
          body {
            margin: 0;
            padding: 20px;
            font-family:
              -apple-system,
              BlinkMacSystemFont,
              "Segoe UI",
              sans-serif;
            background: #f4f4f4;
            color: #222;
          }

          h1 {
            margin-top: 0;
          }

          .summary {
            background: white;
            padding: 16px;
            border-radius: 14px;
            margin-bottom: 20px;
          }

          .tester {
            background: white;
            padding: 16px;
            margin-bottom: 12px;
            border-radius: 14px;
            line-height: 1.6;
          }

          .title {
            font-size: 21px;
            font-weight: 700;
          }

          .device {
            margin-top: 8px;
            font-size: 11px;
            opacity: 0.55;
            word-break: break-all;
          }
        </style>
      </head>

      <body>

        <h1>
          🧠 Moment — Testeurs
        </h1>

        <div class="summary">
          🟢 Actifs :
          <strong>${activeCount}</strong>

          <br>

          🟠 Récents :
          <strong>${recentCount}</strong>

          <br>

          👥 Total :
          <strong>${testers.length}</strong>
        </div>

        ${rows || '<p>Aucun testeur enregistré.</p>'}

      </body>

      </html>
    `);
  }
);

/*
 * =========================================================
 * DIAGNOSTIC TRANSPORT + JOURNAL TESTEUR LISIBLE
 * =========================================================
 *
 * Ce middleware :
 * - conserve les diagnostics techniques existants ;
 * - affiche un rÃ©sumÃ© humain pour /understand et /recall ;
 * - ne modifie aucune logique mÃ©tier ;
 * - exploite uniquement les donnÃ©es dÃ©jÃ  envoyÃ©es par l'app.
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

    const deviceId =
      typeof req.body
        ?.moment_device_id ===
        'string'
        ? req.body
            .moment_device_id
            .trim()
        : '';

    const input =
      String(
        req.body?.text ||
        req.body?.question ||
        ''
      ).trim();

    const feature =
      req.path ===
        '/understand'
        ? 'understand'
        : 'recall';

    const commandLabel =
      feature ===
        'understand'
        ? 'SOUVIENS-TOI'
        : 'RAPPELLE-MOI';

    const startedAt =
      Date.now();

    const parisDateTime =
      new Intl.DateTimeFormat(
        'fr-FR',
        {
          timeZone:
            'Europe/Paris',
          day:
            '2-digit',
          month:
            '2-digit',
          year:
            'numeric',
          hour:
            '2-digit',
          minute:
            '2-digit',
          second:
            '2-digit',
          hour12:
            false,
        }
      ).format(
        new Date()
      );

    const shortDeviceId =
      deviceId
        ? deviceId
            .replace(
              /^moment_/,
              ''
            )
            .slice(
              0,
              8
            )
        : 'inconnu';

    let creditsBefore =
      null;

    if (
      deviceId
    ) {
      try {
        const snapshot =
          getQuotaFeedbackSnapshot(
            deviceId
          );

        if (
          snapshot?.available &&
          Number.isFinite(
            Number(
              snapshot
                .credits_remaining
            )
          )
        ) {
          creditsBefore =
            Number(
              snapshot
                .credits_remaining
            );
        }
      } catch {
        creditsBefore =
          null;
      }
    }

    console.log('');
    console.log(
      'â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•'
    );

    console.log(
      'â•‘ ðŸ§ª ACTIVITÃ‰ TESTEUR MOMENT'
    );

    console.log(
      'â• â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•'
    );

    console.log(
      `â•‘ ðŸ‘¤ Testeur      : ${shortDeviceId}`
    );

    console.log(
      `â•‘ ðŸ†” Appareil     : ${deviceId || 'identifiant indisponible'}`
    );

    console.log(
      `â•‘ ðŸ• Heure        : ${parisDateTime}`
    );

    console.log(
      `â•‘ ðŸ§  Fonction     : ${commandLabel}`
    );

    console.log(
      'â•‘'
    );

    console.log(
      `â•‘ ðŸ“ Demande      : "${input}"`
    );

    if (
      creditsBefore !==
        null
    ) {
      console.log(
        `â•‘ ðŸ’³ CrÃ©dit avant : ${creditsBefore}`
      );
    }

    if (
      diagnosticId
    ) {
      logTransportDiagnostic({
        diagnostic_id:
          diagnosticId,

        feature,

        event:
          'transport_request',

        input,
      });
    }

    const originalJson =
      res.json.bind(
        res
      );

    let responseLogged =
      false;

    res.json =
      payload => {
        if (
          responseLogged
        ) {
          return originalJson(
            payload
          );
        }

        responseLogged =
          true;

        const durationMs =
          Date.now() -
          startedAt;

        let creditsAfter =
          null;

        if (
          deviceId
        ) {
          try {
            const snapshot =
              getQuotaFeedbackSnapshot(
                deviceId
              );

            if (
              snapshot?.available &&
              Number.isFinite(
                Number(
                  snapshot
                    .credits_remaining
                )
              )
            ) {
              creditsAfter =
                Number(
                  snapshot
                    .credits_remaining
                );
            }
          } catch {
            creditsAfter =
              null;
          }
        }

        if (
          diagnosticId
        ) {
          logTransportDiagnostic({
            diagnostic_id:
              diagnosticId,

            feature,

            event:
              'transport_response',

            duration_ms:
              durationMs,

            status_code:
              res.statusCode,

            diagnostic_payload:
              sanitizeTransportDiagnosticPayload(
                payload
              ),
          });
        }

        const successful =
          res.statusCode >=
            200 &&
          res.statusCode <
            300;

        let treatment =
          'INDÃ‰TERMINÃ‰';

        if (
          creditsBefore !==
            null &&
          creditsAfter !==
            null
        ) {
          treatment =
            creditsAfter <
              creditsBefore
              ? 'OPENAI UTILISÃ‰'
              : 'SANS CRÃ‰DIT OPENAI';
        }

        const resultLabel =
          successful
            ? (
                feature ===
                  'understand'
                  ? 'TRAITEMENT TERMINÃ‰'
                  : 'RÃ‰PONSE ENVOYÃ‰E'
              )
            : 'ERREUR';
        /*
         * MOMENT_READABLE_TESTER_LOG_V1
         * Resume lisible des elements compris/enregistres.
         */

        const readableEvents =
          Array.isArray(
            payload?.events
          )
            ? payload.events
            : [];

        const greenField =
          field =>
            `\x1b[32m{${field}}\x1b[0m`;

        const readableValue =
          value => {
            if (
              value === null ||
              value === undefined ||
              value === ''
            ) {
              return '-';
            }

            if (
              Array.isArray(
                value
              )
            ) {
              return value.length
                ? value.join(', ')
                : '-';
            }

            return String(value);
          };

        const readableCalendarDate =
          value => {
            const clean =
              String(
                value || ''
              ).trim();

            const match =
              clean.match(
                /^(\d{4})-(\d{2})-(\d{2})$/
              );

            if (!match) {
              return clean || '-';
            }

            return (
              `${match[3]}/` +
              `${match[2]}/` +
              `${match[1]}`
            );
          };

        const readableTemporalDirection =
          value => {
            if (value === 'past') {
              return 'Passe';
            }

            if (value === 'future') {
              return 'Futur';
            }

            if (value === 'present') {
              return 'Present';
            }

            return readableValue(value);
          };

        const readableLocalOnly =
          req.body?.local_only === true;

        const readableOpenAiUsed =
          creditsBefore !== null &&
          creditsAfter !== null &&
          creditsAfter < creditsBefore;

        const readableErrorCode =
          String(
            payload?.code || ''
          );

        const readableOpenAiFailed =
          !successful &&
          (
            readableErrorCode.startsWith(
              'OPENAI_'
            ) ||
            String(
              payload?.error || ''
            )
              .toLowerCase()
              .includes('openai')
          );

        const readableOpenAiLabel =
          readableOpenAiUsed
            ? 'OUI'
            : readableOpenAiFailed
              ? 'OUI - ECHEC'
              : 'NON';

        const readableModeLabel =
          readableLocalOnly
            ? 'LOCAL UNIQUEMENT'
            : 'LOCAL FIRST';

        if (
          feature === 'understand' &&
          successful &&
          readableEvents.length > 0
        ) {
          console.log('');
          console.log(
            '\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550'
          );

          console.log(
            `\u2551 \u{1F4BE} ELEMENTS COMPRIS / ENREGISTRES : ${readableEvents.length}`
          );

          console.log(
            '\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550'
          );

          readableEvents.forEach(
            (
              event,
              index
            ) => {
              console.log(
                '\u2551'
              );

              console.log(
                `\u2551 #${index + 1} ELEMENT`
              );

              console.log(
                `\u2551 \u{1F4DD} Source       : "${readableValue(event?.source_text)}"  ${greenField('source_text')}`
              );

              console.log(
                `\u2551 \u{1F9E0} Compris      : ${readableValue(event?.description)}  ${greenField('description')}`
              );

              console.log(
                `\u2551 \u{1F4C5} Date         : ${readableValue(event?.date_reference)}  ${greenField('date_reference')}`
              );

              console.log(
                `\u2551 \u{1F4C6} Date reelle  : ${readableCalendarDate(event?.calendar_date)}  ${greenField('calendar_date')}`
              );

              console.log(
                `\u2551 \u{1F570}\uFE0F Temporalite  : ${readableTemporalDirection(event?.temporal_direction)}  ${greenField('temporal_direction')}`
              );

              if (
                Array.isArray(event?.people) &&
                event.people.length > 0
              ) {
                console.log(
                  `\u2551 \u{1F464} Personne(s)  : ${readableValue(event.people)}  ${greenField('people')}`
                );
              }

              if (
                Array.isArray(event?.places) &&
                event.places.length > 0
              ) {
                console.log(
                  `\u2551 \u{1F4CD} Lieu(x)      : ${readableValue(event.places)}  ${greenField('places')}`
                );
              }

              if (
                Array.isArray(event?.actions) &&
                event.actions.length > 0
              ) {
                console.log(
                  `\u2551 \u{1F528} Action(s)    : ${readableValue(event.actions)}  ${greenField('actions')}`
                );
              }

              if (
                event?.confidence !== undefined
              ) {
                console.log(
                  `\u2551 \u{1F3AF} Confiance    : ${readableValue(event.confidence)}  ${greenField('confidence')}`
                );
              }
            }
          );

          console.log(
            '\u2551'
          );
        }

        console.log(
          '\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550'
        );

        console.log(
          '\u2551 \u{1F527} TRAITEMENT'
        );

        console.log(
          '\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550'
        );

        console.log(
          `\u2551 \u{1F9E9} Mode         : ${readableModeLabel}`
        );

        console.log(
          `\u2551 \u{1F916} OpenAI       : ${readableOpenAiLabel}`
        );


        console.log(
          'â•‘'
        );

        console.log(
          `â•‘ ðŸ¤– Traitement   : ${treatment}`
        );

        if (
          creditsBefore !==
            null &&
          creditsAfter !==
            null
        ) {
          console.log(
            `â•‘ ðŸ’³ CrÃ©dit       : ${creditsBefore} â†’ ${creditsAfter}`
          );
        }

        console.log(
          `â•‘ â±ï¸ DurÃ©e        : ${(durationMs / 1000).toFixed(1)} s`
        );

        console.log(
          `â•‘ ${successful ? 'âœ…' : 'âŒ'} RÃ©sultat      : ${resultLabel} (HTTP ${res.statusCode})`
        );

        if (
          !successful
        ) {
          const reason =
            payload?.code ||
            payload?.error ||
            payload?.message ||
            'Erreur non dÃ©taillÃ©e';

          console.log(
            `â•‘ âš ï¸ Motif        : ${String(reason)}`
          );
        }

        console.log(
          'â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•'
        );

        console.log('');

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

/* ========================================================= */
/* VERSION SERVEUR MOMENT                                    */
/* ========================================================= */

const {
  SERVER_VERSION,
  EXPECTED_APP_REVISION,
} = require(
  './config/version'
);

app.get(
  '/version',
  (req, res) => {
    res.json({
      server_version:
        SERVER_VERSION,

      expected_app_revision:
        EXPECTED_APP_REVISION,
    });
  }
);


/* ========================================================= */
/* RACINE                                                    */
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
/* CRÃ‰DITS DE TEST â€” MEMENTO 002-08                           */
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
          error: error?.message || 'Code refusÃ©.',
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
          error: error?.message || 'DonnÃ©es indisponibles.',
        });
    }
  }
);

/* ========================================================= */
/* PRÃ‰SENCE TESTEURS â€” HEARTBEAT                             */
/* ========================================================= */

app.post(
  '/alpha-presence/heartbeat',
  (req, res) => {
    try {
      return res.json(
        recordTesterHeartbeat(
          req.body?.moment_device_id
        )
      );
    } catch (error) {
      return res
        .status(
          error?.status ||
          500
        )
        .json({
          ok:
            false,

          error:
            error?.message ||
            'PrÃ©sence indisponible.',

          code:
            error?.code ||
            'ALPHA_PRESENCE_ERROR',
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
      `ðŸ§  Serveur Moment lancÃ© sur le port ${PORT}`
    );

    console.log(
      'ðŸš¨ VERSION STRICTE PRESENCE + DEDUCTIONS VALIDEES ACTIVE'
    );

    console.log(
      'âœï¸ CORRECTIONS RDV + HORAIRES DE TRAVAIL ACTIVEES'
    );

    console.log(
      'ðŸ“… ANCRAGE CALENDAIRE RÃ‰EL ACTIF'
    );

    console.log(
      'ðŸ—“ï¸ Date Paris actuelle :',
      getCurrentParisDate()
    );
  }
);