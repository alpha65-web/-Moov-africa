<#
.SYNOPSIS
    Démarre le backend Spring Boot du PIM Moov Africa sur un poste de développement.

.DESCRIPTION
    Le backend refuse volontairement de démarrer sans ses identifiants : application.yml
    déclare JWT_SECRET, SPRING_DATASOURCE_USERNAME, SPRING_DATASOURCE_PASSWORD,
    MINIO_ACCESS_KEY et MINIO_SECRET_KEY sans aucune valeur par défaut. Ces valeurs vivent
    dans le fichier .env à la racine, mais .env n'est lu que par Docker Compose : un
    « mvn spring-boot:run » lancé à la main ne le voit pas et échoue immédiatement sur
    « Could not resolve placeholder 'JWT_SECRET' ».

    Ce script fait le pont : il lit .env, complète les variables dérivées, vérifie que la
    base de données répond et que le port 8092 est libre, puis lance Maven.

.PARAMETER Diagnostic
    Exécute toutes les vérifications et affiche le rapport sans démarrer le backend.

.PARAMETER Detache
    Démarre le backend dans un processus indépendant du terminal appelant, et rend
    la main dès qu'il répond.

    Sans ce commutateur, Maven occupe le terminal et le backend meurt avec lui :
    fermer la fenêtre, ou perdre le processus parent, coupe la plateforme en pleine
    séance. Le mode détaché y survit ; la sortie part alors dans
    logs\backend-detache.log au lieu de l'écran.

    Pour arrêter un backend détaché :

        Get-NetTCPConnection -LocalPort 8092 -State Listen |
            ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }

.EXAMPLE
    .\demarrer-backend.ps1

.EXAMPLE
    .\demarrer-backend.ps1 -Diagnostic

.EXAMPLE
    .\demarrer-backend.ps1 -Detache
#>
[CmdletBinding()]
param(
    [switch]$Diagnostic,
    [switch]$Detache
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

# docker.exe ecrit ses diagnostics sur la sortie d'erreur. Avec ErrorActionPreference
# a Stop, PowerShell 5.1 transforme la moindre ligne en exception terminante : le script
# mourait sur "docker info" quand Docker Desktop n'etait pas lance, sans jamais atteindre
# le code qui sait justement le demarrer. On isole donc chaque appel dans sa propre portee.
function Invoke-Docker([string[]]$arguments) {
    $ErrorActionPreference = 'SilentlyContinue'
    $global:LASTEXITCODE = 0
    try {
        & docker @arguments 2>&1 | Out-Null
        return ($LASTEXITCODE -eq 0)
    } catch {
        return $false
    }
}

function Test-DaemonDocker { return (Invoke-Docker @('info')) }

# docker-compose.yml seul ne suffit pas hors Docker : backend-net y est declare
# `internal: true`, si bien que les ports de postgres et de minio ne sont pas
# publies sur l'hote. docker-compose.dev.yml, versionne, les rattache a un
# reseau bridge dedie. docker-compose.override.yml reste ignore par Git et
# n'est plus charge automatiquement des qu'un -f est passe : on le rajoute donc
# nous-memes s'il existe, pour ne pas perdre les reglages propres a un poste.
function Fichiers-Compose([string]$racine) {
    $fichiers = @('-f', 'docker-compose.yml')
    foreach ($nom in 'docker-compose.dev.yml', 'docker-compose.override.yml') {
        if (Test-Path (Join-Path $racine $nom)) { $fichiers += @('-f', $nom) }
    }
    return $fichiers
}

# Secret aleatoire de $octets octets, rendu en hexadecimal : la chaine produite
# fait donc le double de caracteres, tous imprimables et sans guillemet, ce qui
# la rend sure a poser telle quelle dans .env comme dans une variable Docker.
function Nouveau-Secret([int]$octets) {
    $tampon = New-Object byte[] $octets
    $source = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $source.GetBytes($tampon) } finally { $source.Dispose() }
    return (-join ($tampon | ForEach-Object { '{0:x2}' -f $_ }))
}

function Test-PortOuvert([string]$hote, [int]$port, [int]$delaiMs = 2000) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $connexion = $client.BeginConnect($hote, $port, $null, $null)
        if (-not $connexion.AsyncWaitHandle.WaitOne($delaiMs, $false)) { return $false }
        $client.EndConnect($connexion)
        return $true
    } catch {
        return $false
    } finally {
        $client.Close()
    }
}

