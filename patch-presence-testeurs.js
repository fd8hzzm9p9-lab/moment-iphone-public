const fs = require('fs');
const path = require('path');
const {
  execFileSync,
} = require('child_process');

const ROOT =
  process.cwd();

const CHECK_ONLY =
  process.argv.includes(
    '--check'
  );

const PATCH_ID =
  'presence-testeurs-heartbeat-v1';

function fail(
  message
) {
  throw new Error(
    message
  );
}

function read(
  file
) {
  return fs.readFileSync(
    file,
    'utf8'
  );
}

function write(
  file,
  content
) {
  fs.writeFileSync(
    file,
    content,
    'utf8'
  );
}

function assertIncludes(
  content,
  marker,
  label
) {
  if (
    !content.includes(
      marker
    )
  ) {
    fail(
      `Ancre introuvable (${label}). Aucun fichier ne sera modifié.`
    );
  }
}

function assertNotIncludes(
  content,
  marker,
  label
) {
  if (
    content.includes(
      marker
    )
  ) {
    fail(
      `${label} semble déjà installé. Patch annulé pour éviter un doublon.`
    );
  }
}

function findByBasename(
  startDir,
  basename
) {
  const found =
    [];

  function walk(
    dir
  ) {
    for (
      const entry
      of fs.readdirSync(
        dir,
        {
          withFileTypes:
            true,
        }
      )
    ) {
      if (
        [
          'node_modules',
          '.git',
          '.expo',
          'dist',
          'build',
          '.moment-patch-backups',
        ].includes(
          entry.name
        )
      ) {
        continue;
      }

      const full =
        path.join(
          dir,
          entry.name
        );

      if (
        entry.isDirectory()
      ) {
        walk(
          full
        );
      } else if (
        entry.isFile() &&
        entry.name ===
          basename
      ) {
        found.push(
          full
        );
      }
    }
  }

  walk(
    startDir
  );

  return found;
}

function rel(
  file
) {
  return path
    .relative(
      ROOT,
      file
    )
    .replace(
      /\\/g,
      '/'
    );
}

const paths = {
  layout:
    path.join(
      ROOT,
      'app',
      '_layout.tsx'
    ),

  diagnostics:
    path.join(
      ROOT,
      'services',
      'diagnosticService.ts'
    ),

  server:
    path.join(
      ROOT,
      'server',
      'server.js'
    ),

  quota:
    path.join(
      ROOT,
      'server',
      'utils',
      'openai-alpha-quota.js'
    ),
};

for (
  const [
    label,
    file,
  ]
  of Object.entries(
    paths
  )
) {
  if (
    !fs.existsSync(
      file
    )
  ) {
    fail(
      `Fichier requis introuvable : ${label} -> ${rel(file)}`
    );
  }
}

const watcherMatches =
  findByBasename(
    ROOT,
    'watch-alpha-credits.js'
  );

if (
  watcherMatches.length ===
  0
) {
  fail(
    'watch-alpha-credits.js introuvable dans le projet.'
  );
}

if (
  watcherMatches.length >
  1
) {
  fail(
    'Plusieurs watch-alpha-credits.js trouvés :\n' +
      watcherMatches
        .map(
          file =>
            ` - ${rel(file)}`
        )
        .join('\n') +
      '\nPatch annulé pour ne pas modifier le mauvais fichier.'
  );
}

paths.watcher =
  watcherMatches[0];

const originals =
  {};

for (
  const [
    label,
    file,
  ]
  of Object.entries(
    paths
  )
) {
  originals[
    label
  ] =
    read(
      file
    );
}

/*
 * =========================================================
 * PRÉ-CONTRÔLES
 * =========================================================
 *
 * AUCUNE ÉCRITURE AVANT LA FIN DE CE BLOC.
 */

assertIncludes(
  originals.server,

  "  getQuotaFeedbackSnapshot,\n} = require('./utils/openai-alpha-quota');",

  'import quota dans server/server.js'
);

assertIncludes(
  originals.server,

  "/* ========================================================= */\n/* EXPORT DIAGNOSTIC ALPHA",

  'ancre route serveur'
);

assertNotIncludes(
  originals.server,

  "'/alpha-presence/heartbeat'",

  'route heartbeat serveur'
);

assertIncludes(
  originals.quota,

  'function getQuotaFeedbackSnapshot(deviceId) {',

  'getQuotaFeedbackSnapshot'
);

