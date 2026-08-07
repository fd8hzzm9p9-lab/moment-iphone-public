/*
 * =========================================================
 * MOMENT — COMPRÉHENSION LOCALE
 * MEMENTO 002
 * =========================================================
 *
 * Niveau 1 de compréhension.
 *
 * Règle :
 * - si la phrase est comprise avec certitude -> résultat local ;
 * - sinon -> null, et OpenAI reste le fallback.
 *
 * IMPORTANT :
 * ce module doit rester conservateur.
 */

function buildBaseEvent(
  sourceText
) {
  return {
    id: '',
    type: '',
    description: '',
    date_reference: '',
    date_precision: 'unknown',
    temporal_direction: 'unknown',
    context: '',
    people: [],
    places: [],
    objects: [],
    subjects: [],
    thoughts: [],
    actions: [],
    intentions: [],
    facts: [],
    relations: [],
    source_event_ids: [],
    is_deduction: false,
    pending_validation: false,
    created_at: '',
    source_text:
      String(
        sourceText || ''
      ).trim(),
    confidence: 1,
  };
}

/*
 * =========================================================
 * RÉSIDENCE EXPLICITE
 * =========================================================
 *
 * Exemples acceptés :
 *
 * Sophie habite à Évreux.
 * Marc habite à Bernay.
 * Axelle habite à Paris.
 *
 * On exige volontairement :
 * - une seule personne ;
 * - un nom propre simple ;
 * - un lieu propre explicite ;
 * - aucune information supplémentaire.
 *
 * Dès que la phrase est plus complexe,
 * on retourne null et OpenAI reprend la main.
 */

function parseExplicitResidence(
  text
) {
  const sourceText =
    String(
      text || ''
    ).trim();

  if (!sourceText) {
    return null;
  }

  const match =
    sourceText.match(
      /^\s*([A-ZÀ-ÖØ-Þ][\p{L}'’\-]{1,40})\s+habite\s+à\s+([A-ZÀ-ÖØ-Þ][\p{L}'’\-]*(?:\s+[A-ZÀ-ÖØ-Þ][\p{L}'’\-]*){0,3})[.!]?\s*$/u
    );

  if (!match) {
    return null;
  }

  const person =
    match[1].trim();

  const place =
    match[2].trim();

  if (
    !person ||
    !place
  ) {
    return null;
  }

  const event =
    buildBaseEvent(
      sourceText
    );

  event.type =
    'fact';

  event.description =
    `${person} habite à ${place}.`;

  event.context =
    'residence';

  event.people = [
    person,
  ];

  event.places = [
    place,
  ];

  event.subjects = [
    person,
  ];

  /*
   * La description contient déjà
   * entièrement le fait.
   *
   * Conformément au format Moment,
   * facts reste donc vide.
   */

  event.facts = [];

  return {
    input:
      sourceText,

    events: [
      event,
    ],

    local_understanding: {
      matched: true,
      parser:
        'explicit_residence',
      confidence: 1,
    },
  };
}

/* ========================================================= */
/* POINT D'ENTRÉE LOCAL-FIRST                                 */
/* ========================================================= */

function tryLocalUnderstand(
  text
) {
  const parsers = [
    parseExplicitResidence,
  ];

  for (
    const parser of parsers
  ) {
    const result =
      parser(
        text
      );

    if (result) {
      return result;
    }
  }

  return null;
}

module.exports = {
  buildBaseEvent,
  parseExplicitResidence,
  tryLocalUnderstand,
};
