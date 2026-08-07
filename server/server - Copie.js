/*
 * =========================================================
 * MOMENT — SERVER
 * =========================================================
 * VERSION : pré-0.1.0 — correction post-60 tests
 * =========================================================
 */

require('dotenv').config({
  path: __dirname + '/.env',
});

const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* ========================================================= */
/* OUTILS                                                     */
/* ========================================================= */

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function escapeRegExp(value) {
  return String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );
}

function createId(prefix = 'memory') {
  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .substring(2, 9)}`;
}

function getCreatedAt(memory) {
  const value = Date.parse(
    memory?.created_at || ''
  );

  return Number.isFinite(value)
    ? value
    : 0;
}

function getMemoryId(memory) {
  return memory?.id || '';
}

function getMemoryText(memory) {
  return [
    memory?.source_text,
    memory?.description,

    Array.isArray(memory?.facts)
      ? memory.facts.join(' ')
      : '',

    Array.isArray(memory?.actions)
      ? memory.actions.join(' ')
      : '',

    Array.isArray(memory?.intentions)
      ? memory.intentions.join(' ')
      : '',

    Array.isArray(memory?.subjects)
      ? memory.subjects.join(' ')
      : '',

    Array.isArray(memory?.thoughts)
      ? memory.thoughts.join(' ')
      : '',

    memory?.correction_note,

    Array.isArray(memory?.history)
      ? memory.history
          .map(item =>
            [
              item?.previous_description,
              item?.previous_location,
              item?.new_location,
              item?.previous_time,
              item?.new_time,
              item?.reason,
            ]
              .filter(Boolean)
              .join(' ')
          )
          .join(' ')
      : '',
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
}

/* ========================================================= */
/* CHRONOLOGIE CALENDAIRE                                    */
/* ========================================================= */

const PARIS_TIMEZONE = 'Europe/Paris';

const DAYS = [
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
  'dimanche',
];

const DAY_TO_INDEX = {
  dimanche: 0,
  lundi: 1,
  mardi: 2,
  mercredi: 3,
  jeudi: 4,
  vendredi: 5,
  samedi: 6,
};

function getCurrentParisDate() {
  const formatter = new Intl.DateTimeFormat(
    'en-CA',
    {
      timeZone: PARIS_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }
  );

  const parts =
    formatter.formatToParts(
      new Date()
    );

  const values = {};

  for (const part of parts) {
    if (part.type !== 'literal') {
      values[part.type] =
        part.value;
    }
  }

  return `${values.year}-${values.month}-${values.day}`;
}

function parseISODate(value) {
  if (
    typeof value !== 'string'
  ) {
    return null;
  }

  const match =
    value.match(
      /\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/
    );

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function formatISODate(date) {
  if (!date) {
    return '';
  }

  return [
    date.getUTCFullYear(),
    String(
      date.getUTCMonth() + 1
    ).padStart(2, '0'),
    String(
      date.getUTCDate()
    ).padStart(2, '0'),
  ].join('-');
}

function getWeekdayIndexFromISO(
  isoDate
) {
  const date =
    parseISODate(isoDate);

  if (!date) {
    return null;
  }

  return date.getUTCDay();
}

function shiftISODate(
  isoDate,
  days
) {
  const date =
    parseISODate(isoDate);

  if (!date) {
    return '';
  }

  date.setUTCDate(
    date.getUTCDate() + days
  );

  return formatISODate(date);
}

function resolveWeekdayToDate(
  weekday,
  referenceDate = getCurrentParisDate()
) {
  const normalized =
    normalizeText(weekday);

  if (
    !(normalized in DAY_TO_INDEX)
  ) {
    return '';
  }

  const targetIndex =
    DAY_TO_INDEX[normalized];

  const referenceIndex =
    getWeekdayIndexFromISO(
      referenceDate
    );

  if (
    referenceIndex === null
  ) {
    return '';
  }

  let difference =
    referenceIndex - targetIndex;

  if (difference < 0) {
    difference += 7;
  }

  return shiftISODate(
    referenceDate,
    -difference
  );
}

function extractCalendarDateFromText(
  text,
  referenceDate = getCurrentParisDate()
) {
  const normalized =
    normalizeText(text);

  if (!normalized) {
    return '';
  }

  const isoDate =
    parseISODate(normalized);

  if (isoDate) {
    return formatISODate(
      isoDate
    );
  }

  if (
    normalized.includes(
      'avant hier'
    )
  ) {
    return shiftISODate(
      referenceDate,
      -2
    );
  }

  if (
    normalized.includes(
      'aujourd hui'
    )
  ) {
    return referenceDate;
  }

  if (
    normalized.includes('hier')
  ) {
    return shiftISODate(
      referenceDate,
      -1
    );
  }

  if (
    normalized.includes('demain')
  ) {
    return shiftISODate(
      referenceDate,
      1
    );
  }

  for (const day of DAYS) {
    if (
      normalized.includes(
        `${day} prochain`
      ) ||
      normalized.includes(
        `prochain ${day}`
      )
    ) {
      const currentIndex =
        getWeekdayIndexFromISO(
          referenceDate
        );

      const targetIndex =
        DAY_TO_INDEX[day];

      if (
        currentIndex === null
      ) {
        return '';
      }

      let difference =
        targetIndex - currentIndex;

      if (difference <= 0) {
        difference += 7;
      }

      return shiftISODate(
        referenceDate,
        difference
      );
    }
  }

  for (const day of DAYS) {
    if (
      normalized.includes(day)
    ) {
      return resolveWeekdayToDate(
        day,
        referenceDate
      );
    }
  }

  return '';
}

function getMemoryCalendarDate(
  memory
) {
  if (!memory) {
    return '';
  }

  if (
    typeof memory.calendar_date ===
      'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(
      memory.calendar_date
    )
  ) {
    return memory.calendar_date;
  }

  const referenceDate =
    getCurrentParisDate();

  const fromReference =
    extractCalendarDateFromText(
      memory.date_reference,
      referenceDate
    );

  if (fromReference) {
    return fromReference;
  }

  const fromSource =
    extractCalendarDateFromText(
      memory.source_text,
      referenceDate
    );

  if (fromSource) {
    return fromSource;
  }

  return extractCalendarDateFromText(
    memory.description,
    referenceDate
  );
}

function enrichMemoryWithCalendarDate(
  memory
) {
  if (!memory) {
    return memory;
  }

  return {
    ...memory,
    calendar_date:
      getMemoryCalendarDate(memory),
  };
}

function getTemporalSortValue(
  memory
) {
  const calendarDate =
    getMemoryCalendarDate(memory);

  if (calendarDate) {
    const value =
      Date.parse(
        `${calendarDate}T12:00:00Z`
      );

    if (
      Number.isFinite(value)
    ) {
      return value;
    }
  }

  return getCreatedAt(memory);
}

function getDaysFromTemporalQuestion(
  question
) {
  const q =
    normalizeText(question);

  return DAYS.filter(
    day =>
      q.includes(day)
  );
}

function buildTemporalQuestionContext(
  question
) {
  const today =
    getCurrentParisDate();

  const normalized =
    normalizeText(question);

  const days =
    getDaysFromTemporalQuestion(
      question
    );

  const resolvedDays =
    days.map(
      day => ({
        day,
        calendar_date:
          resolveWeekdayToDate(
            day,
            today
          ),
      })
    );

  let sinceDate = '';

  if (
    /\bdepuis\b/.test(normalized) &&
    days.length > 0
  ) {
    sinceDate =
      resolveWeekdayToDate(
        days[0],
        today
      );
  }

  let betweenDates = null;

  if (
    normalized.includes('entre') &&
    days.length >= 2
  ) {
    const first =
      resolveWeekdayToDate(
        days[0],
        today
      );

    const second =
      resolveWeekdayToDate(
        days[1],
        today
      );

    if (
      first &&
      second
    ) {
      betweenDates = {
        start:
          first <= second
            ? first
            : second,

        end:
          first <= second
            ? second
            : first,
      };
    }
  }

  return {
    today,
    days:
      resolvedDays,
    since:
      sinceDate,
    between:
      betweenDates,
  };
}

/* ========================================================= */
/* DÉDUCTIONS                                                 */
/* ========================================================= */

function isDeduction(memory) {
  if (!memory) {
    return false;
  }

  return (
    memory.is_deduction === true ||
    memory.isDeduction === true ||
    memory.type === 'deduction' ||
    memory.type === 'inference' ||
    memory.kind === 'deduction' ||
    memory.kind === 'inference' ||
    Boolean(
      memory.deduction &&
      typeof memory.deduction === 'object'
    )
  );
}

function getDeductionStatus(memory) {
  if (!isDeduction(memory)) {
    return '';
  }

  if (
    memory.deduction &&
    typeof memory.deduction === 'object'
  ) {
    if (
      memory.deduction.status === 'rejected' ||
      memory.deduction.status === 'refuted'
    ) {
      return 'rejected';
    }

    if (
      memory.deduction.validated === true ||
      memory.deduction.status === 'validated'
    ) {
      return 'validated';
    }

    if (
      memory.deduction.pending === true ||
      memory.deduction.status === 'pending'
    ) {
      return 'pending';
    }
  }

  if (
    memory.rejected === true ||
    memory.refuted === true ||
    memory.rejected_inference === true ||
    memory.rejected_deduction === true
  ) {
    return 'rejected';
  }

  if (
    memory.validated === true ||
    memory.validated_deduction === true
  ) {
    return 'validated';
  }

  if (
    memory.pending_validation === true ||
    memory.pendingValidation === true ||
    memory.status === 'pending_validation' ||
    memory.status === 'pending'
  ) {
    return 'pending';
  }

  return 'pending';
}

function isRejectedDeduction(memory) {
  return (
    isDeduction(memory) &&
    getDeductionStatus(memory) ===
      'rejected'
  );
}

function isPendingDeduction(memory) {
  return (
    isDeduction(memory) &&
    getDeductionStatus(memory) ===
      'pending'
  );
}

function isValidatedDeduction(memory) {
  return (
    isDeduction(memory) &&
    getDeductionStatus(memory) ===
      'validated'
  );
}

function isUsableExplicitMemory(memory) {
  if (!memory) {
    return false;
  }

  if (
    isRejectedDeduction(memory) ||
    isPendingDeduction(memory) ||
    isDeduction(memory)
  ) {
    return false;
  }

  return true;
}

function isUsableValidatedDeduction(memory) {
  return (
    isValidatedDeduction(memory) &&
    !isRejectedDeduction(memory)
  );
}

/* ========================================================= */
/* SOURCES D'UNE DÉDUCTION                                   */
/* ========================================================= */

function getDeductionSourceIds(memory) {
  if (
    !memory ||
    !isDeduction(memory)
  ) {
    return [];
  }

  const candidates = [
    memory.source_event_ids,
    memory.sourceEventIds,
    memory.source_memory_ids,
    memory.sourceMemoryIds,
    memory.supporting_event_ids,
    memory.supporting_memory_ids,
  ];

  for (const value of candidates) {
    if (Array.isArray(value)) {
      return value
        .filter(Boolean)
        .map(String);
    }
  }

  if (
    memory.deduction &&
    typeof memory.deduction === 'object'
  ) {
    const nested = [
      memory.deduction.source_event_ids,
      memory.deduction.source_memory_ids,
      memory.deduction.supporting_event_ids,
      memory.deduction.supporting_memory_ids,
    ];

    for (const value of nested) {
      if (Array.isArray(value)) {
        return value
          .filter(Boolean)
          .map(String);
      }
    }
  }

  return [];
}

/* ========================================================= */
/* VALIDATION / RÉFUTATION                                   */
/* ========================================================= */

function getValidationHistory(memory) {
  return Array.isArray(
    memory?.validation_history
  )
    ? memory.validation_history
    : [];
}

function getRefutationHistory(memory) {
  return Array.isArray(
    memory?.refutation_history
  )
    ? memory.refutation_history
    : [];
}

function isRefutationText(text) {
  const q =
    normalizeText(text);

  return (
    q.includes('je refute') ||
    q.includes('c est faux') ||
    q.includes("c'est faux") ||
    q.includes('ce nest pas vrai') ||
    q.includes("ce n'est pas vrai") ||
    q.includes('faux') ||
    q.includes('pas vrai') ||
    q.includes('je me suis trompe') ||
    q.includes('ce nest pas le cas') ||
    q.includes("ce n'est pas le cas")
  );
}

function isValidationText(text) {
  const q =
    normalizeText(text);

  return (
    q.includes('je confirme') ||
    q.includes('c est vrai') ||
    q.includes("c'est vrai") ||
    q.includes('c est bien ca') ||
    q.includes("c'est bien ca") ||
    q.includes('je valide') ||
    q.includes('confirme cette deduction')
  );
}

function findDeductionForRefutation(
  memories,
  text
) {
  if (!Array.isArray(memories)) {
    return null;
  }

  const normalizedQuestion =
    normalizeText(text);

  const deductions =
    memories.filter(
      memory =>
        isDeduction(memory) &&
        !isRejectedDeduction(memory)
    );

  if (deductions.length === 0) {
    return null;
  }

  for (const memory of deductions) {
    const id =
      normalizeText(memory.id);

    if (
      id &&
      normalizedQuestion.includes(id)
    ) {
      return memory;
    }
  }

  let best = null;
  let bestScore = 0;

  for (const memory of deductions) {
    const description =
      normalizeText(
        memory.description ||
        memory.inference ||
        memory.claim ||
        getMemoryText(memory)
      );

    if (!description) {
      continue;
    }

    const words =
      description
        .split(/\s+/)
        .filter(
          word =>
            word.length >= 4
        );

    let score = 0;

    for (const word of words) {
      if (
        normalizedQuestion.includes(word)
      ) {
        score++;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = memory;
    }
  }

  return bestScore >= 2
    ? best
    : null;
}

function findDeductionForValidation(
  memories,
  text
) {
  return findDeductionForRefutation(
    memories,
    text
  );
}

function rejectDeduction(
  deduction,
  reason = ''
) {
  if (
    !deduction ||
    !isDeduction(deduction)
  ) {
    return null;
  }

  const now =
    new Date().toISOString();

  return {
    ...deduction,

    rejected: true,
    refuted: true,
    rejected_inference: true,
    rejected_deduction: true,

    status: 'rejected',

    pending_validation: false,
    pendingValidation: false,

    validated: false,
    validated_deduction: false,

    deduction: {
      ...(deduction.deduction &&
      typeof deduction.deduction === 'object'
        ? deduction.deduction
        : {}),

      status: 'rejected',
      pending: false,
      validated: false,
      rejected: true,
      refuted: true,
      refuted_at: now,
    },

    refutation_history: [
      ...getRefutationHistory(deduction),
      {
        refuted_at: now,
        reason:
          reason ||
          'Réfutation explicite par l’utilisateur',
      },
    ],

    refutation_note:
      reason ||
      'Réfutation explicite par l’utilisateur',

    source_event_ids:
      getDeductionSourceIds(
        deduction
      ),
  };
}

function validateDeduction(deduction) {
  if (
    !deduction ||
    !isDeduction(deduction)
  ) {
    return null;
  }

  if (
    isRejectedDeduction(deduction)
  ) {
    return deduction;
  }

  const now =
    new Date().toISOString();

  return {
    ...deduction,

    validated: true,
    validated_deduction: true,

    rejected: false,
    refuted: false,

    pending_validation: false,
    pendingValidation: false,

    status: 'validated',

    deduction: {
      ...(deduction.deduction &&
      typeof deduction.deduction === 'object'
        ? deduction.deduction
        : {}),

      status: 'validated',
      pending: false,
      validated: true,
      rejected: false,
      refuted: false,
      validated_at: now,
    },

    validation_history: [
      ...getValidationHistory(deduction),
      {
        validated_at: now,
        reason:
          'Validation explicite par l’utilisateur',
      },
    ],

    source_event_ids:
      getDeductionSourceIds(
        deduction
      ),
  };
}

/* ========================================================= */
/* PERSONNES                                                  */
/* ========================================================= */

const KNOWN_PEOPLE = [
  'marc',
  'leo',
  'chloe',
  'sophie',
  'paul',
  'julien',
  'axelle',
];

function findPersonInQuestion(question) {
  const q =
    normalizeText(question);

  for (const person of KNOWN_PEOPLE) {
    const regex =
      new RegExp(
        `\\b${escapeRegExp(person)}\\b`,
        'i'
      );

    if (regex.test(q)) {
      return person;
    }
  }

  return '';
}

function memoryContainsPerson(
  memory,
  wantedPerson
) {
  const wanted =
    normalizeText(wantedPerson);

  if (!wanted) {
    return false;
  }

  if (
    Array.isArray(memory?.people)
  ) {
    for (const person of memory.people) {
      if (
        normalizeText(person) ===
        wanted
      ) {
        return true;
      }
    }
  }

  const text =
    normalizeText(
      getMemoryText(memory)
    );

  const regex =
    new RegExp(
      `\\b${escapeRegExp(wanted)}\\b`,
      'i'
    );

  return regex.test(text);
}

/* ========================================================= */
/* JOURS                                                      */
/* ========================================================= */

function getDaysFromQuestion(question) {
  const q =
    normalizeText(question);

  return DAYS.filter(
    day =>
      q.includes(day)
  );
}

function findDayInQuestion(question) {
  const days =
    getDaysFromQuestion(question);

  return days.length > 0
    ? days[0]
    : '';
}

function memoryContainsDay(
  memory,
  wantedDay
) {
  const wanted =
    normalizeText(wantedDay);

  if (!wanted) {
    return false;
  }

  if (
    normalizeText(
      memory?.date_reference
    ).includes(wanted)
  ) {
    return true;
  }

  const text =
    normalizeText(
      getMemoryText(memory)
    );

  return text.includes(wanted);
}

/* ========================================================= */
/* DATES DE CORRECTION                                       */
/* ========================================================= */

const MONTHS = {
  janvier: 1,
  fevrier: 2,
  février: 2,
  mars: 3,
  avril: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  aout: 8,
  août: 8,
  septembre: 9,
  octobre: 10,
  novembre: 11,
  decembre: 12,
  décembre: 12,
};

function extractExplicitDateFromText(text) {
  const normalized =
    normalizeText(text);

  const numericMatch =
    normalized.match(
      /\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](20\d{2}))?\b/
    );

  if (numericMatch) {
    const day =
      Number(numericMatch[1]);

    const month =
      Number(numericMatch[2]);

    const year =
      numericMatch[3]
        ? Number(numericMatch[3])
        : new Date().getFullYear();

    const date =
      new Date(
        Date.UTC(
          year,
          month - 1,
          day
        )
      );

    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    ) {
      return formatISODate(date);
    }
  }

  const textualMatch =
    normalized.match(
      /\b(\d{1,2})\s+(janvier|fevrier|février|mars|avril|mai|juin|juillet|aout|août|septembre|octobre|novembre|decembre|décembre)(?:\s+(20\d{2}))?\b/
    );

  if (textualMatch) {
    const day =
      Number(textualMatch[1]);

    const month =
      MONTHS[textualMatch[2]];

    const year =
      textualMatch[3]
        ? Number(textualMatch[3])
        : new Date().getFullYear();

    const date =
      new Date(
        Date.UTC(
          year,
          month - 1,
          day
        )
      );

    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    ) {
      return formatISODate(date);
    }
  }

  return '';
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
      String(wantedDate)
    ).trim();

  const memoryCalendar =
    normalizeText(
      String(
        memory?.calendar_date || ''
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
      String(
        getMemoryText(
          memory
        ) || ''
      )
    ).trim();

  /*
   * Correspondance directe.
   */
  if (
    text.includes(
      normalizedWanted
    )
  ) {
    return true;
  }

  /*
   * Si wantedDate est une date ISO :
   *
   * 2026-08-12
   *
   * rechercher également :
   *
   * 12 août 2026
   * 12 août
   * 12/08/2026
   * 12-08-2026
   */

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

    /*
     * Autorise également :
     *
     * 12 août
     *
     * lorsque l'année n'est pas répétée
     * dans le texte de la mémoire.
     */
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

/* ========================================================= */
/* LIEUX                                                      */
/* ========================================================= */

function getMemoryLocation(memory) {
  if (
    Array.isArray(memory?.places)
  ) {
    for (const place of memory.places) {
      if (
        place &&
        String(place).trim()
      ) {
        return String(place).trim();
      }
    }
  }

  if (
    typeof memory?.context === 'string' &&
    memory.context.trim()
  ) {
    return memory.context.trim();
  }

  return '';
}

/* ========================================================= */
/* TRAVAIL                                                    */
/* ========================================================= */

function memoryIsAboutWork(memory) {
  const text =
    normalizeText(
      getMemoryText(memory)
    );

  if (
    Array.isArray(memory?.subjects)
  ) {
    for (const subject of memory.subjects) {
      const normalized =
        normalizeText(subject);

      if (
        normalized.includes('travail') ||
        normalized.includes('travaille') ||
        normalized.includes('travailler')
      ) {
        return true;
      }
    }
  }

  return (
    text.includes('travaille') ||
    text.includes('travail') ||
    text.includes('travailler') ||
    text.includes('planning') ||
    text.includes('horaire') ||
    text.includes('horaires')
  );
}

/* ========================================================= */
/* RENDEZ-VOUS / ÉVÉNEMENTS PLANIFIÉS                        */
/* ========================================================= */

function memoryIsAppointmentLike(memory) {
  const text =
    normalizeText(
      getMemoryText(memory)
    );

  return (
    text.includes('rendez vous') ||
    text.includes('rdv') ||
    text.includes('visite') ||
    text.includes('consultation') ||
    text.includes('medecin') ||
    text.includes('docteur') ||
    text.includes('dentiste') ||
    text.includes('reunion') ||
    text.includes('reunion') ||
    text.includes('meeting') ||
    text.includes('entretien') ||
    text.includes('appointment')
  );
}

function getMemoryTimes(memory) {
  const text =
    getMemoryText(memory) || '';

  const normalized =
    normalizeText(text);

  const times = [];

  const patterns = [
    /\b([01]?\d|2[0-3])h(?:([0-5]\d))?\b/gi,
    /\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/g,
  ];

  for (const pattern of patterns) {
    let match;

    while (
      (match =
        pattern.exec(normalized)) !== null
    ) {
      const hour =
        String(
          Number(match[1])
        ).padStart(2, '0');

      const minute =
        match[2]
          ? String(
              Number(match[2])
            ).padStart(2, '0')
          : '00';

      const canonical =
        `${hour}:${minute}`;

      if (
        !times.includes(canonical)
      ) {
        times.push(canonical);
      }
    }
  }

  return times;
}

function normalizeTimeValue(value) {
  if (!value) {
    return '';
  }

  const normalized =
    normalizeText(value)
      .replace(/\s+/g, '');

  let match =
    normalized.match(
      /^([01]?\d|2[0-3])h([0-5]\d)?$/
    );

  if (match) {
    return `${String(
      Number(match[1])
    ).padStart(2, '0')}:${String(
      Number(match[2] || 0)
    ).padStart(2, '0')}`;
  }

  match =
    normalized.match(
      /^([01]?\d|2[0-3])[:.]([0-5]\d)$/
    );

  if (match) {
    return `${String(
      Number(match[1])
    ).padStart(2, '0')}:${String(
      Number(match[2])
    ).padStart(2, '0')}`;
  }

  return normalized;
}

function timeAppearsInMemory(
  memory,
  wantedTime
) {
  const normalizedWanted =
    normalizeTimeValue(
      wantedTime
    );

  if (!normalizedWanted) {
    return false;
  }

  const memoryTimes =
    getMemoryTimes(memory);

  return memoryTimes.includes(
    normalizedWanted
  );
}

function extractTimePartsFromMemory(
  memory
) {
  return getMemoryTimes(memory);
}

/* ========================================================= */
/* SITUATION                                                  */
/* ========================================================= */

function extractSituation(memory) {
  const text =
    getMemoryText(memory);

  const normalized =
    normalizeText(text);

  let person = '';

  if (
    Array.isArray(memory?.people)
  ) {
    for (const value of memory.people) {
      if (
        value &&
        normalizeText(value) !== 'moi'
      ) {
        person =
          String(value).trim();
        break;
      }
    }
  }

  if (!person) {
    for (const candidate of KNOWN_PEOPLE) {
      const regex =
        new RegExp(
          `\\b${escapeRegExp(candidate)}\\b`,
          'i'
        );

      if (regex.test(normalized)) {
        person = candidate;
        break;
      }
    }
  }

  let day = '';

  for (const candidate of DAYS) {
    if (
      normalized.includes(candidate)
    ) {
      day = candidate;
      break;
    }
  }

  return {
    person,
    day,

    subject:
      memoryIsAboutWork(memory)
        ? 'travail'
        : '',

    location:
      getMemoryLocation(memory),

    calendar_date:
      getMemoryCalendarDate(memory),

    times:
      extractTimePartsFromMemory(
        memory
      ),

    created_at:
      getCreatedAt(memory),

    id:
      getMemoryId(memory),

    text,
  };
}

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
    !isUsableExplicitMemory(newEvent)
  ) {
    return null;
  }

  const newSituation =
    extractSituation(newEvent);

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

  const candidates = [];

  for (const oldMemory of memories) {
    if (
      !isUsableExplicitMemory(
        oldMemory
      )
    ) {
      continue;
    }

    const oldSituation =
      extractSituation(oldMemory);

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

    if (!oldSituation.location) {
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
      memory: oldMemory,
      situation: oldSituation,
    });
  }

  if (
    candidates.length === 0
  ) {
    return null;
  }

  candidates.sort(
    (a, b) =>
      getTemporalSortValue(
        b.memory
      ) -
      getTemporalSortValue(
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
      .charAt(0).toUpperCase() +
    newSituation.person.slice(1);

  const day =
    newSituation.day;

  const oldLocation =
    oldSituation.location;

  const newLocation =
    newSituation.location;

  /*
   * =================================================
   * EXTRACTION DES HORAIRES
   * =================================================
   */

  const extractTimeRange = (
    value
  ) => {
    const text =
      String(value || '');

    const match =
      text.match(
        /\b(\d{1,2})h(?:\s*(\d{1,2}))?\s*(?:à|a|-|–|—)\s*(\d{1,2})h(?:\s*(\d{1,2}))?\b/i
      );

    if (!match) {
      return null;
    }

    return {
      start:
        `${match[1]}h${
          match[2] || ''
        }`,

      end:
        `${match[3]}h${
          match[4] || ''
        }`,
    };
  };

  const oldTime =
    extractTimeRange(
      [
        oldSituation.text || '',
        oldMemory.description || '',
        oldMemory.date_reference || '',
        ...(Array.isArray(
          oldMemory.facts
        )
          ? oldMemory.facts
          : []),
      ].join(' ')
    );

  const newTime =
    extractTimeRange(
      [
        newSituation.text || '',
        newEvent.description || '',
        newEvent.source_text || '',
        newEvent.date_reference || '',
        ...(Array.isArray(
          newEvent.facts
        )
          ? newEvent.facts
          : []),
      ].join(' ')
    );

  /*
   * =================================================
   * TEXTE DE MODIFICATION
   * =================================================
   */

  let changeText =
    `Initialement prévu à ${oldLocation}, mais finalement à ${newLocation}.`;

  if (
    oldTime &&
    newTime
  ) {
    changeText =
      `Horaire corrigé : de ${oldTime.start} à ${oldTime.end} ` +
      `devient de ${newTime.start} à ${newTime.end}.`;
  }

  /*
   * =================================================
   * DESCRIPTION
   * =================================================
   */

  let description =
    `${person} travaille ${day} à ${newLocation}.`;

  if (newTime) {
    description =
      `${person} travaille ${day} à ${newLocation} ` +
      `de ${newTime.start} à ${newTime.end}.`;
  }

  /*
   * =================================================
   * DATE_REFERENCE
   * =================================================
   *
   * On part de la nouvelle date fournie par le serveur.
   * Si elle contient encore l'ancien horaire, on le
   * remplace explicitement par le nouvel horaire.
   */

  let dateReference =
    newEvent.date_reference ||
    oldMemory.date_reference ||
    '';

  if (
    oldTime &&
    newTime
  ) {
    const oldRange =
      `${oldTime.start}\\s*(?:à|a|-|–|—)\\s*${oldTime.end}`;

    dateReference =
      dateReference.replace(
        new RegExp(
          oldRange,
          'gi'
        ),
        `de ${newTime.start} à ${newTime.end}`
      );

    /*
     * Cas où le serveur a conservé uniquement
     * l'heure de fin.
     */
    dateReference =
      dateReference.replace(
        new RegExp(
          `\\b${oldTime.end}\\b`,
          'gi'
        ),
        newTime.end
      );
  }

  /*
   * Si aucun remplacement n'a fonctionné mais qu'un
   * nouvel horaire est connu, on s'assure qu'il apparaît.
   */
  if (
    newTime &&
    !new RegExp(
      `\\b${newTime.start}\\b.*\\b${newTime.end}\\b`,
      'i'
    ).test(
      dateReference
    )
  ) {
    if (
      dateReference.trim()
    ) {
      dateReference =
        `${dateReference} de ${newTime.start} à ${newTime.end}`;
    } else {
      dateReference =
        `de ${newTime.start} à ${newTime.end}`;
    }
  }

  /*
   * =================================================
   * FAITS
   * =================================================
   */

  let correctedFacts =
    Array.isArray(
      newEvent.facts
    )
      ? [...newEvent.facts]
      : [];

  /*
   * Si le serveur a renvoyé les anciens horaires
   * dans les faits, on les remplace par les nouveaux.
   */
  if (
    oldTime &&
    newTime
  ) {
    correctedFacts =
      correctedFacts.map(
        fact => {
          if (
            typeof fact !==
            'string'
          ) {
            return fact;
          }

          let correctedFact =
            fact;

          correctedFact =
            correctedFact.replace(
              new RegExp(
                `${oldTime.start}\\s*(?:à|a|-|–|—)\\s*${oldTime.end}`,
                'gi'
              ),
              `${newTime.start} à ${newTime.end}`
            );

          correctedFact =
            correctedFact.replace(
              new RegExp(
                `\\b${oldTime.end}\\b`,
                'gi'
              ),
              newTime.end
            );

          return correctedFact;
        }
      );
  }

  /*
   * Si aucun fait ne contient le nouvel horaire,
   * on ajoute explicitement l'information corrigée.
   */
  const hasCorrectedSchedule =
    correctedFacts.some(
      fact =>
        typeof fact ===
          'string' &&
        newTime &&
        new RegExp(
          `\\b${newTime.start}\\b.*\\b${newTime.end}\\b`,
          'i'
        ).test(
          fact
        )
    );

  if (
    newTime &&
    !hasCorrectedSchedule
  ) {
    correctedFacts.push(
      `Horaires : de ${newTime.start} à ${newTime.end}.`
    );
  }

  /*
   * =================================================
   * HISTORIQUE
   * =================================================
   */

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

    previous_time:
      oldTime
        ? `${oldTime.start} à ${oldTime.end}`
        : '',

    new_time:
      newTime
        ? `${newTime.start} à ${newTime.end}`
        : '',

    reason:
      'Correction explicite par l’utilisateur',
  };

  const previousHistory =
    Array.isArray(
      oldMemory.history
    )
      ? oldMemory.history
      : [];

  /*
   * =================================================
   * MÉMOIRE CORRIGÉE
   * =================================================
   */

  return {
    ...oldMemory,

    id:
      oldMemory.id,

    description,

    source_text:
      newEvent.source_text ||
      newEvent.description ||
      oldMemory.source_text,

    date_reference:
      dateReference,

    date_precision:
      newEvent.date_precision ||
      oldMemory.date_precision,

    calendar_date:
      newEvent.calendar_date ||
      getMemoryCalendarDate(
        newEvent
      ) ||
      oldMemory.calendar_date,

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

    facts:
      correctedFacts,

    relations:
      Array.isArray(
        newEvent.relations
      )
        ? newEvent.relations
        : oldMemory.relations,

    confidence:
      newEvent.confidence ??
      oldMemory.confidence,

    created_at:
      oldMemory.created_at ||
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
/* QUESTIONS                                                  */
/* ========================================================= */

function isHistoricalQuestion(question) {
  const q =
    normalizeText(question);

  return (
    q.includes("qu'avais-je dit") ||
    q.includes("qu'est-ce que j'avais dit") ||
    q.includes("que t'avais-je dit") ||
    q.includes("qu'avais-je indique") ||
    q.includes("qu'est-ce que je t'avais dit") ||
    q.includes("qu'est-ce que j'avais indique") ||
    (
      q.includes('concernant') &&
      q.includes('avais-je')
    )
  );
}

function isCurrentStateQuestion(question) {
  const q =
    normalizeText(question);

  const hasWork =
    q.includes('travail') ||
    q.includes('travaille') ||
    q.includes('travailler') ||
    q.includes('planning') ||
    q.includes('horaire') ||
    q.includes('horaires');

  const hasLocationQuestion =
    q.includes('ou travaille') ||
    q.includes('ou est') ||
    q.includes('ou se trouve') ||
    q.includes('quel lieu') ||
    q.includes('quel endroit');

  const hasScheduleQuestion =
    q.includes('horaire') ||
    q.includes('horaires') ||
    q.includes('heure') ||
    q.includes('heures') ||
    q.includes('de quelle heure') ||
    q.includes('a quelle heure');

  const hasDay =
    DAYS.some(
      day =>
        q.includes(day)
    );

  return (
    hasWork &&
    (
      hasLocationQuestion ||
      hasScheduleQuestion ||
      hasDay
    )
  );
}

/* ========================================================= */
/* PRÉSENCE / AVEC MOI                                       */
/* ========================================================= */

function isWithMeQuestion(question) {
  const q =
    normalizeText(question);

  const directPresencePatterns = [
    /\betais\s*[- ]?\s*je\s+avec\s+(marc|leo|chloe|sophie|paul|julien|axelle)\b/i,

    /\betais\s*[- ]?\s*j[' ]?avec\s+(marc|leo|chloe|sophie|paul|julien|axelle)\b/i,

    /\best\s*[- ]?\s*ce\s*[- ]?\s*que\s*j[' ]?etais\s+avec\s+(marc|leo|chloe|sophie|paul|julien|axelle)\b/i,

    /\bj[' ]?etais\s+avec\s+(marc|leo|chloe|sophie|paul|julien|axelle)\b/i,

    /\bai\s*[- ]?\s*je\s+ete\s+avec\s+(marc|leo|chloe|sophie|paul|julien|axelle)\b/i,

    /\bavec\s+(marc|leo|chloe|sophie|paul|julien|axelle)\s+etais\s*[- ]?\s*je\b/i,
  ];

  if (
    directPresencePatterns.some(
      pattern =>
        pattern.test(q)
    )
  ) {
    return true;
  }

  return (
    q.includes('avec moi') ||
    q.includes('avec toi') ||
    q.includes('ensemble') ||

    q.includes('etait elle avec moi') ||
    q.includes('etait il avec moi') ||
    q.includes('etait elle avec toi') ||
    q.includes('etait il avec toi') ||

    q.includes('a mange avec moi') ||
    q.includes('mange avec moi') ||
    q.includes('mangeait avec moi') ||
    q.includes('manger avec moi') ||

    q.includes('dejeune avec moi') ||
    q.includes('dejeunait avec moi') ||
    q.includes('dejeuner avec moi') ||

    q.includes('dine avec moi') ||
    q.includes('dinait avec moi') ||
    q.includes('diner avec moi')
  );
}

function explicitlyIndicatesTogether(
  memory,
  person
) {
  if (
    !memory ||
    !person
  ) {
    return false;
  }

  const normalizedPerson =
    normalizeText(person);

  const texts = [
    memory.source_text,
    memory.description,
    ...(Array.isArray(memory.facts)
      ? memory.facts
      : []),
    ...(Array.isArray(memory.actions)
      ? memory.actions
      : []),
  ]
    .filter(Boolean)
    .map(normalizeText);

  const personPattern =
    escapeRegExp(
      normalizedPerson
    );

  const explicitPatterns = [
    new RegExp(
      `\\bavec\\s+${personPattern}\\b`,
      'i'
    ),

    new RegExp(
      `\\b${personPattern}\\s+avec\\s+moi\\b`,
      'i'
    ),

    new RegExp(
      `\\b${personPattern}\\s+et\\s+moi\\b`,
      'i'
    ),

    new RegExp(
      `\\bmoi\\s+et\\s+${personPattern}\\b`,
      'i'
    ),

    new RegExp(
      `\\bj[' ]?ai\\s+mange(?:\\s+avec)?\\s+${personPattern}\\b`,
      'i'
    ),

    new RegExp(
      `\\bmange(?:r|e|ais|ait)?\\s+avec\\s+${personPattern}\\b`,
      'i'
    ),

    new RegExp(
      `\\bdejeun(?:er|e|ais|ait)?\\s+avec\\s+${personPattern}\\b`,
      'i'
    ),

    new RegExp(
      `\\bdin(?:er|e|ais|ait)?\\s+avec\\s+${personPattern}\\b`,
      'i'
    ),

    new RegExp(
      `\\b${personPattern}\\s+etait\\s+avec\\s+moi\\b`,
      'i'
    ),

    new RegExp(
      `\\b${personPattern}\\s+etait\\s+avec\\s+toi\\b`,
      'i'
    ),

    new RegExp(
      `\\b${personPattern}\\s+et\\s+moi\\s+etions\\b`,
      'i'
    ),

    new RegExp(
      `\\bnous\\s+etions\\s+avec\\s+${personPattern}\\b`,
      'i'
    ),
  ];

  for (const text of texts) {
    if (
      explicitPatterns.some(
        pattern =>
          pattern.test(text)
      )
    ) {
      return true;
    }
  }

  return false;
}

