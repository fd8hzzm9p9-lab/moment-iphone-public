$ErrorActionPreference = "Stop"

$Root = $PSScriptRoot

if (-not $Root) {
    $Root = (Get-Location).Path
}

$File = Join-Path $Root "server\server.js"

if (-not (Test-Path $File)) {
    Write-Host "ERREUR : server\server.js introuvable."
    exit 1
}

$Original = Get-Content $File -Raw

# ============================================================
# CONTROLES AVANT MODIFICATION
# ============================================================

if ($Original.Contains("MOMENT_READABLE_TESTER_LOG_V1")) {
    Write-Host "INFO : correctif deja installe."
    exit 0
}

if (-not $Original.Contains("const resultLabel =")) {
    Write-Host "ERREUR : ancre resultLabel introuvable."
    Write-Host "Aucune modification effectuee."
    exit 1
}

if (-not $Original.Contains('${commandLabel}')) {
    Write-Host "ERREUR : commandLabel introuvable."
    Write-Host "Aucune modification effectuee."
    exit 1
}

Write-Host "OK : pre-controles reussis."

# ============================================================
# BLOC JS A AJOUTER
# ============================================================

$ReadableBlock = @'

        /*
         * MOMENT_READABLE_TESTER_LOG_V1
         * Resume lisible des elements compris/enregistres.
         */

        const readableEvents =
          Array.isArray(
            payload?.events
          )
            ? payload.events
            : [];

        const greenField =
          field =>
            `\x1b[32m{${field}}\x1b[0m`;

        const readableValue =
          value => {
            if (
              value === null ||
              value === undefined ||
              value === ''
            ) {
              return '-';
            }

            if (
              Array.isArray(
                value
              )
            ) {
              return value.length
                ? value.join(', ')
                : '-';
            }

            return String(value);
          };

        const readableCalendarDate =
          value => {
            const clean =
              String(
                value || ''
              ).trim();

            const match =
              clean.match(
                /^(\d{4})-(\d{2})-(\d{2})$/
              );

            if (!match) {
              return clean || '-';
            }

            return (
              `${match[3]}/` +
              `${match[2]}/` +
              `${match[1]}`
            );
          };

        const readableTemporalDirection =
          value => {
            if (value === 'past') {
              return 'Passe';
            }

            if (value === 'future') {
              return 'Futur';
            }

            if (value === 'present') {
              return 'Present';
            }

            return readableValue(value);
          };

        const readableLocalOnly =
          req.body?.local_only === true;

        const readableOpenAiUsed =
          creditsBefore !== null &&
          creditsAfter !== null &&
          creditsAfter < creditsBefore;

        const readableErrorCode =
          String(
            payload?.code || ''
          );

        const readableOpenAiFailed =
          !successful &&
          (
            readableErrorCode.startsWith(
              'OPENAI_'
            ) ||
            String(
              payload?.error || ''
            )
              .toLowerCase()
              .includes('openai')
          );

        const readableOpenAiLabel =
          readableOpenAiUsed
            ? 'OUI'
            : readableOpenAiFailed
              ? 'OUI - ECHEC'
              : 'NON';

        const readableModeLabel =
          readableLocalOnly
            ? 'LOCAL UNIQUEMENT'
            : 'LOCAL FIRST';

        if (
          feature === 'understand' &&
          successful &&
          readableEvents.length > 0
        ) {
          console.log('');
          console.log(
            '\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550'
          );

          console.log(
            `\u2551 \u{1F4BE} ELEMENTS COMPRIS / ENREGISTRES : ${readableEvents.length}`
          );

          console.log(
            '\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550'
          );

          readableEvents.forEach(
            (
              event,
              index
            ) => {
              console.log(
                '\u2551'
              );

              console.log(
                `\u2551 #${index + 1} ELEMENT`
              );

              console.log(
                `\u2551 \u{1F4DD} Source       : "${readableValue(event?.source_text)}"  ${greenField('source_text')}`
              );

              console.log(
                `\u2551 \u{1F9E0} Compris      : ${readableValue(event?.description)}  ${greenField('description')}`
              );

              console.log(
                `\u2551 \u{1F4C5} Date         : ${readableValue(event?.date_reference)}  ${greenField('date_reference')}`
              );

              console.log(
                `\u2551 \u{1F4C6} Date reelle  : ${readableCalendarDate(event?.calendar_date)}  ${greenField('calendar_date')}`
              );

              console.log(
                `\u2551 \u{1F570}\uFE0F Temporalite  : ${readableTemporalDirection(event?.temporal_direction)}  ${greenField('temporal_direction')}`
              );

              if (
                Array.isArray(event?.people) &&
                event.people.length > 0
              ) {
                console.log(
                  `\u2551 \u{1F464} Personne(s)  : ${readableValue(event.people)}  ${greenField('people')}`
                );
              }

              if (
                Array.isArray(event?.places) &&
                event.places.length > 0
              ) {
                console.log(
                  `\u2551 \u{1F4CD} Lieu(x)      : ${readableValue(event.places)}  ${greenField('places')}`
                );
              }

              if (
                Array.isArray(event?.actions) &&
                event.actions.length > 0
              ) {
                console.log(
                  `\u2551 \u{1F528} Action(s)    : ${readableValue(event.actions)}  ${greenField('actions')}`
                );
              }

              if (
                event?.confidence !== undefined
              ) {
                console.log(
                  `\u2551 \u{1F3AF} Confiance    : ${readableValue(event.confidence)}  ${greenField('confidence')}`
                );
              }
            }
          );

          console.log(
            '\u2551'
          );
        }

        console.log(
          '\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550'
        );

        console.log(
          '\u2551 \u{1F527} TRAITEMENT'
        );

        console.log(
          '\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550'
        );

        console.log(
          `\u2551 \u{1F9E9} Mode         : ${readableModeLabel}`
        );

        console.log(
          `\u2551 \u{1F916} OpenAI       : ${readableOpenAiLabel}`
        );

