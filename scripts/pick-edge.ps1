# Restart the quick tunnel until Cloudflare lands the connection on an Asian edge
# (hkg / sin / nrt ...). A lax edge gives ~0.7-4s per request from here.
# ASCII only: Windows PowerShell 5.1 reads BOM-less UTF-8 as ANSI.

$ErrorActionPreference = 'Continue'
$cf = 'D:\restaurant\.toolchain\cloudflared\cloudflared.exe'
$log = 'D:\restaurant\.cache\logs\tunnel.err.log'
$good = @('hkg', 'sin', 'nrt', 'kix', 'pek', 'tsn', 'ctu', 'hgh', 'szx', 'can', 'sha', 'wuh')

for ($i = 1; $i -le 8; $i++) {
  Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force
  Start-Sleep -Seconds 2
  Remove-Item $log -Force -ErrorAction SilentlyContinue

  Start-Process -FilePath $cf -ArgumentList 'tunnel', '--url', 'http://localhost:8080', '--no-autoupdate' -WindowStyle Hidden -RedirectStandardOutput 'D:\restaurant\.cache\logs\tunnel.out.log' -RedirectStandardError $log

  $location = $null
  $url = $null
  for ($j = 0; $j -lt 40; $j++) {
    Start-Sleep -Milliseconds 500
    if (Test-Path $log) {
      $m = Select-String -Path $log -Pattern 'location=([a-z0-9]+)' -ErrorAction SilentlyContinue | Select-Object -Last 1
      if ($m) { $location = $m.Matches[0].Groups[1].Value }
      $u = Select-String -Path $log -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -AllMatches -ErrorAction SilentlyContinue
      if ($u) { $url = $u.Matches[0].Value }
    }
    if ($location -and $url) { break }
  }

  Write-Host ("attempt {0}: location={1} url={2}" -f $i, $location, $url)

  $hit = $false
  foreach ($g in $good) {
    if ($location -and $location.StartsWith($g)) { $hit = $true }
  }
  if ($hit) {
    Write-Host "ACCEPTED $url ($location)"
    break
  }
}

if ($url) {
  Set-Content -Path 'D:\restaurant\data\url.txt' -Value $url -Encoding ASCII
  node 'D:\restaurant\scripts\tools\qr.mjs' $url 'D:\restaurant\data\qr.png' | Out-Null
  Write-Host "FINAL $url"
}
