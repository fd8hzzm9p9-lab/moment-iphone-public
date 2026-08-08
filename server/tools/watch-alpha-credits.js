const fs = require('fs');
const path = require('path');

const quotaFile =
  path.join(
    __dirname,
    '..',
    'data',
    'alpha-openai-quotas.json'
  );

const namesFile =
  path.join(
    __dirname,
    '..',
    'data',
    'alpha-tester-names.json'
  );

function readJson(
  file,
  fallback
) {
  try {
    if (
      !fs.existsSync(
        file
      )
    ) {
      return fallback;
    }

    return JSON.parse(
      fs.readFileSync(
        file,
        'utf8'
      )
    );

  } catch {
    return fallback;
  }
}

function shortId(
  value
) {
  return String(
    value || ''
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

function getTesterName(
  names,
  deviceId
) {
  return String(
    names
      ?.testers
      ?.[deviceId] ||
    ''
  ).trim();
}

function buildIdLabel(
  deviceId,
  testerName
) {
  const id =
    shortId(
      deviceId
    );

  if (
    !testerName
  ) {
    return id;
  }

  return (
    id +
    '\n' +
    testerName
  );
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
    readJson(
      quotaFile,
      {
        devices: {},
      }
    );

  const names =
    readJson(
      namesFile,
      {
        testers: {},
      }
    );

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
              ? 'A RECH.'
              : 'ACTIF';

        const testerName =
          getTesterName(
            names,
            device
              ?.device_id
          );

        return {
          'ID / Nom':
            buildIdLabel(
              device
                ?.device_id,
              testerName
            ),

          Statut:
            status,

          'Nbre Rech.':
            rechargeCount,

          'Total rech.':
            totalRecharged,

          'Don.':
            granted,

          Used:
            used,

          Rest:
            remaining,

          Appels:
            Number(
              usage
                ?.request_count ||
              0
            ),

          'Tok. ent.':
            Number(
              usage
                ?.input_tokens ||
              0
            ),

          'Tok. sort.':
            Number(
              usage
                ?.output_tokens ||
              0
            ),

          'Tok. total':
            Number(
              usage
                ?.total_tokens ||
              0
            ),

          Under:
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
        a.Rest !==
        b.Rest
      ) {
        return (
          a.Rest -
          b.Rest
        );
      }

      return String(
        a[
          'ID / Nom'
        ]
      ).localeCompare(
        String(
          b[
            'ID / Nom'
          ]
        )
      );
    }
  );

  console.table(
    rows
  );

  const totalRecharges =
    rows.reduce(
      (
        total,
        row
      ) =>
        total +
        row[
          'Nbre Rech.'
        ],
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
          'Total rech.'
        ],
      0
    );

  const totalUsed =
    rows.reduce(
      (
        total,
        row
      ) =>
        total +
        row.Used,
      0
    );

  const totalRemaining =
    rows.reduce(
      (
        total,
        row
      ) =>
        total +
        row.Rest,
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
          'Tok. total'
        ],
      0
    );

  console.log('');

  console.log(
    `Testeurs : ${rows.length}`
  );

  console.log(
    `Recharges : ${totalRecharges}`
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
