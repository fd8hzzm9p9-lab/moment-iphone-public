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
const app = express();

app.use(cors());
app.use(express.json());

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

/* ========================================================= */
/* UNDERSTAND                                                  */
/* ========================================================= */

function isDeterministicRelativeDateReference(
  dateReference
) {
  if (
    !dateReference ||
    typeof dateReference !==
      'string'
  ) {
    return false;
  }

  const normalized =
    normalizeText(
      dateReference
    )
      .trim()
      .replace(
        /\s+/g,
        ' '
      );

  const deterministicReferences = [
    'aujourd hui',
    "aujourd'hui",
    'demain',
    'apres demain',
    'après demain',
    'hier',
    'avant hier',
    'avant-hier',
  ];

  if (
    deterministicReferences.includes(
      normalized
    )
  ) {
    return true;
  }

  if (
    /^dans\s+\d+\s+jours?$/.test(
      normalized
    )
  ) {
    return true;
  }

  return false;
}

app.post(
  '/understand',
  async (req, res) => {
    console.log(
      '\n📥 ==============================='
    );

    console.log(
      '📥 REQUÊTE /UNDERSTAND'
    );

    try {
      const {
        text,
        memories,
        confirmed_calendar_date,
      } = req.body;

      if (
        !text ||
        !text.trim()
      ) {
        return res
          .status(400)
          .json({
            error:
              'Aucun texte reçu',
          });
      }

      const existingMemories =
        Array.isArray(memories)
          ? memories
          : [];

      const normalizedText =
        normalizeText(
          text
        );

      console.log(
        '🧪 TEST CORRECTION :',
        text.trim(),
        '=>',
        isCorrectionRequest(
          text
        )
      );

      console.log(
        '📝 Texte :',
        text.trim()
      );

      console.log(
        '🧠 Mémoires existantes :',
        existingMemories.length
      );

      /* =================================================== */
      /* CORRECTION D'UNE INFORMATION EXISTANTE              */
      /* =================================================== */

      if (
        isCorrectionRequest(
          text
        )
      ) {
        console.log(
          '✏️ DEMANDE DE CORRECTION DÉTECTÉE'
        );

        const correctionPrompt = `
Tu es le moteur de compréhension des corrections de l'application Moment.

L'utilisateur demande de modifier une information qui peut déjà
exister dans sa mémoire.

Analyse UNIQUEMENT la demande de correction.

Ne crée aucune information absente du texte.

Retourne UNIQUEMENT ce JSON :

{
  "person": "",
  "date_reference": "",
  "day_reference": "",
  "context": "",
  "old_value": "",
  "new_value": "",
  "old_time": "",
  "new_time": "",
  "old_time_start": "",
  "old_time_end": "",
  "new_time_start": "",
  "new_time_end": ""
}

RÈGLES :

- person = personne explicitement concernée.
- date_reference = date explicitement indiquée.
- day_reference = jour de semaine explicitement indiqué.
- context = objet ou contexte de l'information à modifier
  (exemples : rendez-vous, visite, réunion, travail, anniversaire).
- old_value = ancienne information explicitement indiquée.
- new_value = nouvelle information explicitement demandée.

Pour les heures simples :
- old_time = ancienne heure.
- new_time = nouvelle heure.

Pour une plage horaire :
- old_time_start = ancienne heure de début.
- old_time_end = ancienne heure de fin.
- new_time_start = nouvelle heure de début.
- new_time_end = nouvelle heure de fin.

IMPORTANT :

Dans :

"Corrige le rendez-vous de Julien du 12 août à 10h pour le mettre à 11h."

la personne est Julien.
la date est "12 août".
l'ancienne heure est "10h".
la nouvelle heure est "11h".

Le nombre "12" de la date NE DOIT JAMAIS être considéré
comme une heure.

Dans :

"Marc travaille le lundi de 9h à 18h au lieu de 10h à 17h."

l'ancienne plage est :
9h → 18h

la nouvelle plage est :
10h → 17h.

Dans :

"La réunion avec Sophie de vendredi à 9h est finalement à 10h."

ancienne heure = 9h
nouvelle heure = 10h.

Dans :

"Modifie la visite de Marc prévue mardi à 14h pour 15h."

ancienne heure = 14h
nouvelle heure = 15h.

IMPORTANT POUR LES FORMULATIONS "AU LIEU DE" :

Dans :
"Marc travaille le lundi de 10h à 17h au lieu de 9h à 18h."

ancienne plage = 9h → 18h
nouvelle plage = 10h → 17h.

Dans :
"Marc travaille de 9h à 18h au lieu de 10h à 17h."

ancienne plage = 10h → 17h
nouvelle plage = 9h → 18h.

Le segment introduit par "au lieu de" est l'information
ancienne/corrigée lorsque la formulation dit d'abord
la nouvelle information puis "au lieu de" l'ancienne.

Si une information n'est pas explicitement présente,
laisse le champ vide.

Texte utilisateur :

${text.trim()}
`;

        let correctionData;

        try {
          const correctionResponse =
            await openai.responses.create({
              model:
                'gpt-5-mini',

              input:
                correctionPrompt,
            });

const rawCorrectionText =
  String(
    correctionResponse.output_text || ''
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

correctionData =
  JSON.parse(
    rawCorrectionText
  );
        } catch (error) {
          console.error(
            '❌ Impossible de comprendre la correction :',
            error
          );

          return res
            .status(500)
            .json({
              error:
                'Impossible de comprendre la demande de correction',
            });
        }

        correctionData =
          correctionData &&
          typeof correctionData ===
            'object'
            ? correctionData
            : {};

        const correctionPerson =
          correctionData.person
            ? normalizeText(
                correctionData.person
              ).trim()
            : '';

        const correctionDate =
          correctionData.date_reference
            ? normalizeText(
                correctionData.date_reference
              ).trim()
            : '';

        const correctionDay =
          correctionData.day_reference
            ? normalizeText(
                correctionData.day_reference
              ).trim()
            : '';

        const correctionContext =
          correctionData.context
            ? normalizeText(
                correctionData.context
              ).trim()
            : '';

        let oldTime =
          correctionData.old_time
            ? correctionData.old_time.trim()
            : '';

        let newTime =
          correctionData.new_time
            ? correctionData.new_time.trim()
            : '';

        let oldStart =
          correctionData.old_time_start
            ? correctionData.old_time_start.trim()
            : '';

        let oldEnd =
          correctionData.old_time_end
            ? correctionData.old_time_end.trim()
            : '';

        let newStart =
          correctionData.new_time_start
            ? correctionData.new_time_start.trim()
            : '';

        let newEnd =
          correctionData.new_time_end
            ? correctionData.new_time_end.trim()
            : '';

        console.log(
          '🧠 CORRECTION COMPRISE :',
          correctionData
        );

        const person =
          correctionPerson ||
          findPersonInQuestion(
            text
          );

        const day =
          correctionDay ||
          findDayInQuestion(
            text
          );

        let dateReference =
          '';

        const explicitDate =
          extractExplicitDateFromText(
            text
          );

        if (
          explicitDate
        ) {
          dateReference =
            explicitDate;
        } else if (
          correctionDate
        ) {
          dateReference =
            correctionDate;
        }

        if (
          !dateReference &&
          correctionDate
        ) {
          const resolved =
            extractCalendarDateFromText(
              correctionDate
            );

          if (
            resolved
          ) {
            dateReference =
              resolved;
          }
        }

        let oldValue =
          correctionData.old_value
            ? correctionData.old_value.trim()
            : '';

        let newValue =
          correctionData.new_value
            ? correctionData.new_value.trim()
            : '';

        if (
          !oldValue &&
          oldTime
        ) {
          oldValue =
            oldTime;
        }

        if (
          !newValue &&
          newTime
        ) {
          newValue =
            newTime;
        }

        if (
          !oldValue &&
          oldStart &&
          oldEnd
        ) {
          oldValue =
            `${oldStart} à ${oldEnd}`;
        }

        if (
          !newValue &&
          newStart &&
          newEnd
        ) {
          newValue =
            `${newStart} à ${newEnd}`;
        }

        const normalizedRequest =
          normalizeText(
            text
          );

        if (
          normalizedRequest.includes(
            'au lieu de'
          )
        ) {
          const parts =
            normalizedRequest.split(
              'au lieu de'
            );

          if (
            parts.length >= 2
          ) {
            const before =
              parts[0];

            const after =
              parts
                .slice(1)
                .join(
                  ' au lieu de '
                );

            const timesBefore = [
              ...before.matchAll(
                /\b([01]?\d|2[0-3])h(?:([0-5]\d))?\b/gi
              ),
            ].map(
              match =>
                `${match[1]}h${
                  match[2] || ''
                }`
            );

            const timesAfter = [
              ...after.matchAll(
                /\b([01]?\d|2[0-3])h(?:([0-5]\d))?\b/gi
              ),
            ].map(
              match =>
                `${match[1]}h${
                  match[2] || ''
                }`
            );

            if (
              timesBefore.length ===
                1 &&
              timesAfter.length ===
                1
            ) {
              newTime =
                timesBefore[0];

              oldTime =
                timesAfter[0];

              oldValue =
                oldTime;

              newValue =
                newTime;
            }

            if (
              timesBefore.length ===
                2 &&
              timesAfter.length ===
                2
            ) {
              newStart =
                timesBefore[0];

              newEnd =
                timesBefore[1];

              oldStart =
                timesAfter[0];

              oldEnd =
                timesAfter[1];

              correctionData.new_time_start =
                newStart;

              correctionData.new_time_end =
                newEnd;

              correctionData.old_time_start =
                oldStart;

              correctionData.old_time_end =
                oldEnd;

              oldValue =
                `${oldStart} à ${oldEnd}`;

              newValue =
                `${newStart} à ${newEnd}`;
            }
          }
        }

        const normalizedCorrectionData = {
          ...correctionData,

          old_time:
            oldTime,

          new_time:
            newTime,

          old_time_start:
            oldStart,

          old_time_end:
            oldEnd,

          new_time_start:
            newStart,

          new_time_end:
            newEnd,
        };

        console.log(
          '🎯 CORRECTION NORMALISÉE :',
          {
            person,
            dateReference,
            day,
            context:
              correctionContext,
            oldValue,
            newValue,
            oldTime,
            newTime,
            oldStart,
            oldEnd,
            newStart,
            newEnd,
          }
        );

        const correction = {
          person,

          day,

          dateReference,

          correctionContext,

          oldValue,

          correctionData:
            normalizedCorrectionData,
        };

        let scoredCandidates =
          buildCorrectionCandidates(
            existingMemories,
            correction
          );

        if (
          scoredCandidates.length ===
            0 &&
          dateReference
        ) {
          const resolvedDate =
            extractCalendarDateFromText(
              dateReference
            );

          if (
            resolvedDate &&
            resolvedDate !==
              dateReference
          ) {
            correction.dateReference =
              resolvedDate;

            scoredCandidates =
              buildCorrectionCandidates(
                existingMemories,
                correction
              );
          }
        }

        if (
          scoredCandidates.length ===
            0 &&
          correctionContext ===
            'travail' &&
          person &&
          day
        ) {
          const workCandidates =
            findWorkEvents(
              existingMemories,
              person,
              day
            );

          scoredCandidates =
            workCandidates
              .map(
                item => ({
                  memory:
                    item.memory,

                  score:
                    scoreCorrectionCandidate(
                      item.memory,
                      correction
                    ),

                  times:
                    getMemoryTimes(
                      item.memory
                    ),
                })
              )
              .filter(
                item => {
                  if (
                    oldTime ||
                    oldStart ||
                    oldEnd ||
                    oldValue
                  ) {
                    return correctionOldValueMatchesMemory(
                      normalizedCorrectionData,
                      oldValue,
                      item.memory
                    );
                  }

                  return true;
                }
              )
              .sort(
                (a, b) =>
                  b.score -
                  a.score
              );
        }

        const uniqueById =
          new Map();

        for (
          const candidate of
            scoredCandidates
        ) {
          const id =
            candidate.memory?.id ||
            `candidate_${uniqueById.size}`;

          if (
            !uniqueById.has(
              id
            )
          ) {
            uniqueById.set(
              id,
              candidate
            );
          }
        }

        const uniqueCandidates =
          [
            ...uniqueById.values(),
          ];

        if (
          uniqueCandidates.length ===
          0
        ) {
          return res.json({
            input:
              text.trim(),

            events: [],

            conflict:
              null,

            correction_request: {
              detected:
                true,

              type:
                correctionContext ===
                'travail'
                  ? 'work_schedule'
                  : 'generic',

              person:
                person || '',

              date:
                dateReference || '',

              day:
                day || '',

              context:
                correctionContext || '',

              old_value:
                oldValue,

              new_value:
                newValue,

              old_time:
                oldTime || null,

              new_time:
                newTime || null,

              old_time_range:
                oldStart &&
                oldEnd
                  ? {
                      start:
                        oldStart,

                      end:
                        oldEnd,
                    }
                  : null,

              new_time_range:
                newStart &&
                newEnd
                  ? {
                      start:
                        newStart,

                      end:
                        newEnd,
                    }
                  : null,

              event_ids:
                [],

              memories:
                [],

              message:
                person
                  ? `Je ne trouve pas de souvenir correspondant pour ${person}.`
                  : `Je ne trouve pas de souvenir correspondant à cette demande de correction.`,
            },
          });
        }

        const best =
          uniqueCandidates[0];

        const second =
          uniqueCandidates[1];

        let selectedCandidate =
          null;

        if (
          uniqueCandidates.length ===
          1
        ) {
          selectedCandidate =
            best;
        } else {
          const bestScore =
            best.score || 0;

          const secondScore =
            second?.score || 0;

          const scoreGap =
            bestScore -
            secondScore;

          const exactOldTime =
            (
              oldTime &&
              timeAppearsInMemory(
                best.memory,
                oldTime
              )
            ) ||
            (
              oldStart &&
              oldEnd &&
              correctionOldValueMatchesMemory(
                normalizedCorrectionData,
                oldValue,
                best.memory
              )
            );

          if (
            exactOldTime &&
            scoreGap >= 10
          ) {
            selectedCandidate =
              best;
          } else if (
            scoreGap >= 25
          ) {
            selectedCandidate =
              best;
          }
        }

        if (
          !selectedCandidate
        ) {
          return res.json({
            input:
              text.trim(),

            events: [],

            conflict:
              null,

            correction_request: {
              detected:
                true,

              type:
                correctionContext ===
                'travail'
                  ? 'work_schedule'
                  : 'generic',

              person:
                person || '',

              date:
                dateReference || '',

              day:
                day || '',

              context:
                correctionContext || '',

              old_value:
                oldValue,

              new_value:
                newValue,

              old_time:
                oldTime || null,

              new_time:
                newTime || null,

              old_time_range:
                oldStart &&
                oldEnd
                  ? {
                      start:
                        oldStart,

                      end:
                        oldEnd,
                    }
                  : null,

              new_time_range:
                newStart &&
                newEnd
                  ? {
                      start:
                        newStart,

                      end:
                        newEnd,
                    }
                  : null,

              event_ids:
                uniqueCandidates
                  .map(
                    candidate =>
                      candidate.memory?.id
                  )
                  .filter(Boolean),

              memories:
                uniqueCandidates.map(
                  candidate => ({
                    id:
                      candidate.memory?.id ||
                      '',

                    description:
                      candidate.memory?.description ||
                      candidate.memory?.source_text ||
                      getMemoryText(
                        candidate.memory
                      ) ||
                      '',
                  })
                ),

              message:
                `J'ai trouvé plusieurs souvenirs pouvant correspondre à cette correction. Je ne peux pas déterminer lequel modifier avec certitude.`,
            },
          });
        }

        const memory =
          selectedCandidate.memory;

        const oldDescription =
          memory?.description ||
          memory?.source_text ||
          getMemoryText(
            memory
          ) ||
          '';

        /* =================================================== */
        /* CORRECTION DES HORAIRES DE TRAVAIL                  */
        /* =================================================== */

        if (
          correctionContext === 'travail' &&
          newStart &&
          newEnd
        ) {
          const memoryTimes =
            getMemoryTimes(
              memory
            );

          if (
            Array.isArray(memoryTimes) &&
            memoryTimes.length >= 2
          ) {
            const formatTimeForCorrection =
              value => {
                if (
                  !value ||
                  typeof value !== 'string'
                ) {
                  return '';
                }

                const match =
                  value.match(
                    /^(\d{1,2}):(\d{2})$/
                  );

                if (!match) {
                  return value;
                }

                const hour =
                  Number(
                    match[1]
                  );

                const minute =
                  match[2];

                return minute === '00'
                  ? `${hour}h`
                  : `${hour}h${minute}`;
              };

            oldStart =
              formatTimeForCorrection(
                memoryTimes[0]
              );

            oldEnd =
              formatTimeForCorrection(
                memoryTimes[1]
              );

            oldValue =
              `${oldStart} à ${oldEnd}`;

            newValue =
              `${newStart} à ${newEnd}`;

            normalizedCorrectionData.old_time_start =
              oldStart;

            normalizedCorrectionData.old_time_end =
              oldEnd;

            normalizedCorrectionData.new_time_start =
              newStart;

            normalizedCorrectionData.new_time_end =
              newEnd;

            normalizedCorrectionData.old_time =
              '';

            normalizedCorrectionData.new_time =
              '';

            normalizedCorrectionData.old_value =
              oldValue;

            normalizedCorrectionData.new_value =
              newValue;
          }
        }

        const newDescription =
          buildCorrectedDescription(
            oldDescription,
            normalizedCorrectionData,
            oldValue,
            newValue
          );

        const correctedMemory = {
          ...memory,

          id:
            memory.id,

          description:
            newDescription,

          source_text:
            memory.source_text
              ? buildCorrectedDescription(
                  memory.source_text,
                  normalizedCorrectionData,
                  oldValue,
                  newValue
                )
              : memory.source_text,

          date_reference:
            memory.date_reference
              ? buildCorrectedDescription(
                  memory.date_reference,
                  normalizedCorrectionData,
                  oldValue,
                  newValue
                )
              : memory.date_reference,

          calendar_date:
            memory.calendar_date ||
            getMemoryCalendarDate(
              memory
            ),

          facts:
            Array.isArray(
              memory.facts
            )
              ? memory.facts.map(
                  fact =>
                    buildCorrectedDescription(
                      fact,
                      normalizedCorrectionData,
                      oldValue,
                      newValue
                    )
                )
              : [],

          relations:
            Array.isArray(
              memory.relations
            )
              ? memory.relations.map(
                  relation =>
                    typeof relation ===
                    'string'
                      ? buildCorrectedDescription(
                          relation,
                          normalizedCorrectionData,
                          oldValue,
                          newValue
                        )
                      : relation
                )
              : [],

          thoughts:
            Array.isArray(
              memory.thoughts
            )
              ? memory.thoughts.map(
                  thought =>
                    buildCorrectedDescription(
                      thought,
                      normalizedCorrectionData,
                      oldValue,
                      newValue
                    )
                )
              : [],

          actions:
            Array.isArray(
              memory.actions
            )
              ? memory.actions.map(
                  action =>
                    buildCorrectedDescription(
                      action,
                      normalizedCorrectionData,
                      oldValue,
                      newValue
                    )
                )
              : [],

          intentions:
            Array.isArray(
              memory.intentions
            )
              ? memory.intentions.map(
                  intention =>
                    buildCorrectedDescription(
                      intention,
                      normalizedCorrectionData,
                      oldValue,
                      newValue
                    )
                )
              : [],

          corrected:
            true,

          was_corrected:
            true,

          correction_note:
            oldValue &&
            newValue
              ? `Information corrigée de ${oldValue} à ${newValue}.`
              : 'Information corrigée explicitement par l’utilisateur.',

          correction_type:
            correctionContext ||
            'generic',

          corrected_person:
            person || '',

          corrected_old_value:
            oldValue || '',

          corrected_new_value:
            newValue || '',

          corrected_old_time:
            oldTime || '',

          corrected_new_time:
            newTime || '',

          corrected_old_time_start:
            oldStart || '',

          corrected_old_time_end:
            oldEnd || '',

          corrected_new_time_start:
            newStart || '',

          corrected_new_time_end:
            newEnd || '',

          history: [
            ...(Array.isArray(
              memory.history
            )
              ? memory.history
              : []),

            buildCorrectionHistoryEntry(
              memory,
              normalizedCorrectionData,
              oldValue,
              newValue
            ),
          ],

          change_history: [
            ...(Array.isArray(
              memory.change_history
            )
              ? memory.change_history
              : []),

            {
              type:
                'correction',

              old_description:
                oldDescription,

              new_description:
                newDescription,

              old_value:
                oldValue || '',

              new_value:
                newValue || '',

              old_time:
                oldTime || '',

              new_time:
                newTime || '',

              old_time_start:
                oldStart || '',

              old_time_end:
                oldEnd || '',

              new_time_start:
                newStart || '',

              new_time_end:
                newEnd || '',

              date_reference:
                memory.date_reference,

              corrected_at:
                new Date().toISOString(),
            },
          ],
        };

        console.log(
          '🎯 MÉMOIRE CIBLE :',
          memory.id
        );

        console.log(
          '📊 SCORE CIBLE :',
          selectedCandidate.score
        );

        console.log(
          '📝 ANCIENNE INFORMATION :',
          oldDescription
        );

        console.log(
          '🆕 NOUVELLE INFORMATION :',
          newDescription
        );

        return res.json({
          input:
            text.trim(),

          events: [],

          conflict:
            null,

          correction_request: {
            detected:
              true,

            type:
              correctionContext ===
              'travail'
                ? 'work_schedule'
                : memoryIsAppointmentLike(
                    memory
                  )
                  ? 'appointment'
                  : 'generic',

            person:
              person || '',

            date:
              dateReference || '',

            day:
              day || '',

            context:
              correctionContext || '',

            old_value:
              oldValue,

            new_value:
              newValue,

            old_time:
              oldTime || null,

            new_time:
              newTime || null,

            old_time_range:
              oldStart &&
              oldEnd
                ? {
                    start:
                      oldStart,

                    end:
                      oldEnd,
                  }
                : null,

            new_time_range:
              newStart &&
              newEnd
                ? {
                    start:
                      newStart,

                    end:
                      newEnd,
                  }
                : null,

            event_ids: [
              memory.id,
            ].filter(Boolean),

            memories: [
              {
                id:
                  memory.id ||
                  '',

                description:
                  oldDescription,
              },
            ],

            old_memory: {
              id:
                memory.id ||
                '',

              description:
                oldDescription,
            },

            new_memory:
              correctedMemory,

            new_description:
              newDescription,

            message:
              `Je vais corriger cette information :\n\n` +
              `${oldDescription}\n\n` +
              `→ ${newDescription}\n\n` +
              `Confirme-tu cette correction ?`,
          },
        });
      }

      /* =================================================== */
      /* RÉFUTATION                                           */
      /* =================================================== */

      if (
        isRefutationText(
          text
        )
      ) {
        const deduction =
          findDeductionForRefutation(
            existingMemories,
            text
          );

        if (deduction) {
          const rejected =
            rejectDeduction(
              deduction,
              text.trim()
            );

          return res.json({
            input:
              text.trim(),

            events: [],

            deduction_action: {
              type:
                'rejection',

              event_id:
                deduction.id || '',

              status:
                'rejected',

              memory:
                rejected,

              source_event_ids:
                getDeductionSourceIds(
                  deduction
                ),
            },

            conflict:
              null,
          });
        }
      }

      /* =================================================== */
      /* VALIDATION                                           */
      /* =================================================== */

      if (
        isValidationText(
          text
        )
      ) {
        const deduction =
          findDeductionForValidation(
            existingMemories,
            text
          );

        if (deduction) {
          const validated =
            validateDeduction(
              deduction
            );

          return res.json({
            input:
              text.trim(),

            events: [],

            deduction_action: {
              type:
                'validation',

              event_id:
                deduction.id || '',

              status:
                'validated',

              memory:
                validated,

              source_event_ids:
                getDeductionSourceIds(
                  deduction
                ),
            },

            conflict:
              null,
          });
        }
      }

      /* =================================================== */
      /* ANALYSE GPT                                           */
      /* =================================================== */

      console.log(
        '🧠 Analyse de la saisie...'
      );

      const prompt = `
Tu es le moteur de mémoire de l'application Moment.

Une saisie peut contenir un ou plusieurs événements.

RÈGLES ABSOLUES :



1. Ne crée aucune information absente du texte.
2. Ne crée aucune relation non exprimée.
3. Ne transforme jamais une intention en action.
4. Un fait explicitement dit reste explicite.
5. Une déduction doit être séparée des faits sources.
6. Ne déduis jamais qu'une personne était avec l'utilisateur
   simplement parce qu'elle a été vue, mentionnée ou se trouvait
   dans le même lieu.

EXEMPLES :

"J'ai vu Marc au restaurant lundi."

=> Marc est mentionné.
=> Marc était au restaurant.
=> Mais cela NE signifie PAS que Marc était avec moi.

"J'ai mangé avec Marc lundi."

=> Marc était explicitement avec moi.

RÈGLE DE FORMULATION DES DESCRIPTIONS :

Le champ "description" doit être une phrase complète et naturelle
qui résume fidèlement le souvenir en s'adressant directement
à la personne qui utilise Moment.

Lorsque le texte source est formulé à la première personne
("je", "j'", "moi", "mon", "ma", "mes"), la description DOIT
être reformulée à la deuxième personne ("tu", "toi", "ton",
"ta", "tes").

INTERDICTION ABSOLUE dans "description" :
- "Utilisateur"
- "l'utilisateur"
- "je"
- "j'"

Ne supprime pas le sujet de la phrase pour éviter cette règle.
La description doit rester une phrase complète.

Exemples obligatoires :

"Je suis content de l'avancée du projet MOMENT."
=> "Tu es content de l'avancée du projet MOMENT."

"J'ai vu Bob jeudi dernier."
=> "Tu as vu Bob jeudi dernier."

"Mon rendez-vous avec Marc est demain."
=> "Ton rendez-vous avec Marc est demain."

La description doit conserver le sens complet du texte source.

Retourne uniquement du JSON :

{
  "input": "",
  "events": []
}

Chaque événement :

{
  "id": "",
  "type": "",
  "description": "",
  "date_reference": "",
  "date_precision": "",
  "temporal_direction": "",
  "context": "",
  "people": [],
  "places": [],
  "objects": [],
  "subjects": [],
  "thoughts": [],
  "actions": [],
  "intentions": [],
  "facts": [],
  "relations": [],
  "source_event_ids": [],
  "is_deduction": false,
  "pending_validation": false,
  "created_at": "",
  "source_text": "",
  "confidence": 0
}
  RÈGLE POUR LE CHAMP "facts" :

Le champ "facts" contient uniquement des faits explicites
qui apportent une information distincte de la description.

Ne recopie jamais la description dans "facts".

Si la description exprime déjà entièrement le fait mémorisé,
"facts" doit être [].

Exemple :

"Je suis content de l'avancée du projet MOMENT."

=> description :
"Tu es content de l'avancée du projet MOMENT."

=> facts :
[]

Ne crée pas un fait séparé comme :
"Tu es content de l'avancée du projet MOMENT."

Types autorisés :

"event"
"thought"
"idea"
"action"
"intention"
"fact"
"feeling"
"mixed"
"deduction"

date_precision :

"exact"
"day"
"approximate"
"relative"
"unknown"

temporal_direction :

"past"
"future"
"generic"
"unknown"

IMPORTANT — DIRECTION TEMPORELLE :

temporal_direction indique si le repère temporel
doit être compris comme passé, futur ou générique.

"past" :
l'événement est situé dans le passé.

"future" :
l'événement est prévu ou situé dans le futur.

"generic" :
le repère temporel ne désigne pas un jour précis.

"unknown" :
la direction temporelle ne peut pas être déterminée.

EXEMPLES :

"J'y suis allé dimanche."
=> date_reference = "dimanche"
=> temporal_direction = "past"

"J'y vais dimanche."
=> date_reference = "dimanche"
=> temporal_direction = "future"

"J'irai dimanche."
=> date_reference = "dimanche"
=> temporal_direction = "future"

"Il a plu mardi."
=> date_reference = "mardi"
=> temporal_direction = "past"

"Je dois appeler Marc mardi."
=> date_reference = "mardi"
=> temporal_direction = "future"

"J'y suis allé un dimanche."
=> date_reference = "un dimanche"
=> temporal_direction = "generic"

"Un dimanche, j'y suis allé."
=> date_reference = "un dimanche"
=> temporal_direction = "generic"

"Je vais à la piscine mardi prochain."
=> date_reference = "mardi prochain"
=> temporal_direction = "future"

Ne transforme jamais temporal_direction
en une date calendaire.
Le serveur s'en chargera.

IMPORTANT :

date_reference décrit la date ou le repère temporel
explicitement présent dans le texte utilisateur.

created_at doit rester vide.

source_text doit reprendre la partie exacte
du texte utilisateur correspondant à l'événement.

Ne convertis pas toi-même un jour de semaine en date :
le serveur s'en chargera.

Texte utilisateur :

${text.trim()}
`;

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
    '❌ JSON compréhension invalide :',
    response.output_text
  );

  console.error(
    '❌ Détail parsing :',
    error
  );

  return res
    .status(500)
    .json({
      error:
        'Le cerveau de Moment a produit une réponse invalide',
    });
}

      if (
        !Array.isArray(
          result.events
        )
      ) {
        result.events =
          [];
      }

      /* ========================================================= */
      /* CONFIRMATION DES DATES IMPLICITES                         */
      /* ========================================================= */

      /*
       * IMPORTANT :
       *
       * Une date explicitement écrite comme :
       *
       *   "12 août"
       *
       * est considérée comme certaine.
       *
       * En revanche, une référence temporelle comme :
       *
       *   "lundi"
       *   "vendredi"
       *   "vendredi prochain"
       *   "demain"
       *   "après-demain"
       *   "dans 3 jours"
       *
       * peut être transformée par Moment en date calendaire
       * proposée, mais cette date doit être présentée à
       * l'utilisateur pour confirmation.
       *
       * Exemple :
       *
       * aujourd'hui = 06/08/2026
       * vendredi = 07/08/2026
       *
       * => "vendredi" doit proposer :
       *    "vendredi 7 août 2026"
       *
       * et demander confirmation.
       */
console.log(
  '🧪 DATE CHECK AVANT CONFIRMATION :',
  result.events.map(event => ({
    date_reference: event.date_reference,
    temporal_direction: event.temporal_direction,
    calendar_date: event.calendar_date,
  }))
);
result.events =
  result.events.map(
    event =>
      enrichMemoryWithCalendarDate(
        event
      )
  );

console.log(
  '🧪 DATE CHECK APRÈS ENRICHISSEMENT :',
  result.events.map(
    event => ({
      date_reference:
        event.date_reference,

      temporal_direction:
        event.temporal_direction,

      calendar_date:
        event.calendar_date,
    })
  )
);

const enrichedEvents =
  result.events.map(
    event =>
      enrichMemoryWithCalendarDate(
        event
      )
  );

console.log(
  '🧪 DATE CHECK APRÈS ENRICHISSEMENT :',
  enrichedEvents.map(
    event => ({
      date_reference:
        event.date_reference,

      temporal_direction:
        event.temporal_direction,

      calendar_date:
        event.calendar_date,
    })
  )
);

const eventsNeedingDateConfirmation =
  enrichedEvents.filter(
    event => {
      if (
        !event ||
        event.is_deduction === true
      ) {
        return false;
      }

      const dateReference =
        typeof event.date_reference ===
        'string'
          ? event.date_reference.trim()
          : '';

      const temporalDirection =
        typeof event.temporal_direction ===
        'string'
          ? event.temporal_direction.trim()
          : '';

      if (
        temporalDirection ===
        'generic'
      ) {
        return false;
      }

      if (
        !dateReference
      ) {
        return false;
      }

      const explicitDate =
        extractExplicitDateFromText(
          event.source_text ||
          text
        );

      if (
        explicitDate
      ) {
        return false;
      }

      return Boolean(
        event.calendar_date
      );
    }
  );
      if (
        eventsNeedingDateConfirmation.length >
        0
      ) {
        const confirmationEvents =
          eventsNeedingDateConfirmation.map(
            event => ({
              ...event,

              date_confirmation_required:
                true,

              proposed_calendar_date:
                event.calendar_date ||
                '',

              proposed_date_reference:
                event.date_reference ||
                '',

              source_text:
                event.source_text ||
                text.trim(),
            })
          );

        const firstEvent =
          confirmationEvents[0];

        const proposedDate =
          firstEvent.proposed_calendar_date;

        const proposedDateLabel =
          proposedDate
            ? new Intl.DateTimeFormat(
                'fr-FR',
                {
                  weekday:
                    'long',

                  day:
                    'numeric',

                  month:
                    'long',

                  year:
                    'numeric',

                  timeZone:
                    'Europe/Paris',
                }
              ).format(
                new Date(
                  `${proposedDate}T12:00:00`
                )
              )
            : firstEvent.proposed_date_reference;

        /*
         * Si l'utilisateur a confirmé une date proposée par
         * Moment, on ne redemande pas de confirmation.
         *
         * Les événements seront ensuite normalisés avec
         * confirmed_calendar_date.
         */

        if (
          confirmed_calendar_date
        ) {
          console.log(
            '📅 DATE CONFIRMÉE PAR L’UTILISATEUR :',
            confirmed_calendar_date
          );
        } else {
          return res.json({
            input:
              text.trim(),

            events: [],

            conflict:
              null,

            date_confirmation: {
              required:
                true,

              type:
                'implicit_date',

              proposed_date:
                proposedDate,

              original_reference:
                firstEvent.proposed_date_reference,

              source_text:
                firstEvent.source_text,

              events:
                confirmationEvents,

              message:
                `Tu veux dire ${proposedDateLabel} ?`,
            },
          });
        }
      }

      result.events =
        result.events.map(
          event => {
            const id =
              event.id ||
              createId(
                'memory'
              );

            const deduction =
              event.is_deduction ===
                true ||
              event.type ===
                'deduction';

            const normalizedEvent = {
              ...event,

              id,

              created_at:
                new Date().toISOString(),

              is_deduction:
                deduction,

              pending_validation:
                deduction
                  ? true
                  : Boolean(
                      event.pending_validation
                    ),

              status:
                deduction
                  ? 'pending_validation'
                  : event.status,

              source_event_ids:
                Array.isArray(
                  event.source_event_ids
                )
                  ? event.source_event_ids
                  : [],
            };

            /*
             * Si l'utilisateur a explicitement confirmé
             * une date proposée par Moment, cette date devient
             * la date réelle de l'événement.
             */

            if (
              confirmed_calendar_date
            ) {
              normalizedEvent.calendar_date =
                confirmed_calendar_date;

              normalizedEvent.date_confirmation =
                {
                  confirmed: true,

                  confirmed_date:
                    confirmed_calendar_date,
                };
            }

            return enrichMemoryWithCalendarDate(
              normalizedEvent
            );
          }
        );

      /* =================================================== */
      /* CONTRADICTIONS DE PLANNING                           */
      /* =================================================== */

      for (
        const event of
          result.events
      ) {
        const contradiction =
          findContradiction(
            existingMemories,
            event
          );

        if (
          contradiction
        ) {
          const correctedMemory =
            buildCorrectedMemory(
              contradiction
            );

          return res.json({
            input:
              text.trim(),

            events:
              result.events,

            conflict: {
              detected:
                true,

              old_event_id:
                contradiction.oldMemory.id,

              old_memory:
                contradiction.oldMemory,

              new_event:
                event,

              proposed_memory:
                correctedMemory,

              message:
                `J'avais enregistré que ${contradiction.newSituation.person} ` +
                `travaillait ${contradiction.newSituation.day} ` +
                `à ${contradiction.oldSituation.location}. ` +
                `La nouvelle information indique ` +
                `${contradiction.newSituation.location}. ` +
                `Voulez-vous corriger cette information ?`,
            },
          });
        }
      }

      console.log(
        '📅 EVENTS FINAUX AVANT ENVOI :',
        JSON.stringify(
          result.events,
          null,
          2
        )
      );

      return res.json({
        input:
          text.trim(),

        events:
          result.events,

        conflict:
          null,
      });

    } catch (error) {
  console.error(
    '❌ Erreur OpenAI /understand :',
    error
  );

  const errorCode =
    error?.code ||
    error?.error?.code ||
    '';

  const errorType =
    error?.type ||
    error?.error?.type ||
    '';

  const errorStatus =
    error?.status ||
    500;

  if (
    errorStatus === 429 &&
    (
      errorCode ===
        'credit_balance_exhausted' ||
      errorType ===
        'insufficient_quota'
    )
  ) {
    return res
      .status(402)
      .json({
        error:
          'Crédit API OpenAI épuisé',
        code:
          'OPENAI_CREDIT_EXHAUSTED',
        message:
          'Moment ne peut plus analyser de nouveaux souvenirs car le crédit API OpenAI est épuisé.',
      });
  }

  if (
    errorStatus === 429
  ) {
    return res
      .status(429)
      .json({
        error:
          'Limite API OpenAI atteinte',
        code:
          'OPENAI_RATE_LIMIT',
        message:
          'Moment reçoit temporairement trop de requêtes. Réessayez dans quelques instants.',
      });
  }

  return res
    .status(500)
    .json({
      error:
        'Erreur lors de la compréhension de la mémoire',
      code:
        'UNDERSTAND_ERROR',
      message:
        'Moment a rencontré une erreur pendant l’analyse du souvenir.',
    });
}
  }
);

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
      const {
        question,
        memories,
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

      return res
        .status(500)
        .json({
          error:
            'Erreur lors du rappel de la mémoire',
        });
    }
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