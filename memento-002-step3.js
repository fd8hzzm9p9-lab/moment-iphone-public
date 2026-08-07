const fs = require('fs');
const path = require('path');
const {
  execFileSync,
} = require('child_process');

const root = process.cwd();

const understandPath =
  path.join(
    root,
    'server',
    'routes',
    'understand.js'
  );

const localUnderstandPath =
  path.join(
    root,
    'server',
    'utils',
    'local-understand.js'
  );

const appConfigPath =
  path.join(
    root,
    'config',
    'app.ts'
  );

const understandBackupPath =
  path.join(
    root,
    'server',
    'routes',
    'understand.js.memento002-03.bak'
  );

const appBackupPath =
  path.join(
    root,
    'config',
    'app.ts.memento002-03.bak'
  );

/* ========================================================= */
/* CONTRÔLES                                                  */
/* ========================================================= */

if (
  !fs.existsSync(
    understandPath
  )
) {
  console.error(
    '❌ server/routes/understand.js introuvable.'
  );

  process.exit(1);
}

const originalUnderstand =
  fs.readFileSync(
    understandPath,
    'utf8'
  );

const originalApp =
  fs.existsSync(
    appConfigPath
  )
    ? fs.readFileSync(
        appConfigPath,
        'utf8'
      )
    : null;

/* ========================================================= */
/* MODULE LOCAL-FIRST                                         */
/* ========================================================= */

const localUnderstandFile = `/*
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
      /^\\s*([A-ZÀ-ÖØ-Þ][\\p{L}'’\\-]{1,40})\\s+habite\\s+à\\s+([A-ZÀ-ÖØ-Þ][\\p{L}'’\\-]*(?:\\s+[A-ZÀ-ÖØ-Þ][\\p{L}'’\\-]*){0,3})[.!]?\\s*$/u
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
    \`\${person} habite à \${place}.\`;

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
`;

/* ========================================================= */
/* PRÉPARATION understand.js                                  */
/* ========================================================= */

let understand =
  originalUnderstand;

const localImport =
`const {
  tryLocalUnderstand,
} = require('../utils/local-understand');
`;

/*
 * Ajout de l'import.
 */

if (
  !understand.includes(
    "require('../utils/local-understand')"
  )
) {
  const helpersMarker =
    'const helpers = {';

  const helpersIndex =
    understand.indexOf(
      helpersMarker
    );

  if (
    helpersIndex === -1
  ) {
    console.error(
      '❌ Bloc helpers introuvable.'
    );

    process.exit(1);
  }

  understand =
    understand.slice(
      0,
      helpersIndex
    ) +
    localImport +
    '\n' +
    understand.slice(
      helpersIndex
    );
}

/* ========================================================= */
/* LOCALISATION DU BLOC GPT                                   */
/* ========================================================= */

const analysisMarker =
  '/* ANALYSE GPT';

const analysisTitleIndex =
  understand.indexOf(
    analysisMarker
  );

if (
  analysisTitleIndex === -1
) {
  console.error(
    '❌ Bloc ANALYSE GPT introuvable.'
  );

  process.exit(1);
}

const analysisStart =
  understand.lastIndexOf(
    '/* =================================================== */',
    analysisTitleIndex
  );

if (
  analysisStart === -1
) {
  console.error(
    '❌ Début ANALYSE GPT introuvable.'
  );

  process.exit(1);
}

/*
 * Le traitement commun commence à :
 *
 * if (
 *   !Array.isArray(
 *     result.events
 *   )
 * )
 */

const afterAnalysis =
  understand.slice(
    analysisStart
  );