function Trouver-Psql {
    $commande = Get-Command psql.exe -ErrorAction SilentlyContinue
    if ($commande) { return $commande.Source }
    $candidats = Get-ChildItem 'C:\Program Files\PostgreSQL' -Directory -ErrorAction SilentlyContinue |
        Sort-Object Name -Descending |
        ForEach-Object { Join-Path $_.FullName 'bin\psql.exe' } |
        Where-Object { Test-Path $_ }
    if ($candidats) { return @($candidats)[0] }
    return $null
}

# Renvoie $true / $false selon que pim_db repond sur ce port, ou $null si psql est absent
# et que la question ne peut pas etre tranchee.
function Test-BaseValide([string]$psql, [int]$port, [string]$utilisateur, [string]$motDePasse, [string]$base) {
    if (-not $psql) { return $null }
    $ancien = $env:PGPASSWORD
    $env:PGPASSWORD = $motDePasse
    try {
        & $psql -h localhost -p $port -U $utilisateur -d $base -tAc 'select 1' > $null 2> $null
        return ($LASTEXITCODE -eq 0)
    } catch {
        return $false
    } finally {
        $env:PGPASSWORD = $ancien
    }
}

Write-Host ""
Write-Host "  Backend PIM Moov Africa - demarrage local" -ForegroundColor White
Write-Host "  $racine" -ForegroundColor DarkGray

# ---------------------------------------------------------------------------
Etape "1/6  Outils requis"
# ---------------------------------------------------------------------------
if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
    Fatal "Java est introuvable dans le PATH." "Installez le JDK 21 (Temurin) puis rouvrez le terminal."
}
$ligneJava = (& java --version | Select-Object -First 1)
if ($ligneJava -match '(\d+)') {
    $majeurJava = [int]$Matches[1]
    if ($majeurJava -lt 21) {
        Fatal "Java $majeurJava detecte, le projet exige Java 21." "Installez le JDK 21 et placez-le en tete du PATH."
    }
}
Ok "Java  : $ligneJava"

$mvn = Get-Command mvn -ErrorAction SilentlyContinue
if (-not $mvn) {
    Fatal "Maven est introuvable dans le PATH." "Installez Maven 3.9+ et ajoutez son dossier bin au PATH."
}
Ok "Maven : $($mvn.Source)"

if (-not (Test-Path (Join-Path $racine 'backend\pom.xml'))) {
    Fatal "backend\pom.xml est introuvable sous $racine." "Lancez le script depuis la racine du depot."
}

# ---------------------------------------------------------------------------
Etape "2/6  Chargement du fichier .env"
# ---------------------------------------------------------------------------
$cheminEnv = Join-Path $racine '.env'
if (-not (Test-Path $cheminEnv)) {
    # Premier demarrage sur un depot fraichement clone. Plutot que d'arreter le
    # script en demandant de recopier le modele et d'inventer six secrets, on
    # ecrit le fichier avec des valeurs aleatoires : la plateforme demarre alors
    # d'une seule commande. Les secrets restent modifiables ensuite.
    $modeleEnv = Join-Path $racine '.env.example'
    if (-not (Test-Path $modeleEnv)) {
        Fatal "Ni .env ni .env.example a la racine du depot." "Le depot est incomplet. Reclonez-le."
    }
    Souci ".env absent : premier demarrage, le fichier est cree depuis .env.example."
    $secrets = @{
        'POSTGRES_USER'      = 'pim'
        'POSTGRES_PASSWORD'  = (Nouveau-Secret 16)
        'MINIO_ACCESS_KEY'   = 'pim' + (Nouveau-Secret 6)
        'MINIO_SECRET_KEY'   = (Nouveau-Secret 20)
        'JWT_SECRET'         = (Nouveau-Secret 32)
        'PIM_ENCRYPTION_KEY' = (Nouveau-Secret 16)
    }
    $lignesEnv = foreach ($ligne in (Get-Content $modeleEnv)) {
        if ($ligne -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*$' -and $secrets.ContainsKey($Matches[1])) {
            "$($Matches[1])=$($secrets[$Matches[1]])"
        } else {
            $ligne
        }
    }
    # Sans BOM : Docker Compose lit ce meme fichier et prendrait la marque
    # d'ordre des octets pour le debut du premier nom de variable.
    [System.IO.File]::WriteAllLines($cheminEnv, [string[]]$lignesEnv, (New-Object System.Text.UTF8Encoding($false)))
    Ok ".env cree avec des secrets aleatoires - modifiez-le si vous avez vos propres identifiants."
}