assertIncludes(
  originals.quota,

  'module.exports = {',

  'exports quota'
);

assertNotIncludes(
  originals.quota,

  'function recordTesterHeartbeat(',

  'fonction heartbeat quota'
);

assertIncludes(
  originals.diagnostics,

  'export async function getMomentDeviceId()',

  'getMomentDeviceId'
);

assertIncludes(
  originals.layout,

  "import {\n  Alert,\n} from 'react-native';",

  'import react-native dans _layout.tsx'
);

assertIncludes(
  originals.layout,

  "import {\n  FEEDBACK_ALERT_THRESHOLD,\n  getPendingDiagnosticCount,\n} from '../services/diagnosticService';",

  'import diagnosticService dans _layout.tsx'
);

assertIncludes(
  originals.layout,

  '  return (\n    <ThemeProvider',

  'ancre rendu RootLayout'
);

assertNotIncludes(
  originals.layout,

  '/alpha-presence/heartbeat',

  'heartbeat client'
);

assertIncludes(
  originals.watcher,

  '          Statut:\n            status,',

  'colonne Statut tableau crédits'
);

assertNotIncludes(
  originals.watcher,

  "'En ligne':",

  'colonne En ligne'
);

console.log(
  '✅ Pré-contrôles réussis.'
);

console.log(
  'Fichiers détectés :'
);

for (
  const file
  of Object.values(
    paths
  )
) {
  console.log(
    ` - ${rel(file)}`
  );
}

if (
  CHECK_ONLY
) {
  console.log(
    ''
  );

  console.log(
    '✅ MODE --check : aucune modification effectuée.'
  );

  process.exit(
    0
  );
}

/*
 * =========================================================
 * CONSTRUCTION DES NOUVEAUX CONTENUS EN MÉMOIRE
 * =========================================================
 */

const next = {
  ...originals,
};

/*
 * =========================================================
 * QUOTA
 * =========================================================
 */

const quotaFunction = `
/*
 * =========================================================
 * PRÉSENCE TESTEURS — HEARTBEAT
 * =========================================================
 *
 * Aucun appel OpenAI.
 * Enregistre uniquement la dernière présence connue
 * de l'application auprès du serveur Moment.
 */

function recordTesterHeartbeat(
  deviceId
) {
  const cleanDeviceId =
    normalizeDeviceId(
      deviceId
    );

  if (!cleanDeviceId) {
    const error =
      new Error(
        'Identifiant appareil manquant'
      );

    error.code =
      'MISSING_DEVICE_ID';

    error.status =
      400;

    throw error;
  }

  const store =
    readStore();

  const state =
    ensureCreditFields(
      getOrCreateDevice(
        store,
        cleanDeviceId
      )
    );

  const now =
    new Date()
      .toISOString();

  state.last_seen_at =
    now;

  writeStore(
    store
  );

  return {
    ok:
      true,

    moment_device_id:
      cleanDeviceId,

    last_seen_at:
      now,
  };
}

`;

next.quota =
  next.quota.replace(
    'function getQuotaFeedbackSnapshot(deviceId) {',

    quotaFunction +
      'function getQuotaFeedbackSnapshot(deviceId) {'
  );

next.quota =
  next.quota.replace(
    '  getQuotaFeedbackSnapshot,\n};',

    '  getQuotaFeedbackSnapshot,\n  recordTesterHeartbeat,\n};'
  );

/*
 * =========================================================
 * SERVEUR
 * =========================================================
 */

next.server =
  next.server.replace(
    "  getQuotaFeedbackSnapshot,\n} = require('./utils/openai-alpha-quota');",

    "  getQuotaFeedbackSnapshot,\n  recordTesterHeartbeat,\n} = require('./utils/openai-alpha-quota');"
  );

const heartbeatRoute = `/* ========================================================= */
/* PRÉSENCE TESTEURS — HEARTBEAT                             */
/* ========================================================= */

app.post(
  '/alpha-presence/heartbeat',
  (req, res) => {
    try {
      return res.json(
        recordTesterHeartbeat(
          req.body?.moment_device_id
        )
      );
    } catch (error) {
      return res
        .status(
          error?.status ||
          500
        )
        .json({
          ok:
            false,

          error:
            error?.message ||
            'Présence indisponible.',

          code:
            error?.code ||
            'ALPHA_PRESENCE_ERROR',
        });
    }
  }
);


`;

