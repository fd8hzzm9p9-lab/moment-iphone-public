/*
 * =========================================================
 * MOMENT — CALENDRIER / CHRONOLOGIE
 * MEMENTO 001-02
 * =========================================================
 *
 * Extraction structurelle depuis server/server.js.
 * La logique fonctionnelle d'origine est conservée.
 */

const {
  normalizeText,
  escapeRegExp,
  createId,
  getCreatedAt,
  getMemoryId,
  getMemoryText,
} = require('./core');

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
  const formatter =
    new Intl.DateTimeFormat(
      'en-CA',
      {
        timeZone:
          PARIS_TIMEZONE,
        year:
          'numeric',
        month:
          '2-digit',
        day:
          '2-digit',
      }
    );

  const parts =
    formatter.formatToParts(
      new Date()
    );

  const values = {};

  for (
    const part of parts
  ) {
    if (
      part.type !==
      'literal'
    ) {
      values[
        part.type
      ] =
        part.value;
    }
  }

  return `${values.year}-${values.month}-${values.day}`;
}

function parseISODate(value) {
  if (
    typeof value !==
    'string'
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

  const year =
    Number(match[1]);

  const month =
    Number(match[2]);

  const day =
    Number(match[3]);

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  if (
    date.getUTCFullYear() !==
      year ||
    date.getUTCMonth() !==
      month - 1 ||
    date.getUTCDate() !==
      day
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
    parseISODate(
      isoDate
    );

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
    parseISODate(
      isoDate
    );

  if (!date) {
    return '';
  }

  date.setUTCDate(
    date.getUTCDate() +
      days
  );

  return formatISODate(
    date
  );
}

function resolveWeekdayToDate(
  weekday,
  referenceDate =
    getCurrentParisDate()
) {
  const normalized =
    normalizeText(
      weekday
    );

  if (
    !(normalized in
      DAY_TO_INDEX)
  ) {
    return '';
  }

  const targetIndex =
    DAY_TO_INDEX[
      normalized
    ];

  const referenceIndex =
    getWeekdayIndexFromISO(
      referenceDate
    );

  if (
    referenceIndex ===
    null
  ) {
    return '';
  }

  let difference =
    referenceIndex -
    targetIndex;

  if (
    difference < 0
  ) {
    difference += 7;
  }

  return shiftISODate(
    referenceDate,
    -difference
  );
}

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
function extractExplicitDateFromText(
  text
) {
  const normalized =
    normalizeText(
      text
    );

  const numericMatch =
    normalized.match(
      /\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](20\d{2}))?\b/
    );

  if (numericMatch) {
    const day =
      Number(
        numericMatch[1]
      );

    const month =
      Number(
        numericMatch[2]
      );

    const year =
      numericMatch[3]
        ? Number(
            numericMatch[3]
          )
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
      date.getUTCFullYear() ===
        year &&
      date.getUTCMonth() ===
        month - 1 &&
      date.getUTCDate() ===
        day
    ) {
      return formatISODate(
        date
      );
    }
  }

  const textualMatch =
    normalized.match(
      /\b(\d{1,2})\s+(janvier|fevrier|février|mars|avril|mai|juin|juillet|aout|août|septembre|octobre|novembre|decembre|décembre)(?:\s+(20\d{2}))?\b/
    );

  if (textualMatch) {
    const day =
      Number(
        textualMatch[1]
      );

    const month =
      MONTHS[
        textualMatch[2]
      ];

    const year =
      textualMatch[3]
        ? Number(
            textualMatch[3]
          )
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
      date.getUTCFullYear() ===
        year &&
      date.getUTCMonth() ===
        month - 1 &&
      date.getUTCDate() ===
        day
    ) {
      return formatISODate(
        date
      );
    }
  }

  return '';
}

/* ======================================================= */
/* DATE CALENDAIRE EXPLICITE OU RELATIVE                   */
/* ======================================================= */

