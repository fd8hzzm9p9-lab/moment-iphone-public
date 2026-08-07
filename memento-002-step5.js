const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = process.cwd();

const paths = {
  appConfig: path.join(root, 'config', 'app.ts'),
  index: path.join(root, 'app', '(tabs)', 'index.tsx'),
  recallScreen: path.join(root, 'app', '(tabs)', 'rappelle-moi.tsx'),
  understandRoute: path.join(root, 'server', 'routes', 'understand.js'),
  recallRoute: path.join(root, 'server', 'routes', 'recall.js'),
  clientDiagnostics: path.join(root, 'services', 'diagnosticService.ts'),
  serverDiagnostics: path.join(root, 'server', 'utils', 'diagnostics.js'),
};

for (const [name, file] of Object.entries({
  appConfig: paths.appConfig,
  index: paths.index,
  recallScreen: paths.recallScreen,
  understandRoute: paths.understandRoute,
  recallRoute: paths.recallRoute,
})) {
  if (!fs.existsSync(file)) {
    console.error(`❌ Fichier introuvable (${name}) : ${file}`);
    process.exit(1);
  }
}

const originals = {};

for (const [name, file] of Object.entries({
  appConfig: paths.appConfig,
  index: paths.index,
  recallScreen: paths.recallScreen,
  understandRoute: paths.understandRoute,
  recallRoute: paths.recallRoute,
})) {
    originals[name] = fs
    .readFileSync(
        file,
        'utf8'
    )
    .replace(
        /\r\n/g,
        '\n'
    );
}

for (const [name, file] of Object.entries({
  appConfig: paths.appConfig,
  index: paths.index,
  recallScreen: paths.recallScreen,
  understandRoute: paths.understandRoute,
  recallRoute: paths.recallRoute,
})) {
  const backup = `${file}.memento002-05.bak`;

  if (!fs.existsSync(backup)) {
    fs.writeFileSync(
      backup,
      originals[name],
      'utf8'
    );
  }
}

/* ========================================================= */
/* SERVICE DIAGNOSTIC CÔTÉ APPLICATION                        */
/* ========================================================= */

const clientDiagnostics = `
import AsyncStorage from '@react-native-async-storage/async-storage';

export const DIAGNOSTIC_STORAGE_KEY =
  'moment_diagnostic_interactions_v1';

const MAX_DIAGNOSTIC_INTERACTIONS =
  500;

export type DiagnosticInteraction = {
  diagnostic_id: string;
  feature:
    | 'understand'
    | 'recall'
    | 'prevent';
  input: string;
  created_at: string;
  app_version?: string;
};

export function createDiagnosticId(
  feature:
    | 'understand'
    | 'recall'
    | 'prevent'
) {
  return (
    \`diag_\${feature}_\${Date.now()}_\` +
    Math.random()
      .toString(36)
      .substring(2, 10)
  );
}

export async function recordDiagnosticInteraction(
  interaction: DiagnosticInteraction
) {
  try {
    const raw =
      await AsyncStorage.getItem(
        DIAGNOSTIC_STORAGE_KEY
      );

    const existing:
      DiagnosticInteraction[] =
        raw
          ? JSON.parse(raw)
          : [];

    const next = [
      interaction,
      ...existing,
    ].slice(
      0,
      MAX_DIAGNOSTIC_INTERACTIONS
    );

    await AsyncStorage.setItem(
      DIAGNOSTIC_STORAGE_KEY,
      JSON.stringify(next)
    );
  } catch (error) {
    console.error(
      '❌ Impossible d’enregistrer le diagnostic local :',
      error
    );
  }
}

export async function getDiagnosticInteractions() {
  try {
    const raw =
      await AsyncStorage.getItem(
        DIAGNOSTIC_STORAGE_KEY
      );

    return raw
      ? JSON.parse(raw)
      : [];
  } catch {
    return [];
  }
}

export async function clearDiagnosticInteractions() {
  await AsyncStorage.removeItem(
    DIAGNOSTIC_STORAGE_KEY
  );
}
`;

fs.mkdirSync(
  path.dirname(paths.clientDiagnostics),
  { recursive: true }
);

fs.writeFileSync(
  paths.clientDiagnostics,
  clientDiagnostics,
  'utf8'
);

/* ========================================================= */
/* LOGGER DIAGNOSTIC CÔTÉ SERVEUR                             */
/* ========================================================= */