next.server =
  next.server.replace(
    '/* ========================================================= */\n/* EXPORT DIAGNOSTIC ALPHA',

    heartbeatRoute +
      '/* ========================================================= */\n/* EXPORT DIAGNOSTIC ALPHA'
  );

/*
 * =========================================================
 * CLIENT / _layout.tsx
 * =========================================================
 */

next.layout =
  next.layout.replace(
    "import {\n  Alert,\n} from 'react-native';",

    "import {\n  Alert,\n  AppState,\n} from 'react-native';"
  );

next.layout =
  next.layout.replace(
    "import {\n  FEEDBACK_ALERT_THRESHOLD,\n  getPendingDiagnosticCount,\n} from '../services/diagnosticService';",

    "import {\n  FEEDBACK_ALERT_THRESHOLD,\n  getMomentDeviceId,\n  getPendingDiagnosticCount,\n} from '../services/diagnosticService';"
  );

const serverUrlImport = `
import {
  SERVER_URL,
} from '../config/server';
`;

next.layout =
  next.layout.replace(
    "import {\n  useColorScheme,\n} from '@/hooks/use-color-scheme';",

    "import {\n  useColorScheme,\n} from '@/hooks/use-color-scheme';\n" +
      serverUrlImport
  );

const heartbeatEffect = `  useEffect(
    () => {
      /*
       * Présence testeur :
       *
       * - ping immédiat quand Moment est actif ;
       * - ping toutes les 60 secondes ;
       * - aucun ping lorsque l'app est en arrière-plan.
       */

      let heartbeatInterval:
        ReturnType<typeof setInterval> |
        null =
          null;

      const sendHeartbeat =
        async () => {
          try {
            const momentDeviceId =
              await getMomentDeviceId();

            await fetch(
              \`\${SERVER_URL}/alpha-presence/heartbeat\`,
              {
                method:
                  'POST',

                headers: {
                  'Content-Type':
                    'application/json',
                },

                body:
                  JSON.stringify({
                    moment_device_id:
                      momentDeviceId,
                  }),
              }
            );
          } catch {
            /*
             * Le heartbeat ne doit jamais gêner
             * l'utilisation normale de Moment.
             */
          }
        };

      const stopHeartbeat =
        () => {
          if (
            heartbeatInterval
          ) {
            clearInterval(
              heartbeatInterval
            );

            heartbeatInterval =
              null;
          }
        };

      const startHeartbeat =
        () => {
          stopHeartbeat();

          void sendHeartbeat();

          heartbeatInterval =
            setInterval(
              () => {
                void sendHeartbeat();
              },
              60000
            );
        };

      if (
        AppState.currentState ===
        'active'
      ) {
        startHeartbeat();
      }

      const subscription =
        AppState.addEventListener(
          'change',
          nextState => {
            if (
              nextState ===
              'active'
            ) {
              startHeartbeat();
            } else {
              stopHeartbeat();
            }
          }
        );

      return () => {
        stopHeartbeat();

        subscription.remove();
      };
    },
    []
  );

`;

next.layout =
  next.layout.replace(
    '  return (\n    <ThemeProvider',

    heartbeatEffect +
      '  return (\n    <ThemeProvider'
  );

/*
 * =========================================================
 * TABLEAU CRÉDITS
 * =========================================================
 */

const watcherPresenceBlock = `        const lastSeenAt =
          device
            ?.last_seen_at ||
          null;

        const lastSeenMs =
          lastSeenAt
            ? new Date(
                lastSeenAt
              ).getTime()
            : 0;

        const isOnline =
          Number.isFinite(
            lastSeenMs
          ) &&
          lastSeenMs > 0 &&
          (
            Date.now() -
            lastSeenMs
          ) <= 90000;

`;

next.watcher =
  next.watcher.replace(
    '        const testerName =\n          getTesterName(',

    watcherPresenceBlock +
      '        const testerName =\n          getTesterName('
  );

next.watcher =
  next.watcher.replace(
    '          Statut:\n            status,',

    `          Crédit:
            status,

          'En ligne':
            isOnline
              ? '🟢 OUI'
              : '⚫ NON',

          'Vu':
            formatDate(
              lastSeenAt
            ),`
  );

