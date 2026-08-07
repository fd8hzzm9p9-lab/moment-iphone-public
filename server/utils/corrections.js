/*
 * =========================================================
 * MOMENT — CORRECTIONS
 * MEMENTO 001-06
 * =========================================================
 *
 * Extraction structurelle depuis server/server.js.
 * Aucun comportement métier n'est volontairement modifié.
 */

const {
  normalizeText,
  escapeRegExp,
  createId,
  getCreatedAt,
  getMemoryId,
  getMemoryText,
} = require('./core');

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
} = require('./calendar');

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
} = require('./memory');

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
} = require('./deductions');

const {
  isWithMeQuestion,
  findPersonDayMemories,
  explicitlyIndicatesTogether,
} = require('./presence');

/* ========================================================= */
/* CORRECTIONS DE PLANNING                                    */
/* ========================================================= */

function findContradiction(
  memories,
  newEvent
) {
  if (
    !Array.isArray(memories) ||
    !newEvent
  ) {
    return null;
  }

  if (
    !isUsableExplicitMemory(
      newEvent
    )
  ) {
    return null;
  }

  const newSituation =
    extractSituation(
      newEvent
    );

  if (
    !newSituation.person ||
    !newSituation.day ||
    !newSituation.location
  ) {
    return null;
  }

  if (
    newSituation.subject !==
    'travail'
  ) {
    return null;
  }

  const candidates =
    [];

  for (
    const oldMemory of
      memories
  ) {
    if (
      !isUsableExplicitMemory(
        oldMemory
      )
    ) {
      continue;
    }

    const oldSituation =
      extractSituation(
        oldMemory
      );

    if (
      !oldSituation.person ||
      !oldSituation.day
    ) {
      continue;
    }

    if (
      normalizeText(
        oldSituation.person
      ) !==
      normalizeText(
        newSituation.person
      )
    ) {
      continue;
    }

    if (
      normalizeText(
        oldSituation.day
      ) !==
      normalizeText(
        newSituation.day
      )
    ) {
      continue;
    }

    if (
      oldSituation.subject !==
      'travail'
    ) {
      continue;
    }

    if (
      !oldSituation.location
    ) {
      continue;
    }

    if (
      normalizeText(
        oldSituation.location
      ) ===
      normalizeText(
        newSituation.location
      )
    ) {
      continue;
    }

    candidates.push({
      memory:
        oldMemory,

      situation:
        oldSituation,
    });
  }

  if (
    candidates.length ===
    0
  ) {
    return null;
  }

  candidates.sort(
    (a, b) =>
      getCreatedAt(
        b.memory
      ) -
      getCreatedAt(
        a.memory
      )
  );

  const previous =
    candidates[0];

  return {
    oldMemory:
      previous.memory,

    oldSituation:
      previous.situation,

    newEvent,

    newSituation,
  };
}

function buildCorrectedMemory(
  contradiction
) {
  const oldMemory =
    contradiction.oldMemory;

  const newEvent =
    contradiction.newEvent;

  const oldSituation =
    contradiction.oldSituation;

  const newSituation =
    contradiction.newSituation;

  const person =
    newSituation.person
      .charAt(0)
      .toUpperCase() +
    newSituation.person.slice(
      1
    );

  const day =
    newSituation.day;

  const oldLocation =
    oldSituation.location;

  const newLocation =
    newSituation.location;

  const changeText =
    `Initialement prévu à ${oldLocation}, mais finalement à ${newLocation}.`;

  const description =
    `${person} travaille ${day} à ${newLocation}. ${changeText}`;

  const historyEntry = {
    changed_at:
      new Date().toISOString(),

    previous_description:
      oldMemory.description ||
      oldSituation.text,

    previous_location:
      oldLocation,

    new_location:
      newLocation,

    reason:
      'Correction explicite par l’utilisateur',
  };

  const previousHistory =
    Array.isArray(
      oldMemory.history
    )
      ? oldMemory.history
      : [];

  return {
    ...oldMemory,

    id:
      oldMemory.id,

    description,

    source_text:
      newEvent.source_text ||
      newEvent.description,

    date_reference:
      newEvent.date_reference ||
      oldMemory.date_reference,

    date_precision:
      newEvent.date_precision ||
      oldMemory.date_precision,

    context:
      newEvent.context ||
      oldMemory.context,

    people:
      newEvent.people?.length
        ? newEvent.people
        : oldMemory.people,

    places:
      newEvent.places?.length
        ? newEvent.places
        : oldMemory.places,

    objects:
      newEvent.objects?.length
        ? newEvent.objects
        : oldMemory.objects,

    subjects:
      newEvent.subjects?.length
        ? newEvent.subjects
        : oldMemory.subjects,

    thoughts:
      newEvent.thoughts?.length
        ? newEvent.thoughts
        : oldMemory.thoughts,

    actions:
      newEvent.actions?.length
        ? newEvent.actions
        : oldMemory.actions,

    intentions:
      newEvent.intentions?.length
        ? newEvent.intentions
        : oldMemory.intentions,

    facts: [
      ...(Array.isArray(
        newEvent.facts
      )
        ? newEvent.facts
        : []),

      changeText,
    ],

    relations:
      newEvent.relations?.length
        ? newEvent.relations
        : oldMemory.relations,

    confidence:
      newEvent.confidence,

    created_at:
      newEvent.created_at ||
      new Date().toISOString(),

    history: [
      ...previousHistory,

      historyEntry,
    ],

    corrected:
      true,

    correction_note:
      changeText,
  };
}