const serverDiagnostics = `
const fs = require('fs');
const path = require('path');

const diagnosticsDir =
  path.join(
    __dirname,
    '..',
    'diagnostics'
  );

function ensureDiagnosticsDir() {
  if (
    !fs.existsSync(
      diagnosticsDir
    )
  ) {
    fs.mkdirSync(
      diagnosticsDir,
      {
        recursive: true,
      }
    );
  }
}

function getDiagnosticsFile() {
  const now =
    new Date();

  const year =
    now.getUTCFullYear();

  const month =
    String(
      now.getUTCMonth() + 1
    ).padStart(
      2,
      '0'
    );

  return path.join(
    diagnosticsDir,
    \`diagnostics-\${year}-\${month}.jsonl\`
  );
}

function serializeError(
  error
) {
  if (!error) {
    return null;
  }

  return {
    name:
      error.name ||
      '',

    message:
      error.message ||
      String(error),

    code:
      error.code ||
      error?.error?.code ||
      '',

    type:
      error.type ||
      error?.error?.type ||
      '',

    status:
      error.status ||
      null,
  };
}

function logDiagnostic(
  entry
) {
  try {
    ensureDiagnosticsDir();

    const record = {
      recorded_at:
        new Date()
          .toISOString(),

      ...entry,
    };

    fs.appendFileSync(
      getDiagnosticsFile(),
      JSON.stringify(
        record
      ) + '\\n',
      'utf8'
    );
  } catch (error) {
    console.error(
      '❌ DIAGNOSTIC LOG ERROR :',
      error
    );
  }
}

function summarizeResponse(
  payload
) {
  if (
    !payload ||
    typeof payload !==
      'object'
  ) {
    return {
      response_type:
        typeof payload,
    };
  }

  return {
    event_count:
      Array.isArray(
        payload.events
      )
        ? payload.events.length
        : undefined,

    has_answer:
      typeof payload.answer ===
        'string',

    has_correction:
      Boolean(
        payload
          .correction_request
          ?.detected
      ),

    has_date_confirmation:
      Boolean(
        payload
          .date_confirmation
          ?.required
      ),

    has_conflict:
      Boolean(
        payload
          .conflict
          ?.detected
      ),

    error_code:
      payload.code ||
      '',

    error:
      payload.error ||
      '',
  };
}

module.exports = {
  logDiagnostic,
  serializeError,
  summarizeResponse,
};
`;

fs.writeFileSync(
  paths.serverDiagnostics,
  serverDiagnostics,
  'utf8'
);

/* ========================================================= */
/* PATCH CLIENT : SOUVIENS-TOI                                */
/* ========================================================= */

let index =
  originals.index;

const clientImport = `
import {
  createDiagnosticId,
  recordDiagnosticInteraction,
} from '../../services/diagnosticService';
`;

if (
  !index.includes(
    "from '../../services/diagnosticService'"
  )
) {
  const marker =
    "import { SERVER_URL } from '../../config/server';";

  if (!index.includes(marker)) {
    throw new Error(
      'Import SERVER_URL introuvable dans index.tsx'
    );
  }

  index =
    index.replace(
      marker,
      `${marker}\n${clientImport}`
    );
}

const requestIdMarker = `
      const requestId =
        ++requestIdRef.current;
`;

if (
  !index.includes(
    'createDiagnosticId('
  )
) {
  if (
    !index.includes(
      requestIdMarker
    )
  ) {
    throw new Error(
      'requestId analyserSouvenir introuvable'
    );
  }

  index =
    index.replace(
      requestIdMarker,
`${requestIdMarker}
      const diagnosticId =
        createDiagnosticId(
          'understand'
        );

      void recordDiagnosticInteraction({
        diagnostic_id:
          diagnosticId,

        feature:
          'understand',

        input:
          texte.trim(),

        created_at:
          new Date()
            .toISOString(),

        app_version:
          APP_VERSION,
      });
`
    );
}

const understandBodyMarker = `
    confirmed_calendar_date:
      confirmedCalendarDate || '',
`;

if (
  !index.includes(
    'diagnostic_id:'
  )
) {
  if (
    !index.includes(
      understandBodyMarker
    )
  ) {
    throw new Error(
      'Body /understand introuvable dans index.tsx'
    );
  }

  index =
    index.replace(
      understandBodyMarker,
`${understandBodyMarker}
    diagnostic_id:
      diagnosticId,
`
    );
}

fs.writeFileSync(
  paths.index,
  index,
  'utf8'
);

/* ========================================================= */
/* PATCH CLIENT : RAPPELLE-MOI                                */
/* ========================================================= */

let recallScreen =
  originals.recallScreen;

