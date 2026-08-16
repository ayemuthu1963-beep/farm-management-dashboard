# Android Production local-release test results

Date: 2026-08-16

Status: **Pre-install checks pass; Lenovo physical-device acceptance pending**

## Artifact

- Filename: `Muthu-Farms-Production-1.0.1-release-signed.apk`
- Package ID: `com.muthufarms.app`
- Version name: `1.0.1-production`
- Version code: `2`
- SHA-256:
  `39435C3E59827D39426229B824A92FC4E479227708E902A4CD4C7DCB2BDFFBEC`
- Signing-certificate SHA-256:
  `5bd94927e052e01b215d01d7063c3e364b7fab4441ef4a13178c1070b91ca1b1`
- APK Signature Scheme v2: pass

## Production chain evidence

- Packaged Capacitor URL: `https://muthufarms.com`
- Packaged navigation allowlist: `muthufarms.com`, `www.muthufarms.com`,
  `auth.muthufarms.com`
- Live authenticated `/api/version`: HTTP 200, environment `Production`, build
  timestamp `20260815T083748Z`, Git commit
  `e9833917c0a7fd190d933acb8cb234f60f5c8c65`
- Read-only live container inspection: Production frontend
  `mfms-v0-preview-web` and backend `harvest-api` both declare
  `mfms_server_prod`; both were running with restart count zero.
- Live Production Farm Map: `2117 coconut trees loaded`.
- Browser network-host audit: `muthufarms.com` and `unpkg.com`; no Preview/UAT
  host was observed.

The historical Production frontend container name includes the word `preview`.
This is a server-side container name only. It is not an APK endpoint and is not
packaged in the APK.

## Static security and endpoint audit

- No `preview.muthufarms.com`, Preview service/banner, UAT host/path,
  `mfms_server_uat`, `mfms_server_prod`, PostgreSQL URI, or JDBC PostgreSQL
  string was found in the decompressed APK entries.
- Exact local release signing passwords were not present in the APK.
- No cleartext or mixed content is permitted.
- Production Capacitor logging and WebView debugging are disabled.
- Host-only runtime endpoint audit logging contains no paths, queries, headers,
  cookies, or tokens.

## Automated results

- Mobile configuration assertions: pass
- TypeScript type check: pass
- Full repository test suite: pass
- Next.js optimized Production build: pass
- ESLint: pass with 44 pre-existing warnings and zero errors
- Android clean signed release build: pass
- Android release unit tests: pass
- Android release lint: pass
- APK package/signature/configuration/string verification: pass

## Open physical-device gates

The Lenovo `HA2DSL0K` was not visible to ADB during the build. Therefore the
following were deliberately not performed:

- rollback APK preservation and installed-certificate comparison;
- Production APK installation;
- password-free session preservation check;
- Lenovo host-only Logcat capture;
- close/reopen and Android crash check;
- Lenovo Production-interface screenshots.

The Samsung `R5CXB2Z7C0J` was never targeted by a Production install command.

The live Production Farm Map currently returns HTTP 404 for the Vercel insights
script and several out-of-coverage edge tiles. Those are pre-existing website
subresource responses, not Preview/UAT calls, but they prevent claiming the
strict zero-4xx acceptance gate until the Lenovo test path is captured and the
scope of expected map-edge 404s is resolved.

PR #168 must remain draft and unmerged. No Production deployment or database
write is part of this release.
