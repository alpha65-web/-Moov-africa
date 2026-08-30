<#
.SYNOPSIS
    Demarre toute la plateforme PIM Moov Africa : base, MinIO, backend et frontend.

.DESCRIPTION
    Une seule commande pour disposer d'un environnement complet et verifie.

    Le script delegue le backend a demarrer-backend.ps1, qui se charge lui-meme du
    fichier .env, de PostgreSQL et de MinIO, puis lance le frontend Next.js. Les deux
    serveurs sont demarres detaches : ils survivent a la fermeture de ce terminal, et
    s'arretent avec .\demarrer-plateforme.ps1 -Arreter.

    Les journaux sont ecrits dans le dossier logs\ a la racine du depot.

.PARAMETER Arreter
    Arrete le backend et le frontend, puis quitte.

.PARAMETER Diagnostic
    Verifie les prerequis du backend sans rien demarrer.

.PARAMETER SansFrontend
    Ne demarre que le backend.

.EXAMPLE
    .\demarrer-plateforme.ps1

.EXAMPLE
    .\demarrer-plateforme.ps1 -Arreter
#>
[CmdletBinding()]
param(
    [switch]$Arreter,
    [switch]$Diagnostic,
    [switch]$SansFrontend
)

$ErrorActionPreference = 'Stop'

$racine = $PSScriptRoot
if (-not $racine) { $racine = Split-Path -Parent $MyInvocation.MyCommand.Definition }

function Etape([string]$message) { Write-Host ""; Write-Host "==> $message" -ForegroundColor Cyan }
function Ok([string]$message)    { Write-Host "    [ok]  $message" -ForegroundColor Green }
function Souci([string]$message) { Write-Host "    [!]   $message" -ForegroundColor Yellow }
function Info([string]$message)  { Write-Host "          $message" -ForegroundColor DarkGray }
function Fatal([string]$message, [string]$remede) {
    Write-Host ""
    Write-Host "ECHEC : $message" -ForegroundColor Red
    if ($remede) {
        Write-Host ""
        Write-Host "Correction :" -ForegroundColor Yellow
        Write-Host $remede
    }
    Write-Host ""
    exit 1
}

# Le PID qui ecoute reellement sur le port, et non celui du lanceur : mvn et npm
# delegent a un processus fils (java, node), et c'est ce fils qu'il faut arreter.
function Get-ProcessusDuPort([int]$port) {
    $connexion = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $connexion) { return $null }
    return Get-Process -Id $connexion.OwningProcess -ErrorAction SilentlyContinue
}

function Attendre-Port([int]$port, [int]$secondes) {
    $ecoule = 0
    while ($ecoule -lt $secondes) {
        if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) { return $true }
        Start-Sleep -Seconds 3
        $ecoule += 3
    }
    return $false
}

function Test-Http([string]$url, [int]$delai = 20) {
    try {
        $reponse = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec $delai
        return [int]$reponse.StatusCode
    } catch {
        if ($_.Exception.Response) { return [int]$_.Exception.Response.StatusCode.value__ }
        return 0
    }
}

$portBackend = 8092
$portFrontend = 3000
$dossierLogs = Join-Path $racine 'logs'

Write-Host ""
Write-Host "  Plateforme PIM Moov Africa" -ForegroundColor White
Write-Host "  $racine" -ForegroundColor DarkGray

# ---------------------------------------------------------------------------
if ($Arreter) {
# ---------------------------------------------------------------------------
    Etape "Arret des services"
    $arretes = 0
    foreach ($paire in @(@{ Nom = 'backend'; Port = $portBackend }, @{ Nom = 'frontend'; Port = $portFrontend })) {
        $processus = Get-ProcessusDuPort $paire.Port
        if ($processus) {
            Stop-Process -Id $processus.Id -Force
            Ok "$($paire.Nom) arrete (PID $($processus.Id) / $($processus.ProcessName))"
            $arretes++
        } else {
            Info "$($paire.Nom) : deja arrete"
        }
    }
    if ($arretes -eq 0) { Info "Rien a arreter." }
    Info "MinIO et PostgreSQL restent en place : docker compose down pour les arreter aussi."
    Write-Host ""
    exit 0
}

# ---------------------------------------------------------------------------
if ($Diagnostic) {
# ---------------------------------------------------------------------------
    & (Join-Path $racine 'demarrer-backend.ps1') -Diagnostic
    exit $LASTEXITCODE
}

# ---------------------------------------------------------------------------
Etape "1/4  Preparation"
# ---------------------------------------------------------------------------
$scriptBackend = Join-Path $racine 'demarrer-backend.ps1'
if (-not (Test-Path $scriptBackend)) {
    Fatal "demarrer-backend.ps1 est introuvable sous $racine." "Lancez le script depuis la racine du depot."
}
if (-not (Test-Path $dossierLogs)) { New-Item -ItemType Directory -Force $dossierLogs | Out-Null }
Ok "Journaux : $dossierLogs"

if (-not $SansFrontend) {
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Fatal "npm est introuvable dans le PATH." "Installez Node.js 20+ puis rouvrez le terminal."
    }
    if (-not (Test-Path (Join-Path $racine 'frontend\node_modules'))) {
        Souci "Dependances du frontend absentes, installation en cours (plusieurs minutes)..."
        Push-Location (Join-Path $racine 'frontend')
        try { & npm install } finally { Pop-Location }
        if ($LASTEXITCODE -ne 0) { Fatal "npm install a echoue." "Relancez l'installation a la main dans frontend\." }
    }
    Ok "Dependances du frontend en place"
}

