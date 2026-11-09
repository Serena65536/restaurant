# start.ps1 - start the local backend and a Cloudflare quick tunnel, then print
# the public URL, write it to data\url.txt and open a QR image for the phone.
# ASCII only: Windows PowerShell 5.1 misreads BOM-less UTF-8 scripts.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\scripts\start.ps1
#   powershell -ExecutionPolicy Bypass -File .\scripts\start.ps1 -Wait
#
# -Wait keeps this window attached (Ctrl+C stops nothing that is already detached;
# use stop.ps1 for that). Without -Wait the script prints the URL and exits, and
# both services keep running in the background.

param(
  [switch]$Wait
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'env.ps1')

$logDir = Join-Path $root '.cache\logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$serverLog = Join-Path $logDir 'server.log'
$tunnelLog = Join-Path $logDir 'tunnel.log'
$tunnelErr = Join-Path $logDir 'tunnel.err.log'

function Test-Backend {
  try {
    $r = Invoke-WebRequest -Uri 'http://127.0.0.1:8080/api/health' -UseBasicParsing -TimeoutSec 2
    return ($r.StatusCode -eq 200)
  } catch {
    return $false
  }
}

# 1) backend
if (Test-Backend) {
  Write-Host '[1/3] backend already running on 127.0.0.1:8080'
} else {
  Write-Host '[1/3] starting backend...'
  $serverDir = Join-Path $root 'server'
  Start-Process -FilePath 'node' `
    -ArgumentList 'src/index.mjs' `
    -WorkingDirectory $serverDir `
    -WindowStyle Hidden `
    -RedirectStandardOutput $serverLog `
    -RedirectStandardError (Join-Path $logDir 'server.err.log')
  $ok = $false
  for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Milliseconds 500
    if (Test-Backend) { $ok = $true; break }
  }
  if (-not $ok) {
    Write-Host 'backend failed to start; see .cache\logs\server.err.log' -ForegroundColor Red
    exit 1
  }
  Write-Host '      backend ready'
}

# 2) tunnel - kill a leftover one first so only one URL is ever alive
$stale = Get-Process cloudflared -ErrorAction SilentlyContinue
if ($stale) {
  Write-Host '[2/3] stopping the previous tunnel first...'
  $stale | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 800
}

Write-Host '[2/3] starting Cloudflare tunnel...'
foreach ($f in @($tunnelLog, $tunnelErr)) {
  if (Test-Path $f) { Remove-Item $f -Force -ErrorAction SilentlyContinue }
}
$cloudflared = Join-Path $root '.toolchain\cloudflared\cloudflared.exe'
$proc = Start-Process -FilePath $cloudflared `
  -ArgumentList 'tunnel', '--url', 'http://localhost:8080', '--no-autoupdate' `
  -WindowStyle Hidden -PassThru `
  -RedirectStandardOutput $tunnelLog `
  -RedirectStandardError $tunnelErr

$publicUrl = $null
for ($i = 0; $i -lt 120; $i++) {
  Start-Sleep -Milliseconds 500
  foreach ($candidate in @($tunnelLog, $tunnelErr)) {
    if (Test-Path $candidate) {
      $m = Select-String -Path $candidate -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -AllMatches -ErrorAction SilentlyContinue
      if ($m) {
        $publicUrl = $m.Matches[0].Value.Trim()
        break
      }
    }
  }
  if ($publicUrl) { break }
}
if (-not $publicUrl) {
  Write-Host 'tunnel URL not found; see .cache\logs\tunnel.err.log' -ForegroundColor Red
  exit 1
}

# 3) show it
$urlFile = Join-Path $root 'data\url.txt'
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $urlFile) | Out-Null
Set-Content -Path $urlFile -Value $publicUrl -Encoding ASCII
try { Set-Clipboard -Value $publicUrl } catch {}

Write-Host ''
Write-Host '============================================================' -ForegroundColor Green
Write-Host "  $publicUrl" -ForegroundColor Green
Write-Host '============================================================' -ForegroundColor Green
Write-Host '  (copied to clipboard, also saved to data\url.txt)'
Write-Host ''

# Same-WiFi phones are much faster against the LAN address (no tunnel hop).
# ASCII only + no pipeline continuation: Windows PowerShell 5.1 rejects a line
# that starts with a pipe, and reads BOM-less UTF-8 as ANSI.
$lanIp = $null
try {
  $candidates = @(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue)
  foreach ($candidate in $candidates) {
    if ($candidate.IPAddress -notlike '127.*' -and $candidate.IPAddress -notlike '169.254.*') {
      $lanIp = $candidate.IPAddress
      break
    }
  }
} catch {
  $lanIp = $null
}
if ($lanIp) {
  Write-Host ("  Same WiFi (faster): http://{0}:8080" -f $lanIp) -ForegroundColor Cyan
  Write-Host ''
}

Write-Host '[3/3] generating QR image...'
$qrPng = Join-Path $root 'data\qr.png'
$qrScript = Join-Path $PSScriptRoot 'tools\qr.mjs'
try {
  node $qrScript $publicUrl $qrPng
  Start-Process $qrPng
} catch {
  Write-Host 'QR image could not be opened; just type the URL into the app.'
}

Write-Host ''
Write-Host 'Next: put this URL into the app field and tap the button.'
Write-Host 'The URL changes every time this script runs.'
Write-Host 'Stop backend + tunnel:  powershell -ExecutionPolicy Bypass -File .\scripts\stop.ps1'

if ($Wait) {
  Write-Host ''
  Write-Host 'Attached. Close this window (or Ctrl+C) when done; use stop.ps1 to kill services.'
  while (-not $proc.HasExited) { Start-Sleep -Seconds 3 }
  Write-Host 'tunnel exited.'
}