if (
  !recallScreen.includes(
    "from '../../services/diagnosticService'"
  )
) {
  const marker =
    "import { SERVER_URL } from '../../config/server';";

  if (
    !recallScreen.includes(
      marker
    )
  ) {
    throw new Error(
      'Import SERVER_URL introuvable dans rappelle-moi.tsx'
    );
  }

  recallScreen =
    recallScreen.replace(
      marker,
      `${marker}\n${clientImport}`
    );
}

const recallQuestionMarker = `
    const question =
      recherche.trim();
`;

if (
  !recallScreen.includes(
    "createDiagnosticId(\n        'recall'"
  )
) {
  if (
    !recallScreen.includes(
      recallQuestionMarker
    )
  ) {
    throw new Error(
      'question lancerRecherche introuvable'
    );
  }

  recallScreen =
    recallScreen.replace(
      recallQuestionMarker,
`${recallQuestionMarker}
    const diagnosticId =
      createDiagnosticId(
        'recall'
      );

    void recordDiagnosticInteraction({
      diagnostic_id:
        diagnosticId,

      feature:
        'recall',

      input:
        question,

      created_at:
        new Date()
          .toISOString(),

      app_version:
        APP_VERSION,
    });
`
    );
}

const recallBodyMarker = `
              question,
              memories: evenements,
`;

if (
  !recallScreen.includes(
    'diagnostic_id: diagnosticId'
  )
) {
  if (
    !recallScreen.includes(
      recallBodyMarker
    )
  ) {
    throw new Error(
      'Body /recall introuvable'
    );
  }

  recallScreen =
    recallScreen.replace(
      recallBodyMarker,
`${recallBodyMarker}
              diagnostic_id: diagnosticId,
`
    );
}

fs.writeFileSync(
  paths.recallScreen,
  recallScreen,
  'utf8'
);

/* ========================================================= */
/* PATCH SERVEUR : /UNDERSTAND                                */
/* ========================================================= */

let understand =
  originals.understandRoute;

const serverImport = `
const {
  logDiagnostic,
  serializeError,
  summarizeResponse,
} = require('../utils/diagnostics');
`;

if (
  !understand.includes(
    "require('../utils/diagnostics')"
  )
) {
  const marker = `
const {
  tryLocalUnderstand,
} = require('../utils/local-understand');
`;

  if (
    !understand.includes(
      marker
    )
  ) {
    throw new Error(
      'Import local-understand introuvable'
    );
  }

  understand =
    understand.replace(
      marker,
      `${marker}${serverImport}`
    );
}

const understandReqMarker = `
        confirmed_calendar_date,
      } = req.body;
`;

if (
  !understand.includes(
    'diagnostic_id,'
  )
) {
  if (
    !understand.includes(
      understandReqMarker
    )
  ) {
    throw new Error(
      'Destructuration req.body /understand introuvable'
    );
  }

  understand =
    understand.replace(
      understandReqMarker,
`        confirmed_calendar_date,
        diagnostic_id,
      } = req.body;
`
    );
}

const understandMemoriesMarker = `
      const existingMemories =
        Array.isArray(memories)
          ? memories
          : [];
`;

if (
  !understand.includes(
    "feature:\n          'understand'"
  )
) {
  if (
    !understand.includes(
      understandMemoriesMarker
    )
  ) {
    throw new Error(
      'existingMemories /understand introuvable'
    );
  }

  understand =
    understand.replace(
      understandMemoriesMarker,
`${understandMemoriesMarker}
      const diagnosticId =
        typeof diagnostic_id ===
          'string' &&
        diagnostic_id.trim()
          ? diagnostic_id.trim()
          : createId(
              'diagnostic'
            );

      const requestStartedAt =
        Date.now();

      const originalJson =
        res.json.bind(
          res
        );

      res.json =
        payload => {
          logDiagnostic({
            diagnostic_id:
              diagnosticId,

            feature:
              'understand',

            event:
              'response',

            duration_ms:
              Date.now() -
              requestStartedAt,

            status_code:
              res.statusCode,

            summary:
              summarizeResponse(
                payload
              ),
          });

          return originalJson(
            payload
          );
        };

      logDiagnostic({
        diagnostic_id:
          diagnosticId,

        feature:
          'understand',

        event:
          'request_start',

        input:
          text.trim(),

        memory_count:
          existingMemories.length,
      });
`
    );
}

const localSuccessMarker = `
        console.log(
          '⚡ LOCAL FIRST : compréhension locale utilisée'
        );
`;