function findPersonDayMemories(
  memories,
  person,
  day
) {
  return memories
    .filter(
      memory =>
        isUsableExplicitMemory(memory)
    )
    .filter(
      memory =>
        memoryContainsPerson(
          memory,
          person
        )
    )
    .filter(
      memory =>
        memoryContainsDay(
          memory,
          day
        )
    )
    .sort(
      (a, b) =>
        getTemporalSortValue(b) -
        getTemporalSortValue(a)
    );
}

/* ========================================================= */
/* DÉDUCTIONS VALIDÉES                                       */
/* ========================================================= */

function getValidatedDeductionText(memory) {
  if (!memory) {
    return '';
  }

  return (
    memory.description ||
    memory.inference ||
    memory.claim ||
    memory.deduction?.description ||
    getMemoryText(memory) ||
    ''
  );
}

function tokenizeForMatching(text) {
  return normalizeText(text)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/)
    .filter(
      word =>
        word.length >= 3
    );
}

function getImportantQuestionWords(question) {
  const stopWords = new Set([
    'est',
    'ce',
    'que',
    'qui',
    'quoi',
    'comment',
    'pourquoi',
    'quand',
    'ou',
    'avec',
    'moi',
    'toi',
    'il',
    'elle',
    'etait',
    'ete',
    'vraiment',
    'bien',
    'donc',
    'dans',
    'sur',
    'au',
    'aux',
    'du',
    'de',
    'la',
    'le',
    'les',
    'un',
    'une',
    'des',
    'a',
    'ai',
    'je',
    'tu',
    'mon',
    'ma',
    'mes',
    'ton',
    'ta',
    'tes',
    'lundi',
    'mardi',
    'mercredi',
    'jeudi',
    'vendredi',
    'samedi',
    'dimanche',
  ]);

  return [
    ...new Set(
      tokenizeForMatching(question)
        .filter(
          word =>
            !stopWords.has(word)
        )
    ),
  ];
}

