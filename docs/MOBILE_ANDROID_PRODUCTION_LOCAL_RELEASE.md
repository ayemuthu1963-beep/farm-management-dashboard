# Muthu Farms Android Production local release

This runbook covers the locally distributed Android Production APK only. It
does not publish to Google Play, deploy either website, or change any database.

## Approved identity

- Package ID: `com.muthufarms.app`
- Version name: `1.0.1-production`
- Version code: `2`
- Website origin: `https://muthufarms.com`
- Production navigation hosts: `muthufarms.com`, `www.muthufarms.com`, and
  `auth.muthufarms.com`
- Release-certificate SHA-256:
  `5bd94927e052e01b215d01d7063c3e364b7fab4441ef4a13178c1070b91ca1b1`
- Approved installation device: Lenovo serial `HA2DSL0K`
- Prohibited installation device: Samsung serial `R5CXB2Z7C0J`

The APK contains the Production HTTPS web origin only. PostgreSQL credentials,
database names, signing passwords, session cookies, tokens, and API keys are
not packaged. The Production website calls its existing server-side API; only
that backend connects to PostgreSQL.

## Build

Keep the PKCS#12 keystore and DPAPI-protected signing secret outside the Git
repository. From the repository root on the approved Windows signing account:

```powershell
& .\scripts\build-android-production.ps1 `
  -SigningSecretPath 'C:\secure\Muthu-Farms-Android-Release.secrets.dpapi' `
  -KeystorePath 'C:\secure\Muthu-Farms-Android-Release.p12' `
  -OutputDirectory 'C:\secure\release-output' `
  -VersionCode 2 `
  -VersionName '1.0.1-production'
```

The script selects the Production target explicitly, syncs only Android,
builds the signed release, runs Android release lint and unit tests, and then
checks package metadata, certificate identity, HTTPS configuration, the exact
host allowlist, and the absence of Preview/UAT/database/direct-PostgreSQL
strings.

## Lenovo rollback and installation gate

Never use an unqualified `adb` install command. Every command must specify the
Lenovo serial exactly.

1. Confirm `adb devices -l` contains `HA2DSL0K` and record every other device.
2. Read the installed package path with
   `adb -s HA2DSL0K shell pm path com.muthufarms.app`.
3. Pull the installed `base.apk` to the protected rollback directory and record
   its SHA-256, package ID, version, and signing-certificate SHA-256.
4. Compare the rollback certificate with the new release certificate.
5. If package ID or certificate differs, stop. Do not uninstall and do not
   clear application data.
6. Install only with
   `adb -s HA2DSL0K install -r <production-apk>`.

An in-place `-r` update preserves the existing WebView application data and
session. Never run `pm clear`, never clear WebView data, and do not touch QField
or GIS files.

## Read-only acceptance test

Clear Logcat only, launch the app, and capture the `MFMS_ENDPOINT_AUDIT` tag.
That tag records scheme and host only; it never records URL paths, queries,
headers, cookies, tokens, or form data.

- No Preview/UAT warning or endpoint.
- Main page is `https://muthufarms.com`.
- Existing session opens without a password prompt.
- Farm Map reports `2117 coconut trees loaded`.
- Production pages display live data.
- No form is submitted and no record is changed.
- Force-stop and reopen succeeds.
- No crash, HTTP 4xx, or HTTP 5xx is emitted during the accepted path.

If any Preview/UAT host is observed, immediately reinstall the preserved
rollback APK with `adb -s HA2DSL0K install -r <rollback-apk>`, mark the build
failed, and do not approve it.