if (
  !understand.includes(
    "event:\n            'local_success'"
  )
) {
  if (
    !understand.includes(
      localSuccessMarker
    )
  ) {
    throw new Error(
      'Log local success introuvable'
    );
  }

  understand =
    understand.replace(
      localSuccessMarker,
`${localSuccessMarker}
        logDiagnostic({
          diagnostic_id:
            diagnosticId,

          feature:
            'understand',

          event:
            'local_success',

          parser:
            localResult
              .local_understanding
              ?.parser ||
              'unknown',

          confidence:
            localResult
              .local_understanding
              ?.confidence ??
              null,
        });
`
    );
}

const fallbackMarker = `
        console.log(
          '🌐 LOCAL FIRST : fallback OpenAI nécessaire'
        );
`;

if (
  !understand.includes(
    "event:\n            'openai_fallback'"
  )
) {
  if (
    !understand.includes(
      fallbackMarker
    )
  ) {
    throw new Error(
      'Log fallback OpenAI introuvable'
    );
  }

  understand =
    understand.replace(
      fallbackMarker,
`${fallbackMarker}
        logDiagnostic({
          diagnostic_id:
            diagnosticId,

          feature:
            'understand',

          event:
            'openai_fallback',

          reason:
            'local_understanding_not_confident',
        });
`
    );
}

const understandCatchMarker = `
  console.error(
    '❌ Erreur OpenAI /understand :',
    error
  );
`;

if (
  !understand.includes(
    "event:\n      'error'"
  )
) {
  if (
    !understand.includes(
      understandCatchMarker
    )
  ) {
    throw new Error(
      'Catch /understand introuvable'
    );
  }

  understand =
    understand.replace(
      understandCatchMarker,
`${understandCatchMarker}
  logDiagnostic({
    diagnostic_id:
      typeof diagnosticId !==
        'undefined'
        ? diagnosticId
        : diagnostic_id ||
          '',

    feature:
      'understand',

    event:
      'error',

    error:
      serializeError(
        error
      ),
  });
`
    );
}

fs.writeFileSync(
  paths.understandRoute,
  understand,
  'utf8'
);

/* ========================================================= */
/* PATCH SERVEUR : /RECALL                                    */
/* ========================================================= */

let recallRoute =
  originals.recallRoute;

if (
  !recallRoute.includes(
    "require('../utils/diagnostics')"
  )
) {
  const marker =
    'const helpers = {';

  recallRoute =
    recallRoute.replace(
      marker,
      `${serverImport}${marker}`
    );
}

const recallReqMarker = `
        question,
        memories,
      } = req.body;
`;

if (
  !recallRoute.includes(
    'diagnostic_id,'
  )
) {
  if (
    !recallRoute.includes(
      recallReqMarker
    )
  ) {
    throw new Error(
      'Destructuration /recall introuvable'
    );
  }

  recallRoute =
    recallRoute.replace(
      recallReqMarker,
`        question,
        memories,
        diagnostic_id,
      } = req.body;
`
    );
}

const recallStartMarker = `
      console.log(
        '❓ Question :',
        question
      );
`;

if (
  !recallRoute.includes(
    "feature:\n          'recall'"
  )
) {
  if (
    !recallRoute.includes(
      recallStartMarker
    )
  ) {
    throw new Error(
      'Point de départ /recall introuvable'
    );
  }

  recallRoute =
    recallRoute.replace(
      recallStartMarker,
`      const diagnosticId =
        typeof diagnostic_id ===
          'string' &&
        diagnostic_id.trim()
          ? diagnostic_id.trim()
          : createId(
              'diagnostic'
            );

      const requestStartedAt =
        Date.now();

      const originalJson =
        res.json.bind(
          res
        );

      res.json =
        payload => {
          logDiagnostic({
            diagnostic_id:
              diagnosticId,

            feature:
              'recall',

            event:
              'response',

            duration_ms:
              Date.now() -
              requestStartedAt,

            status_code:
              res.statusCode,

            summary:
              summarizeResponse(
                payload
              ),
          });

          return originalJson(
            payload
          );
        };

      logDiagnostic({
        diagnostic_id:
          diagnosticId,

        feature:
          'recall',

        event:
          'request_start',

        input:
          question.trim(),

        memory_count:
          memories.length,
      });

${recallStartMarker}`
    );
}

const recallOpenAiMarker = `
      const response =
        await openai.responses.create({
`;

if (
  !recallRoute.includes(
    "event:\n          'openai_fallback'"
  )
) {
  if (
    !recallRoute.includes(
      recallOpenAiMarker
    )
  ) {
    throw new Error(
      'Fallback OpenAI /recall introuvable'
    );
  }

  recallRoute =
    recallRoute.replace(
      recallOpenAiMarker,
`      logDiagnostic({
        diagnostic_id:
          diagnosticId,

        feature:
          'recall',

        event:
          'openai_fallback',

        reason:
          'no_local_answer_returned',
      });

${recallOpenAiMarker}`
    );
}