/* ========================================================= */
/* CORRECTION — DÉTECTION                                     */
/* ========================================================= */

function isCorrectionRequest(text) {
  const normalized =
    normalizeText(text);

  /*
   * =================================================
   * CORRECTION EXPLICITE
   * =================================================
   *
   * Une correction peut être exprimée de plusieurs
   * façons :
   *
   * - "corrige"
   * - "finalement"
   * - "au lieu de"
   * - "pas à 10h"
   * - "et non à 10h"
   * - "mais pas à 10h"
   * - "ce n'est pas à 10h"
   *
   * IMPORTANT :
   * Une négation portant directement sur une valeur
   * temporelle constitue elle aussi une correction.
   */

  const correctionWords = [
    'corrig',
    'correction',
    'corriger',
    'rectifier',
    'rectification',
    'modifier',
    'modification',
    'change',
    'changer',
    'changement',
    'remplacer',
    'remplacement',
    'finalement',
    'en fait',
    'au lieu de',
    'plutot',
    'plutôt',
  ];

  const hasCorrectionWord =
    correctionWords.some(
      word =>
        normalized.includes(
          normalizeText(word)
        )
    );

  /*
   * =================================================
   * FORMULATIONS NÉGATIVES DE CORRECTION
   * =================================================
   *
   * Exemples :
   *
   * "11h pas 10h"
   * "à 11h, pas à 10h"
   * "11h et non 10h"
   * "11h mais pas 10h"
   * "ce n'est pas à 10h"
   * "ce n'est plus à 10h"
   */

  const hasNegativeCorrection =
    /(?:\bpas\s+(?:a|à)\s*\d{1,2}(?:h\d{0,2}|:\d{2})\b)/i.test(
      normalized
    ) ||
    /(?:\bet\s+non\s+(?:a|à)\s*\d{1,2}(?:h\d{0,2}|:\d{2})\b)/i.test(
      normalized
    ) ||
    /(?:\bmais\s+pas\s+(?:a|à)\s*\d{1,2}(?:h\d{0,2}|:\d{2})\b)/i.test(
      normalized
    ) ||
    /(?:\bce\s+n['’]est\s+(?:pas|plus)\s+(?:a|à)\s*\d{1,2}(?:h\d{0,2}|:\d{2})\b)/i.test(
      normalized
    ) ||
    /(?:\bn['’]est\s+(?:pas|plus)\s+(?:a|à)\s*\d{1,2}(?:h\d{0,2}|:\d{2})\b)/i.test(
      normalized
    );

  /*
   * =================================================
   * IL FAUT AUSSI UN CONTEXTE DE CORRECTION
   * =================================================
   */

  const correctionContextWords = [
    'horaire',
    'horaires',
    'heure',
    'heures',
    'travail',
    'travaille',
    'rendez vous',
    'rendez-vous',
    'rdv',
    'visite',
    'reunion',
    'réunion',
    'consultation',
    'medecin',
    'médecin',
    'dentiste',
    'entretien',
    'anniversaire',
  ];

  const hasCorrectionContext =
    correctionContextWords.some(
      word =>
        normalized.includes(
          normalizeText(word)
        )
    );

  /*
   * Une formulation classique de correction doit
   * contenir un mot de correction + un contexte.
   */

  if (
    hasCorrectionWord &&
    hasCorrectionContext
  ) {
    return true;
  }

  /*
   * Une formulation "11h (pas à 10h)" ou
   * "11h, et non à 10h" est une correction même
   * sans le mot "corriger".
   */

  if (
    hasNegativeCorrection &&
    hasCorrectionContext
  ) {
    return true;
  }

  return false;
}

function correctionContextMatchesMemory(
  correctionContext,
  memory
) {
  if (!correctionContext) {
    return true;
  }

  const context =
    normalizeText(
      correctionContext
    );

  const text =
    normalizeText(
      getMemoryText(
        memory
      )
    );

  const aliases = {
    'rendez vous': [
      'rendez vous',
      'rdv',
      'rendez-vous',
    ],

    visite: [
      'visite',
      'consultation',
    ],

    reunion: [
      'reunion',
      'meeting',
    ],

    travail: [
      'travail',
      'travaille',
      'travailler',
      'horaire',
      'horaires',
      'planning',
    ],

    anniversaire: [
      'anniversaire',
    ],

    entretien: [
      'entretien',
    ],

    consultation: [
      'consultation',
      'rendez vous',
      'rdv',
      'medecin',
      'docteur',
    ],
  };

  const candidates =
    aliases[context] || [
      context,
    ];

  return candidates.some(
    candidate =>
      text.includes(
        normalizeText(
          candidate
        )
      )
  );
}

function correctionDateMatchesMemory(
  dateReference,
  day,
  memory
) {
  if (
    dateReference
  ) {
    return memoryMatchesCalendarDate(
      memory,
      dateReference
    );
  }

  if (day) {
    return memoryContainsDay(
      memory,
      day
    );
  }

  return true;
}

function memoryMatchesCalendarDate(
  memory,
  wantedDate
) {
  if (!wantedDate) {
    return true;
  }

  const normalizedWanted =
    normalizeText(
      String(
        wantedDate
      )
    ).trim();

  const memoryCalendar =
    normalizeText(
      String(
        memory?.calendar_date ||
        ''
      )
    ).trim();

  if (
    memoryCalendar ===
    normalizedWanted
  ) {
    return true;
  }

  const resolved =
    getMemoryCalendarDate(
      memory
    );

  if (
    normalizeText(
      String(
        resolved || ''
      )
    ).trim() ===
    normalizedWanted
  ) {
    return true;
  }

  const text =
    normalizeText(
      getMemoryText(
        memory
      ) || ''
    ).trim();

  if (
    text.includes(
      normalizedWanted
    )
  ) {
    return true;
  }

  const iso =
    parseISODate(
      normalizedWanted
    );

  if (iso) {
    const day =
      iso.getUTCDate();

    const month =
      iso.getUTCMonth() + 1;

    const year =
      iso.getUTCFullYear();

    const numeric =
      [
        String(day).padStart(
          2,
          '0'
        ),
        String(month).padStart(
          2,
          '0'
        ),
        year,
      ].join('/');

    if (
      text.includes(
        numeric
      )
    ) {
      return true;
    }

    const numericDash =
      [
        String(day).padStart(
          2,
          '0'
        ),
        String(month).padStart(
          2,
          '0'
        ),
        year,
      ].join('-');

    if (
      text.includes(
        numericDash
      )
    ) {
      return true;
    }

    const months = [
      'janvier',
      'février',
      'mars',
      'avril',
      'mai',
      'juin',
      'juillet',
      'août',
      'septembre',
      'octobre',
      'novembre',
      'décembre',
    ];

    const monthName =
      months[
        month - 1
      ];

    const frenchDate =
      `${day} ${monthName} ${year}`;

    if (
      text.includes(
        normalizeText(
          frenchDate
        )
      )
    ) {
      return true;
    }

    const frenchDateWithoutYear =
      `${day} ${monthName}`;

    if (
      text.includes(
        normalizeText(
          frenchDateWithoutYear
        )
      )
    ) {
      return true;
    }
  }

  return false;
}

function correctionOldValueMatchesMemory(
  correctionData,
  oldValue,
  memory
) {
  const oldTime =
    correctionData.old_time ||
    '';

  const oldStart =
    correctionData.old_time_start ||
    '';

  const oldEnd =
    correctionData.old_time_end ||
    '';

  if (oldTime) {
    return timeAppearsInMemory(
      memory,
      oldTime
    );
  }

  if (
    oldStart ||
    oldEnd
  ) {
    const times =
      getMemoryTimes(
        memory
      );

    const start =
      normalizeTimeValue(
        oldStart
      );

    const end =
      normalizeTimeValue(
        oldEnd
      );

    if (
      start &&
      end
    ) {
      return (
        times.includes(
          start
        ) &&
        times.includes(
          end
        )
      );
    }

    if (start) {
      return times.includes(
        start
      );
    }

    if (end) {
      return times.includes(
        end
      );
    }

    return true;
  }

  if (oldValue) {
    const normalizedOld =
      normalizeText(
        oldValue
      );

    const normalizedMemory =
      normalizeText(
        getMemoryText(
          memory
        )
      );

    const words =
      normalizedOld
        .split(/\s+/)
        .filter(
          word =>
            word.length >= 2
        );

    if (
      words.length ===
      0
    ) {
      return false;
    }

    return words.every(
      word =>
        normalizedMemory.includes(
          word
        )
    );
  }

  return true;
}

function scoreCorrectionCandidate(
  memory,
  correction
) {
  let score = 0;

  const {
    person,
    day,
    dateReference,
    correctionContext,
    oldValue,
    correctionData,
  } = correction;

  if (
    person &&
    memoryContainsPerson(
      memory,
      person
    )
  ) {
    score += 30;
  }

  if (
    day &&
    memoryContainsDay(
      memory,
      day
    )
  ) {
    score += 20;
  }

  if (
    dateReference &&
    memoryMatchesCalendarDate(
      memory,
      dateReference
    )
  ) {
    score += 35;
  }

  if (
    correctionContext &&
    correctionContextMatchesMemory(
      correctionContext,
      memory
    )
  ) {
    score += 25;
  }

  if (
    correctionOldValueMatchesMemory(
      correctionData,
      oldValue,
      memory
    )
  ) {
    score += 40;
  }

  if (
    correctionContext ===
      'travail' &&
    memoryIsAboutWork(
      memory
    )
  ) {
    score += 20;
  }

  if (
    (
      correctionContext ===
        'rendez vous' ||
      correctionContext ===
        'visite' ||
      correctionContext ===
        'consultation' ||
      correctionContext ===
        'reunion' ||
      correctionContext ===
        'entretien'
    ) &&
    memoryIsAppointmentLike(
      memory
    )
  ) {
    score += 20;
  }

  return score;
}

function buildCorrectionCandidates(
  existingMemories,
  correction
) {
  const {
    person,
    day,
    dateReference,
    correctionContext,
    oldValue,
    correctionData,
  } = correction;

  const scored = [];

  /*
   * =================================================
   * IDENTITÉ LOGIQUE DE L'ÉVÉNEMENT
   * =================================================
   *
   * Une correction ne doit pas seulement chercher
   * une mémoire contenant la nouvelle phrase.
   *
   * Elle doit rechercher l'événement déjà mémorisé
   * auquel la correction fait référence.
   *
   * Pour un rendez-vous, les éléments les plus
   * importants sont :
   *
   *   - personne
   *   - date
   *   - type rendez-vous
   *   - lieu si présent
   *   - ancienne heure si explicitement donnée
   *
   * Exemple :
   *
   * Mémoire :
   * "Rendez-vous avec Julien à Bernay
   *  le 20 août à 10h."
   *
   * Correction :
   * "Le rendez-vous avec Julien à Bernay
   *  le 20 août est finalement à 11h."
   *
   * => même événement.
   */

  const correctionIsAppointment =
    (
      correctionContext === 'rendez vous' ||
      correctionContext === 'visite' ||
      correctionContext === 'consultation' ||
      correctionContext === 'reunion' ||
      correctionContext === 'entretien'
    );

  for (
    const memory of existingMemories
  ) {
    if (
      !isUsableExplicitMemory(
        memory
      )
    ) {
      continue;
    }

    let score = 0;

    /*
     * =================================================
     * PERSONNE
     * =================================================
     */

    if (person) {
      if (
        !memoryContainsPerson(
          memory,
          person
        )
      ) {
        continue;
      }

      score += 50;
    }

    /*
     * =================================================
     * DATE
     * =================================================
     *
     * Pour une correction de rendez-vous, la date
     * identifie beaucoup plus fortement l'événement
     * que le simple ordre chronologique.
     */

    if (
      dateReference
    ) {
      if (
        !memoryMatchesCalendarDate(
          memory,
          dateReference
        )
      ) {
        continue;
      }

      score += 70;
    } else if (
      day
    ) {
      if (
        !memoryContainsDay(
          memory,
          day
        )
      ) {
        continue;
      }

      score += 30;
    }

    /*
     * =================================================
     * TYPE D'ÉVÉNEMENT
     * =================================================
     */

    if (
      correctionIsAppointment
    ) {
      if (
        !memoryIsAppointmentLike(
          memory
        )
      ) {
        continue;
      }

      score += 40;
    }

    /*
     * =================================================
     * CONTEXTE
     * =================================================
     */

    if (
      correctionContext
    ) {
      if (
        correctionContextMatchesMemory(
          correctionContext,
          memory
        )
      ) {
        score += 30;
      }
    }

    /*
     * =================================================
     * ANCIENNE VALEUR
     * =================================================
     *
     * Si l'utilisateur dit :
     *
     * "10h devient 11h"
     *
     * la mémoire à 10h doit être privilégiée.
     */

    const hasExplicitOldValue =
      Boolean(
        correctionData.old_time ||
        correctionData.old_time_start ||
        correctionData.old_time_end ||
        oldValue
      );

    if (
      hasExplicitOldValue
    ) {
      if (
        !correctionOldValueMatchesMemory(
          correctionData,
          oldValue,
          memory
        )
      ) {
        continue;
      }

      score += 80;
    }

    /*
     * =================================================
     * LIEU
     * =================================================
     *
     * Le lieu doit être utilisé comme critère
     * d'identification lorsqu'il est présent dans
     * la correction.
     */

    const correctionText =
      normalizeText(
        [
          correctionData?.correction_context,
          correctionData?.date_reference,
          correctionData?.old_description,
          correctionData?.new_description,
        ]
          .filter(Boolean)
          .join(' ')
      );

    const memoryLocation =
      normalizeText(
        getMemoryLocation(
          memory
        )
      );

    if (
      memoryLocation &&
      correctionText
    ) {
      if (
        correctionText.includes(
          memoryLocation
        )
      ) {
        score += 45;
      }
    }

    /*
     * =================================================
     * COHÉRENCE RENDEZ-VOUS
     * =================================================
     *
     * Pour un rendez-vous précis, la combinaison :
     *
     * personne + date + type
     *
     * constitue une identité forte.
     *
     * Cela permet notamment de distinguer :
     *
     * Julien — 20 août — 10h
     *
     * de :
     *
     * Julien — 21 août — 11h
     */

    if (
      correctionIsAppointment &&
      person &&
      dateReference &&
      memoryContainsPerson(
        memory,
        person
      ) &&
      memoryMatchesCalendarDate(
        memory,
        dateReference
      ) &&
      memoryIsAppointmentLike(
        memory
      )
    ) {
      score += 100;
    }

    /*
     * =================================================
     * HISTORIQUE DE CORRECTION
     * =================================================
     *
     * Une mémoire déjà corrigée reste le même événement.
     * Elle doit donc continuer à être considérée comme
     * la même identité logique.
     */

    if (
      memory.was_corrected === true ||
      memory.corrected === true
    ) {
      score += 20;
    }

    if (
      Array.isArray(
        memory.history
      ) &&
      memory.history.length > 0
    ) {
      score += 10;
    }

    if (
      Array.isArray(
        memory.change_history
      ) &&
      memory.change_history.length > 0
    ) {
      score += 10;
    }

    /*
     * =================================================
     * SÉCURITÉ
     * =================================================
     *
     * Une mémoire qui n'a aucun élément permettant
     * de l'identifier ne doit jamais être choisie
     * uniquement parce qu'elle est récente.
     */

    if (
      score <= 0
    ) {
      continue;
    }

    scored.push({
      memory,
      score,
      times:
        getMemoryTimes(
          memory
        ),
    });
  }

  /*
   * =================================================
   * TRI
   * =================================================
   *
   * Priorité :
   *
   * 1. correspondance logique de l'événement
   * 2. date
   * 3. ancienne valeur
   * 4. personne
   * 5. type
   * 6. récence
   */

  scored.sort(
    (a, b) => {
      if (
        b.score !==
        a.score
      ) {
        return (
          b.score -
          a.score
        );
      }

      return (
        getTemporalSortValue(
          b.memory
        ) -
        getTemporalSortValue(
          a.memory
        )
      );
    }
  );

  console.log(
    '🎯 CANDIDATS DE CORRECTION :',
    scored.map(
      item => ({
        id:
          item.memory?.id,

        description:
          item.memory?.description,

        score:
          item.score,

        times:
          item.times,
      })
    )
  );

  return scored;
}

function buildCorrectedDescription(
  oldDescription,
  correctionData,
  oldValue,
  newValue
) {
  let newDescription =
    oldDescription;

  const oldTime =
    correctionData.old_time ||
    '';

  const newTime =
    correctionData.new_time ||
    '';

  const oldStart =
    correctionData.old_time_start ||
    '';

  const oldEnd =
    correctionData.old_time_end ||
    '';

  const newStart =
    correctionData.new_time_start ||
    '';

  const newEnd =
    correctionData.new_time_end ||
    '';

  if (
    oldTime &&
    newTime
  ) {
    const oldCanonical =
      normalizeTimeValue(
        oldTime
      );

    const oldHour =
      oldCanonical
        ? String(
            Number(
              oldCanonical.split(
                ':'
              )[0]
            )
          )
        : '';

    const oldMinute =
      oldCanonical
        ? Number(
            oldCanonical.split(
              ':'
            )[1]
          )
        : 0;

    const alternatives = [
      oldTime,

      oldTime.replace(
        /\s+/g,
        ''
      ),

      `${oldHour}h`,

      `${oldHour}h${String(
        oldMinute
      ).padStart(
        2,
        '0'
      )}`,

      `${oldHour}:${String(
        oldMinute
      ).padStart(
        2,
        '0'
      )}`,
    ]
      .filter(Boolean)
      .map(
        escapeRegExp
      );

    const pattern =
      new RegExp(
        `(?<!\\d)(?:${alternatives.join('|')})(?!\\d)`,
        'i'
      );

    if (
      pattern.test(
        oldDescription
      )
    ) {
      return oldDescription.replace(
        pattern,
        newTime
      );
    }

    return oldDescription;
  }

  if (
    !oldTime &&
    newTime
  ) {
    const timePattern =
      /\b\d{1,2}(?:h\d{0,2}|:\d{2})\b/i;

    if (
      timePattern.test(
        oldDescription
      )
    ) {
      return oldDescription.replace(
        timePattern,
        newTime
      );
    }

    return oldDescription;
  }

  if (
    oldStart &&
    oldEnd &&
    newStart &&
    newEnd
  ) {
    const start =
      escapeRegExp(
        oldStart
      );

    const end =
      escapeRegExp(
        oldEnd
      );

    const rangePattern =
      new RegExp(
        `(?<!\\d)${start}\\s*(?:à|a|-|–|—)\\s*${end}(?!\\d)`,
        'i'
      );

    if (
      rangePattern.test(
        oldDescription
      )
    ) {
      return oldDescription.replace(
        rangePattern,
        `${newStart} à ${newEnd}`
      );
    }

    return oldDescription;
  }

  if (
    oldValue &&
    newValue
  ) {
    const oldValuePattern =
      new RegExp(
        escapeRegExp(
          oldValue
        ),
        'i'
      );

    if (
      oldValuePattern.test(
        oldDescription
      )
    ) {
      return oldDescription.replace(
        oldValuePattern,
        newValue
      );
    }
  }

  return newDescription;
}

function buildCorrectionHistoryEntry(
  memory,
  correctionData,
  oldValue,
  newValue
) {
  return {
    changed_at:
      new Date().toISOString(),

    previous_description:
      memory.description ||
      memory.source_text ||
      getMemoryText(
        memory
      ),

    previous_time:
      correctionData.old_time ||
      oldValue ||
      '',

    new_time:
      correctionData.new_time ||
      newValue ||
      '',

    previous_time_start:
      correctionData.old_time_start ||
      '',

    previous_time_end:
      correctionData.old_time_end ||
      '',

    new_time_start:
      correctionData.new_time_start ||
      '',

    new_time_end:
      correctionData.new_time_end ||
      '',

    reason:
      'Correction explicite par l’utilisateur',
  };
}

module.exports = {
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
};