$charges = 0
foreach ($ligne in (Get-Content $cheminEnv)) {
    if ($ligne -match '^\s*(#|$)') { continue }
    if ($ligne -notmatch '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') { continue }
    $nom = $Matches[1]
    $valeur = $Matches[2].Trim()
    if ($valeur.Length -ge 2) {
        $guillemets = ($valeur.StartsWith('"') -and $valeur.EndsWith('"')) -or ($valeur.StartsWith("'") -and $valeur.EndsWith("'"))
        if ($guillemets) { $valeur = $valeur.Substring(1, $valeur.Length - 2) }
    }
    Set-Item -Path "env:$nom" -Value $valeur
    $charges++
}
Ok "$charges variables chargees depuis .env"

# .env porte les noms attendus par Docker Compose (POSTGRES_*) ; Spring attend
# SPRING_DATASOURCE_*. On derive les secondes des premieres pour n'avoir qu'une
# seule source de verite.
if (-not $env:SPRING_DATASOURCE_USERNAME -and $env:POSTGRES_USER)     { $env:SPRING_DATASOURCE_USERNAME = $env:POSTGRES_USER }
if (-not $env:SPRING_DATASOURCE_PASSWORD -and $env:POSTGRES_PASSWORD) { $env:SPRING_DATASOURCE_PASSWORD = $env:POSTGRES_PASSWORD }
if (-not $env:SPRING_PROFILES_ACTIVE) { $env:SPRING_PROFILES_ACTIVE = 'dev' }

$manquantes = @()
foreach ($nom in 'SPRING_DATASOURCE_USERNAME', 'SPRING_DATASOURCE_PASSWORD', 'JWT_SECRET', 'MINIO_ACCESS_KEY', 'MINIO_SECRET_KEY') {
    $valeur = (Get-Item "env:$nom" -ErrorAction SilentlyContinue).Value
    if (-not $valeur) { $manquantes += $nom }
}
if ($manquantes.Count -gt 0) {
    Fatal "Variables absentes de .env : $($manquantes -join ', ')" "Renseignez-les dans .env - le modele commente se trouve dans .env.example."
}
if ($env:JWT_SECRET.Length -lt 32) {
    Fatal "JWT_SECRET fait $($env:JWT_SECRET.Length) caracteres, il en faut au moins 32." "Allongez JWT_SECRET dans .env."
}
Ok "Identifiants complets (utilisateur base : $($env:SPRING_DATASOURCE_USERNAME))"

# ---------------------------------------------------------------------------
Etape "3/6  Base de donnees PostgreSQL"
# ---------------------------------------------------------------------------
$base = 'pim_db'
$hote = 'localhost'
$psql = Trouver-Psql
if ($psql) { Info "psql : $psql" } else { Souci "psql introuvable : la base ne sera pas validee avant le demarrage." }

