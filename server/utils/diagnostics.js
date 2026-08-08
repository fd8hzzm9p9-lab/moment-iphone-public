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
    `diagnostics-${year}-${month}.jsonl`
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

function sanitizeDiagnosticPayload(
  payload
) {
  if (
    !payload ||
    typeof payload !==
      'object'
  ) {
    return payload;
  }

  /*
   * On conserve le résultat utile au diagnostic
   * mais on évite de dupliquer toute la BDD mémoire
   * dans le fichier de feedback.
   */

  return {
    input:
      payload.input,

    events:
      Array.isArray(
        payload.events
      )
        ? payload.events
        : [],

    answer:
      payload.answer,

    conflict:
      payload.conflict,

    correction_request:
      payload.correction_request,

    deduction_action:
      payload.deduction_action,

    date_confirmation:
      payload.date_confirmation,

    event_ids:
      payload.event_ids,

    evidence:
      payload.evidence,

    code:
      payload.code,

    error:
      payload.error,

    message:
      payload.message,
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
      ) + '\n',
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

function readAllDiagnostics() {
  ensureDiagnosticsDir();

  const files =
    fs
      .readdirSync(
        diagnosticsDir
      )
      .filter(
        file =>
          file.endsWith(
            '.jsonl'
          )
      )
      .sort();

  const entries = [];

  for (
    const file of files
  ) {
    const fullPath =
      path.join(
        diagnosticsDir,
        file
      );

    const lines =
      fs
        .readFileSync(
          fullPath,
          'utf8'
        )
        .split(
          /\r?\n/
        )
        .filter(Boolean);

    for (
      const line of lines
    ) {
      try {
        entries.push(
          JSON.parse(
            line
          )
        );
      } catch {
        // Ligne invalide ignorée.
      }
    }
  }

  return entries;
}

function getDiagnosticsByIds(
  ids
) {
  const wanted =
    new Set(
      Array.isArray(ids)
        ? ids
            .filter(
              value =>
                typeof value ===
                'string' &&
                value.trim()
            )
            .map(
              value =>
                value.trim()
            )
        : []
    );

  if (
    wanted.size === 0
  ) {
    return [];
  }

  return readAllDiagnostics()
    .filter(
      entry =>
        wanted.has(
          entry
            .diagnostic_id
        )
    );
}

module.exports = {
  getDiagnosticsByIds,
  logDiagnostic,
  sanitizeDiagnosticPayload,
  serializeError,
  summarizeResponse,
};
