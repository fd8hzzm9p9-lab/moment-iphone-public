const fs = require('fs');
const path = require('path');

const quotaFile =
  path.join(
    __dirname,
    '..',
    'data',
    'alpha-openai-quotas.json'
  );

function readData() {
  if (
    !fs.existsSync(
      quotaFile
    )
  ) {
    return {
      devices: {},
    };
  }

  try {
    return JSON.parse(
      fs.readFileSync(
        quotaFile,
        'utf8'
      )
    );

  } catch {
    return {
      devices: {},
    };
  }
}

function shortId(
  id
) {
  return String(
    id || ''
  )
    .replace(
      /^moment_/,
      ''
    )
    .slice(
      0,
      8
    );
}

function formatDate(
  value
) {
  if (!value) {
    return '-';
  }

  try {
    return new Date(
      value
    ).toLocaleString(
      'fr-FR',
      {
        timeZone:
          'Europe/Paris',

        day:
          '2-digit',

        month:
          '2-digit',

        hour:
          '2-digit',

        minute:
          '2-digit',

        second:
          '2-digit',
      }
    );

  } catch {
    return '-';
  }
}

function render() {
  console.clear();

  console.log(
    '🧠 MOMENT — CRÉDITS TESTEURS'
  );

  console.log(
    'Actualisation automatique toutes les 2 secondes'
  );

  console.log('');

  const data =
    readData();

  const devices =
    Object.values(
      data.devices ||
      {}
    );

  if (
    devices.length ===
    0
  ) {
    console.log(
      'Aucun testeur enregistré.'
    );

    return;
  }

  const rows =
    devices.map(
      device => {
        const granted =
          Number(
            device
              ?.credits_granted ||
            0
          );

        const used =
          Number(
            device
              ?.credits_used ||
            0
          );

        const remaining =
          Math.max(
            0,
            granted -
            used
          );

        const history =
          Array.isArray(
            device
              ?.credit_history
          )
            ? device
                .credit_history
            : [];

        const rechargeCount =
          history.length;

        const totalRecharged =
          history.reduce(
            (
              total,
              item
            ) =>
              total +
              Number(
                item
                  ?.credits_added ||
                0
              ),
            0
          );

        const usage =
          device?.usage ||
          {};

        const pending =
          device
            ?.pending_credit_request;

        const status =
          rechargeCount === 0
            ? 'NOUVEAU'
            : remaining <= 0
              ? 'À RECHARGER'
              : 'ACTIF';

        return {
          Testeur:
            shortId(
              device
                ?.device_id
            ),

          Statut:
            status,

          Recharges:
            rechargeCount,

          'Total rechargé':
            totalRecharged,

          Accordés:
            granted,

          Utilisés:
            used,

          Restants:
            remaining,

          Appels:
            Number(
              usage
                ?.request_count ||
              0
            ),

          'Tokens entrée':
            Number(
              usage
                ?.input_tokens ||
              0
            ),

          'Tokens sortie':
            Number(
              usage
                ?.output_tokens ||
              0
            ),

          'Tokens total':
            Number(
              usage
                ?.total_tokens ||
              0
            ),

          Understand:
            Number(
              usage
                ?.understand_requests ||
              0
            ),

          Recall:
            Number(
              usage
                ?.recall_requests ||
              0
            ),

          Demande:
            pending &&
            pending.status ===
              'pending'
              ? pending
                  .request_code
              : '-',

          'Dernière MAJ':
            formatDate(
              device
                ?.updated_at
            ),
        };
      }
    );

  rows.sort(
    (
      a,
      b
    ) => {
      if (
        a.Restants !==
        b.Restants
      ) {
        return (
          a.Restants -
          b.Restants
        );
      }

      return (
        a.Testeur
          .localeCompare(
            b.Testeur
          )
      );
    }
  );

  console.table(
    rows
  );

  const totalRemaining =
    rows.reduce(
      (
        total,
        row
      ) =>
        total +
        row.Restants,
      0
    );

  const totalUsed =
    rows.reduce(
      (
        total,
        row
      ) =>
        total +
        row.Utilisés,
      0
    );

  const totalRecharges =
    rows.reduce(
      (
        total,
        row
      ) =>
        total +
        row.Recharges,
      0
    );

  const totalRecharged =
    rows.reduce(
      (
        total,
        row
      ) =>
        total +
        row[
          'Total rechargé'
        ],
      0
    );

  const totalTokens =
    rows.reduce(
      (
        total,
        row
      ) =>
        total +
        row[
          'Tokens total'
        ],
      0
    );

  console.log('');

  console.log(
    `Testeurs : ${rows.length}`
  );

  console.log(
    `Recharges effectuées : ${totalRecharges}`
  );

  console.log(
    `Crédits rechargés : ${totalRecharged}`
  );

  console.log(
    `Crédits consommés : ${totalUsed}`
  );

  console.log(
    `Crédits disponibles : ${totalRemaining}`
  );

  console.log(
    `Tokens OpenAI cumulés : ${totalTokens}`
  );

  console.log('');

  console.log(
    'Ctrl+C pour fermer.'
  );
}

render();

setInterval(
  render,
  2000
);