function extractCalendarDateFromText(
  text,
  referenceDate =
    getCurrentParisDate(),
  temporalDirection =
    'unknown'
) {
  const normalized =
    normalizeText(
      text
    );

  if (!normalized) {
    return '';
  }

  /*
   * Un repère générique comme :
   *
   * "un dimanche"
   *
   * ne désigne pas un dimanche précis.
   */
  if (
    /\bun\s+(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/.test(
      normalized
    )
  ) {
    return '';
  }

  /*
   * Date explicite :
   *
   * "12 août"
   * "12 août 2026"
   */
  const explicitDate =
    extractExplicitDateFromText(
      normalized
    );

  if (explicitDate) {
    return explicitDate;
  }

  /*
   * Date ISO explicite.
   */
  const isoDate =
    parseISODate(
      normalized
    );

  if (isoDate) {
    return formatISODate(
      isoDate
    );
  }

  /*
   * =========================================================
   * RÉFÉRENCES RELATIVES DÉTERMINISTES
   * =========================================================
   *
   * Ces références ont toujours une date calculable.
   *
   * "avant-hier"   => -2 jours
   * "après-demain" => +2 jours
   * "aujourd'hui"  => date actuelle
   * "demain"       => +1 jour
   * "hier"         => -1 jour
   *
   * IMPORTANT :
   * "après-demain" doit être testé AVANT "demain",
   * car "après-demain" contient la chaîne "demain".
   *
   * La temporal_direction n'est volontairement PAS utilisée
   * ici : le mot lui-même donne déjà la direction.
   */

if (
  /avant[-\s]?hier/.test(
    normalized
  )
) {
  const result =
    shiftISODate(
      referenceDate,
      -2
    );

  console.log(
    '🧪 CALENDAR DEBUG : "avant-hier" =>',
    result
  );

  return result;
}

  /*
   * IMPORTANT :
   * Ce test doit être AVANT le test "demain".
   */
if (
  /apres[-\s]?demain/.test(
    normalized
  )
) {
  const result =
    shiftISODate(
      referenceDate,
      2
    );

  console.log(
    '🧪 CALENDAR DEBUG : "après-demain" =>',
    result
  );

  return result;
}

  if (
    normalized.includes(
      "aujourd hui"
    )
  ) {
    console.log(
      '🧪 CALENDAR DEBUG : "aujourd’hui" =>',
      referenceDate
    );

    return referenceDate;
  }

  if (
    normalized.includes(
      'demain'
    )
  ) {
    const result =
      shiftISODate(
        referenceDate,
        1
      );

    console.log(
      '🧪 CALENDAR DEBUG : "demain" =>',
      result
    );

    return result;
  }

  if (
    normalized.includes(
      'hier'
    )
  ) {
    const result =
      shiftISODate(
        referenceDate,
        -1
      );

    console.log(
      '🧪 CALENDAR DEBUG : "hier" =>',
      result
    );

    return result;
  }

  /*
   * =========================================================
   * "DANS X JOURS"
   * =========================================================
   */

  const futureDaysMatch =
    normalized.match(
      /^dans\s+(\d+)\s+jours?$/
    );

  if (
    futureDaysMatch
  ) {
    const days =
      Number(
        futureDaysMatch[1]
      );

    if (
      Number.isFinite(
        days
      )
    ) {
      const result =
        shiftISODate(
          referenceDate,
          days
        );

      console.log(
        '🧪 CALENDAR DEBUG : "dans X jours" =>',
        result
      );

      return result;
    }
  }

  /*
   * =========================================================
   * "IL Y A X JOURS"
   * =========================================================
   */

  const pastDaysMatch =
    normalized.match(
      /^il\s+y\s+a\s+(\d+)\s+jours?$/
    );

  if (
    pastDaysMatch
  ) {
    const days =
      Number(
        pastDaysMatch[1]
      );

    if (
      Number.isFinite(
        days
      )
    ) {
      const result =
        shiftISODate(
          referenceDate,
          -days
        );

      console.log(
        '🧪 CALENDAR DEBUG : "il y a X jours" =>',
        result
      );

      return result;
    }
  }
  /*
   * =========================================================
   * JOUR DE LA SEMAINE + "DERNIER"
   * =========================================================
   *
   * "samedi dernier"
   * "dimanche dernier"
   *
   * désigne explicitement le dernier jour correspondant
   * dans le passé.
   */

  for (
    const day of DAYS
  ) {
    if (
      normalized.includes(
        `${day} dernier`
      ) ||
      normalized.includes(
        `dernier ${day}`
      )
    ) {
      const currentIndex =
        getWeekdayIndexFromISO(
          referenceDate
        );

      const targetIndex =
        DAY_TO_INDEX[day];

      if (
        currentIndex ===
        null
      ) {
        return '';
      }

      let difference =
        targetIndex -
        currentIndex;

      /*
       * On veut TOUJOURS le jour précédent,
       * jamais aujourd'hui.
       */
      if (
        difference >= 0
      ) {
        difference -= 7;
      }

      const result =
        shiftISODate(
          referenceDate,
          difference
        );

      console.log(
        '🧪 CALENDAR DEBUG : jour dernier =>',
        {
          day,
          temporalDirection,
          result,
        }
      );

      return result;
    }
  }
  /*
   * =========================================================
   * JOUR DE LA SEMAINE + "PROCHAIN"
   * =========================================================
   *
   * "lundi prochain"
   * "vendredi prochain"
   *
   * désigne explicitement le prochain jour correspondant.
   */

  for (
    const day of DAYS
  ) {
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
        currentIndex ===
        null
      ) {
        return '';
      }

      let difference =
        targetIndex -
        currentIndex;

      if (
        difference <= 0
      ) {
        difference += 7;
      }

      const result =
        shiftISODate(
          referenceDate,
          difference
        );

      console.log(
        '🧪 CALENDAR DEBUG : jour prochain =>',
        {
          day,
          temporalDirection,
          result,
        }
      );

      return result;
    }
  }

  /*
   * =========================================================
   * JOUR DE LA SEMAINE SANS "PROCHAIN"
   * =========================================================
   *
   * Passé :
   *   "je suis allé dimanche"
   *   "il a plu mardi"
   *
   * Futur :
   *   "j'y vais dimanche"
   *   "je dois appeler Marc mardi"
   *
   * Générique :
   *   "un dimanche"
   *
   * Inconnu :
   *   aucune date inventée.
   */

  for (
    const day of DAYS
  ) {
    if (
      normalized.includes(
        day
      )
    ) {
      if (
        temporalDirection ===
        'generic'
      ) {
        return '';
      }

      const currentIndex =
        getWeekdayIndexFromISO(
          referenceDate
        );

      const targetIndex =
        DAY_TO_INDEX[day];

      if (
        currentIndex ===
        null
      ) {
        return '';
      }

      let difference =
        targetIndex -
        currentIndex;

      /*
       * FUTUR
       *
       * On prend le prochain jour correspondant.
       */
      if (
        temporalDirection ===
        'future'
      ) {
        if (
          difference <= 0
        ) {
          difference += 7;
        }

        const result =
          shiftISODate(
            referenceDate,
            difference
          );

        console.log(
          '🧪 CALENDAR DEBUG : jour futur =>',
          {
            day,
            result,
          }
        );

        return result;
      }

      /*
       * PASSÉ
       *
       * On prend le dernier jour correspondant.
       */
      if (
        temporalDirection ===
        'past'
      ) {
        if (
          difference >= 0
        ) {
          difference -= 7;
        }

        const result =
          shiftISODate(
            referenceDate,
            difference
          );

        console.log(
          '🧪 CALENDAR DEBUG : jour passé =>',
          {
            day,
            result,
          }
        );

        return result;
      }

      /*
       * Direction inconnue :
       * ne rien inventer.
       */
      return '';
    }
  }

  return '';
}

