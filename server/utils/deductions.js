/*
 * =========================================================
 * MOMENT — DÉDUCTIONS
 * MEMENTO 001-04
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
  getMemoryCalendarDate,
  getTemporalSortValue,
} = require('./calendar');

const {
  memoryContainsPerson,
  memoryContainsDay,
  findPersonInQuestion,
  findDayInQuestion,
} = require('./memory');

/* ========================================================= */
/* DÉDUCTIONS                                                 */
/* ========================================================= */

function isDeduction(
  memory
) {
  if (!memory) {
    return false;
  }

  return (
    memory.is_deduction ===
      true ||
    memory.isDeduction ===
      true ||
    memory.type ===
      'deduction' ||
    memory.type ===
      'inference' ||
    memory.kind ===
      'deduction' ||
    memory.kind ===
      'inference' ||
    Boolean(
      memory.deduction &&
      typeof memory.deduction ===
        'object'
    )
  );
}

function getDeductionStatus(
  memory
) {
  if (
    !isDeduction(memory)
  ) {
    return '';
  }

  if (
    memory.deduction &&
    typeof memory.deduction ===
      'object'
  ) {
    if (
      memory.deduction.status ===
        'rejected' ||
      memory.deduction.status ===
        'refuted'
    ) {
      return 'rejected';
    }

    if (
      memory.deduction.validated ===
        true ||
      memory.deduction.status ===
        'validated'
    ) {
      return 'validated';
    }

    if (
      memory.deduction.pending ===
        true ||
      memory.deduction.status ===
        'pending'
    ) {
      return 'pending';
    }
  }

  if (
    memory.rejected ===
      true ||
    memory.refuted ===
      true ||
    memory.rejected_inference ===
      true ||
    memory.rejected_deduction ===
      true
  ) {
    return 'rejected';
  }

  if (
    memory.validated ===
      true ||
    memory.validated_deduction ===
      true
  ) {
    return 'validated';
  }

  if (
    memory.pending_validation ===
      true ||
    memory.pendingValidation ===
      true ||
    memory.status ===
      'pending_validation' ||
    memory.status ===
      'pending'
  ) {
    return 'pending';
  }

  return 'pending';
}

function isRejectedDeduction(
  memory
) {
  return (
    isDeduction(memory) &&
    getDeductionStatus(
      memory
    ) === 'rejected'
  );
}

function isPendingDeduction(
  memory
) {
  return (
    isDeduction(memory) &&
    getDeductionStatus(
      memory
    ) === 'pending'
  );
}

function isValidatedDeduction(
  memory
) {
  return (
    isDeduction(memory) &&
    getDeductionStatus(
      memory
    ) === 'validated'
  );
}

function isUsableExplicitMemory(
  memory
) {
  if (!memory) {
    return false;
  }

  if (
    isRejectedDeduction(
      memory
    ) ||
    isPendingDeduction(
      memory
    ) ||
    isDeduction(memory)
  ) {
    return false;
  }

  return true;
}

function isUsableValidatedDeduction(
  memory
) {
  return (
    isValidatedDeduction(
      memory
    ) &&
    !isRejectedDeduction(
      memory
    )
  );
}

function getDeductionSourceIds(
  memory
) {
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

  for (
    const value of candidates
  ) {
    if (
      Array.isArray(value)
    ) {
      return value
        .filter(Boolean)
        .map(String);
    }
  }

  if (
    memory.deduction &&
    typeof memory.deduction ===
      'object'
  ) {
    const nested = [
      memory.deduction
        .source_event_ids,

      memory.deduction
        .source_memory_ids,

      memory.deduction
        .supporting_event_ids,

      memory.deduction
        .supporting_memory_ids,
    ];

    for (
      const value of nested
    ) {
      if (
        Array.isArray(value)
      ) {
        return value
          .filter(Boolean)
          .map(String);
      }
    }
  }

  return [];
}

function getValidatedDeductionText(
  memory
) {
  return (
    memory?.description ||
    memory?.inference ||
    memory?.claim ||
    memory?.deduction?.description ||
    getMemoryText(memory) ||
    ''
  );
}

function tokenizeForMatching(
  text
) {
  return normalizeText(
    text
  )
    .replace(
      /[^\p{L}\p{N}]+/gu,
      ' '
    )
    .split(/\s+/)
    .filter(
      word =>
        word.length >= 3
    );
}

function getImportantQuestionWords(
  question
) {
  const stopWords =
    new Set([
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
      tokenizeForMatching(
        question
      ).filter(
        word =>
          !stopWords.has(
            word
          )
      )
    ),
  ];
}

/* ========================================================= */
/* PRÉSÉLECTION LOCALE DES MÉMOIRES POUR GPT                 */
/* ========================================================= */