function findValidatedDeductionForQuestion(
  memories,
  question
) {
  if (!Array.isArray(memories)) {
    return null;
  }

  const validated =
    memories.filter(
      memory =>
        isUsableValidatedDeduction(memory)
    );

  if (
    validated.length === 0
  ) {
    return null;
  }

  const normalizedQuestion =
    normalizeText(question);

  for (const memory of validated) {
    const id =
      normalizeText(memory.id);

    if (
      id &&
      normalizedQuestion.includes(id)
    ) {
      return memory;
    }
  }

  const questionWords =
    getImportantQuestionWords(
      question
    );

  const questionPerson =
    findPersonInQuestion(question);

  const questionDay =
    findDayInQuestion(question);

  let best = null;
  let bestScore = 0;

  for (const memory of validated) {
    const text =
      getValidatedDeductionText(
        memory
      );

    if (!text) {
      continue;
    }

    const normalizedText =
      normalizeText(text);

    if (
      questionPerson &&
      !memoryContainsPerson(
        memory,
        questionPerson
      )
    ) {
      continue;
    }

    if (
      questionDay &&
      !memoryContainsDay(
        memory,
        questionDay
      )
    ) {
      continue;
    }

    const deductionWords =
      new Set(
        tokenizeForMatching(text)
      );

    let score = 0;

    for (const word of questionWords) {
      if (
        deductionWords.has(word)
      ) {
        score++;
      }
    }

    if (
      questionPerson &&
      normalizedText.includes(
        normalizeText(questionPerson)
      )
    ) {
      score += 3;
    }

    if (
      questionDay &&
      normalizedText.includes(
        normalizeText(questionDay)
      )
    ) {
      score += 2;
    }

    const minimumScore =
      questionPerson && questionDay
        ? 5
        : 2;

    if (
      score >= minimumScore &&
      score > bestScore
    ) {
      bestScore = score;
      best = memory;
    }
  }

  return best;
}