if ($env:SPRING_DATASOURCE_URL) {
    Info "SPRING_DATASOURCE_URL imposee par .env"
    $portBase = 5432
    if ($env:SPRING_DATASOURCE_URL -match 'jdbc:postgresql://([^:/]+):(\d+)/([^?]+)') {
        $hote = $Matches[1]
        $portBase = [int]$Matches[2]
        $base = $Matches[3]
    }
    if (-not (Test-PortOuvert $hote $portBase)) {
        Fatal "Aucun PostgreSQL n'ecoute sur $hote port $portBase." "Demarrez la base, ou corrigez SPRING_DATASOURCE_URL dans .env."
    }
} else {
    # Deux PostgreSQL coexistent souvent sur ce poste : le natif (5432) et celui de Docker
    # Compose republie sur 5433 par docker-compose.dev.yml. On retient celui qui
    # heberge reellement pim_db, pas simplement le premier port ouvert - se tromper de
    # base donne un backend qui demarre sur un catalogue vide.
    $portBase = $null
    $indecis = $null
    foreach ($candidat in 5432, 5433) {
        if (-not (Test-PortOuvert $hote $candidat 1000)) { continue }
        $valide = Test-BaseValide $psql $candidat $env:SPRING_DATASOURCE_USERNAME $env:SPRING_DATASOURCE_PASSWORD $base
        if ($valide -eq $true) { $portBase = $candidat; break }
        if ($null -eq $valide) {
            if (-not $indecis) { $indecis = $candidat }
        } else {
            Info "Port $candidat ouvert, mais $base inaccessible avec ces identifiants."
        }
    }

    if (-not $portBase -and $indecis) {
        $portBase = $indecis
        Souci "Port $portBase retenu sans validation (psql absent)."
    }

    if (-not $portBase) {
        $service = Get-Service -Name 'postgresql*' -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($service -and $service.Status -ne 'Running') {
            Souci "Service $($service.Name) arrete, tentative de demarrage..."
            try {
                Start-Service $service.Name
                Start-Sleep -Seconds 3
            } catch {
                Souci "Demarrage refuse : $($_.Exception.Message)"
            }
            if (Test-PortOuvert $hote 5432 3000) {
                $portBase = 5432
                Ok "Service $($service.Name) demarre."
            }
        }
    }

    if (-not $portBase -and (Get-Command docker -ErrorAction SilentlyContinue)) {
        Souci "Tentative de demarrage du PostgreSQL de Docker Compose..."
        Push-Location $racine
        try { Invoke-Docker ((Fichiers-Compose $racine) + @('compose', 'up', '-d', 'postgres')) | Out-Null } finally { Pop-Location }
        foreach ($candidat in 5433, 5432) {
            if (Test-PortOuvert $hote $candidat 3000) { $portBase = $candidat; break }
        }
    }

    if (-not $portBase) {
        $remede = @"
Trois pistes, dans l'ordre :

  1. PostgreSQL natif arrete   : Start-Service postgresql-x64-18
  2. PostgreSQL Docker         : docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres
  3. Base pas encore creee     : creez-la une seule fois, en tant que postgres -
     CREATE USER $($env:SPRING_DATASOURCE_USERNAME) WITH PASSWORD '$($env:SPRING_DATASOURCE_PASSWORD)';
     CREATE DATABASE pim_db OWNER $($env:SPRING_DATASOURCE_USERNAME);
"@
        Fatal "Aucune base PostgreSQL accessible sur les ports 5432 ni 5433." $remede
    }

    $env:SPRING_DATASOURCE_URL = "jdbc:postgresql://" + $hote + ":" + $portBase + "/" + $base
}
Ok "Base  : $($env:SPRING_DATASOURCE_URL)"

# ---------------------------------------------------------------------------
Etape "4/6  MinIO (stockage des medias)"
# ---------------------------------------------------------------------------
if (-not $env:PIM_MINIO_ENDPOINT) { $env:PIM_MINIO_ENDPOINT = 'http://localhost:9000' }
$portMinio = 9000
if ($env:PIM_MINIO_ENDPOINT -match ':(\d+)') { $portMinio = [int]$Matches[1] }

# MinIO doit ecouter AVANT que Spring ne demarre : le bean MinioConfig cree le bucket
# pim-media pendant l'initialisation du contexte et n'y revient jamais. Si MinIO monte
# apres coup, le backend tourne mais tout televersement echoue sur un bucket absent.
if (-not (Test-PortOuvert $hote $portMinio 1000)) {
    Souci "MinIO ne repond pas sur $($env:PIM_MINIO_ENDPOINT), tentative de demarrage..."
    $docker = Get-Command docker -ErrorAction SilentlyContinue
    if (-not $docker) {
        Souci "docker est introuvable dans le PATH, MinIO ne peut pas etre demarre."
    } else {
        # Le daemon peut etre absent alors que le client existe : Docker Desktop non lance.
        if (-not (Test-DaemonDocker)) {
            $bureau = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
            if (Test-Path $bureau) {
                Info "Daemon Docker arrete, lancement de Docker Desktop (compter une minute)..."
                Start-Process $bureau | Out-Null
                $attente = 0
                while ($attente -lt 180) {
                    Start-Sleep -Seconds 5
                    $attente += 5
                    if (Test-DaemonDocker) { break }
                }
            } else {
                Souci "Docker Desktop est introuvable a $bureau."
            }
        }

        if (-not (Test-DaemonDocker)) {
            Souci "Le daemon Docker ne repond toujours pas."
        } else {
            Push-Location $racine
            try { Invoke-Docker ((Fichiers-Compose $racine) + @('compose', 'up', '-d', 'minio')) | Out-Null } finally { Pop-Location }
            $attente = 0
            while ($attente -lt 60 -and -not (Test-PortOuvert $hote $portMinio 1000)) {
                Start-Sleep -Seconds 3
                $attente += 3
            }
        }
    }
}

