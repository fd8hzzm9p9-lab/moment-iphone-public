$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$ProjectRoot = $PSScriptRoot
$ServerFile = Join-Path $ProjectRoot "config\server.ts"
$ServerHost = "127.0.0.1"
$ServerPort = 3000
$OriginUrl = "http://${ServerHost}:${ServerPort}"
$ReadyFile = Join-Path $env:TEMP "moment-original-cloudflare-ready.json"

function Write-Tagged {
    param(
        [string]$Tag,
        [string]$Message,
        [ConsoleColor]$Color
    )

    Write-Host $Tag -NoNewline -ForegroundColor $Color
    Write-Host " $Message" -ForegroundColor White
}

function Log-OK {
    param([string]$Message)
    Write-Tagged "[OK]" $Message Green
}

function Log-KO {
    param([string]$Message)
    Write-Tagged "[KO]" $Message Red
}

function Log-INFO {
    param([string]$Message)
    Write-Host "[INFO] " -NoNewline -ForegroundColor Gray
    Write-Host $Message -ForegroundColor White
}

function Test-TcpPort {
    param(
        [string]$HostName,
        [int]$Port,
        [int]$TimeoutMs = 1000
    )

    $client = New-Object System.Net.Sockets.TcpClient

    try {
        $async = $client.BeginConnect(
            $HostName,
            $Port,
            $null,
            $null
        )

        if (
            -not $async.AsyncWaitHandle.WaitOne(
                $TimeoutMs
            )
        ) {
            return $false
        }

        $client.EndConnect(
            $async
        )

        return $true
    }
    catch {
        return $false
    }
    finally {
        $client.Close()
    }
}

function Wait-Server {
    $deadline = (Get-Date).AddSeconds(60)

    while (
        (Get-Date) -lt $deadline
    ) {
        if (
            Test-TcpPort `
                -HostName $ServerHost `
                -Port $ServerPort `
                -TimeoutMs 1000
        ) {
            return $true
        }

        Start-Sleep -Milliseconds 500
    }

    return $false
}

function Get-ConfiguredServerUrl {
    $bytes = [IO.File]::ReadAllBytes(
        $ServerFile
    )

    $latin1 = [Text.Encoding]::GetEncoding(
        28591
    )

    $text = $latin1.GetString(
        $bytes
    )

    $match = [regex]::Match(
        $text,
        'https://[a-zA-Z0-9-]+\.trycloudflare\.com'
    )

    if (
        $match.Success
    ) {
        return $match.Value
    }

    return $null
}

function Resolve-PublicTunnelIp {
    param(
        [string]$HostName
    )

    foreach (
        $dnsServer in @(
            "1.1.1.1",
            "8.8.8.8"
        )
    ) {
        try {
            $answers = @(
                Resolve-DnsName `
                    $HostName `
                    -Server $dnsServer `
                    -Type A `
                    -ErrorAction Stop |
                    Where-Object {
                        $_.IPAddress
                    }
            )

            if (
                $answers.Count -gt 0
            ) {
                return [string]$answers[0].IPAddress
            }
        }
        catch {
        }
    }

    return $null
}

function Test-TunnelDirect {
    param(
        [string]$BaseUrl,
        [string]$IpAddress
    )

    if (
        -not $BaseUrl -or
        -not $IpAddress
    ) {
        return $false
    }

    $hostName = (
        [Uri]$BaseUrl
    ).Host

    $testUrl = $BaseUrl + "/__moment_launcher_test__"

    $status = & curl.exe `
        --resolve "$($hostName):443:$IpAddress" `
        --connect-timeout 5 `
        --max-time 10 `
        --silent `
        --output NUL `
        --write-out "%{http_code}" `
        $testUrl 2>$null

    if (
        $LASTEXITCODE -ne 0
    ) {
        return $false
    }

    $status = ([string]$status).Trim()

    return (
        $status -match
        '^[1-5][0-9][0-9]$'
    )
}

function Replace-ServerUrlBinary {
    param(
        [string]$NewUrl
    )

    $bytes = [IO.File]::ReadAllBytes(
        $ServerFile
    )

    $latin1 = [Text.Encoding]::GetEncoding(
        28591
    )

    $text = $latin1.GetString(
        $bytes
    )

    $matches = [regex]::Matches(
        $text,
        'https://[a-zA-Z0-9-]+\.trycloudflare\.com'
    )

    if (
        $matches.Count -ne 1
    ) {
        throw "SERVER_URL Cloudflare trouvee $($matches.Count) fois dans config/server.ts."
    }

    $match = $matches[0]
    $newBytes = [Text.Encoding]::ASCII.GetBytes(
        $NewUrl
    )

    $output = New-Object IO.MemoryStream

    try {
        $output.Write(
            $bytes,
            0,
            $match.Index
        )

        $output.Write(
            $newBytes,
            0,
            $newBytes.Length
        )

        $after = $match.Index + $match.Length

        $output.Write(
            $bytes,
            $after,
            $bytes.Length - $after
        )

        [IO.File]::WriteAllBytes(
            $ServerFile,
            $output.ToArray()
        )
    }
    finally {
        $output.Dispose()
    }
}

function Stop-StaleMomentTunnels {
    try {
        $processes = Get-CimInstance `
            Win32_Process `
            -Filter "Name='cloudflared.exe'" `
            -ErrorAction SilentlyContinue

        foreach (
            $item in $processes
        ) {
            $commandLine = [string]$item.CommandLine

            if (
                $commandLine -match
                '--url\s+http://(?:localhost|127\.0\.0\.1):3000(?:\s|$)'
            ) {
                Stop-Process `
                    -Id $item.ProcessId `
                    -Force `
                    -ErrorAction SilentlyContinue
            }
        }
    }
    catch {
    }
}