function buildValidatedDeductionAnswer(
  deduction
) {
  const text =
    getValidatedDeductionText(
      deduction
    ).trim();

  if (!text) {
    return "Oui, cette information a été validée.";
  }

  return text;
}

/* ========================================================= */
/* PLANNING                                                   */
/* ========================================================= */

function findWorkEvents(
  memories,
  person,
  day
) {
  const candidates = [];

  for (const memory of memories) {
    if (
      !isUsableExplicitMemory(memory)
    ) {
      continue;
    }

    if (
      !memoryContainsPerson(
        memory,
        person
      )
    ) {
      continue;
    }

    if (
      !memoryIsAboutWork(memory)
    ) {
      continue;
    }

    if (
      !memoryContainsDay(
        memory,
        day
      )
    ) {
      continue;
    }

    candidates.push({
      memory,
      situation:
        extractSituation(memory),
    });
  }

  candidates.sort(
    (a, b) =>
      getTemporalSortValue(a.memory) -
      getTemporalSortValue(b.memory)
  );

  return candidates;
}

function findLatestWorkEvent(
  memories,
  person,
  day
) {
  const events =
    findWorkEvents(
      memories,
      person,
      day
    );

  return (
    events[events.length - 1] ||
    null
  );
}

/* ========================================================= */
/* HISTORIQUE DE CORRECTION                                   */
/* ========================================================= */

