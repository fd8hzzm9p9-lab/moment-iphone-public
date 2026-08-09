$ErrorActionPreference = "Stop"

$SourceRoot = "C:\Users\jerry\moment-iphone"
$DevRoot = "C:\Users\jerry\moment-dev"

$Files = @(
    "app\_layout.tsx",
    "app\(tabs)\index.tsx",
    "services\diagnosticService.ts",
    "server\server.js",
    "server\routes\understand.js",
    "server\utils\openai-alpha-quota.js",
    "server\tools\watch-alpha-credits.js"
)

Write-Host ""
Write-Host "========================================"
Write-Host "MOMENT - SYNCHRONISATION TESTEURS -> DEV"
Write-Host "========================================"
Write-Host ""

if (-not (Test-Path $SourceRoot)) {
    Write-Host "ERREUR : dossier TESTEURS introuvable."
    exit 1
}

if (-not (Test-Path $DevRoot)) {
    Write-Host "ERREUR : dossier MOMENT DEV introuvable."
    exit 1
}

Write-Host "TESTEURS : $SourceRoot"
Write-Host "DEV      : $DevRoot"
Write-Host ""

# ============================================================
# PRE-CONTROLES
# ============================================================

foreach ($Relative in $Files) {

    $Source = Join-Path $SourceRoot $Relative
    $Target = Join-Path $DevRoot $Relative

    if (-not (Test-Path $Source)) {
        Write-Host "ERREUR SOURCE : $Relative"
        Write-Host "Aucune modification effectuee."
        exit 1
    }

    if (-not (Test-Path $Target)) {
        Write-Host "ERREUR DEV : $Relative"
        Write-Host "Aucune modification effectuee."
        exit 1
    }
}

Write-Host "OK : tous les fichiers source et DEV existent."

# ============================================================
# PROTECTIONS DEV
# ============================================================

$ProtectedFiles = @(
    "config\server.ts",
    "config\app.ts",
    "server\.env",
    "server\data\alpha-openai-quotas.json",
    "server\data\alpha-tester-names.json",
    "demarrer-tunnel.ps1"
)

Write-Host ""
Write-Host "Fichiers DEV proteges et NON copies :"

foreach ($Protected in $ProtectedFiles) {
    Write-Host " - $Protected"
}

# ============================================================
# BACKUP COMPLET DES FICHIERS DEV CONCERNES
# ============================================================

$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"

$BackupRoot = Join-Path `
    $DevRoot `
    ".moment-patch-backups\sync-from-testers-$Stamp"

New-Item `
    -ItemType Directory `
    -Path $BackupRoot `
    -Force |
    Out-Null

foreach ($Relative in $Files) {

    $Target = Join-Path $DevRoot $Relative
    $Backup = Join-Path $BackupRoot $Relative

    $BackupDirectory =
        Split-Path $Backup -Parent

    New-Item `
        -ItemType Directory `
        -Path $BackupDirectory `
        -Force |
        Out-Null

    Copy-Item `
        -Path $Target `
        -Destination $Backup `
        -Force
}

Write-Host ""
Write-Host "OK : sauvegarde DEV creee :"
Write-Host $BackupRoot

# ============================================================
# COPIE
# ============================================================

$Modified = @()

try {

    foreach ($Relative in $Files) {

        $Source = Join-Path $SourceRoot $Relative
        $Target = Join-Path $DevRoot $Relative

        Copy-Item `
            -Path $Source `
            -Destination $Target `
            -Force

        $Modified += $Relative

        Write-Host "COPIE : $Relative"
    }

    # ========================================================
    # CONTROLE DES HASH
    # ========================================================

    Write-Host ""
    Write-Host "Verification des fichiers copies..."

    foreach ($Relative in $Files) {

        $Source = Join-Path $SourceRoot $Relative
        $Target = Join-Path $DevRoot $Relative

        $SourceHash =
            (Get-FileHash $Source -Algorithm SHA256).Hash

        $TargetHash =
            (Get-FileHash $Target -Algorithm SHA256).Hash

        if ($SourceHash -ne $TargetHash) {
            throw "Hash different apres copie : $Relative"
        }
    }

    Write-Host "OK : fichiers identiques."

    # ========================================================
    # CONTROLE SYNTAXE SERVEUR
    # ========================================================

    Write-Host ""
    Write-Host "Verification syntaxe serveur DEV..."

    & node --check `
        (Join-Path $DevRoot "server\server.js")

    if ($LASTEXITCODE -ne 0) {
        throw "Erreur syntaxe server.js"
    }

    & node --check `
        (Join-Path $DevRoot "server\routes\understand.js")

    if ($LASTEXITCODE -ne 0) {
        throw "Erreur syntaxe understand.js"
    }

    & node --check `
        (Join-Path $DevRoot "server\utils\openai-alpha-quota.js")

    if ($LASTEXITCODE -ne 0) {
        throw "Erreur syntaxe openai-alpha-quota.js"
    }

    & node --check `
        (Join-Path $DevRoot "server\tools\watch-alpha-credits.js")

    if ($LASTEXITCODE -ne 0) {
        throw "Erreur syntaxe watch-alpha-credits.js"
    }

    # ========================================================
    # VERIFICATION DES PROTECTIONS DEV
    # ========================================================

    $DevServerConfig =
        Join-Path $DevRoot "config\server.ts"

    if (-not (Test-Path $DevServerConfig)) {
        throw "config/server.ts DEV a disparu."
    }

    Write-Host ""
    Write-Host "========================================"
    Write-Host "SYNCHRONISATION DEV TERMINEE"
    Write-Host "========================================"
    Write-Host ""
    Write-Host "OK : code courant copie vers DEV"
    Write-Host "OK : syntaxe serveur controlee"
    Write-Host "OK : configuration DEV preservee"
    Write-Host "OK : donnees de credits DEV preservees"
    Write-Host "OK : tunnel DEV preserve"
    Write-Host ""
    Write-Host "Sauvegarde :"
    Write-Host $BackupRoot
    Write-Host ""

}
catch {

    Write-Host ""
    Write-Host "ERREUR PENDANT LA SYNCHRONISATION"
    Write-Host $_.Exception.Message
    Write-Host ""
    Write-Host "RESTAURATION DEV..."

    foreach ($Relative in $Modified) {

        $Target =
            Join-Path $DevRoot $Relative

        $Backup =
            Join-Path $BackupRoot $Relative

        if (Test-Path $Backup) {

            Copy-Item `
                -Path $Backup `
                -Destination $Target `
                -Force
        }
    }

    Write-Host "DEV restaure automatiquement."
    exit 1
}