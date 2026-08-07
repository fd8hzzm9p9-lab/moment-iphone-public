/*
 * =========================================================
 * MOMENT — PRÉSENCE / AVEC MOI
 * MEMENTO 001-05
 * =========================================================
 *
 * Extraction structurelle depuis server/server.js.
 * Aucun comportement métier n'est volontairement modifié.
 */

const {
  normalizeText,
  escapeRegExp,
  getMemoryText,
} = require('./core');

const {
  getTemporalSortValue,
} = require('./calendar');

const {
  memoryContainsPerson,
  memoryContainsDay,
} = require('./memory');

const {
  isUsableExplicitMemory,
} = require('./deductions');

/* ========================================================= */
/* PRÉSENCE / AVEC MOI — STRICTE                             */
/* ========================================================= */

function isWithMeQuestion(
  question
) {
  const q =
    normalizeText(
      question
    );

  return (
    /\betais[- ]?je avec\b/.test(
      q
    ) ||
    /\b(etait|étais) .* avec moi\b/.test(
      q
    ) ||
    /\bavec moi\b/.test(
      q
    ) ||
    /\bavec nous\b/.test(
      q
    ) ||
    /\bensemble\b/.test(
      q
    ) ||
    /\bvu .* avec\b/.test(
      q
    ) ||
    /\bvu .* moi\b/.test(
      q
    ) ||
    /\bpresente .* avec moi\b/.test(
      q
    ) ||
    /\bprésente .* avec moi\b/.test(
      q
    )
  );
}

function findPersonDayMemories(
  memories,
  person,
  day
) {
  if (
    !Array.isArray(memories)
  ) {
    return [];
  }

  return memories
    .filter(
      memory =>
        isUsableExplicitMemory(
          memory
        ) &&
        memoryContainsPerson(
          memory,
          person
        ) &&
        memoryContainsDay(
          memory,
          day
        )
    )
    .sort(
      (a, b) =>
        getTemporalSortValue(
          b
        ) -
        getTemporalSortValue(
          a
        )
    );
}

function explicitlyIndicatesTogether(
  memory,
  person
) {
  const text =
    normalizeText(
      getMemoryText(
        memory
      )
    );

  const p =
    normalizeText(
      person
    );

  if (!p || !text) {
    return false;
  }

  const patterns = [
    new RegExp(
      `avec\\s+${escapeRegExp(
        p
      )}`,
      'i'
    ),

    new RegExp(
      `${escapeRegExp(
        p
      )}\\s+.*avec\\s+moi`,
      'i'
    ),

    new RegExp(
      `moi\\s+.*avec\\s+${escapeRegExp(
        p
      )}`,
      'i'
    ),

    new RegExp(
      `${escapeRegExp(
        p
      )}\\s+et\\s+moi`,
      'i'
    ),

    new RegExp(
      `moi\\s+et\\s+${escapeRegExp(
        p
      )}`,
      'i'
    ),

    new RegExp(
      `dejeuner\\s+avec\\s+${escapeRegExp(
        p
      )}`,
      'i'
    ),

    new RegExp(
      `dejeune\\s+avec\\s+${escapeRegExp(
        p
      )}`,
      'i'
    ),

    new RegExp(
      `manger\\s+avec\\s+${escapeRegExp(
        p
      )}`,
      'i'
    ),

    new RegExp(
      `mange\\s+avec\\s+${escapeRegExp(
        p
      )}`,
      'i'
    ),

    new RegExp(
      `diner\\s+avec\\s+${escapeRegExp(
        p
      )}`,
      'i'
    ),

    new RegExp(
      `dine\\s+avec\\s+${escapeRegExp(
        p
      )}`,
      'i'
    ),

    new RegExp(
      `sorti\\s+avec\\s+${escapeRegExp(
        p
      )}`,
      'i'
    ),

    new RegExp(
      `sortie\\s+avec\\s+${escapeRegExp(
        p
      )}`,
      'i'
    ),
  ];

  return patterns.some(
    pattern =>
      pattern.test(
        text
      )
  );
}

module.exports = {
  isWithMeQuestion,
  findPersonDayMemories,
  explicitlyIndicatesTogether,
};
