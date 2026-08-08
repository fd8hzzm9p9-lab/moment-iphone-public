import {
  File,
  Paths,
} from 'expo-file-system';

import * as Sharing
  from 'expo-sharing';

import * as Device
  from 'expo-device';

import {
  Platform,
} from 'react-native';

import {
  APP_NAME,
  APP_VERSION,
} from '../config/app';

import {
  SERVER_URL,
} from '../config/server';

import {
  getMomentDeviceId,
  getPendingDiagnosticInteractions,
} from './diagnosticService';

import {
  getLocalAlphaCreditSnapshot,
} from './alphaCreditService';

import {
  getPendingMemoryDiagnosticSnapshot,
} from './pendingMemoryService';

function buildFileName(
  momentDeviceId:
    string
) {
  const now =
    new Date();

  const date =
    now
      .toISOString()
      .slice(
        0,
        10
      );

  const time =
    now
      .toISOString()
      .slice(
        11,
        19
      )
      .replace(
        /:/g,
        '-'
      );

  const shortDeviceId =
    String(
      momentDeviceId ||
      'unknown'
    )
      .replace(
        /^moment_/,
        ''
      )
      .replace(
        /[^a-zA-Z0-9]/g,
        ''
      )
      .slice(
        0,
        8
      ) ||
      'unknown';

  const shortVersion =
    String(
      APP_VERSION ||
      'unknown'
    )
      .replace(
        /^pré-alpha\s*/i,
        ''
      )
      .replace(
        /[^0-9.]/g,
        ''
      ) ||
      'unknown';

  return (
    `moment-feedback-${shortDeviceId}-v${shortVersion}-${date}-${time}.json`
  );
}

export async function exportMomentFeedback() {
  const interactions =
    await getPendingDiagnosticInteractions();

  const pendingMemories =
    await getPendingMemoryDiagnosticSnapshot();

  if (
    interactions.length === 0
  ) {
    throw new Error(
      'Aucune interaction en attente.'
    );
  }

  /*
   * Snapshot du lot.
   *
   * C'est CETTE liste précise qui
   * pourra être marquée envoyée ensuite.
   */

  const diagnosticIds =
    interactions
      .map(
        item =>
          item
            ?.diagnostic_id
      )
      .filter(Boolean);

  const momentDeviceId =
    await getMomentDeviceId();

  let serverDiagnostics:
    any = {
      available:
        false,

      diagnostics:
        [],
    };

  try {
    const response =
      await fetch(
        `${SERVER_URL}/diagnostics/export`,
        {
          method:
            'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body:
            JSON.stringify({
              diagnostic_ids:
                diagnosticIds,
            }),
        }
      );

    if (
      response.ok
    ) {
      serverDiagnostics = {
        available:
          true,

        ...(
          await response.json()
        ),
      };

    } else {
      serverDiagnostics = {
        available:
          false,

        status:
          response.status,

        diagnostics:
          [],
      };
    }

  } catch (error) {
    serverDiagnostics = {
      available:
        false,

      error:
        String(
          error
        ),

      diagnostics:
        [],
    };
  }

  let alphaCredit:
    any = {
      available:
        false,
    };

  try {
    const alphaCreditResponse =
      await fetch(
        `${SERVER_URL}/alpha-credit/feedback`,
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

    if (
      alphaCreditResponse.ok
    ) {
      alphaCredit =
        await alphaCreditResponse
          .json();

    } else {
      alphaCredit = {
        available:
          false,

        status:
          alphaCreditResponse.status,
      };
    }

  } catch (error) {
    alphaCredit = {
      available:
        false,

      error:
        String(
          error
        ),
    };
  }

  const alphaCreditDevice =
    await getLocalAlphaCreditSnapshot();

  const feedback = {
    format:
      'moment-feedback-v2',

    generated_at:
      new Date()
        .toISOString(),

    tester: {
      moment_device_id:
        momentDeviceId,
    },

    device: {
      platform:
        Platform.OS,

      brand:
        Device.brand,

      manufacturer:
        Device.manufacturer,

      model_name:
        Device.modelName,

      model_id:
        Device.modelId,

      os_name:
        Device.osName,

      os_version:
        Device.osVersion,
    },

    app: {
      name:
        APP_NAME,

      version:
        APP_VERSION,
    },

    client: {
      interaction_count:
        interactions.length,

      diagnostic_ids:
        diagnosticIds,

      interactions,
    },

    pending_memories:
      pendingMemories,

    server:
      serverDiagnostics,

    alpha_credit:
      alphaCredit,

    alpha_credit_device:
      alphaCreditDevice,

    analysis_notes: {
      purpose:
        'Diagnostic automatique de session alpha Moment',

      local_first:
        true,

      contains_user_test_content:
        true,

      requires_manual_send_confirmation:
        true,
    },
  };

  const file =
    new File(
      Paths.cache,
      buildFileName(
        momentDeviceId
      )
    );

  if (
    file.exists
  ) {
    file.delete();
  }

  file.create();

  file.write(
    JSON.stringify(
      feedback,
      null,
      2
    )
  );

  const sharingAvailable =
    await Sharing
      .isAvailableAsync();

  if (
    !sharingAvailable
  ) {
    throw new Error(
      'Le partage de fichiers n’est pas disponible sur cet appareil.'
    );
  }

  await Sharing
    .shareAsync(
      file.uri,
      {
        mimeType:
          'application/json',

        UTI:
          'public.json',

        dialogTitle:
          'Envoyer le feedback Moment',
      }
    );

  return {
    file_uri:
      file.uri,

    interaction_count:
      interactions.length,

    diagnostic_ids:
      diagnosticIds,

    moment_device_id:
      momentDeviceId,

    server_diagnostic_count:
      Array.isArray(
        serverDiagnostics
          ?.diagnostics
      )
        ? serverDiagnostics
            .diagnostics
            .length
        : 0,
  };
}
