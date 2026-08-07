/*
 * =========================================================
 * MOMENT — MÉMOIRE / ENTITÉS / QUESTIONS
 * MEMENTO 001-03
 * =========================================================
 *
 * Extraction structurelle depuis server/server.js.
 * Aucun comportement métier n'est volontairement modifié.
 */

const {
  normalizeText,
  escapeRegExp,
  getCreatedAt,
  getMemoryId,
  getMemoryText,
} = require('./core');

const {
  DAYS,
  getMemoryCalendarDate,
} = require('./calendar');

/* ========================================================= */
/* PERSONNES                                                  */
/* ========================================================= */

const KNOWN_PEOPLE = [
  'marc',
  'leo',
  'chloe',
  'sophie',
  'paul',
];

function memoryContainsPerson(
  memory,
  wantedPerson
) {
  const wanted =
    normalizeText(
      wantedPerson
    );

  if (!wanted) {
    return false;
  }

  if (
    Array.isArray(
      memory?.people
    )
  ) {
    for (
      const person of
        memory.people
    ) {
      if (
        normalizeText(
          person
        ) === wanted
      ) {
        return true;
      }
    }
  }

  const text =
    normalizeText(
      getMemoryText(
        memory
      )
    );

  const regex =
    new RegExp(
      `\\b${escapeRegExp(
        wanted
      )}\\b`,
      'i'
    );

  return regex.test(
    text
  );
}

/* ========================================================= */
/* JOURS                                                      */
/* ========================================================= */

function memoryContainsDay(
  memory,
  wantedDay
) {
  const wanted =
    normalizeText(
      wantedDay
    );

  if (!wanted) {
    return false;
  }

  if (
    normalizeText(
      memory?.date_reference
    ).includes(
      wanted
    )
  ) {
    return true;
  }

  const text =
    normalizeText(
      getMemoryText(
        memory
      )
    );

  return text.includes(
    wanted
  );
}

/* ========================================================= */
/* LIEUX                                                      */
/* ========================================================= */

function getMemoryLocation(
  memory
) {
  if (
    Array.isArray(
      memory?.places
    )
  ) {
    for (
      const place of
        memory.places
    ) {
      if (
        place &&
        String(place).trim()
      ) {
        return String(
          place
        ).trim();
      }
    }
  }

  if (
    typeof memory?.context ===
      'string' &&
    memory.context.trim()
  ) {
    return memory.context.trim();
  }

  return '';
}

/* ========================================================= */
/* TRAVAIL                                                    */
/* ========================================================= */

function memoryIsAboutWork(
  memory
) {
  const text =
    normalizeText(
      getMemoryText(
        memory
      )
    );

  if (
    Array.isArray(
      memory?.subjects
    )
  ) {
    for (
      const subject of
        memory.subjects
    ) {
      const normalized =
        normalizeText(
          subject
        );

      if (
        normalized.includes(
          'travail'
        ) ||
        normalized.includes(
          'travaille'
        ) ||
        normalized.includes(
          'travailler'
        )
      ) {
        return true;
      }
    }
  }

  return (
    text.includes(
      'travaille'
    ) ||
    text.includes(
      'travail'
    ) ||
    text.includes(
      'travailler'
    ) ||
    text.includes(
      'planning'
    ) ||
    text.includes(
      'horaire'
    ) ||
    text.includes(
      'horaires'
    )
  );
}

/* ========================================================= */
/* RENDEZ-VOUS / ÉVÉNEMENTS PLANIFIÉS                        */
/* ========================================================= */

function memoryIsAppointmentLike(
  memory
) {
  const text =
    normalizeText(
      getMemoryText(
        memory
      )
    );

  return (
    text.includes(
      'rendez vous'
    ) ||
    text.includes(
      'rdv'
    ) ||
    text.includes(
      'visite'
    ) ||
    text.includes(
      'consultation'
    ) ||
    text.includes(
      'medecin'
    ) ||
    text.includes(
      'docteur'
    ) ||
    text.includes(
      'dentiste'
    ) ||
    text.includes(
      'reunion'
    ) ||
    text.includes(
      'meeting'
    ) ||
    text.includes(
      'entretien'
    ) ||
    text.includes(
      'appointment'
    )
  );
}

function getMemoryTimes(
  memory
) {
  const text =
    getMemoryText(
      memory
    ) || '';

  const normalized =
    normalizeText(
      text
    );

  const times =
    [];

  const patterns = [
    /\b([01]?\d|2[0-3])h(?:([0-5]\d))?\b/gi,

    /\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/g,
  ];

  for (
    const pattern of patterns
  ) {
    let match;

    while (
      (
        match =
          pattern.exec(
            normalized
          )
      ) !== null
    ) {
      const hour =
        String(
          Number(
            match[1]
          )
        ).padStart(
          2,
          '0'
        );

      const minute =
        match[2]
          ? String(
              Number(
                match[2]
              )
            ).padStart(
              2,
              '0'
            )
          : '00';

      const canonical =
        `${hour}:${minute}`;

      if (
        !times.includes(
          canonical
        )
      ) {
        times.push(
          canonical
        );
      }
    }
  }

  return times;
}

