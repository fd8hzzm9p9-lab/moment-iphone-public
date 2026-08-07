
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

module.exports = {
  logDiagnostic,
  serializeError,
  summarizeResponse,
};
