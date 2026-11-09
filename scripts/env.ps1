# Shared environment for all scripts. ASCII only: Windows PowerShell 5.1 reads
# BOM-less UTF-8 as ANSI, so non-ASCII comments here can break parsing.
# Usage:  Set-ExecutionPolicy -Scope Process Bypass -Force ; . D:\restaurant\scripts\env.ps1

$root = 'D:\restaurant'

$env:JAVA_HOME        = Join-Path $root '.toolchain\jdk17'
$env:ANDROID_HOME     = Join-Path $root '.toolchain\android-sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:GRADLE_USER_HOME = Join-Path $root '.gradle-home'

# sdkmanager writes its cache into %USERPROFILE%\.android by default, which the
# sandbox denies; point it inside the workspace. Only ANDROID_USER_HOME is set:
# AGP fails the build if both ANDROID_USER_HOME and ANDROID_SDK_HOME are present.
$env:ANDROID_USER_HOME = Join-Path $root '.toolchain\android-home'

# npm: keep cache inside the workspace (the system cache dir is blocked -> EPERM),
# and use a China mirror for speed.
$env:npm_config_cache    = Join-Path $root '.cache\npm'
$env:npm_config_registry = 'https://registry.npmmirror.com/'

# %TEMP% is blocked by the sandbox; several tools (RN CLI, Gradle) create temp
# dirs there, so redirect temp to the workspace.
$tmp = Join-Path $root '.cache\tmp'
if (-not (Test-Path $tmp)) { New-Item -ItemType Directory -Force -Path $tmp | Out-Null }
$env:TEMP = $tmp
$env:TMP  = $tmp

$env:PATH = @(
  (Join-Path $env:JAVA_HOME 'bin'),
  (Join-Path $env:ANDROID_HOME 'platform-tools'),
  (Join-Path $env:ANDROID_HOME 'cmdline-tools\latest\bin'),
  $env:PATH
) -join ';'
