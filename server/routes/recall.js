/*
 * =========================================================
 * MOMENT — ROUTE /RECALL
 * MEMENTO 001-09
 * =========================================================
 *
 * Extraction structurelle depuis server/server.js.
 * La logique interne de la route est conservée.
 */


const {
  logDiagnostic,
  sanitizeDiagnosticPayload,
  serializeError,
  summarizeResponse,
} = require('../utils/diagnostics');
const helpers = {
  ...require('../utils/calendar'),
  ...require('../utils/core'),
  ...require('../utils/corrections'),
  ...require('../utils/deductions'),
  ...require('../utils/history'),
  ...require('../utils/memory'),
  ...require('../utils/presence'),
  ...require('../utils/work'),
};

const {
  DAYS,
  DAY_TO_INDEX,
  KNOWN_PEOPLE,
  MONTHS,
  PARIS_TIMEZONE,
  buildCorrectedDescription,
  buildCorrectedMemory,
  buildCorrectionCandidates,
  buildCorrectionHistoryEntry,
  buildHistoricalAnswer,
  buildTemporalQuestionContext,
  buildValidatedDeductionAnswer,
  collectValidatedClaims,
  collectValidatedDeductions,
  correctionContextMatchesMemory,
  correctionDateMatchesMemory,
  correctionOldValueMatchesMemory,
  createId,
  enrichMemoryWithCalendarDate,
  escapeRegExp,
  explicitlyIndicatesTogether,
  extractCalendarDateFromText,
  extractExplicitDateFromText,
  extractRelativeTimeReference,
  extractSituation,
  findContradiction,
  findDayInQuestion,
  findDeductionForRefutation,
  findDeductionForValidation,
  findLatestWorkEvent,
  findPersonDayMemories,
  findPersonInQuestion,
  findValidatedDeductionForQuestion,
  findWorkEvents,
  formatISODate,
  getCorrectionHistory,
  getCreatedAt,
  getCurrentParisDate,
  getDaysFromQuestion,
  getDaysFromTemporalQuestion,
  getDeductionSourceIds,
  getDeductionStatus,
  getISOWeekRange,
  getImportantQuestionWords,
  getMemoryCalendarDate,
  getMemoryId,
  getMemoryLocation,
  getMemoryText,
  getMemoryTimes,
  getRefutationHistory,
  getRelativePeriodFromText,
  getTemporalSortValue,
  getValidatedDeductionText,
  getValidationHistory,
  getWeekStartISODate,
  getWeekdayIndexFromISO,
  isCorrectionRequest,
  isCurrentStateQuestion,
  isDeduction,
  isHistoricalQuestion,
  isPendingDeduction,
  isRefutationText,
  isRejectedDeduction,
  isUsableExplicitMemory,
  isUsableValidatedDeduction,
  isValidatedDeduction,
  isValidationText,
  isWithMeQuestion,
  memoryContainsDay,
  memoryContainsPerson,
  memoryIsAboutWork,
  memoryIsAppointmentLike,
  memoryMatchesCalendarDate,
  normalizeText,
  normalizeTimeValue,
  parseISODate,
  rejectDeduction,
  resolveWeekdayToDate,
  scoreCorrectionCandidate,
  selectRelevantMemoriesForQuestion,
  shiftISODate,
  tokenizeForMatching,
  validateDeduction
} = helpers;