function normalizeTimeValue(
  value
) {
  if (!value) {
    return '';
  }

  const normalized =
    normalizeText(
      value
    ).replace(
      /\s+/g,
      ''
    );

  let match =
    normalized.match(
      /^([01]?\d|2[0-3])h([0-5]\d)?$/
    );

  if (match) {
    return `${String(
      Number(
        match[1]
      )
    ).padStart(
      2,
      '0'
    )}:${String(
      Number(
        match[2] || 0
      )
    ).padStart(
      2,
      '0'
    )}`;
  }

  match =
    normalized.match(
      /^([01]?\d|2[0-3])[:.]([0-5]\d)$/
    );

  if (match) {
    return `${String(
      Number(
        match[1]
      )
    ).padStart(
      2,
      '0'
    )}:${String(
      Number(
        match[2]
      )
    ).padStart(
      2,
      '0'
    )}`;
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
    getMemoryTimes(
      memory
    );

  return memoryTimes.includes(
    normalizedWanted
  );
}

function extractTimePartsFromMemory(
  memory
) {
  return getMemoryTimes(
    memory
  );
}

/* ========================================================= */
/* SITUATION                                                  */
/* ========================================================= */

function extractSituation(
  memory
) {
  const text =
    getMemoryText(
      memory
    );

  const normalized =
    normalizeText(
      text
    );

  let person =
    '';

  if (
    Array.isArray(
      memory?.people
    )
  ) {
    for (
      const value of
        memory.people
    ) {
      if (
        value &&
        normalizeText(
          value
        ) !== 'moi'
      ) {
        person =
          String(
            value
          ).trim();

        break;
      }
    }
  }

  if (!person) {
    for (
      const candidate of
        KNOWN_PEOPLE
    ) {
      const regex =
        new RegExp(
          `\\b${escapeRegExp(
            candidate
          )}\\b`,
          'i'
        );

      if (
        regex.test(
          normalized
        )
      ) {
        person =
          candidate;

        break;
      }
    }
  }

  let day =
    '';

  for (
    const candidate of
      DAYS
  ) {
    if (
      normalized.includes(
        candidate
      )
    ) {
      day =
        candidate;

      break;
    }
  }

  return {
    person,

    day,

    subject:
      memoryIsAboutWork(
        memory
      )
        ? 'travail'
        : '',

    location:
      getMemoryLocation(
        memory
      ),

    calendar_date:
      getMemoryCalendarDate(
        memory
      ),

    times:
      extractTimePartsFromMemory(
        memory
      ),

    created_at:
      getCreatedAt(
        memory
      ),

    id:
      getMemoryId(
        memory
      ),

    text,
  };
}

/* ========================================================= */
/* QUESTIONS                                                  */
/* ========================================================= */

function getDaysFromQuestion(
  question
) {
  const q =
    normalizeText(
      question
    );

  return DAYS.filter(
    day =>
      q.includes(
        day
      )
  );
}

function findPersonInQuestion(
  question
) {
  const q =
    normalizeText(
      question
    );

  for (
    const person of
      KNOWN_PEOPLE
  ) {
    const regex =
      new RegExp(
        `\\b${escapeRegExp(
          person
        )}\\b`,
        'i'
      );

    if (
      regex.test(q)
    ) {
      return person;
    }
  }

  return '';
}

function findDayInQuestion(
  question
) {
  const days =
    getDaysFromQuestion(
      question
    );

  return days.length > 0
    ? days[0]
    : '';
}

function isHistoricalQuestion(
  question
) {
  const q =
    normalizeText(
      question
    );

  return (
    q.includes(
      "qu'avais-je dit"
    ) ||
    q.includes(
      "qu'est-ce que j'avais dit"
    ) ||
    q.includes(
      "que t'avais-je dit"
    ) ||
    q.includes(
      "qu'avais-je indique"
    ) ||
    q.includes(
      "qu'est-ce que je t'avais dit"
    ) ||
    q.includes(
      "qu'est-ce que j'avais indique"
    ) ||
    (
      q.includes(
        'concernant'
      ) &&
      q.includes(
        'avais-je'
      )
    )
  );
}

function isCurrentStateQuestion(
  question
) {
  const q =
    normalizeText(
      question
    );

  const hasWork =
    q.includes(
      'travail'
    ) ||
    q.includes(
      'travaille'
    ) ||
    q.includes(
      'travailler'
    ) ||
    q.includes(
      'planning'
    );

  const hasLocationQuestion =
    q.includes(
      'ou travaille'
    ) ||
    q.includes(
      'ou est'
    ) ||
    q.includes(
      'ou se trouve'
    ) ||
    q.includes(
      'quel lieu'
    ) ||
    q.includes(
      'quel endroit'
    );

  const hasDay =
    DAYS.some(
      day =>
        q.includes(
          day
        )
    );

  return (
    hasWork &&
    (
      hasLocationQuestion ||
      hasDay
    )
  );
}

module.exports = {
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
};