function selectRelevantMemoriesForQuestion(
  memories,
  question,
  limit = 20
) {
  if (
    !Array.isArray(memories) ||
    memories.length === 0
  ) {
    return [];
  }

  const questionWords =
    getImportantQuestionWords(
      question
    );

  const questionPerson =
    findPersonInQuestion(
      question
    );

  const questionDays =
    getDaysFromTemporalQuestion(
      question
    );

  const normalizedQuestion =
    normalizeText(
      question
    );

  const scored =
    memories.map(
      (
        memory,
        index
      ) => {
        const memoryText =
          normalizeText(
            getMemoryText(
              memory
            )
          );

        const memoryWords =
          new Set(
            tokenizeForMatching(
              memoryText
            )
          );

        let score =
          0;

        /*
         * Mots importants présents à la fois
         * dans la question et dans le souvenir.
         */
        for (
          const word of
            questionWords
        ) {
          if (
            memoryWords.has(
              word
            )
          ) {
            score += 2;
          }
        }

        /*
         * Personne explicitement demandée.
         */
        if (
          questionPerson &&
          memoryContainsPerson(
            memory,
            questionPerson
          )
        ) {
          score += 8;
        }

        /*
         * Jour explicitement demandé.
         */
        for (
          const day of
            questionDays
        ) {
          if (
            memoryContainsDay(
              memory,
              day
            )
          ) {
            score += 5;
          }
        }

        /*
         * Correspondance directe d'une partie importante
         * de la question dans le texte de la mémoire.
         */
        if (
          normalizedQuestion &&
          memoryText.includes(
            normalizedQuestion
          )
        ) {
          score += 10;
        }

        /*
         * Les déductions validées restent importantes :
         * elles ont été explicitement acceptées
         * par l'utilisateur.
         */
        if (
          isValidatedDeduction(
            memory
          )
        ) {
          score += 3;
        }

        /*
         * Une déduction rejetée ne doit jamais être
         * proposée au modèle.
         */
        if (
          isRejectedDeduction(
            memory
          )
        ) {
          score = -1000;
        }

        return {
          memory,
          score,
          index,
        };
      }
    );

  const relevant =
    scored
      .filter(
        item =>
          item.score > 0
      )
      .sort(
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

          /*
           * En cas d'égalité, préférence au
           * souvenir le plus récent.
           */
          return (
            getCreatedAt(
              b.memory
            ) -
            getCreatedAt(
              a.memory
            )
          );
        }
      )
      .slice(
        0,
        Math.max(
          1,
          limit
        )
      )
      .map(
        item =>
          item.memory
      );

  return relevant;
}

function getValidationHistory(
  memory
) {
  return Array.isArray(
    memory?.validation_history
  )
    ? memory.validation_history
    : [];
}

function getRefutationHistory(
  memory
) {
  return Array.isArray(
    memory?.refutation_history
  )
    ? memory.refutation_history
    : [];
}

function isRefutationText(
  text
) {
  const q =
    normalizeText(text);

  return (
    q.includes(
      'je refute'
    ) ||
    q.includes(
      'c est faux'
    ) ||
    q.includes(
      "c'est faux"
    ) ||
    q.includes(
      'ce nest pas vrai'
    ) ||
    q.includes(
      "ce n'est pas vrai"
    ) ||
    q === 'faux' ||
    q.includes(
      'pas vrai'
    ) ||
    q.includes(
      'je me suis trompe'
    ) ||
    q.includes(
      'ce nest pas le cas'
    ) ||
    q.includes(
      "ce n'est pas le cas"
    )
  );
}

function isValidationText(
  text
) {
  const q =
    normalizeText(text);

  return (
    q.includes(
      'je confirme'
    ) ||
    q.includes(
      'c est vrai'
    ) ||
    q.includes(
      "c'est vrai"
    ) ||
    q.includes(
      'c est bien ca'
    ) ||
    q.includes(
      "c'est bien ca"
    ) ||
    q.includes(
      'je valide'
    ) ||
    q.includes(
      'confirme cette deduction'
    )
  );
}

function findDeductionForRefutation(
  memories,
  text
) {
  if (
    !Array.isArray(memories)
  ) {
    return null;
  }

  const normalizedQuestion =
    normalizeText(
      text
    );

  const deductions =
    memories.filter(
      memory =>
        isDeduction(memory) &&
        !isRejectedDeduction(
          memory
        )
    );

  if (
    deductions.length ===
    0
  ) {
    return null;
  }

  for (
    const memory of deductions
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

  let best =
    null;

  let bestScore =
    0;

  for (
    const memory of deductions
  ) {
    const description =
      normalizeText(
        memory.description ||
        memory.inference ||
        memory.claim ||
        getMemoryText(
          memory
        )
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

    let score =
      0;

    for (
      const word of words
    ) {
      if (
        normalizedQuestion.includes(
          word
        )
      ) {
        score++;
      }
    }

    if (
      score > bestScore
    ) {
      bestScore =
        score;

      best =
        memory;
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
    !isDeduction(
      deduction
    )
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

    status:
      'rejected',

    pending_validation:
      false,

    pendingValidation:
      false,

    validated:
      false,

    validated_deduction:
      false,

    deduction: {
      ...(
        deduction.deduction &&
        typeof deduction.deduction ===
          'object'
          ? deduction.deduction
          : {}
      ),

      status:
        'rejected',

      pending:
        false,

      validated:
        false,

      rejected:
        true,

      refuted:
        true,

      refuted_at:
        now,
    },

    refutation_history: [
      ...getRefutationHistory(
        deduction
      ),

      {
        refuted_at:
          now,

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

function validateDeduction(
  deduction
) {
  if (
    !deduction ||
    !isDeduction(
      deduction
    )
  ) {
    return null;
  }

  if (
    isRejectedDeduction(
      deduction
    )
  ) {
    return deduction;
  }

  const now =
    new Date().toISOString();

  return {
    ...deduction,

    validated:
      true,

    validated_deduction:
      true,

    rejected:
      false,

    refuted:
      false,

    pending_validation:
      false,

    pendingValidation:
      false,

    status:
      'validated',

    deduction: {
      ...(
        deduction.deduction &&
        typeof deduction.deduction ===
          'object'
          ? deduction.deduction
          : {}
      ),

      status:
        'validated',

      pending:
        false,

      validated:
        true,

      rejected:
        false,

      refuted:
        false,

      validated_at:
        now,
    },

    validation_history: [
      ...getValidationHistory(
        deduction
      ),

      {
        validated_at:
          now,

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

module.exports = {
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
};
