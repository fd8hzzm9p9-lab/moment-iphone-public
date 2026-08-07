/*
 * =========================================================
 * MOMENT — HISTORIQUE / CLAIMS VALIDÉS
 * MEMENTO 001-08
 * =========================================================
 *
 * Extraction structurelle depuis server/server.js.
 * Aucun comportement métier n'est volontairement modifié.
 */

const {
  normalizeText,
  getMemoryText,
} = require('./core');

const {
  getMemoryLocation,
  memoryContainsPerson,
  memoryContainsDay,
  findPersonInQuestion,
  findDayInQuestion,
} = require('./memory');

const {
  isUsableValidatedDeduction,
  getValidatedDeductionText,
  getDeductionSourceIds,
  getImportantQuestionWords,
  tokenizeForMatching,
} = require('./deductions');

/* ========================================================= */
/* HISTORIQUE DE CORRECTION                                   */
/* ========================================================= */

function getCorrectionHistory(
  memory
) {
  if (
    !memory ||
    !Array.isArray(
      memory.history
    )
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
    person
      .charAt(0)
      .toUpperCase() +
    person.slice(
      1
    );

  const currentLocation =
    getMemoryLocation(
      memory
    );

  const history =
    getCorrectionHistory(
      memory
    );

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
      normalizeText(
        previousLocation
      ) !==
      normalizeText(
        newLocation
      )
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
    typeof memory.correction_note ===
      'string' &&
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
  const claims =
    [];

  for (
    const memory of
      memories
  ) {
    if (
      !memory ||
      !Array.isArray(
        memory.validated_claims
      )
    ) {
      continue;
    }

    for (
      const claim of
        memory.validated_claims
    ) {
      if (
        claim &&
        typeof claim.claim ===
          'string' &&
        claim.claim.trim()
      ) {
        claims.push({
          event_id:
            memory.id || '',

          claim:
            claim.claim.trim(),

          validated_at:
            claim.validated_at ||
            '',
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
        isUsableValidatedDeduction(
          memory
        )
    )
    .map(
      memory => ({
        event_id:
          memory.id || '',

        description:
          getValidatedDeductionText(
            memory
          ),

        source_event_ids:
          getDeductionSourceIds(
            memory
          ),

        validated_at:
          memory.deduction?.validated_at ||
          memory.validated_at ||
          '',
      })
    );
}

function findValidatedDeductionForQuestion(
  memories,
  question
) {
  if (
    !Array.isArray(memories)
  ) {
    return null;
  }

  const validated =
    memories.filter(
      memory =>
        isUsableValidatedDeduction(
          memory
        )
    );

  if (
    validated.length ===
    0
  ) {
    return null;
  }

  const normalizedQuestion =
    normalizeText(
      question
    );

  for (
    const memory of
      validated
  ) {
    const id =
      normalizeText(
        memory.id
      );

    if (
      id &&
      normalizedQuestion.includes(
        id
      )
    ) {
      return memory;
    }
  }

  const questionWords =
    getImportantQuestionWords(
      question
    );

  const questionPerson =
    findPersonInQuestion(
      question
    );

  const questionDay =
    findDayInQuestion(
      question
    );

  let best =
    null;

  let bestScore =
    0;

  for (
    const memory of
      validated
  ) {
    const text =
      getValidatedDeductionText(
        memory
      );

    if (!text) {
      continue;
    }

    const normalizedText =
      normalizeText(
        text
      );

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
        tokenizeForMatching(
          text
        )
      );

    let score =
      0;

    for (
      const word of
        questionWords
    ) {
      if (
        deductionWords.has(
          word
        )
      ) {
        score++;
      }
    }

    if (
      questionPerson &&
      normalizedText.includes(
        normalizeText(
          questionPerson
        )
      )
    ) {
      score += 3;
    }

    if (
      questionDay &&
      normalizedText.includes(
        normalizeText(
          questionDay
        )
      )
    ) {
      score += 2;
    }

    const minimumScore =
      questionPerson &&
      questionDay
        ? 5
        : 2;

    if (
      score >=
        minimumScore &&
      score >
        bestScore
    ) {
      bestScore =
        score;

      best =
        memory;
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
    return 'Oui, cette information a été validée.';
  }

  return text;
}

module.exports = {
  getCorrectionHistory,
  buildHistoricalAnswer,
  collectValidatedClaims,
  collectValidatedDeductions,
  findValidatedDeductionForQuestion,
  buildValidatedDeductionAnswer,
};
