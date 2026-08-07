/*
 * =========================================================
 * MOMENT — TRAVAIL
 * MEMENTO 001-07
 * =========================================================
 *
 * Extraction structurelle depuis server/server.js.
 * Aucun comportement métier n'est volontairement modifié.
 */

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
/* TRAVAIL                                                     */
/* ========================================================= */

function findWorkEvents(
  memories,
  person,
  day
) {
  const candidates =
    [];

  for (
    const memory of
      memories
  ) {
    if (
      !isUsableExplicitMemory(
        memory
      )
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
      !memoryIsAboutWork(
        memory
      )
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
        extractSituation(
          memory
        ),
    });
  }

  candidates.sort(
    (a, b) =>
      getTemporalSortValue(
        a.memory
      ) -
      getTemporalSortValue(
        b.memory
      )
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
    events[
      events.length - 1
    ] ||
    null
  );
}

module.exports = {
  findWorkEvents,
  findLatestWorkEvent,
};
