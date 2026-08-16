[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$SigningSecretPath,

    [Parameter(Mandatory = $true)]
    [string]$KeystorePath,

    [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\release-output'),
    [int]$VersionCode = 2,
    [string]$VersionName = '1.0.1-production'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ($VersionCode -le 1) {
    throw 'The Production versionCode must be greater than the Preview versionCode (1).'
}
if ($VersionName -notmatch '^[0-9]+\.[0-9]+\.[0-9]+-production$') {
    throw 'The Production versionName must use the form 1.0.1-production.'
}

$resolvedSecretPath = (Resolve-Path -LiteralPath $SigningSecretPath).Path
$resolvedKeystorePath = (Resolve-Path -LiteralPath $KeystorePath).Path
$resolvedOutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))

Add-Type -AssemblyName System.Security
$encryptedBytes = [IO.File]::ReadAllBytes($resolvedSecretPath)
$plainBytes = $null
$signing = $null
$savedEnvironment = @{}
$environmentNames = @(
    'MFMS_MOBILE_RELEASE_ENVIRONMENT',
    'MFMS_ANDROID_ONLY',
    'MOBILE_WEB_URL',
    'ALLOW_PRODUCTION_MOBILE_TARGET',
    'MFMS_ANDROID_VERSION_CODE',
    'MFMS_ANDROID_VERSION_NAME',
    'MFMS_ANDROID_KEYSTORE_PATH',
    'MFMS_ANDROID_KEYSTORE_PASSWORD',
    'MFMS_ANDROID_KEY_ALIAS',
    'MFMS_ANDROID_KEY_PASSWORD'
)

foreach ($name in $environmentNames) {
    $savedEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}

try {
    $plainBytes = [Security.Cryptography.ProtectedData]::Unprotect(
        $encryptedBytes,
        $null,
        [Security.Cryptography.DataProtectionScope]::CurrentUser
    )
    $signing = [Text.Encoding]::UTF8.GetString($plainBytes) | ConvertFrom-Json

    $env:MFMS_MOBILE_RELEASE_ENVIRONMENT = 'production'
    $env:MFMS_ANDROID_ONLY = 'true'
    $env:MOBILE_WEB_URL = 'https://muthufarms.com'
    $env:ALLOW_PRODUCTION_MOBILE_TARGET = 'true'
    $env:MFMS_ANDROID_VERSION_CODE = [string]$VersionCode
    $env:MFMS_ANDROID_VERSION_NAME = $VersionName
    $env:MFMS_ANDROID_KEYSTORE_PATH = $resolvedKeystorePath
    $env:MFMS_ANDROID_KEYSTORE_PASSWORD = [string]$signing.storePassword
    $env:MFMS_ANDROID_KEY_ALIAS = [string]$signing.keyAlias
    $env:MFMS_ANDROID_KEY_PASSWORD = [string]$signing.keyPassword

    Push-Location $repoRoot
    try {
        & pnpm.cmd exec cap sync android
        if ($LASTEXITCODE -ne 0) { throw 'Capacitor Android sync failed.' }

        & node scripts/run-mobile-gradle.mjs clean assembleRelease lintRelease testReleaseUnitTest
        if ($LASTEXITCODE -ne 0) { throw 'Android Production release build failed.' }
    }
    finally {
        Pop-Location
    }

    $sourceApk = Join-Path $repoRoot 'android\app\build\outputs\apk\release\app-release.apk'
    if (-not (Test-Path -LiteralPath $sourceApk)) {
        throw 'The signed release APK was not produced.'
    }

    New-Item -ItemType Directory -Force -Path $resolvedOutputDirectory | Out-Null
    $releaseNumber = $VersionName -replace '-production$', ''
    $outputApk = Join-Path $resolvedOutputDirectory "Muthu-Farms-Production-$releaseNumber-release-signed.apk"
    Copy-Item -LiteralPath $sourceApk -Destination $outputApk -Force

    & (Join-Path $PSScriptRoot 'verify-android-production.ps1') -ApkPath $outputApk

    [pscustomobject]@{
        Apk = $outputApk
        SHA256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $outputApk).Hash
        VersionName = $VersionName
        VersionCode = $VersionCode
        PackageId = 'com.muthufarms.app'
    } | Format-List
}
finally {
    foreach ($name in $environmentNames) {
        [Environment]::SetEnvironmentVariable($name, $savedEnvironment[$name], 'Process')
    }
    if ($null -ne $plainBytes) {
        [Array]::Clear($plainBytes, 0, $plainBytes.Length)
    }
    $signing = $null
}
