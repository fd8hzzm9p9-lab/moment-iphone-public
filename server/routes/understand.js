/*
 * =========================================================
 * MOMENT — ROUTE /UNDERSTAND
 * MEMENTO 001-10
 * =========================================================
 *
 * Extraction structurelle depuis server/server.js.
 * La logique interne de la route est conservée.
 */

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
  validateDeduction,
} = helpers;

function registerUnderstandRoute(
  app,
  openai
) {

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

}

module.exports = {
  registerUnderstandRoute,
};