/*
 * =========================================================
 * CONTRÔLES AVANT ÉCRITURE
 * =========================================================
 */

const expectedMarkers = [
  [
    next.server,
    "'/alpha-presence/heartbeat'",
    'route serveur',
  ],

  [
    next.server,
    'recordTesterHeartbeat(',
    'appel heartbeat serveur',
  ],

  [
    next.quota,
    'function recordTesterHeartbeat(',
    'fonction quota',
  ],

  [
    next.quota,
    '  recordTesterHeartbeat,',
    'export quota',
  ],

  [
    next.layout,
    'AppState.addEventListener(',
    'AppState client',
  ],

  [
    next.layout,
    '/alpha-presence/heartbeat',
    'appel heartbeat client',
  ],

  [
    next.layout,
    '60000',
    'intervalle 60 secondes',
  ],

  [
    next.watcher,
    "'En ligne':",
    'colonne En ligne',
  ],

  [
    next.watcher,
    'last_seen_at',
    'dernière présence',
  ],
];

for (
  const [
    content,
    marker,
    label,
  ]
  of expectedMarkers
) {
  assertIncludes(
    content,
    marker,
    label
  );
}

console.log(
  '✅ Nouveau contenu construit et contrôlé en mémoire.'
);

/*
 * =========================================================
 * SAUVEGARDE
 * =========================================================
 */

const stamp =
  new Date()
    .toISOString()
    .replace(
      /[:.]/g,
      '-'
    );

const backupRoot =
  path.join(
    ROOT,
    '.moment-patch-backups',
    `${PATCH_ID}-${stamp}`
  );

for (
  const [
    label,
    file,
  ]
  of Object.entries(
    paths
  )
) {
  const destination =
    path.join(
      backupRoot,
      rel(file)
    );

  fs.mkdirSync(
    path.dirname(
      destination
    ),
    {
      recursive:
        true,
    }
  );

  fs.copyFileSync(
    file,
    destination
  );
}

console.log(
  `✅ Sauvegarde créée : ${rel(backupRoot)}`
);

/*
 * =========================================================
 * ÉCRITURE + VALIDATION + RESTAURATION AUTO SI ÉCHEC
 * =========================================================
 */

let modified =
  false;

try {
  for (
    const [
      label,
      file,
    ]
    of Object.entries(
      paths
    )
  ) {
    write(
      file,
      next[
        label
      ]
    );
  }

  modified =
    true;

  /*
   * Contrôle syntaxe JS.
   */

  execFileSync(
    process.execPath,
    [
      '--check',
      paths.server,
    ],
    {
      stdio:
        'pipe',
    }
  );

  execFileSync(
    process.execPath,
    [
      '--check',
      paths.quota,
    ],
    {
      stdio:
        'pipe',
    }
  );

  execFileSync(
    process.execPath,
    [
      '--check',
      paths.watcher,
    ],
    {
      stdio:
        'pipe',
    }
  );

  /*
   * Contrôle post-écriture.
   */

  for (
    const [
      label,
      file,
    ]
    of Object.entries(
      paths
    )
  ) {
    const current =
      read(
        file
      );

    if (
      current !==
      next[
        label
      ]
    ) {
      fail(
        `Contrôle post-écriture échoué : ${rel(file)}`
      );
    }
  }

  console.log(
    ''
  );

  console.log(
    '✅ PATCH TERMINÉ'
  );

  console.log(
    '✅ Heartbeat : ouverture + retour au premier plan + toutes les 60 s'
  );

  console.log(
    '✅ Seuil tableau : en ligne si vu depuis moins de 90 s'
  );

  console.log(
    '✅ Aucun appel OpenAI'
  );

  console.log(
    `✅ Sauvegarde conservée : ${rel(backupRoot)}`
  );

} catch (
  error
) {
  console.error(
    ''
  );

  console.error(
    '❌ ÉCHEC DU PATCH :',
    error?.message ||
    error
  );

  if (
    modified
  ) {
    for (
      const [
        label,
        file,
      ]
      of Object.entries(
        paths
      )
    ) {
      write(
        file,
        originals[
          label
        ]
      );
    }

    console.error(
      '↩️ RESTAURATION AUTOMATIQUE EFFECTUÉE.'
    );
  } else {
    console.error(
      'ℹ️ Aucun fichier n’avait encore été modifié.'
    );
  }

  process.exitCode =
    1;
}