# ---------------------------------------------------------------------------
Etape "2/4  Backend"
# ---------------------------------------------------------------------------
$dejaLa = Get-ProcessusDuPort $portBackend
if ($dejaLa) {
    Ok "Deja demarre (PID $($dejaLa.Id) / $($dejaLa.ProcessName))"
} else {
    $journalBackend = Join-Path $dossierLogs 'backend.log'
    $erreursBackend = Join-Path $dossierLogs 'backend.err'
    $journalDemarrage = Join-Path $dossierLogs 'backend-demarrage.log'
    Info "Demarrage detache, journal : $journalBackend"
    # Deux flux distincts, parce qu'ils ne passent pas par le meme canal :
    #   - demarrer-backend.ps1 rend compte par Write-Host, qui ecrit sur l'hote et non
    #     sur la sortie standard ; seul Start-Transcript le capture. Sans lui, un echec
    #     du script (.env absent, base injoignable) laisserait un journal vide.
    #   - Maven et Spring ecrivent sur la sortie standard, redirigee vers backend.log.
    # La redirection de la sortie standard est indispensable meme si l'on garde le
    # transcript : sans elle, les milliers de lignes de Maven remontent dans le terminal
    # qui a lance ce script.
    $commande = "Start-Transcript -Path '$journalDemarrage' -Force | Out-Null; & '$scriptBackend'"
    Start-Process -FilePath 'powershell.exe' `
        -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $commande `
        -WorkingDirectory $racine `
        -RedirectStandardOutput $journalBackend `
        -RedirectStandardError $erreursBackend `
        -WindowStyle Hidden | Out-Null

    Info "Compilation Maven et migrations Flyway, compter une a deux minutes..."
    if (-not (Attendre-Port $portBackend 300)) {
        # La cause d'un echec du script se trouve dans le transcript, celle d'un echec de
        # Spring dans la sortie de Maven : on montre les deux plutot que de choisir mal.
        $fin = ''
        if (Test-Path $journalDemarrage) { $fin += "--- verifications ---`n" + ((Get-Content $journalDemarrage -Tail 15) -join "`n") + "`n`n" }
        if (Test-Path $journalBackend)   { $fin += "--- maven / spring ---`n" + ((Get-Content $journalBackend -Tail 20) -join "`n") }
        Fatal "Le backend n'ecoute toujours pas sur le port $portBackend apres 5 minutes." "$fin`n`nDiagnostic complet : .\demarrer-backend.ps1 -Diagnostic"
    }
    $processusBackend = Get-ProcessusDuPort $portBackend
    Ok "Demarre (PID $($processusBackend.Id) / $($processusBackend.ProcessName))"
}

# L'API doit repondre, pas seulement le port etre ouvert : un corps vide sur la route de
# connexion doit donner 400, ce qui prouve que Spring sert reellement les controleurs.
$codeApi = Test-Http "http://localhost:$portBackend/api/v1/offers" 20
if ($codeApi -eq 401 -or $codeApi -eq 403 -or $codeApi -eq 200) {
    Ok "API   : http://localhost:$portBackend/api/v1 (HTTP $codeApi)"
} else {
    Souci "L'API a repondu HTTP $codeApi sur /api/v1/offers, verifiez $dossierLogs\backend.log"
}

# ---------------------------------------------------------------------------
if (-not $SansFrontend) {
Etape "3/4  Frontend"
# ---------------------------------------------------------------------------
    $dejaLa = Get-ProcessusDuPort $portFrontend
    if ($dejaLa) {
        Ok "Deja demarre (PID $($dejaLa.Id) / $($dejaLa.ProcessName))"
    } else {
        $journalFrontend = Join-Path $dossierLogs 'frontend.log'
        $erreursFrontend = Join-Path $dossierLogs 'frontend.err'
        Info "Demarrage detache, journal : $journalFrontend"
        Start-Process -FilePath 'cmd.exe' `
            -ArgumentList '/c', 'npm run dev' `
            -WorkingDirectory (Join-Path $racine 'frontend') `
            -RedirectStandardOutput $journalFrontend `
            -RedirectStandardError $erreursFrontend `
            -WindowStyle Hidden | Out-Null

        if (-not (Attendre-Port $portFrontend 120)) {
            $fin = ''
            if (Test-Path $journalFrontend) { $fin = (Get-Content $journalFrontend -Tail 20) -join "`n" }
            Fatal "Le frontend n'ecoute toujours pas sur le port $portFrontend apres 2 minutes." "Fin du journal :`n`n$fin"
        }
        $processusFrontend = Get-ProcessusDuPort $portFrontend
        Ok "Demarre (PID $($processusFrontend.Id) / $($processusFrontend.ProcessName))"
    }

    $codeFront = Test-Http "http://localhost:$portFrontend" 60
    if ($codeFront -eq 200) {
        Ok "Interface : http://localhost:$portFrontend (HTTP 200)"
    } else {
        Souci "Le frontend a repondu HTTP $codeFront, verifiez $dossierLogs\frontend.log"
    }
}

# ---------------------------------------------------------------------------
Etape "4/4  Recapitulatif"
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "  Interface  http://localhost:$portFrontend" -ForegroundColor White
Write-Host "  API        http://localhost:$portBackend/api/v1" -ForegroundColor White
Write-Host "  Journaux   $dossierLogs" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Les serveurs tournent detaches : fermer ce terminal ne les arrete pas." -ForegroundColor DarkGray
Write-Host "  Pour les arreter :  .\demarrer-plateforme.ps1 -Arreter" -ForegroundColor DarkGray
Write-Host ""