function getCorrectionHistory(memory) {
  if (
    !memory ||
    !Array.isArray(memory.history)
  ) {
    return [];
  }

  return memory.history.filter(
    entry =>
      entry &&
      (
        entry.previous_location ||
        entry.new_location ||
        entry.previous_time ||
        entry.new_time ||
        entry.previous_description
      )
  );
}

function buildHistoricalAnswer(
  person,
  day,
  memory
) {
  const displayPerson =
    person.charAt(0).toUpperCase() +
    person.slice(1);

  const currentLocation =
    getMemoryLocation(memory);

  const history =
    getCorrectionHistory(memory);

  if (
    history.length > 0
  ) {
    const firstChange =
      history[0];

    const previousLocation =
      firstChange.previous_location;

    const newLocation =
      firstChange.new_location ||
      currentLocation;

    if (
      previousLocation &&
      newLocation &&
      normalizeText(previousLocation) !==
      normalizeText(newLocation)
    ) {
      return (
        `Tu avais d'abord indiqué que ${displayPerson} ` +
        `travaillait ${day} à ${previousLocation}, ` +
        `puis tu as corrigé cette information en précisant ` +
        `qu'il travaillait finalement à ${newLocation}.`
      );
    }

    if (
      firstChange.previous_time &&
      firstChange.new_time
    ) {
      return (
        `Tu avais d'abord indiqué que ${displayPerson} ` +
        `avait cet horaire à ${firstChange.previous_time}, ` +
        `puis tu as corrigé cette information en précisant ` +
        `qu'il était finalement à ${firstChange.new_time}.`
      );
    }
  }

  if (
    memory.corrected &&
    typeof memory.correction_note === 'string' &&
    memory.correction_note.trim()
  ) {
    return (
      `Tu avais indiqué que ${displayPerson} ` +
      `travaillait ${day} à ${currentLocation}. ` +
      `${memory.correction_note}`
    );
  }

  return (
    `Tu avais dit que ${displayPerson} ` +
    `travaille ${day} à ${currentLocation}.`
  );
}

