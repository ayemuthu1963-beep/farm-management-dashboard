# Muthu Farms mobile setup and build guide

## Versions and identifiers

- App name: Muthu Farms
- Android application ID: `com.muthufarms.app`
- iOS bundle ID: `com.muthufarms.app`
- App version: `1.0.0` / Android version code `1` / iOS build `1`
- Capacitor: `8.5.0`
- Node.js: 24
- pnpm: 10.34.5
- Android compile and target SDK: 36; minimum SDK: 24
- Android Java: 21
- iOS deployment target: 15.0; Xcode 26 is required by Capacitor 8

## Install and verify

```powershell
pnpm install --frozen-lockfile
pnpm mobile:verify
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

All commands default to `https://preview.muthufarms.com`. Do not set a
Production URL for ordinary development or CI.

## Android debug APK

Install Android Studio and the Android SDK. On Windows,
`scripts/run-mobile-gradle.mjs` uses Android Studio's bundled Java and the SDK
under `%LOCALAPPDATA%\Android\Sdk` when environment variables are absent.

```powershell
pnpm mobile:android:debug
```

The APK is written to:

`android/app/build/outputs/apk/debug/app-debug.apk`

Install on an attached development device with:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r `
  android/app/build/outputs/apk/debug/app-debug.apk
```

## Android signed APK and AAB

Never add a keystore, password, or `keystore.properties` to the repository.
Supply all four values in the build environment:

```powershell
$env:MFMS_ANDROID_KEYSTORE_PATH = 'C:\secure\muthu-farms-upload.jks'
$env:MFMS_ANDROID_KEYSTORE_PASSWORD = '<secret>'
$env:MFMS_ANDROID_KEY_ALIAS = 'muthu-farms-upload'
$env:MFMS_ANDROID_KEY_PASSWORD = '<secret>'
pnpm mobile:android:release
```

Outputs are under `android/app/build/outputs/apk/release/` and
`android/app/build/outputs/bundle/release/`. Without all four variables, Gradle
may compile unsigned release artifacts only; those are not publishable builds.
For local-only distribution, use the permanent Muthu Farms release key. The
current key is stored outside the repository with a random password protected by
Windows current-user DPAPI and a restrictive filesystem ACL. Back up the
keystore and its DPAPI blob together to owner-controlled encrypted storage; an
APK signed with another key cannot update an installed copy.

## iOS project on a Mac

The complete Xcode project is `ios/App/App.xcodeproj`. On macOS with Xcode 26:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm mobile:verify
pnpm mobile:ios:sync
open ios/App/App.xcodeproj
```

The sync script normalizes Capacitor's generated Swift Package plugin path to a
repository-relative path. Always use this script instead of invoking
`cap sync ios` directly, especially when the project was prepared on Windows.

In Xcode, select the App target, choose the owner's Apple team, confirm bundle
ID `com.muthufarms.app`, and build. For local-only device distribution, register
each iPhone/iPad UDID, create an Ad Hoc provisioning profile for the bundle ID,
archive with the Apple Distribution certificate, and export an Ad Hoc IPA. Do
not select App Store Connect or TestFlight. The local Windows computer cannot
compile, sign, or validate an iOS archive.

## Secure GitHub Actions iOS build

`.github/workflows/mobile-ios.yml` always compiles the Preview project without
signing on pull requests. A manually dispatched run can create a registered-
device Ad Hoc IPA only through the protected `mobile-ios-ad-hoc` environment and
these repository/environment secrets:

- `IOS_DISTRIBUTION_CERTIFICATE_BASE64`
- `IOS_CERTIFICATE_PASSWORD`
- `IOS_AD_HOC_PROVISIONING_PROFILE_BASE64`
- `APPLE_TEAM_ID`

Use a required reviewer on the protected environment. The workflow creates a
randomly protected temporary keychain, validates the profile's Team ID, bundle
ID, and non-empty registered-device list, verifies the exported IPA, retains the
private artifact for one day, and removes signing material after the job. It has
no App Store Connect or upload step. Certificates, profiles, keys, and passwords
must never be committed or printed.

## Icons and splash assets

The generated native assets come from the existing high-resolution
`public/muthu-farms-logo.png` copied into `assets/`. Regenerate after an approved
brand update with:

```powershell
pnpm mobile:icons
pnpm mobile:sync
```

## Production target guard

The source configuration permits a Production origin only when both the code
review/release checklist has explicit owner approval and the build environment
sets:

```powershell
$env:MOBILE_WEB_URL = 'https://muthufarms.com'
$env:ALLOW_PRODUCTION_MOBILE_TARGET = 'true'
```

This is an intentional hard stop. Do not set it for Preview testing, pull
requests, or Ad Hoc signing preparation without the owner's direct approval.
