# stop.ps1 - stop the backend (node) and the Cloudflare tunnel started by start.ps1.
# ASCII only.

$root = Split-Path -Parent $PSScriptRoot

$ports = @(8080)
foreach ($port in $ports) {
  $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  foreach ($c in $conns) {
    try {
      Stop-Process -Id $c.OwningProcess -Force -ErrorAction Stop
      Write-Host "stopped listener on port $port (pid $($c.OwningProcess))"
    } catch {
      Write-Host "could not stop pid $($c.OwningProcess) on port $port"
    }
  }
}

Get-Process cloudflared -ErrorAction SilentlyContinue | ForEach-Object {
  Stop-Process -Id $_.Id -Force
  Write-Host "stopped cloudflared (pid $($_.Id))"
}

Write-Host 'done'