/* ======================================================= */
/* DÉBUT DE SEMAINE                                        */
/* ======================================================= */

function getWeekStartISODate(
  referenceDate
) {
  const date =
    new Date(
      `${referenceDate}T00:00:00Z`
    );

  const day =
    date.getUTCDay();

  const diff =
    day === 0
      ? -6
      : 1 - day;

  date.setUTCDate(
    date.getUTCDate() +
      diff
  );

  return formatISODate(
    date
  );
}

/* ======================================================= */
/* PÉRIODE RELATIVE                                        */
/* ======================================================= */

function getRelativePeriodFromText(
  text,
  referenceDate =
    getCurrentParisDate()
) {
  
const normalized =
    normalizeText(
      text
    );

  if (!normalized) {
    return null;
  }

  const weekStart =
    getWeekStartISODate(
      referenceDate
    );
    
  if (
    normalized.includes(
      'semaine prochaine'
    )
  ) {
    return {
      type:
        'relative_period',

      reference:
        'la semaine prochaine',

      start:
        shiftISODate(
          weekStart,
          7
        ),

      end:
        shiftISODate(
          weekStart,
          13
        ),
    };
  }

  if (
    normalized.includes(
      'cette semaine'
    )
  ) {
    return {
      type:
        'relative_period',

      reference:
        'cette semaine',

      start:
        weekStart,

      end:
        shiftISODate(
          weekStart,
          6
        ),
    };
  }

  if (
    normalized.includes(
      'semaine derniere'
    )
  ) {
    return {
      type:
        'relative_period',

      reference:
        'la semaine dernière',

      start:
        shiftISODate(
          weekStart,
          -7
        ),

      end:
        shiftISODate(
          weekStart,
          -1
        ),
    };
  }

  return null;
}