if (Test-PortOuvert $hote $portMinio 1000) {
    Ok "MinIO : $($env:PIM_MINIO_ENDPOINT)"
} else {
    Souci "MinIO reste injoignable sur $($env:PIM_MINIO_ENDPOINT)."
    Info "Le backend demarre quand meme, mais tout televersement de media echouera."
    Info "Pour l'activer a la main : docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d minio"
}

# ---------------------------------------------------------------------------
Etape "5/6  Port 8092"
# ---------------------------------------------------------------------------
$occupe = Get-NetTCPConnection -LocalPort 8092 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($occupe) {
    $processus = Get-Process -Id $occupe.OwningProcess -ErrorAction SilentlyContinue
    $nom = 'inconnu'
    if ($processus) { $nom = $processus.ProcessName }
    Fatal "Le port 8092 est deja occupe par $nom (PID $($occupe.OwningProcess))." "Une instance du backend tourne deja. Arretez-la :`n`n    Stop-Process -Id $($occupe.OwningProcess)"
}
Ok "Port 8092 libre"

# ---------------------------------------------------------------------------
Etape "6/6  Demarrage"
# ---------------------------------------------------------------------------
if ($Diagnostic) {
    Write-Host ""
    Write-Host "  Mode diagnostic : tout est en place, le backend n'a pas ete demarre." -ForegroundColor White
    Write-Host ""
    exit 0
}

Info "Profil Spring : $($env:SPRING_PROFILES_ACTIVE)"
Info "API           : http://localhost:8092/api/v1"

if ($Detache) {
    # Le backend doit survivre a la fermeture du terminal. Le script se relance
    # donc dans un processus a part, sans le commutateur, avec sa sortie redirigee
    # vers un journal : demarre depuis le terminal appelant, Maven mourrait avec lui.
    $journal = Join-Path $racine 'logs\backend-detache.log'
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $journal) | Out-Null

    $script = Join-Path $racine 'demarrer-backend.ps1'
    $arguments = "-NoProfile -ExecutionPolicy Bypass -Command `"& '$script' *> '$journal'`""
    Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -WindowStyle Hidden

    Info "Journal       : $journal"
    Write-Host ""
    Write-Host "  Demarrage detache en cours..." -ForegroundColor White

    # Rendre la main sur une promesse ne vaudrait rien : on attend que l'API
    # reponde vraiment, et on le dit si elle ne repond pas.
    $limite = (Get-Date).AddMinutes(5)
    while ((Get-Date) -lt $limite) {
        Start-Sleep -Seconds 5
        try {
            $sante = Invoke-RestMethod -Uri 'http://localhost:8092/api/v1/actuator/health' -TimeoutSec 5
            if ($sante.status -eq 'UP') {
                Ok "Backend en ligne : http://localhost:8092/api/v1"
                Info "Arret : Get-NetTCPConnection -LocalPort 8092 -State Listen | ForEach-Object { Stop-Process -Id `$_.OwningProcess -Force }"
                Write-Host ""
                exit 0
            }
        } catch {
            # Le serveur n'ecoute pas encore : c'est le cas normal pendant la
            # trentaine de secondes que prend le demarrage.
        }
    }

    Souci "Le backend n'a pas repondu dans les cinq minutes."
    Info "Consultez le journal : $journal"
    exit 1
}

Info "Ctrl+C pour arreter."
Write-Host ""

$code = 1
Push-Location (Join-Path $racine 'backend')
try {
    & mvn spring-boot:run
    $code = $LASTEXITCODE
} finally {
    Pop-Location
}
exit $code
