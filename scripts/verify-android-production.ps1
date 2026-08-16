[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ApkPath,

    [string]$ExpectedCertificateSha256 = '5bd94927e052e01b215d01d7063c3e364b7fab4441ef4a13178c1070b91ca1b1'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$resolvedApk = (Resolve-Path -LiteralPath $ApkPath).Path
$androidSdk = if ($env:ANDROID_HOME) {
    $env:ANDROID_HOME
} else {
    Join-Path $env:LOCALAPPDATA 'Android\Sdk'
}
$buildToolsRoot = Join-Path $androidSdk 'build-tools'
$buildTools = (Get-ChildItem -LiteralPath $buildToolsRoot -Directory |
    Sort-Object { [version]$_.Name } -Descending |
    Select-Object -First 1).FullName

if (-not $env:JAVA_HOME) {
    $androidStudioJava = Join-Path $env:ProgramFiles 'Android\Android Studio\jbr'
    if (Test-Path -LiteralPath $androidStudioJava) {
        $env:JAVA_HOME = $androidStudioJava
    }
}

$aapt = Join-Path $buildTools 'aapt.exe'
$apkSigner = Join-Path $buildTools 'apksigner.bat'
$badging = (& $aapt dump badging $resolvedApk) -join "`n"
$signature = (& $apkSigner verify --verbose --print-certs $resolvedApk) -join "`n"

if ($badging -notmatch "package: name='com\.muthufarms\.app' versionCode='2' versionName='1\.0\.1-production'") {
    throw 'APK package or Production version metadata does not match the approved release.'
}
if ($signature -notmatch 'Verified using v2 scheme \(APK Signature Scheme v2\): true') {
    throw 'APK Signature Scheme v2 verification failed.'
}

$certificateMatch = [regex]::Match(
    $signature,
    'certificate SHA-256 digest:\s*([0-9a-f]+)',
    [Text.RegularExpressions.RegexOptions]::IgnoreCase
)
if (-not $certificateMatch.Success) {
    throw 'The APK signing-certificate SHA-256 could not be read.'
}
$certificateSha256 = $certificateMatch.Groups[1].Value.ToLowerInvariant()
if ($certificateSha256 -ne $ExpectedCertificateSha256.ToLowerInvariant()) {
    throw 'The APK is not signed by the approved Muthu Farms release certificate.'
}

Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($resolvedApk)
$forbiddenHits = [Collections.Generic.List[object]]::new()
$forbiddenPatterns = [ordered]@{
    preview_host = 'preview.muthufarms.com'
    preview_url = 'https://preview'
    preview_service_ui = 'Preview service'
    preview_uat_banner = 'PREVIEW / UAT'
    uat_database = 'mfms_server_uat'
    uat_host = 'uat.muthufarms.com'
    uat_path = '/uat'
    production_database_name = 'mfms_server_prod'
    postgres_uri = 'postgres://'
    postgresql_uri = 'postgresql://'
    jdbc_postgresql = 'jdbc:postgresql'
}

try {
    $configEntry = $archive.GetEntry('assets/capacitor.config.json')
    if ($null -eq $configEntry) {
        throw 'Capacitor configuration is missing from the APK.'
    }

    $configStream = $configEntry.Open()
    try {
        $reader = [IO.StreamReader]::new($configStream, [Text.Encoding]::UTF8)
        try {
            $config = $reader.ReadToEnd() | ConvertFrom-Json
        }
        finally {
            $reader.Dispose()
        }
    }
    finally {
        $configStream.Dispose()
    }

    if ($config.appId -cne 'com.muthufarms.app') {
        throw 'The packaged Capacitor app ID is incorrect.'
    }
    if ($config.server.url -cne 'https://muthufarms.com') {
        throw 'The packaged Capacitor server URL is not the Production origin.'
    }
    if ($config.loggingBehavior -cne 'none') {
        throw 'Capacitor logging must be disabled in the Production release.'
    }
    if ($config.server.cleartext -ne $false -or $config.android.allowMixedContent -ne $false) {
        throw 'The Production APK permits insecure cleartext or mixed content.'
    }
    $allowedNavigation = @($config.server.allowNavigation | Sort-Object)
    $expectedNavigation = @('auth.muthufarms.com', 'muthufarms.com', 'www.muthufarms.com')
    if (Compare-Object -ReferenceObject $expectedNavigation -DifferenceObject $allowedNavigation) {
        throw 'The packaged navigation allowlist is not the approved Production allowlist.'
    }

    foreach ($entry in $archive.Entries) {
        if ($entry.Length -eq 0) { continue }
        $entryStream = $entry.Open()
        try {
            $memory = [IO.MemoryStream]::new()
            $entryStream.CopyTo($memory)
            $bytes = $memory.ToArray()
            $decoded = @(
                [Text.Encoding]::UTF8.GetString($bytes),
                [Text.Encoding]::Unicode.GetString($bytes),
                [Text.Encoding]::BigEndianUnicode.GetString($bytes)
            )
            foreach ($pattern in $forbiddenPatterns.GetEnumerator()) {
                if ($decoded.Where({
                    $_.IndexOf($pattern.Value, [StringComparison]::OrdinalIgnoreCase) -ge 0
                }).Count -gt 0) {
                    $forbiddenHits.Add([pscustomobject]@{
                        Check = $pattern.Key
                        Entry = $entry.FullName
                    })
                }
            }
        }
        finally {
            $entryStream.Dispose()
        }
    }
}
finally {
    $archive.Dispose()
}

if ($forbiddenHits.Count -gt 0) {
    $forbiddenHits | Sort-Object Check, Entry | Format-Table -AutoSize
    throw 'The APK contains a forbidden environment, endpoint, database, or direct PostgreSQL string.'
}

[pscustomobject]@{
    Verification = 'PASS'
    Apk = $resolvedApk
    SHA256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $resolvedApk).Hash
    PackageId = 'com.muthufarms.app'
    VersionName = '1.0.1-production'
    VersionCode = 2
    CertificateSHA256 = $certificateSha256
    ServerUrl = 'https://muthufarms.com'
    NavigationHosts = $expectedNavigation -join ', '
    ForbiddenEnvironmentStrings = 0
} | Format-List