/* ======================================================= */
/* RÉFÉRENCE TEMPORELLE RELATIVE                           */
/* ======================================================= */

function extractRelativeTimeReference(
  text
) {
  const normalized =
    normalizeText(
      text
    );

  if (!normalized) {
    return null;
  }

  if (
    normalized.includes(
      'la semaine prochaine'
    )
  ) {
    return {
      type:
        'relative_week',

      offset:
        1,

      reference:
        'la semaine prochaine',
    };
  }

  if (
    normalized.includes(
      'la semaine suivante'
    )
  ) {
    return {
      type:
        'relative_week',

      offset:
        1,

      reference:
        'la semaine suivante',
    };
  }

  const matchWeeks =
    normalized.match(
      /dans (\d+) semaines?/
    );

  if (matchWeeks) {
    const offset =
      Number(
        matchWeeks[1]
      );

    if (
      Number.isFinite(
        offset
      ) &&
      offset >
        0
    ) {
      return {
        type:
          'relative_week',

        offset,

        reference:
          matchWeeks[0],
      };
    }
  }

  return null;
}


/* ======================================================= */
/* DATE CALENDAIRE D'UNE MÉMOIRE                           */
/* ======================================================= */

function getMemoryCalendarDate(
  memory
) {
  if (!memory) {
    console.log(
      '🧪 CALENDAR DEBUG : memory absente'
    );

    return '';
  }

  console.log(
    '🧪 CALENDAR DEBUG : memory =',
    {
      date_reference:
        memory.date_reference,

      source_text:
        memory.source_text,

      description:
        memory.description,

      temporal_direction:
        memory.temporal_direction,

      calendar_date:
        memory.calendar_date,
    }
  );

  /*
   * Si une date calendaire existe déjà
   * et qu'elle est valide, on la conserve.
   */
  if (
    typeof memory.calendar_date ===
      'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(
      memory.calendar_date
    )
  ) {
    console.log(
      '🧪 CALENDAR DEBUG : date déjà présente =',
      memory.calendar_date
    );

    return memory.calendar_date;
  }

  const referenceDate =
    getCurrentParisDate();

  console.log(
    '🧪 CALENDAR DEBUG : referenceDate =',
    referenceDate
  );

  /*
   * =========================================================
   * 1. date_reference
   * =========================================================
   *
   * Exemple :
   *
   * date_reference = "demain"
   * temporal_direction = "future"
   *
   * => 2026-08-07
   */

  const fromReference =
    extractCalendarDateFromText(
      memory.date_reference || '',
      referenceDate,
      memory.temporal_direction ||
        'unknown'
    );

  console.log(
    '🧪 CALENDAR DEBUG : fromReference =',
    fromReference
  );

  if (fromReference) {
    return fromReference;
  }

  /*
   * =========================================================
   * 2. source_text
   * =========================================================
   *
   * Sécurité si date_reference est vide ou mal extraite.
   */

  const fromSource =
    extractCalendarDateFromText(
      memory.source_text || '',
      referenceDate,
      memory.temporal_direction ||
        'unknown'
    );

  console.log(
    '🧪 CALENDAR DEBUG : fromSource =',
    fromSource
  );

  if (fromSource) {
    return fromSource;
  }

  /*
   * =========================================================
   * 3. description
   * =========================================================
   *
   * Dernier recours.
   */

  const fromDescription =
    extractCalendarDateFromText(
      memory.description || '',
      referenceDate,
      memory.temporal_direction ||
        'unknown'
    );

  console.log(
    '🧪 CALENDAR DEBUG : fromDescription =',
    fromDescription
  );

  return fromDescription || '';
}