/* ========================================================= */
/* CLAIMS / DÉDUCTIONS VALIDÉS                                */
/* ========================================================= */

function collectValidatedClaims(
  memories
) {
  const claims = [];

  for (const memory of memories) {
    if (
      !memory ||
      !Array.isArray(
        memory.validated_claims
      )
    ) {
      continue;
    }

    for (
      const claim of memory.validated_claims
    ) {
      if (
        claim &&
        typeof claim.claim === 'string' &&
        claim.claim.trim()
      ) {
        claims.push({
          event_id:
            memory.id || '',

          claim:
            claim.claim.trim(),

          validated_at:
            claim.validated_at || '',
        });
      }
    }
  }

  return claims;
}

function collectValidatedDeductions(
  memories
) {
  return memories
    .filter(
      memory =>
        isUsableValidatedDeduction(memory)
    )
    .map(
      memory => ({
        event_id:
          memory.id || '',

        description:
          memory.description ||
          memory.inference ||
          memory.claim ||
          getMemoryText(memory),

        source_event_ids:
          getDeductionSourceIds(memory),

        validated_at:
          memory.deduction?.validated_at ||
          memory.validated_at ||
          '',
      })
    );
}

/* ========================================================= */
/* CORRECTION                                                 */
/* ========================================================= */

function isCorrectionRequest(text) {
  const normalized =
    normalizeText(text);

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
        normalized.includes(word)
    );

  if (!hasCorrectionWord) {
    return false;
  }

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

  return correctionContextWords.some(
    word =>
      normalized.includes(
        normalizeText(word)
      )
  );
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
      getMemoryText(memory)
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
        normalizeText(candidate)
      )
  );
}