'@

# ============================================================
# INSERTION
# ============================================================

$Pattern = "(?s)(        const resultLabel =.*?            : 'ERREUR';)"

$Match = [regex]::Match(
    $Original,
    $Pattern
)

if (-not $Match.Success) {
    Write-Host "ERREUR : bloc resultLabel introuvable."
    Write-Host "Aucune modification effectuee."
    exit 1
}

$Modified = $Original.Insert(
    $Match.Index + $Match.Length,
    $ReadableBlock
)

# Commande -> Fonction
$Modified = $Modified.Replace(
    'Commande     : ${commandLabel}',
    'Fonction     : ${commandLabel}'
)

# ============================================================
# CONTROLES AVANT ECRITURE
# ============================================================

if (-not $Modified.Contains("MOMENT_READABLE_TESTER_LOG_V1")) {
    Write-Host "ERREUR : insertion non detectee."
    exit 1
}

if (-not $Modified.Contains("greenField('date_reference')")) {
    Write-Host "ERREUR : date_reference absent."
    exit 1
}

if (-not $Modified.Contains("greenField('calendar_date')")) {
    Write-Host "ERREUR : calendar_date absent."
    exit 1
}

Write-Host "OK : nouveau contenu construit."

# ============================================================
# BACKUP
# ============================================================

$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"

$BackupDir = Join-Path `
    $Root `
    ".moment-patch-backups\logs-testeurs-$Stamp"

New-Item `
    -ItemType Directory `
    -Path $BackupDir `
    -Force |
    Out-Null

$BackupFile = Join-Path `
    $BackupDir `
    "server.js"

Copy-Item `
    $File `
    $BackupFile `
    -Force

Write-Host "OK : sauvegarde creee :"
Write-Host $BackupFile

# ============================================================
# ECRITURE + TEST + RESTAURATION AUTO
# ============================================================

try {

    [System.IO.File]::WriteAllText(
        $File,
        $Modified,
        [System.Text.UTF8Encoding]::new($false)
    )

    & node --check $File

    if ($LASTEXITCODE -ne 0) {
        throw "node --check a echoue."
    }

    $Verification = Get-Content $File -Raw

    if (-not $Verification.Contains("MOMENT_READABLE_TESTER_LOG_V1")) {
        throw "Controle final echoue."
    }

    Write-Host ""
    Write-Host "========================================"
    Write-Host "PATCH TERMINE"
    Write-Host "========================================"
    Write-Host "Fonction : SOUVIENS-TOI / RAPPELLE-MOI"
    Write-Host "Elements compris affiches lisiblement"
    Write-Host "Noms des champs techniques en vert"
    Write-Host "Mode LOCAL FIRST / LOCAL UNIQUEMENT"
    Write-Host "OpenAI OUI / NON / ECHEC"
    Write-Host "Aucune logique metier modifiee"
    Write-Host ""

}
catch {

    Copy-Item `
        $BackupFile `
        $File `
        -Force

    Write-Host ""
    Write-Host "ECHEC DU PATCH"
    Write-Host $_.Exception.Message
    Write-Host "server.js restaure automatiquement."

    exit 1
}