/* ======================================================= */
/* ENRICHISSEMENT CALENDRIER                               */
/* ======================================================= */

function enrichMemoryWithCalendarDate(
  memory
) {
  if (!memory) {
    return memory;
  }

  const enrichedMemory = {
    ...memory,

    calendar_date:
      getMemoryCalendarDate(
        memory
      ),
  };

  const relativePeriod =
    getRelativePeriodFromText(
      memory.date_reference ||
      memory.source_text ||
      ''
    );

  if (relativePeriod) {
    enrichedMemory.relative_period =
      relativePeriod;
  }

  return enrichedMemory;
}
function getTemporalSortValue(
  memory
) {
  const calendarDate =
    getMemoryCalendarDate(
      memory
    );

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

  return getCreatedAt(
    memory
  );
}

function getDaysFromTemporalQuestion(
  question
) {
  const q =
    normalizeText(
      question
    );

  return DAYS.filter(
    day =>
      q.includes(day)
  );
}

function getISOWeekRange(
  week,
  year
) {
  const january4 =
    new Date(
      Date.UTC(
        year,
        0,
        4
      )
    );

  const day =
    january4.getUTCDay() ||
    7;

  const monday =
    new Date(
      january4
    );

  monday.setUTCDate(
    january4.getUTCDate() -
      day +
      1 +
      (week - 1) * 7
  );

  const sunday =
    new Date(
      monday
    );

  sunday.setUTCDate(
    monday.getUTCDate() +
      6
  );

  return {
    start:
      formatISODate(
        monday
      ),

    end:
      formatISODate(
        sunday
      ),
  };
}

function buildTemporalQuestionContext(
  question
) {
  const today =
    getCurrentParisDate();

  const normalized =
    normalizeText(
      question
    );

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

  /*
   * NUMÉRO DE SEMAINE ISO
   *
   * Exemple :
   *   "semaine 42"
   *   "semaine 42 de 2025"
   *   "semaine 42 2025"
   *
   * Si aucune année n'est indiquée,
   * on utilise l'année calendaire actuelle.
   */
  let weekNumber =
    null;

  let weekYear =
    null;

  const weekMatch =
    normalized.match(
      /\bsemaine\s+(\d{1,2})(?:\s+(?:de\s+)?(\d{4}))?\b/
    );

  if (
    weekMatch
  ) {
    const parsedWeek =
      Number(
        weekMatch[1]
      );

    const parsedYear =
      weekMatch[2]
        ? Number(
            weekMatch[2]
          )
        : Number(
            today.slice(
              0,
              4
            )
          );

    if (
      parsedWeek >= 1 &&
      parsedWeek <= 53
    ) {
      weekNumber =
        parsedWeek;

      weekYear =
        parsedYear;
    }
  }

  let weekRange =
    null;

  if (
    weekNumber !== null &&
    weekYear !== null
  ) {
    weekRange =
      getISOWeekRange(
        weekNumber,
        weekYear
      );
  }

  let sinceDate =
    '';

  if (
    /\bdepuis\b/.test(
      normalized
    ) &&
    days.length > 0
  ) {
    sinceDate =
      resolveWeekdayToDate(
        days[0],
        today
      );
  }

  let betweenDates =
    null;

  if (
    normalized.includes(
      'entre'
    ) &&
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

    week:
      weekRange
        ? {
            number:
              weekNumber,

            year:
              weekYear,

            start:
              weekRange.start,

            end:
              weekRange.end,
          }
        : null,
  };
}

module.exports = {
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
};
