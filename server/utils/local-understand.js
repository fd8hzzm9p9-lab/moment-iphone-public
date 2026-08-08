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
/* MARIAGE EXPLICITE AVEC DATE                               */
/* ========================================================= */
/*
 * Exemples :
 *
 * Je suis mariée à Denis, depuis le 4 juillet 2020.
 * Je suis marié à Denis depuis le 4 juillet 2020.
 *
 * Ce parser reste volontairement strict :
 * - une seule personne ;
 * - une date explicite complète ;
 * - aucune autre information.
 */

function parseExplicitMarriage(
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
      /^\s*Je\s+suis\s+(marié|mariée)\s+à\s+([A-ZÀ-ÖØ-Þ][\p{L}'’\-]{1,40})\s*,?\s+depuis\s+le\s+(\d{1,2})\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(\d{4})[.!]?\s*$/iu
    );

  if (!match) {
    return null;
  }

  const maritalWord =
    match[1]
      .toLowerCase();

  const person =
    match[2].trim();

  const day =
    match[3];

  const month =
    match[4].toLowerCase();

  const year =
    match[5];

  const dateReference =
    `${day} ${month} ${year}`;

  const event =
    buildBaseEvent(
      sourceText
    );

  event.type =
    'fact';

  event.description =
    `Tu es ${maritalWord} à ${person} depuis le ${dateReference}.`;

  event.date_reference =
    dateReference;

  event.date_precision =
    'exact';

  event.temporal_direction =
    'past';

  event.context =
    'famille';

  event.people = [
    person,
  ];

  event.subjects = [
    'mariage',
  ];

  event.relations = [
    {
      from:
        'toi',

      relation:
        maritalWord ===
          'mariée'
          ? 'mariée à'
          : 'marié à',

      to:
        person,
    },
  ];

  return {
    input:
      sourceText,

    events: [
      event,
    ],

    local_understanding: {
      matched:
        true,

      parser:
        'explicit_marriage',

      confidence:
        1,
    },
  };
}

/* ========================================================= */
/* FRERE + SOEUR EXPLICITES                                  */
/* ========================================================= */
/*
 * Exemple couvert par le feedback :
 *
 * J'ai un grand frère qui s'appelle Jérémy
 * et une petite soeur qui s'appelle Élise.
 *
 * Aucun lien supplémentaire n'est déduit.
 */

function parseExplicitBrotherAndSister(
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
      /^\s*J['’]ai\s+un\s+(grand\s+)?frère\s+qui\s+s['’]appelle\s+([A-ZÀ-ÖØ-Þ][\p{L}'’\-]{1,40})\s+et\s+une\s+(petite\s+)?(?:sœur|soeur)\s+qui\s+s['’]appelle\s+([A-ZÀ-ÖØ-Þ][\p{L}'’\-]{1,40})[.!]?\s*$/iu
    );

  if (!match) {
    return null;
  }

  const hasGrandBrother =
    Boolean(
      match[1]
    );

  const brother =
    match[2].trim();

  const hasLittleSister =
    Boolean(
      match[3]
    );

  const sister =
    match[4].trim();

  const brotherLabel =
    hasGrandBrother
      ? 'grand frère'
      : 'frère';

  const sisterLabel =
    hasLittleSister
      ? 'petite sœur'
      : 'sœur';

  const event =
    buildBaseEvent(
      sourceText
    );

  event.type =
    'fact';

  event.description =
    `Tu as un ${brotherLabel} qui s'appelle ${brother} et une ${sisterLabel} qui s'appelle ${sister}.`;

  event.context =
    'famille';

  event.people = [
    brother,
    sister,
  ];

  event.subjects = [
    brotherLabel,
    sisterLabel,
  ];

  event.relations = [
    {
      from:
        'toi',

      relation:
        brotherLabel,

      to:
        brother,
    },

    {
      from:
        'toi',

      relation:
        sisterLabel,

      to:
        sister,
    },
  ];

  return {
    input:
      sourceText,

    events: [
      event,
    ],

    local_understanding: {
      matched:
        true,

      parser:
        'explicit_brother_and_sister',

      confidence:
        1,
    },
  };
}

/* ========================================================= */
/* LISTE STRUCTUREE D'ENFANTS                                */
/* ========================================================= */
/*
 * Premier mecanisme de pre-decoupage deterministe.
 *
 * Exemple :
 *
 * J'ai 3 enfants :
 * Mathéo né le 23 février 2004 ;
 * Lou-Anne née le 28 janvier 2006 ;
 * Ilana née le 23 février 2013
 *
 * Principes :
 *
 * - le nombre d'enfants peut varier ;
 * - chaque entree doit contenir nom + ne/nee + date complete ;
 * - le nombre annonce doit correspondre au nombre extrait ;
 * - aucune information manquante n'est inventee ;
 * - une seule saisie utilisateur peut produire plusieurs souvenirs.
 */

function normalizeStructuredPersonName(
  value
) {
  return String(
    value || ''
  )
    .trim()
    .replace(
      /\s*-\s*/g,
      '-'
    )
    .replace(
      /\s+/g,
      ' '
    );
}

function parseStructuredChildrenList(
  text
) {
  const sourceText =
    String(
      text || ''
    ).trim();

  if (!sourceText) {
    return null;
  }

  const headerMatch =
    sourceText.match(
      /^\s*J['’]ai\s+(\d+)\s+enfants?\s*:\s*(.+)$/isu
    );

  if (!headerMatch) {
    return null;
  }

  const announcedCount =
    Number(
      headerMatch[1]
    );

  if (
    !Number.isInteger(
      announcedCount
    ) ||
    announcedCount <= 0
  ) {
    return null;
  }

  const body =
    headerMatch[2]
      .trim();

  /*
   * Pour cette premiere version,
   * le point-virgule est le separateur
   * structurel explicite.
   *
   * On ne coupe pas sur de simples virgules,
   * afin d'eviter de casser des noms ou
   * formulations naturelles.
   */

  const chunks =
    body
      .split(
        /\s*;\s*/
      )
      .map(
        item =>
          item.trim()
      )
      .filter(Boolean);

  if (
    chunks.length !==
    announcedCount
  ) {
    return null;
  }

  const monthPattern =
    'janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre';

  const parsedChildren =
    [];

  for (
    const chunk
    of chunks
  ) {
    const childMatch =
      chunk.match(
        new RegExp(
          '^\\s*' +
          "([A-ZÀ-ÖØ-Þ][\\p{L}’'\\- ]{0,60}?)" +
          '\\s*,?\\s+' +
          '(né|née)' +
          '\\s+le\\s+' +
          '(\\d{1,2})\\s+' +
          '(' +
          monthPattern +
          ')' +
          '\\s+' +
          '(\\d{4})' +
          '[.!]?\\s*$',
          'iu'
        )
      );

    if (!childMatch) {
      return null;
    }

    const name =
      normalizeStructuredPersonName(
        childMatch[1]
      );

    const birthWord =
      childMatch[2]
        .toLowerCase();

    const day =
      childMatch[3];

    const month =
      childMatch[4]
        .toLowerCase();

    const year =
      childMatch[5];

    if (!name) {
      return null;
    }

    parsedChildren.push({
      source:
        chunk,

      name,

      birthWord,

      dateReference:
        `${day} ${month} ${year}`,
    });
  }

  if (
    parsedChildren.length !==
    announcedCount
  ) {
    return null;
  }

  const events =
    parsedChildren.map(
      child => {
        const isFemale =
          child.birthWord ===
          'née';

        const relation =
          isFemale
            ? 'fille'
            : 'fils';

        const event =
          buildBaseEvent(
            child.source
          );

        event.type =
          'event';

        event.description =
          isFemale
            ? `Ta fille ${child.name} est née le ${child.dateReference}.`
            : `Ton fils ${child.name} est né le ${child.dateReference}.`;

        event.date_reference =
          child.dateReference;

        event.date_precision =
          'exact';

        event.temporal_direction =
          'past';

        event.context =
          'famille';

        event.people = [
          child.name,
        ];

        event.subjects = [
          relation,
        ];

        event.relations = [
          {
            from:
              'toi',

            relation,

            to:
              child.name,
          },
        ];

        return event;
      }
    );

  return {
    input:
      sourceText,

    events,

    local_understanding: {
      matched:
        true,

      parser:
        'structured_children_list',

      confidence:
        1,

      source_count:
        announcedCount,

      event_count:
        events.length,
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
    parseExplicitMarriage,
    parseExplicitBrotherAndSister,
    parseStructuredChildrenList,
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
  parseExplicitMarriage,
  parseExplicitBrotherAndSister,
  parseStructuredChildrenList,
  tryLocalUnderstand,
};