const commonRegex =
  /\r?\n\s*if\s*\(\s*\r?\n\s*!Array\.isArray\(\s*\r?\n\s*result\.events/;

const commonMatch =
  commonRegex.exec(
    afterAnalysis
  );

if (
  !commonMatch
) {
  console.error(
    '❌ Début du traitement commun result.events introuvable.'
  );

  process.exit(1);
}

const commonStart =
  analysisStart +
  commonMatch.index +
  (
    commonMatch[0].startsWith(
      '\r\n'
    )
      ? 2
      : 1
  );

/*
 * On conserve absolument tout le bloc GPT existant.
 */

let originalGPTBlock =
  understand.slice(
    analysisStart,
    commonStart
  );

/*
 * Le bloc original déclare :
 *
 * let result;
 *
 * result sera maintenant déclaré avant
 * la décision Local First.
 */

originalGPTBlock =
  originalGPTBlock.replace(
    /\r?\n\s*let\s+result\s*;\s*\r?\n/,
    '\n'
  );

/*
 * Le bloc GPT devient la branche ELSE.
 */

const indentedGPTBlock =
  originalGPTBlock
    .split(/\r?\n/)
    .map(
      line =>
        `  ${line}`
    )
    .join('\n');

const localFirstBlock =
`      /* =================================================== */
      /* LOCAL FIRST — MEMENTO 002                            */
      /* =================================================== */

      let result;

      const localResult =
        tryLocalUnderstand(
          text
        );

      if (
        localResult
      ) {
        console.log(
          '⚡ LOCAL FIRST : compréhension locale utilisée'
        );

        console.log(
          '⚡ Parser local :',
          localResult
            .local_understanding
            ?.parser ||
            'unknown'
        );

        result =
          localResult;
      } else {

        console.log(
          '🌐 LOCAL FIRST : fallback OpenAI nécessaire'
        );

${indentedGPTBlock}

      }

`;

/* ========================================================= */
/* REMPLACEMENT                                               */
/* ========================================================= */

understand =
  understand.slice(
    0,
    analysisStart
  ) +
  localFirstBlock +
  understand.slice(
    commonStart
  );

/* ========================================================= */
/* CONTRÔLES STATIQUES                                        */
/* ========================================================= */

if (
  !understand.includes(
    'tryLocalUnderstand('
  )
) {
  console.error(
    '❌ Appel Local First absent.'
  );

  process.exit(1);
}

if (
  !understand.includes(
    'openai.responses.create'
  )
) {
  console.error(
    '❌ Fallback OpenAI perdu.'
  );

  process.exit(1);
}

if (
  !understand.includes(
    'enrichMemoryWithCalendarDate'
  )
) {
  console.error(
    '❌ Enrichissement commun perdu.'
  );

  process.exit(1);
}

if (
  !understand.includes(
    'findContradiction'
  )
) {
  console.error(
    '❌ Contrôle de contradictions perdu.'
  );

  process.exit(1);
}

/* ========================================================= */
/* SAUVEGARDES                                                */
/* ========================================================= */

if (
  !fs.existsSync(
    understandBackupPath
  )
) {
  fs.writeFileSync(
    understandBackupPath,
    originalUnderstand,
    'utf8'
  );
}

if (
  originalApp !== null &&
  !fs.existsSync(
    appBackupPath
  )
) {
  fs.writeFileSync(
    appBackupPath,
    originalApp,
    'utf8'
  );
}

/* ========================================================= */
/* ÉCRITURE                                                   */
/* ========================================================= */

fs.writeFileSync(
  localUnderstandPath,
  localUnderstandFile,
  'utf8'
);

fs.writeFileSync(
  understandPath,
  understand,
  'utf8'
);

/* ========================================================= */
/* VERSION                                                    */
/* ========================================================= */

if (
  originalApp !== null
) {
  let updatedApp =
    originalApp;

  const versionRegex =
    /export\s+const\s+APP_VERSION\s*=\s*'[^']*'\s*;/m;

  if (
    versionRegex.test(
      updatedApp
    )
  ) {
    updatedApp =
      updatedApp.replace(
        versionRegex,
        "export const APP_VERSION =\n  'pré-alpha 0.2.3';"
      );
  }

  fs.writeFileSync(
    appConfigPath,
    updatedApp,
    'utf8'
  );
}

/* ========================================================= */
/* VALIDATION                                                 */
/* ========================================================= */

try {

  /*
   * Syntaxe du nouveau moteur local.
   */

  execFileSync(
    process.execPath,
    [
      '--check',
      localUnderstandPath,
    ],
    {
      stdio: 'pipe',
    }
  );

  /*
   * Syntaxe de /understand.
   */

  execFileSync(
    process.execPath,
    [
      '--check',
      understandPath,
    ],
    {
      stdio: 'pipe',
    }
  );

  /*
   * Test direct du parser local.
   */

  execFileSync(
    process.execPath,
    [
      '-e',
      `
const local = require(${JSON.stringify(
        localUnderstandPath
      )});

const ok =
  local.tryLocalUnderstand(
    'Sophie habite à Évreux.'
  );

if (
  !ok ||
  !Array.isArray(ok.events) ||
  ok.events.length !== 1
) {
  throw new Error(
    'Résidence simple non comprise localement'
  );
}

if (
  ok.events[0].people[0] !==
  'Sophie'
) {
  throw new Error(
    'Personne locale incorrecte'
  );
}

if (
  ok.events[0].places[0] !==
  'Évreux'
) {
  throw new Error(
    'Lieu local incorrect'
  );
}

/*
 * Une phrase plus complexe doit
 * obligatoirement être refusée localement.
 */

const fallback =
  local.tryLocalUnderstand(
    'Sophie habite probablement à Évreux depuis deux ans.'
  );

if (
  fallback !== null
) {
  throw new Error(
    'Phrase ambiguë acceptée localement'
  );
}
`,
    ],
    {
      stdio: 'pipe',
    }
  );

  /*
   * Test réel de la route :
   * la saisie simple ne doit JAMAIS
   * appeler OpenAI.
   */

  execFileSync(
    process.execPath,
    [
      '-e',
      `
const route =
  require(${JSON.stringify(
        understandPath
      )});

let handler = null;

const fakeApp = {
  post(path, fn) {
    if (
      path === '/understand'
    ) {
      handler = fn;
    }
  }
};

let openAICalls = 0;

const fakeOpenAI = {
  responses: {
    async create() {
      openAICalls += 1;

      throw new Error(
        'OpenAI ne devait pas être appelé'
      );
    }
  }
};

route.registerUnderstandRoute(
  fakeApp,
  fakeOpenAI
);

if (
  typeof handler !==
  'function'
) {
  throw new Error(
    '/understand non enregistrée'
  );
}

const res = {
  statusCode: 200,
  payload: null,

  status(code) {
    this.statusCode =
      code;

    return this;
  },

  json(payload) {
    this.payload =
      payload;

    return payload;
  }
};

(async () => {

  await handler(
    {
      body: {
        text:
          'Sophie habite à Évreux.',

        memories: [],
      }
    },
    res
  );

  if (
    openAICalls !== 0
  ) {
    throw new Error(
      'OpenAI appelé sur chemin local'
    );
  }

  if (
    !res.payload ||
    !Array.isArray(
      res.payload.events
    ) ||
    res.payload.events.length !==
      1
  ) {
    throw new Error(
      'Réponse locale invalide'
    );
  }

  console.log(
    'LOCAL_TEST_OK'
  );

})().catch(
  error => {
    console.error(
      error
    );

    process.exit(1);
  }
);
`,
    ],
    {
      stdio: 'pipe',
    }
  );

} catch (error) {

  /*
   * Restauration automatique.
   */

  fs.writeFileSync(
    understandPath,
    originalUnderstand,
    'utf8'
  );

  if (
    originalApp !== null
  ) {
    fs.writeFileSync(
      appConfigPath,
      originalApp,
      'utf8'
    );
  }

  if (
    fs.existsSync(
      localUnderstandPath
    )
  ) {
    fs.unlinkSync(
      localUnderstandPath
    );
  }

  console.error('');

  console.error(
    '❌ MEMENTO 002-03 a échoué.'
  );

  console.error(
    '🛟 understand.js et config/app.ts ont été restaurés.'
  );

  if (
    error.stderr
  ) {
    console.error(
      error.stderr.toString()
    );
  }

  process.exit(1);
}

/* ========================================================= */
/* RÉSULTAT                                                   */
/* ========================================================= */

console.log('');

console.log(
  '✅ MEMENTO 002-03 appliqué avec succès.'
);

console.log(
  '✅ Moteur Local First créé.'
);

console.log(
  '✅ Nouveau fichier : server/utils/local-understand.js'
);

console.log(
  '✅ /understand essaie maintenant le local avant GPT.'
);

console.log(
  '✅ Résidence explicite simple comprise localement.'
);

console.log(
  '✅ Phrase complexe refusée localement et réservée au fallback.'
);

console.log(
  '✅ Test réel : 0 appel OpenAI pour "Sophie habite à Évreux."'
);

console.log(
  '✅ Fallback OpenAI original conservé.'
);

console.log(
  '✅ Enrichissements et contradictions communs conservés.'
);

console.log(
  '✅ Version visible : pré-alpha 0.2.3.'
);

console.log('');

console.log(
  '🛟 Sauvegarde :'
);

console.log(
  understandBackupPath
);