function correctionDateMatchesMemory(
  dateReference,
  day,
  memory
) {
  if (dateReference) {
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

function correctionOldValueMatchesMemory(
  correctionData,
  oldValue,
  memory
) {
  const oldTime =
    correctionData.old_time || '';

  const oldStart =
    correctionData.old_time_start || '';

  const oldEnd =
    correctionData.old_time_end || '';

  if (
    oldTime
  ) {
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
      getMemoryTimes(memory);

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
        times.includes(start) &&
        times.includes(end)
      );
    }

    if (start) {
      return times.includes(start);
    }

    if (end) {
      return times.includes(end);
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
        getMemoryText(memory)
      );

    const words =
      normalizedOld
        .split(/\s+/)
        .filter(
          word =>
            word.length >= 2
        );

    if (
      words.length === 0
    ) {
      return false;
    }

    return words.every(
      word =>
        normalizedMemory.includes(word)
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
    correctionContext === 'travail' &&
    memoryIsAboutWork(memory)
  ) {
    score += 20;
  }

  if (
    (
      correctionContext === 'rendez vous' ||
      correctionContext === 'visite' ||
      correctionContext === 'consultation' ||
      correctionContext === 'reunion' ||
      correctionContext === 'entretien'
    ) &&
    memoryIsAppointmentLike(memory)
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

    if (
      person &&
      !memoryContainsPerson(
        memory,
        person
      )
    ) {
      continue;
    }

    if (
      !correctionDateMatchesMemory(
        dateReference,
        day,
        memory
      )
    ) {
      continue;
    }

    if (
      correctionContext &&
      !correctionContextMatchesMemory(
        correctionContext,
        memory
      )
    ) {
      continue;
    }

    if (
      (
        correctionData.old_time ||
        correctionData.old_time_start ||
        correctionData.old_time_end ||
        oldValue
      ) &&
      !correctionOldValueMatchesMemory(
        correctionData,
        oldValue,
        memory
      )
    ) {
      continue;
    }

    const score =
      scoreCorrectionCandidate(
        memory,
        correction
      );

    scored.push({
      memory,
      score,
      times:
        getMemoryTimes(memory),
    });
  }

  scored.sort(
    (a, b) => {
      if (
        b.score !== a.score
      ) {
        return b.score - a.score;
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
    correctionData.old_time || '';

  const newTime =
    correctionData.new_time || '';

  const oldStart =
    correctionData.old_time_start || '';

  const oldEnd =
    correctionData.old_time_end || '';

  const newStart =
    correctionData.new_time_start || '';

  const newEnd =
    correctionData.new_time_end || '';

  /*
   * =================================================
   * CORRECTION D'UNE HEURE SIMPLE
   * ancienne heure -> nouvelle heure
   * =================================================
   */

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
              oldCanonical.split(':')[0]
            )
          )
        : '';

    const oldMinute =
      oldCanonical
        ? Number(
            oldCanonical.split(':')[1]
          )
        : 0;

    const alternatives = [
      oldTime,
      oldTime.replace(/\s+/g, ''),
      `${oldHour}h`,
      `${oldHour}h${String(
        oldMinute
      ).padStart(2, '0')}`,
      `${oldHour}:${String(
        oldMinute
      ).padStart(2, '0')}`,
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

  /*
   * =================================================
   * CORRECTION D'UNE HEURE
   * ANCIENNE HEURE NON INDIQUÉE
   * =================================================
   *
   * Exemple :
   *
   * "Le rendez-vous de Julien du 12 août
   * est finalement à 11h."
   *
   * Mémoire :
   *
   * "Rendez-vous ... le 12 août 2026 à 10h"
   *
   * Résultat :
   *
   * "Rendez-vous ... le 12 août 2026 à 11h"
   */

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

  /*
   * =================================================
   * CORRECTION D'UNE PLAGE HORAIRE
   * =================================================
   */

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

  /*
   * =================================================
   * CORRECTION GÉNÉRIQUE
   * =================================================
   */

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
      getMemoryText(memory),

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
        normalizeText(text);

      console.log(
        '🧪 TEST CORRECTION :',
        text.trim(),
        '=>',
        isCorrectionRequest(text)
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
        isCorrectionRequest(text)
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

          correctionData =
            JSON.parse(
              correctionResponse.output_text
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
          typeof correctionData === 'object'
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

        const oldTime =
          correctionData.old_time
            ? correctionData.old_time.trim()
            : '';

        const newTime =
          correctionData.new_time
            ? correctionData.new_time.trim()
            : '';

        const oldStart =
          correctionData.old_time_start
            ? correctionData.old_time_start.trim()
            : '';

        const oldEnd =
          correctionData.old_time_end
            ? correctionData.old_time_end.trim()
            : '';

        const newStart =
          correctionData.new_time_start
            ? correctionData.new_time_start.trim()
            : '';

        const newEnd =
          correctionData.new_time_end
            ? correctionData.new_time_end.trim()
            : '';

        console.log(
          '🧠 CORRECTION COMPRISE :',
          correctionData
        );

        /* ================================================= */
        /* IDENTIFICATION PERSONNE                            */
        /* ================================================= */

        const person =
          correctionPerson ||
          findPersonInQuestion(text);

        /* ================================================= */
        /* IDENTIFICATION JOUR                               */
        /* ================================================= */

        let day =
          correctionDay ||
          findDayInQuestion(text);

        /* ================================================= */
        /* IDENTIFICATION DATE                               */
        /* ================================================= */

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

          if (resolved) {
            dateReference =
              resolved;
          }
        }

        /* ================================================= */
        /* VALEURS ANCIENNE / NOUVELLE                       */
        /* ================================================= */

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

        /*
         * Sécurité supplémentaire pour les formulations
         * "nouvelle valeur au lieu de ancienne valeur".
         *
         * Le modèle reste prioritaire, mais lorsque le texte
         * contient clairement "au lieu de", on vérifie que
         * les deux valeurs sont bien présentes.
         */

        const normalizedRequest =
          normalizeText(text);

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
              parts.slice(1).join(
                ' au lieu de '
              );

            const timesBefore =
              [
                ...before.matchAll(
                  /\b([01]?\d|2[0-3])h(?:([0-5]\d))?\b/gi
                ),
              ].map(
                match =>
                  `${match[1]}h${
                    match[2] || ''
                  }`
              );

            const timesAfter =
              [
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
              timesBefore.length === 1 &&
              timesAfter.length === 1
            ) {
              if (
                !newTime ||
                !oldTime
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
            }

            if (
              timesBefore.length === 2 &&
              timesAfter.length === 2
            ) {
              if (
                !newStart ||
                !newEnd ||
                !oldStart ||
                !oldEnd
              ) {
                correctionData.new_time_start =
                  timesBefore[0];

                correctionData.new_time_end =
                  timesBefore[1];

                correctionData.old_time_start =
                  timesAfter[0];

                correctionData.old_time_end =
                  timesAfter[1];

                oldValue =
                  `${timesAfter[0]} à ${timesAfter[1]}`;

                newValue =
                  `${timesBefore[0]} à ${timesBefore[1]}`;
              }
            }
          }
        }

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
            oldStart:
              correctionData.old_time_start ||
              oldStart,
            oldEnd:
              correctionData.old_time_end ||
              oldEnd,
            newStart:
              correctionData.new_time_start ||
              newStart,
            newEnd:
              correctionData.new_time_end ||
              newEnd,
          }
        );

        const normalizedOldStart =
          correctionData.old_time_start ||
          oldStart;

        const normalizedOldEnd =
          correctionData.old_time_end ||
          oldEnd;

        const normalizedNewStart =
          correctionData.new_time_start ||
          newStart;

        const normalizedNewEnd =
          correctionData.new_time_end ||
          newEnd;

        const normalizedCorrectionData = {
          ...correctionData,

          old_time_start:
            normalizedOldStart,

          old_time_end:
            normalizedOldEnd,

          new_time_start:
            normalizedNewStart,

          new_time_end:
            normalizedNewEnd,
        };

        /* ================================================= */
        /* RECHERCHE DES MÉMOIRES CANDIDATES                 */
        /* ================================================= */

        const correction =
          {
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

        /*
         * Si la date est explicitement présente et qu'aucune
         * mémoire n'est trouvée sous cette forme, on tente
         * une résolution calendaire à partir du texte stocké.
         */

        if (
          scoredCandidates.length === 0 &&
          dateReference
        ) {
          const resolvedDate =
            extractCalendarDateFromText(
              dateReference
            );

          if (
            resolvedDate &&
            resolvedDate !== dateReference
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

        /*
         * Recherche spéciale des horaires de travail :
         *
         * lorsqu'une personne et un jour sont connus,
         * on conserve toutes les mémoires correspondant
         * réellement à cette personne et à ce jour.
         *
         * L'ancienne heure/plage sert ensuite à départager.
         */

        if (
          scoredCandidates.length === 0 &&
          correctionContext === 'travail' &&
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
                    normalizedOldStart ||
                    normalizedOldEnd ||
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
                  b.score - a.score
              );
        }

        /*
         * Suppression des doublons.
         */

        const uniqueById = new Map();

        for (
          const candidate of scoredCandidates
        ) {
          const id =
            candidate.memory?.id ||
            `candidate_${uniqueById.size}`;

          if (
            !uniqueById.has(id)
          ) {
            uniqueById.set(
              id,
              candidate
            );
          }
        }

        const uniqueCandidates =
          [...uniqueById.values()];

        console.log(
          '🔎 MÉMOIRES CANDIDATES POUR CORRECTION :',
          uniqueCandidates
        );

        /* ================================================= */
        /* AUCUNE MÉMOIRE TROUVÉE                            */
        /* ================================================= */

        if (
          uniqueCandidates.length === 0
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
                'generic',

              person:
                person || '',

              date:
                dateReference || '',

              day:
                day || '',

              context:
                correctionData.context ||
                '',

              old_value:
                oldValue,

              new_value:
                newValue,

              old_time:
                oldTime || null,

              new_time:
                newTime || null,

              old_time_range:
                normalizedOldStart &&
                normalizedOldEnd
                  ? {
                      start:
                        normalizedOldStart,

                      end:
                        normalizedOldEnd,
                    }
                  : null,

              new_time_range:
                normalizedNewStart &&
                normalizedNewEnd
                  ? {
                      start:
                        normalizedNewStart,

                      end:
                        normalizedNewEnd,
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

        /*
         * =================================================
         * SÉLECTION D'UNE CIBLE
         * =================================================
         *
         * Une seule mémoire est automatiquement retenue
         * uniquement si elle domine clairement les autres.
         *
         * Sinon Moment demande une clarification.
         */

        const best =
          uniqueCandidates[0];

        const second =
          uniqueCandidates[1];

        let selectedCandidate =
          null;

        if (
          uniqueCandidates.length === 1
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

          /*
           * Pour une correction horaire avec une ancienne
           * heure explicitement indiquée, une correspondance
           * exacte sur l'heure permet de sélectionner la bonne
           * mémoire même si plusieurs événements existent.
           */

          const exactOldTime =
            (
              oldTime &&
              timeAppearsInMemory(
                best.memory,
                oldTime
              )
            ) ||
            (
              normalizedOldStart &&
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

        /* ================================================= */
        /* PLUSIEURS MÉMOIRES POSSIBLES                      */
        /* ================================================= */

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
                'generic',

              person:
                person || '',

              date:
                dateReference || '',

              day:
                day || '',

              context:
                correctionData.context ||
                '',

              old_value:
                oldValue,

              new_value:
                newValue,

              old_time:
                oldTime || null,

              new_time:
                newTime || null,

              old_time_range:
                normalizedOldStart &&
                normalizedOldEnd
                  ? {
                      start:
                        normalizedOldStart,

                      end:
                        normalizedOldEnd,
                    }
                  : null,

              new_time_range:
                normalizedNewStart &&
                normalizedNewEnd
                  ? {
                      start:
                        normalizedNewStart,

                      end:
                        normalizedNewEnd,
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

        /* ================================================= */
        /* UNE SEULE MÉMOIRE CIBLE                           */
        /* ================================================= */

        const memory =
          selectedCandidate.memory;

        const oldDescription =
          memory?.description ||
          memory?.source_text ||
          getMemoryText(
            memory
          ) ||
          '';

         /*
         * =================================================
         * CONSTRUCTION DE LA NOUVELLE INFORMATION
         * =================================================
         */

        const newDescription =
          buildCorrectedDescription(
            oldDescription,
            normalizedCorrectionData,
            oldValue,
            newValue
          );

        /*
         * -------------------------------------------------
         * CORRECTION DE LA DESCRIPTION
         * -------------------------------------------------
         */

        memory.description =
          newDescription;

        /*
         * -------------------------------------------------
         * CORRECTION DES CHAMPS TEXTUELS LIÉS
         * -------------------------------------------------
         *
         * Une correction d'heure doit être propagée dans
         * tous les champs qui contiennent l'ancienne heure.
         */

        const correctedOldTime =
          normalizedCorrectionData.old_time || '';

        const correctedNewTime =
          normalizedCorrectionData.new_time || '';

        const replaceCorrectedTime =
          value => {
            if (
              !value ||
              !correctedNewTime
            ) {
              return value;
            }

            /*
             * Cas normal :
             * ancienne heure connue.
             */
            if (
              correctedOldTime
            ) {
              return buildCorrectedDescription(
                value,
                normalizedCorrectionData,
                oldValue,
                newValue
              );
            }

            /*
             * Cas :
             * "Le rendez-vous de Julien du 12 août
             *  est finalement à 11h."
             *
             * L'ancienne heure n'est pas fournie
             * dans la demande, mais la mémoire possède
             * une heure qu'il faut remplacer.
             */
            return value.replace(
              /\b\d{1,2}(?:h\d{0,2}|:\d{2})\b/gi,
              correctedNewTime
            );
          };

        /*
         * date_reference
         */
        if (
          memory.date_reference
        ) {
          memory.date_reference =
            replaceCorrectedTime(
              memory.date_reference
            );
        }

        /*
         * source_text
         */
        if (
          memory.source_text
        ) {
          memory.source_text =
            replaceCorrectedTime(
              memory.source_text
            );
        }

        /*
         * -------------------------------------------------
         * CORRECTION DES FACTS
         * -------------------------------------------------
         */

        if (
          Array.isArray(
            memory.facts
          )
        ) {
          memory.facts =
            memory.facts.map(
              fact =>
                replaceCorrectedTime(
                  fact
                )
            );
        }

        /*
         * -------------------------------------------------
         * CORRECTION DES RELATIONS
         * -------------------------------------------------
         */

        if (
          Array.isArray(
            memory.relations
          )
        ) {
          memory.relations =
            memory.relations.map(
              relation =>
                replaceCorrectedTime(
                  relation
                )
            );
        }

        /*
         * -------------------------------------------------
         * CORRECTION DU CONTEXTE
         * -------------------------------------------------
         */

        if (
          typeof memory.context ===
          'string' &&
          memory.context
        ) {
          memory.context =
            replaceCorrectedTime(
              memory.context
            );
        }

        /*
         * -------------------------------------------------
         * CORRECTION DES PENSÉES
         * -------------------------------------------------
         */

        if (
          Array.isArray(
            memory.thoughts
          )
        ) {
          memory.thoughts =
            memory.thoughts.map(
              thought =>
                replaceCorrectedTime(
                  thought
                )
            );
        }

        /*
         * -------------------------------------------------
         * CORRECTION DES ACTIONS
         * -------------------------------------------------
         */

        if (
          Array.isArray(
            memory.actions
          )
        ) {
          memory.actions =
            memory.actions.map(
              action =>
                replaceCorrectedTime(
                  action
                )
            );
        }

        /*
         * -------------------------------------------------
         * CORRECTION DES INTENTIONS
         * -------------------------------------------------
         */

        if (
          Array.isArray(
            memory.intentions
          )
        ) {
          memory.intentions =
            memory.intentions.map(
              intention =>
                replaceCorrectedTime(
                  intention
                )
            );
        }

        /*
         * -------------------------------------------------
         * HISTORIQUE
         * -------------------------------------------------
         */

        const historyEntry =
          buildCorrectionHistoryEntry(
            memory,
            normalizedCorrectionData,
            oldValue,
            newValue
          );

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
        /*
         * =================================================
         * MÉMOIRE CORRIGÉE
         * =================================================
         *
         * La mémoire n'est PAS enregistrée ici.
         * Le client conserve le mécanisme de confirmation.
         */

                 const correctedMemory = {
          ...memory,

          id:
            memory.id,

          /*
           * -------------------------------------------------
           * DESCRIPTION
           * -------------------------------------------------
           */
          description:
            newDescription,

          /*
           * -------------------------------------------------
           * SOURCE
           * -------------------------------------------------
           */
          source_text:
            (() => {
              const source =
                memory.source_text || '';

              if (
                !source
              ) {
                return source;
              }

              const correctedNewTime =
                normalizedCorrectionData.new_time || '';

              const correctedOldTime =
                normalizedCorrectionData.old_time || '';

              if (
                correctedNewTime
              ) {
                if (
                  correctedOldTime
                ) {
                  return buildCorrectedDescription(
                    source,
                    normalizedCorrectionData,
                    oldValue,
                    newValue
                  );
                }

                return source.replace(
                  /\b\d{1,2}(?:h\d{0,2}|:\d{2})\b/i,
                  correctedNewTime
                );
              }

              if (
                oldValue &&
                newValue
              ) {
                return buildCorrectedDescription(
                  source,
                  normalizedCorrectionData,
                  oldValue,
                  newValue
                );
              }

              return source;
            })(),

          /*
           * -------------------------------------------------
           * DATE / HEURE
           * -------------------------------------------------
           */
          date_reference:
            (() => {
              const currentDateReference =
                memory.date_reference || '';

              const correctedNewTime =
                normalizedCorrectionData.new_time || '';

              const correctedOldTime =
                normalizedCorrectionData.old_time || '';

              if (
                !currentDateReference ||
                !correctedNewTime
              ) {
                return currentDateReference;
              }

              if (
                correctedOldTime
              ) {
                return buildCorrectedDescription(
                  currentDateReference,
                  normalizedCorrectionData,
                  oldValue,
                  newValue
                );
              }

              return currentDateReference.replace(
                /\b\d{1,2}(?:h\d{0,2}|:\d{2})\b/i,
                correctedNewTime
              );
            })(),

          calendar_date:
            memory.calendar_date ||
            getMemoryCalendarDate(
              memory
            ),

          /*
           * -------------------------------------------------
           * DONNÉES STRUCTURÉES
           * -------------------------------------------------
           *
           * IMPORTANT :
           * les textes structurés doivent eux aussi refléter
           * la correction.
           */
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
                    buildCorrectedDescription(
                      relation,
                      normalizedCorrectionData,
                      oldValue,
                      newValue
                    )
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

          context:
            memory.context || '',

          /*
           * -------------------------------------------------
           * MARQUEURS DE CORRECTION
           * -------------------------------------------------
           */
          corrected:
            true,

          was_corrected:
            true,

          correction_note:
            oldValue && newValue
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
            normalizedOldStart || '',

          corrected_old_time_end:
            normalizedOldEnd || '',

          corrected_new_time_start:
            normalizedNewStart || '',

          corrected_new_time_end:
            normalizedNewEnd || '',

          /*
           * -------------------------------------------------
           * HISTORIQUE
           * -------------------------------------------------
           */
          history: [
            ...(Array.isArray(
              memory.history
            )
              ? memory.history
              : []),

            historyEntry,
          ],

          /*
           * -------------------------------------------------
           * HISTORIQUE DE MODIFICATION
           * -------------------------------------------------
           */
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

              date_reference:
                memory.date_reference,

              corrected_at:
                new Date().toISOString(),
            },
          ],
        };

        /*
         * =================================================
         * RETOUR DE LA DEMANDE DE CORRECTION
         * =================================================
         */
        console.log(
          '🧪 CORRECTED MEMORY ENVOYÉE :',
          JSON.stringify(
            correctedMemory,
            null,
            2
          )
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
              correctionContext === 'travail'
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
              correctionData.context ||
              '',

            old_value:
              oldValue,

            new_value:
              newValue,

            old_time:
              oldTime || null,

            new_time:
              newTime || null,

            old_time_range:
              normalizedOldStart &&
              normalizedOldEnd
                ? {
                    start:
                      normalizedOldStart,

                    end:
                      normalizedOldEnd,
                  }
                : null,

            new_time_range:
              normalizedNewStart &&
              normalizedNewEnd
                ? {
                    start:
                      normalizedNewStart,

                    end:
                      normalizedNewEnd,
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
        isRefutationText(text)
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
        isValidationText(text)
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
        result =
          JSON.parse(
            response.output_text
          );
      } catch (error) {
        console.error(
          '❌ JSON compréhension invalide :',
          response.output_text
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
        result.events = [];
      }

      result.events =
        result.events.map(
          event => {
            const id =
              event.id ||
              createId('memory');

            const deduction =
              event.is_deduction === true ||
              event.type === 'deduction';

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

            return enrichMemoryWithCalendarDate(
              normalizedEvent
            );
          }
        );

      /* =================================================== */
      /* CONTRADICTIONS DE PLANNING                           */
      /* =================================================== */

      for (
        const event of result.events
      ) {
        const contradiction =
          findContradiction(
            existingMemories,
            event
          );

        if (contradiction) {
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

      return res
        .status(500)
        .json({
          error:
            'Erreur lors de la compréhension de la mémoire',
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
        !Array.isArray(memories)
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
        isWithMeQuestion(question);

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

          if (togetherMemory) {
            const displayPerson =
              person.charAt(0).toUpperCase() +
              person.slice(1);

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
                    togetherMemory.id || '',

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

          if (mentionedMemory) {
            const displayPerson =
              person.charAt(0).toUpperCase() +
              person.slice(1);

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
                    mentionedMemory.id || '',

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
                validatedDeduction.id || '',

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
              validatedDeduction.id || '',

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
            workEvents.length === 0
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
              (item, index, array) =>
                index ===
                array.findIndex(
                  other =>
                    other.memory?.description ===
                    item.memory?.description
                )
            );

          const displayPerson =
            person.charAt(0).toUpperCase() +
            person.slice(1);

          if (
            uniques.length === 1
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
                    memory.id || '',

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
            descriptionsUniques.length === 1
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
            events.length > 0
          ) {
            if (
              events.length === 1
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

              const evidence = [];

              evidence.push({
                event_id:
                  memory.id || '',

                status:
                  'explicit',

                claim:
                  memory.description ||
                  events[0].situation.text ||
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
                      memory.id || '',

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
                  .join('\n'),

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
        [...enrichedMemories].sort(
          (a, b) =>
            getTemporalSortValue(a) -
            getTemporalSortValue(b)
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

            _calendar_date_source:
              memory.calendar_date
                ? 'stored_or_resolved'
                : 'not_available',

            _deduction_status:
              isDeduction(memory)
                ? getDeductionStatus(memory)
                : null,

            _source_event_ids:
              isDeduction(memory)
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
        result =
          JSON.parse(
            response.output_text
          );
      } catch (error) {
        console.error(
          '❌ JSON rappel invalide :',
          response.output_text
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
        result.event_ids = [];
      }

      if (
        !Array.isArray(
          result.evidence
        )
      ) {
        result.evidence = [];
      }

      if (
        typeof result.confidence !==
        'number'
      ) {
        result.confidence = 0;
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
            validEventIds.has(id)
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
                  item.event_id === '' ||
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
          validEventIds.has(id)
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
  process.env.PORT || 3000;

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