function Write-ReadyMarker {
    param(
        [string]$Url
    )

    $payload = @{
        url = $Url
        created_at = (
            Get-Date
        ).ToUniversalTime().ToString(
            "o"
        )
    } | ConvertTo-Json -Compress

    [IO.File]::WriteAllText(
        $ReadyFile,
        $payload,
        (
            New-Object System.Text.UTF8Encoding(
                $false
            )
        )
    )
}

Write-Host ""
Write-Host "=== CLOUDFLARE TUNNEL MOMENT ===" -ForegroundColor Cyan
Write-Host ""

try {
    Set-Location $ProjectRoot

    if (
        Test-Path -LiteralPath $ReadyFile
    ) {
        Remove-Item `
            -LiteralPath $ReadyFile `
            -Force `
            -ErrorAction SilentlyContinue
    }

    if (
        -not (
            Test-Path -LiteralPath $ServerFile
        )
    ) {
        throw "config/server.ts introuvable."
    }

    Log-INFO "Attente du serveur Moment sur le port 3000..."

    if (
        -not (
            Wait-Server
        )
    ) {
        throw "Le serveur Moment n'ecoute pas sur 127.0.0.1:3000 apres 60 secondes."
    }

    Log-OK "Serveur Moment joignable sur 127.0.0.1:3000"

    Stop-StaleMomentTunnels

    Log-INFO "Creation d'un nouveau tunnel Moment"

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "cloudflared.exe"
    $psi.Arguments = "tunnel --url $OriginUrl"
    $psi.WorkingDirectory = $ProjectRoot
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $false
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true

    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $psi

    $process.Start() | Out-Null

    $url = $null
    $deadline = (Get-Date).AddSeconds(60)

    while (
        -not $url -and
        -not $process.HasExited -and
        (Get-Date) -lt $deadline
    ) {
        $line = $process.StandardError.ReadLine()

        if (
            $line
        ) {
            Write-Host $line

            if (
                $line -match
                'https://[a-zA-Z0-9-]+\.trycloudflare\.com'
            ) {
                $url = $matches[0]
            }
        }
    }

    if (
        -not $url
    ) {
        throw "Aucune URL Cloudflare obtenue."
    }

    Log-OK "Nouvelle URL : $url"

    $hostName = ([Uri]$url).Host
    $publicIp = $null
    $ready = $false
    $validationDeadline = (Get-Date).AddSeconds(90)

    Log-INFO "Validation via DNS public Cloudflare/Google..."

    while (
        -not $ready -and
        -not $process.HasExited -and
        (Get-Date) -lt $validationDeadline
    ) {
        $publicIp = Resolve-PublicTunnelIp `
            -HostName $hostName

        if (
            $publicIp
        ) {
            if (
                Test-TunnelDirect `
                    -BaseUrl $url `
                    -IpAddress $publicIp
            ) {
                $ready = $true
                break
            }
        }

        Start-Sleep -Seconds 2
    }

    if (
        -not $ready
    ) {
        throw "Le tunnel Cloudflare n'est pas devenu joignable dans les 90 secondes."
    }

    Log-OK "Tunnel Cloudflare valide de bout en bout"

    $backup = Join-Path `
        $env:TEMP `
        (
            "moment-server-before-tunnel-" +
            (Get-Date -Format "yyyyMMdd-HHmmss") +
            ".ts"
        )

    [IO.File]::WriteAllBytes(
        $backup,
        [IO.File]::ReadAllBytes(
            $ServerFile
        )
    )

    Replace-ServerUrlBinary `
        -NewUrl $url

    $configuredUrl = Get-ConfiguredServerUrl

    if (
        $configuredUrl -ne $url
    ) {
        [IO.File]::WriteAllBytes(
            $ServerFile,
            [IO.File]::ReadAllBytes(
                $backup
            )
        )

        throw "Controle SERVER_URL echoue ; config/server.ts restaure."
    }

    Log-OK "config/server.ts mis a jour sans reencodage"
    Log-OK "URL active : $url"

    Write-ReadyMarker `
        -Url $url

    Log-OK "Signal de demarrage Expo cree"

    Write-Host ""
    Write-Host "CLOUDFLARE MOMENT PRET" -ForegroundColor Green
    Write-Host ""

    while (
        -not $process.HasExited
    ) {
        $line = $process.StandardError.ReadLine()

        if (
            $line
        ) {
            Write-Host $line
        }
    }

    Log-KO "Le tunnel Cloudflare Moment s'est arrete."
}
catch {
    Log-KO $_.Exception.Message

    Write-Host ""
    Write-Host "CLOUDFLARE MOMENT NON DEMARRE" -ForegroundColor Red
}