const recallCatchMarker = `
      console.error(
        '❌ Erreur de rappel :',
        error
      );
`;

if (
  !recallRoute.includes(
    "feature:\n          'recall',\n\n        event:\n          'error'"
  )
) {
  if (
    !recallRoute.includes(
      recallCatchMarker
    )
  ) {
    throw new Error(
      'Catch /recall introuvable'
    );
  }

  recallRoute =
    recallRoute.replace(
      recallCatchMarker,
`${recallCatchMarker}
      logDiagnostic({
        diagnostic_id:
          typeof diagnosticId !==
            'undefined'
            ? diagnosticId
            : diagnostic_id ||
              '',

        feature:
          'recall',

        event:
          'error',

        error:
          serializeError(
            error
          ),
      });
`
    );
}

fs.writeFileSync(
  paths.recallRoute,
  recallRoute,
  'utf8'
);

/* ========================================================= */
/* VERSION                                                    */
/* ========================================================= */

let appConfig =
  originals.appConfig;

const versionRegex =
  /export\s+const\s+APP_VERSION\s*=\s*'[^']*'\s*;/m;

if (
  !versionRegex.test(
    appConfig
  )
) {
  throw new Error(
    'APP_VERSION introuvable'
  );
}

appConfig =
  appConfig.replace(
    versionRegex,
    "export const APP_VERSION =\n  'pré-alpha 0.2.5';"
  );

fs.writeFileSync(
  paths.appConfig,
  appConfig,
  'utf8'
);

/* ========================================================= */
/* VALIDATION                                                 */
/* ========================================================= */

try {
  execFileSync(
    process.execPath,
    [
      '--check',
      paths.serverDiagnostics,
    ],
    {
      stdio: 'pipe',
    }
  );

  execFileSync(
    process.execPath,
    [
      '--check',
      paths.understandRoute,
    ],
    {
      stdio: 'pipe',
    }
  );

  execFileSync(
    process.execPath,
    [
      '--check',
      paths.recallRoute,
    ],
    {
      stdio: 'pipe',
    }
  );

  execFileSync(
    process.execPath,
    [
      '-e',
      `
const d =
  require(${JSON.stringify(
    paths.serverDiagnostics
  )});

d.logDiagnostic({
  diagnostic_id:
    'memento00205_test',

  feature:
    'test',

  event:
    'self_test',
});

console.log(
  'DIAGNOSTICS_OK'
);
`,
    ],
    {
      stdio: 'pipe',
    }
  );

} catch (error) {

  for (const [name, file] of Object.entries({
    appConfig: paths.appConfig,
    index: paths.index,
    recallScreen: paths.recallScreen,
    understandRoute: paths.understandRoute,
    recallRoute: paths.recallRoute,
  })) {
    fs.writeFileSync(
      file,
      originals[name],
      'utf8'
    );
  }

  for (const generated of [
    paths.clientDiagnostics,
    paths.serverDiagnostics,
  ]) {
    if (
      fs.existsSync(
        generated
      )
    ) {
      fs.unlinkSync(
        generated
      );
    }
  }

  console.error('');

  console.error(
    '❌ MEMENTO 002-05 a échoué.'
  );

  console.error(
    '🛟 Les fichiers modifiés ont été restaurés.'
  );

  if (error.stderr) {
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
  '✅ MEMENTO 002-05 appliqué avec succès.'
);

console.log(
  '✅ Identifiant diagnostic commun téléphone ↔ serveur ajouté.'
);

console.log(
  '✅ Souviens-toi journalise automatiquement chaque saisie.'
);

console.log(
  '✅ Rappelle-moi journalise automatiquement chaque question.'
);

console.log(
  '✅ Le serveur journalise les débuts et fins de requêtes.'
);

console.log(
  '✅ Local First réussi / fallback OpenAI / erreurs sont consignés.'
);

console.log(
  '✅ Logs serveur : server/diagnostics/diagnostics-YYYY-MM.jsonl'
);

console.log(
  '✅ Journal téléphone : AsyncStorage moment_diagnostic_interactions_v1'
);

console.log(
  '✅ Version visible : pré-alpha 0.2.5.'
);

console.log('');

console.log(
  'ℹ️ 002-06 réunira automatiquement ces informations dans le bouton Envoyer le feedback.'
);