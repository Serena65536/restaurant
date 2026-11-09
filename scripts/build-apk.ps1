# build-apk.ps1 - assemble the release APK.
# ASCII only (Windows PowerShell 5.1).

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot 'env.ps1')

$androidDir = Join-Path $root 'app\android'
$logFile = Join-Path $root '.cache\build-release.log'
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $logFile) | Out-Null

Push-Location $androidDir
# gradle writes warnings (and javac notes in GBK) to stderr; with -Stop that would
# abort the script mid-build, so only rely on the exit code here.
$ErrorActionPreference = 'Continue'
try {
  & .\gradlew.bat assembleRelease --console=plain 2>&1 | Tee-Object -FilePath $logFile
  $code = $LASTEXITCODE
} finally {
  Pop-Location
}

$apk = Join-Path $androidDir 'app\build\outputs\apk\release\app-release.apk'
if ($code -eq 0 -and (Test-Path $apk)) {
  $size = [math]::Round((Get-Item $apk).Length / 1MB, 1)
  Write-Host ''
  Write-Host "APK ready: $apk ($size MB)" -ForegroundColor Green
  exit 0
} else {
  Write-Host "build failed (exit $code); see $logFile" -ForegroundColor Red
  exit 1
}