function registerRecallRoute(
  app,
  openai
) {
/* ========================================================= */
/* RECALL                                                      */
/* ========================================================= */

app.post(
  '/recall',
  async (req, res) => {
    console.log(
      '\n🔎 ==============================='
    );

    console.log(
      '🔎 REQUÊTE /RECALL'
    );

    try {
      const {        question,
        memories,
        diagnostic_id,
      } = req.body;

      if (
        !question ||
        !Array.isArray(
          memories
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              'Question ou mémoire absente',
          });
      }
      const diagnosticId =
        typeof diagnostic_id ===
          'string' &&
        diagnostic_id.trim()
          ? diagnostic_id.trim()
          : createId(
              'diagnostic'
            );

      const requestStartedAt =
        Date.now();

      const originalJson =
        res.json.bind(
          res
        );

      res.json =
        payload => {
          logDiagnostic({
            diagnostic_id:
              diagnosticId,

            feature:
              'recall',

            event:
              'response',

            duration_ms:
              Date.now() -
              requestStartedAt,

            status_code:
              res.statusCode,

            summary:
              summarizeResponse(
                payload
              ),

            diagnostic_payload:
              sanitizeDiagnosticPayload(
                payload
              ),
          });

          return originalJson(
            payload
          );
        };

      logDiagnostic({
        diagnostic_id:
          diagnosticId,

        feature:
          'recall',

        event:
          'request_start',

        input:
          question.trim(),

        memory_count:
          memories.length,
      });


      console.log(
        '❓ Question :',
        question
      );

      console.log(
        `🧠 Recherche dans ${memories.length} événement(s)...`
      );

      const historical =
        isHistoricalQuestion(
          question
        );

      const current =
        isCurrentStateQuestion(
          question
        );

      const withMe =
        isWithMeQuestion(
          question
        );

      const temporalContext =
        buildTemporalQuestionContext(
          question
        );

      console.log(
        '📅 Date calendaire actuelle :',
        temporalContext.today
      );

      console.log(
        '🗓️ Contexte temporel :',
        temporalContext
      );

      console.log(
        '🕰️ Historique :',
        historical
      );

      console.log(
        '📌 État actuel :',
        current
      );

      console.log(
        '👥 Question "avec moi" :',
        withMe
      );

      console.log(
        '🧪 Question normalisée :',
        normalizeText(
          question
        )
      );

      /* =================================================== */
      /* BARRIÈRE PRÉSENCE                                   */
      /* =================================================== */

      if (withMe) {
        console.log(
          '🔒 BARRIÈRE PRÉSENCE ACTIVÉE — FALLBACK GPT INTERDIT'
        );

        const person =
          findPersonInQuestion(
            question
          );

        const day =
          findDayInQuestion(
            question
          );

        if (
          person &&
          day
        ) {
          const candidates =
            findPersonDayMemories(
              memories,
              person,
              day
            );

          const togetherMemory =
            candidates.find(
              memory =>
                explicitlyIndicatesTogether(
                  memory,
                  person
                )
            );

          if (
            togetherMemory
          ) {
            const displayPerson =
              person
                .charAt(0)
                .toUpperCase() +
              person.slice(
                1
              );

            return res.json({
              answer:
                `Oui — ${displayPerson} était explicitement avec toi ${day}.`,

              event_ids: [
                togetherMemory.id,
              ].filter(Boolean),

              confidence:
                1,

              evidence: [
                {
                  event_id:
                    togetherMemory.id ||
                    '',

                  status:
                    'explicit',

                  claim:
                    togetherMemory.description ||
                    togetherMemory.source_text ||
                    getMemoryText(
                      togetherMemory
                    ),
                },
              ],
            });
          }

          const mentionedMemory =
            candidates[0];

          if (
            mentionedMemory
          ) {
            const displayPerson =
              person
                .charAt(0)
                .toUpperCase() +
              person.slice(
                1
              );

            return res.json({
              answer:
                `Non confirmé : tu as mentionné ${displayPerson} ${day}, mais rien dans cette mémoire n'indique explicitement qu'il était avec toi.`,

              event_ids: [
                mentionedMemory.id,
              ].filter(Boolean),

              confidence:
                0,

              evidence: [
                {
                  event_id:
                    mentionedMemory.id ||
                    '',

                  status:
                    'not_confirmed',

                  claim:
                    mentionedMemory.description ||
                    mentionedMemory.source_text ||
                    getMemoryText(
                      mentionedMemory
                    ),
                },
              ],
            });
          }

          return res.json({
            answer:
              `Je n'ai aucune information permettant de confirmer que ${person} était avec toi ${day}.`,

            event_ids: [],

            confidence:
              0,

            evidence: [
              {
                event_id:
                  '',

                status:
                  'not_confirmed',

                claim:
                  "Aucune information explicite ne confirme sa présence avec toi.",
              },
            ],
          });
        }

        return res.json({
          answer:
            "Je n'ai pas suffisamment d'informations explicites pour confirmer que cette personne était avec toi.",

          event_ids: [],

          confidence:
            0,

          evidence: [
            {
              event_id:
                '',

              status:
                'not_confirmed',

              claim:
                "Aucune information explicite ne confirme sa présence avec toi.",
            },
          ],
        });
      }

      /* =================================================== */
      /* DÉDUCTIONS VALIDÉES                                 */
      /* =================================================== */

      const validatedDeduction =
        findValidatedDeductionForQuestion(
          memories,
          question
        );

      if (
        validatedDeduction
      ) {
        console.log(
          '✅ DÉDUCTION VALIDÉE TROUVÉE — FALLBACK GPT INTERDIT :',
          validatedDeduction.id
        );

        const answer =
          buildValidatedDeductionAnswer(
            validatedDeduction
          );

        const sourceIds =
          getDeductionSourceIds(
            validatedDeduction
          );

        return res.json({
          answer,

          event_ids: [
            validatedDeduction.id,
          ].filter(Boolean),

          confidence:
            1,

          evidence: [
            {
              event_id:
                validatedDeduction.id ||
                '',

              status:
                'validated',

              claim:
                getValidatedDeductionText(
                  validatedDeduction
                ),
            },
          ],

          deduction: {
            status:
              'validated',

            event_id:
              validatedDeduction.id ||
              '',

            source_event_ids:
              sourceIds,
          },
        });
      }

      /* =================================================== */
      /* ÉTAT ACTUEL / PLANNING                              */
      /* =================================================== */

      if (
        current &&
        !historical
      ) {
        const person =
          findPersonInQuestion(
            question
          );

        const day =
          findDayInQuestion(
            question
          );

        if (
          person &&
          day
        ) {
          const workEvents =
            findWorkEvents(
              memories,
              person,
              day
            );

          if (
            workEvents.length ===
            0
          ) {
            return res.json({
              answer:
                "Je n'ai pas d'information explicite dans ma mémoire pour cette situation.",

              event_ids: [],

              confidence:
                0,

              evidence: [
                {
                  event_id:
                    '',

                  status:
                    'not_confirmed',

                  claim:
                    "Aucune information explicite correspondante n'a été trouvée.",
                },
              ],
            });
          }

          const uniques =
            workEvents.filter(
              (
                item,
                index,
                array
              ) =>
                index ===
                array.findIndex(
                  other =>
                    other.memory
                      ?.description ===
                    item.memory
                      ?.description
                )
            );

          const displayPerson =
            person
              .charAt(0)
              .toUpperCase() +
            person.slice(
              1
            );

          if (
            uniques.length ===
            1
          ) {
            const item =
              uniques[0];

            const memory =
              item.memory;

            return res.json({
              answer:
                memory.description ||
                item.situation?.text ||
                `${displayPerson} travaille ${day}.`,

              event_ids: [
                memory.id,
              ].filter(Boolean),

              confidence:
                memory.confidence ??
                1,

              evidence: [
                {
                  event_id:
                    memory.id ||
                    '',

                  status:
                    'explicit',

                  claim:
                    memory.description ||
                    item.situation?.text ||
                    `${displayPerson} travaille ${day}.`,
                },
              ],
            });
          }

          const descriptionsUniques =
            [
              ...new Set(
                uniques
                  .map(
                    item =>
                      item.memory?.description ||
                      item.situation?.text ||
                      ''
                  )
                  .filter(Boolean)
              ),
            ];

          if (
            descriptionsUniques.length ===
            1
          ) {
            return res.json({
              answer:
                descriptionsUniques[0],

              event_ids:
                uniques
                  .map(
                    item =>
                      item.memory?.id
                  )
                  .filter(Boolean),

              confidence:
                Math.max(
                  ...uniques.map(
                    item =>
                      item.memory?.confidence ??
                      1
                  )
                ),

              evidence:
                uniques.map(
                  item => ({
                    event_id:
                      item.memory?.id ||
                      '',

                    status:
                      'explicit',

                    claim:
                      item.memory?.description ||
                      item.situation?.text ||
                      '',
                  })
                ),
            });
          }

          const lignes =
            descriptionsUniques.map(
              (
                description,
                index
              ) =>
                `${index + 1}. ${description}`
            );

          const eventIds =
            uniques
              .map(
                item =>
                  item.memory?.id
              )
              .filter(Boolean);

          const evidence =
            uniques.map(
              item => ({
                event_id:
                  item.memory?.id ||
                  '',

                status:
                  'explicit',

                claim:
                  item.memory?.description ||
                  item.situation?.text ||
                  '',
              })
            );

          return res.json({
            answer:
              `${displayPerson} travaille ${day}, mais plusieurs informations explicites existent dans ma mémoire :\n\n` +
              `${lignes.join('\n')}\n\n` +
              `Ces informations sont contradictoires ; je ne peux pas déterminer laquelle est correcte.`,

            event_ids:
              eventIds,

            confidence:
              1,

            evidence:
              evidence,
          });
        }
      }

      /* =================================================== */
      /* HISTORIQUE                                           */
      /* =================================================== */

      if (
        historical
      ) {
        const person =
          findPersonInQuestion(
            question
          );

        const day =
          findDayInQuestion(
            question
          );

        if (
          person &&
          day
        ) {
          const events =
            findWorkEvents(
              memories,
              person,
              day
            );

          if (
            events.length >
            0
          ) {
            if (
              events.length ===
              1
            ) {
              const memory =
                events[0].memory;

              const answer =
                buildHistoricalAnswer(
                  person,
                  day,
                  memory
                );

              const correctionHistory =
                getCorrectionHistory(
                  memory
                );

              const evidence =
                [];

              evidence.push({
                event_id:
                  memory.id ||
                  '',

                status:
                  'explicit',

                claim:
                  memory.description ||
                  events[0].situation
                    .text ||
                  answer,
              });

              for (
                const historyEntry of
                  correctionHistory
              ) {
                if (
                  historyEntry.previous_description
                ) {
                  evidence.push({
                    event_id:
                      memory.id ||
                      '',

                    status:
                      'explicit',

                    claim:
                      historyEntry.previous_description,
                  });
                }
              }

              return res.json({
                answer,

                event_ids: [
                  memory.id,
                ].filter(Boolean),

                confidence:
                  1,

                evidence,
              });
            }

            const descriptions =
              events
                .map(
                  item =>
                    item.memory?.description ||
                    item.situation?.text ||
                    ''
                )
                .filter(Boolean);

            return res.json({
              answer:
                'Tu as indiqué :\n\n' +
                descriptions
                  .map(
                    description =>
                      `• ${description}`
                  )
                  .join(
                    '\n'
                  ),

              event_ids:
                events
                  .map(
                    item =>
                      item.memory.id
                  )
                  .filter(Boolean),

              confidence:
                1,

              evidence:
                events.map(
                  item => ({
                    event_id:
                      item.memory.id ||
                      '',

                    status:
                      'explicit',

                    claim:
                      item.memory.description ||
                      item.situation.text,
                  })
                ),
            });
          }
        }
      }

/* =================================================== */
/* FALLBACK GPT                                         */
/* =================================================== */

/*
 * Présélection locale expérimentale.
 *
 * IMPORTANT :
 * pour l'instant cette sélection sert uniquement
 * à vérifier dans les logs quels souvenirs seraient
 * considérés comme pertinents.
 *
 * Le fallback GPT continue encore à utiliser
 * toutes les mémoires.
 */

const relevantMemories =
  selectRelevantMemoriesForQuestion(
    memories,
    question,
    20
  );

console.log(
  '🧠 Mémoires totales :',
  memories.length
);

console.log(
  '🎯 Mémoires présélectionnées :',
  relevantMemories.length
);

console.log(
  '🎯 IDs présélectionnés :',
  relevantMemories.map(
    memory =>
      memory.id
  )
);

console.log(
  '🎯 Descriptions présélectionnées :',
  relevantMemories.map(
    memory =>
      memory.description ||
      memory.source_text ||
      ''
  )
);

const validatedClaims =
  collectValidatedClaims(
    memories
  );

const validatedDeductions =
  collectValidatedDeductions(
    memories
  );

const enrichedMemories =
  memories.map(
    memory =>
      enrichMemoryWithCalendarDate(
        memory
      )
  );

      const chronologicalMemories =
        [
          ...enrichedMemories,
        ].sort(
          (a, b) =>
            getTemporalSortValue(
              a
            ) -
            getTemporalSortValue(
              b
            )
        );

      const memoriesForModel =
        chronologicalMemories.map(
          (
            memory,
            index
          ) => ({
            ...memory,

            _chronological_index:
              index + 1,

            _chronological_position:
              `${index + 1}/${chronologicalMemories.length}`,

            _calendar_date:
              getMemoryCalendarDate(
                memory
              ),

              _relative_period:
  getRelativePeriodFromText(
    memory.date_reference ||
    memory.source_text ||
    ''
  ),

            _calendar_date_source:
              memory.calendar_date
                ? 'stored_or_resolved'
                : 'not_available',

            _deduction_status:
              isDeduction(
                memory
              )
                ? getDeductionStatus(
                    memory
                  )
                : null,

            _source_event_ids:
              isDeduction(
                memory
              )
                ? getDeductionSourceIds(
                    memory
                  )
                : [],
          })
        );
      
      const prompt = `
Tu es le moteur de rappel de Moment.

DATE CALENDAIRE DE RÉFÉRENCE :
${temporalContext.today}

IMPORTANT :
Le serveur a calculé les dates calendaires des événements
lorsqu'une référence comme "dimanche", "lundi" ou "mardi"
était disponible.

Tu dois utiliser en priorité :

_calendar_date

pour raisonner sur l'ordre réel des événements.

Lorsqu'un événement contient
_relative_period, utilise exclusivement
les valeurs start et end de cette période
pour répondre aux questions temporelles.

Ne recalcule JAMAIS toi-même les dates
d'une période relative comme "la semaine prochaine",
"cette semaine" ou "la semaine dernière".

Le serveur a déjà calculé les bornes exactes.
Tu dois utiliser ces bornes telles quelles.

NE PAS confondre :

- created_at = date à laquelle la mémoire a été enregistrée ;
- _calendar_date = date réelle de l'événement.

Pour les questions temporelles, la chronologie doit être
basée sur _calendar_date lorsqu'elle existe.

CONTEXTE TEMPOREL CALCULÉ PAR LE SERVEUR :

${JSON.stringify(
  temporalContext,
  null,
  2
)}

RÈGLES ABSOLUES :

1. Un fait explicite est prioritaire.
2. Une déduction non validée ne doit jamais être présentée
   comme un fait.
3. Une déduction rejetée ne doit jamais être utilisée.
4. La réfutation d'une déduction ne réfute pas ses sources.
5. Ne déduis JAMAIS une présence avec l'utilisateur.

6. Ne révèle JAMAIS à l'utilisateur les identifiants internes,
   les noms de champs techniques ou les métadonnées internes
   des événements.

7. Les dates calendaires calculées par le serveur sont des
   informations internes utilisées pour raisonner.

   Ne révèle jamais que la date provient d'un calcul,
   d'un champ interne ou d'une "date calendrier".

8. La réponse destinée à l'utilisateur doit être formulée
   comme une réponse naturelle, et non comme une extraction
   brute de la base de données.

RÈGLE CRITIQUE DE PRÉSENCE :

"J'ai vu Marc lundi au restaurant."

ne permet PAS de répondre :

"Marc était avec toi lundi."

Cela permet seulement de répondre :

"Tu as vu Marc lundi au restaurant."

Pour répondre que Marc était avec l'utilisateur,
il faut une preuve explicitement relationnelle telle que :

"J'ai mangé avec Marc."
"J'ai déjeuné avec Marc."
"Marc était avec moi."
"Marc et moi étions ensemble."

Le fait que Marc soit au même restaurant,
au même endroit ou le même jour ne constitue PAS
une preuve qu'il était avec l'utilisateur.

Ne transforme jamais un statut "explicit" disant
"j'ai vu Marc" en statut "implied" disant
"j'étais avec Marc".

IMPORTANT POUR LES QUESTIONS DE COMPTAGE :

Si la question demande :

- combien de fois ;
- combien de jours ;
- entre X et Y ;
- depuis X ;
- tous les jours ;
- plusieurs jours consécutifs ;
- le plus récemment ;
- le dernier ;
- le premier ;

tu dois d'abord établir la chronologie calendaire
des événements.

Une absence d'événement pendant une période ne signifie
pas automatiquement qu'un événement n'a pas eu lieu.

Il faut distinguer :

- événements confirmés ;
- événements non documentés ;
- absence de preuve.

Une déduction ayant le statut "validated" est une
information validée par l'utilisateur.

Elle doit être considérée comme acquise.

Ne transforme pas une déduction validée en
"probable", "possible", "non confirmé" ou
"déduction non validée".

Question :

${question}

Événements :

${JSON.stringify(
  memoriesForModel,
  null,
  2
)}

Éléments validés :

${JSON.stringify(
  validatedClaims,
  null,
  2
)}

Déductions validées :

${JSON.stringify(
  validatedDeductions,
  null,
  2
)}

RÈGLES DE PRÉSENTATION DE LA RÉPONSE :

Le champ "answer" est destiné directement à l'utilisateur.
Il ne doit contenir AUCUNE information technique interne.

INTERDIT dans "answer" :

- les identifiants de mémoire tels que memory_... ;
- les event_id ;
- les noms de champs internes ;
- les détails techniques utilisés par le serveur ;
- les références internes entre parenthèses ;
- les dates techniques qui ne sont pas utiles à l'utilisateur.

Tu peux utiliser une date normale en français lorsqu'elle
est utile à la compréhension de la réponse.

La réponse doit être naturelle, concise et compréhensible
par une personne qui utilise Moment.

IMPORTANT POUR LA STRUCTURE :

Lorsque la réponse contient plusieurs informations distinctes,
ne les rassemble pas inutilement dans un seul paragraphe.

Utilise des retours à la ligne et des puces lorsque cela
améliore la lisibilité.

N'utilise pas de numérotation artificielle du type
"(1)", "(2)", "(3)" lorsque de simples paragraphes ou
des puces sont plus lisibles.

Ne demande jamais à l'utilisateur comment il souhaite
que la réponse soit présentée.

Retourne uniquement :

{
  "answer": "",
  "event_ids": [],
  "confidence": 0,
  "evidence": []
}

Chaque evidence :

{
  "event_id": "",
  "status": "",
  "claim": ""
}

status :

"explicit"
"implied"
"not_confirmed"

Pour implied, event_id doit être "".

Une déduction rejetée ne doit jamais servir de preuve.
`;
      logDiagnostic({
        diagnostic_id:
          diagnosticId,

        feature:
          'recall',

        event:
          'openai_fallback',

        reason:
          'no_local_answer_returned',
      });


      const response =
        await openai.responses.create({
          model:
            'gpt-5-mini',

          input:
            prompt,
        });

let result;

try {
  const rawText =
    String(
      response.output_text || ''
    )
      .trim()
      .replace(
        /^```(?:json)?\s*/i,
        ''
      )
      .replace(
        /\s*```$/i,
        ''
      )
      .trim();

  result =
    JSON.parse(
      rawText
    );
} catch (error) {
  console.error(
    '❌ JSON rappel invalide :',
    response.output_text
  );

  console.error(
    '❌ Détail parsing rappel :',
    error
  );

  return res
    .status(500)
    .json({
      error:
        'Réponse de rappel invalide',
    });
}

      if (
        typeof result.answer !==
        'string'
      ) {
        result.answer =
          "Je n'ai pas suffisamment d'informations dans ma mémoire.";
      }

      if (
        !Array.isArray(
          result.event_ids
        )
      ) {
        result.event_ids =
          [];
      }

      if (
        !Array.isArray(
          result.evidence
        )
      ) {
        result.evidence =
          [];
      }

      if (
        typeof result.confidence !==
        'number'
      ) {
        result.confidence =
          0;
      }

      const validEventIds =
        new Set(
          memories
            .map(
              memory =>
                memory?.id
            )
            .filter(Boolean)
        );

      result.event_ids =
        result.event_ids.filter(
          id =>
            validEventIds.has(
              id
            )
        );

      result.evidence =
        result.evidence
          .filter(
            item =>
              item &&
              typeof item.event_id ===
                'string' &&
              typeof item.claim ===
                'string' &&
              [
                'explicit',
                'implied',
                'not_confirmed',
              ].includes(
                item.status
              )
          )
          .map(
            item => ({
              event_id:
                item.status ===
                'implied'
                  ? ''
                  : item.event_id,

              status:
                item.status,

              claim:
                item.claim.trim(),
            })
          )
          .filter(
            item => {
              if (
                item.status ===
                'implied'
              ) {
                return true;
              }

              if (
                item.status ===
                'not_confirmed'
              ) {
                return (
                  item.event_id ===
                    '' ||
                  validEventIds.has(
                    item.event_id
                  )
                );
              }

              return validEventIds.has(
                item.event_id
              );
            }
          );

      const evidenceIds =
        result.evidence
          .map(
            item =>
              item.event_id
          )
          .filter(Boolean);

      result.event_ids = [
        ...new Set([
          ...result.event_ids,
          ...evidenceIds,
        ]),
      ].filter(
        id =>
          validEventIds.has(
            id
          )
      );

      console.log(
        '💡 Réponse :',
        result.answer
      );

      console.log(
        '🆔 Event IDs :',
        result.event_ids
      );

      console.log(
        '====================================\n'
      );

      return res.json(
        result
      );

    } catch (error) {
      console.error(
        '❌ Erreur de rappel :',
        error
      );

      logDiagnostic({
        diagnostic_id:
          typeof diagnosticId !==
            'undefined'
            ? diagnosticId
            : diagnostic_id ||
              '',

        feature:
          'recall',

        event:
          'error',

        error:
          serializeError(
            error
          ),
      });

      return res
        .status(500)
        .json({
          error:
            'Erreur lors du rappel de la mémoire',
        });
    }
  }
);
}

module.exports = {
  registerRecallRoute,
};
