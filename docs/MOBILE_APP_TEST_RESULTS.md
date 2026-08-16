# Muthu Farms mobile test results

Test date: 2026-08-16

Target: `https://preview.muthufarms.com` only

Branch: `agent/muthu-farms-mobile-preview`

## Completed automated and build checks

| Check | Result | Evidence |
| --- | --- | --- |
| Baseline frontend tests before mobile changes | Pass | Existing test command completed successfully |
| Baseline TypeScript check | Pass | `pnpm typecheck` |
| Baseline ESLint | Pass with 44 pre-existing warnings, 0 errors | `pnpm lint` |
| Baseline Next.js production build | Pass | `pnpm build`, Next.js 16.2.11 |
| Mobile configuration/security assertions | Pass | `pnpm mobile:verify` |
| Full frontend tests with mobile assertions | Pass | `pnpm test`; all existing suites and mobile assertions completed |
| Final TypeScript check | Pass | `pnpm typecheck` |
| Final ESLint | Pass with 44 pre-existing warnings, 0 errors | Generated native outputs are excluded from frontend lint |
| Final Next.js production build | Pass | `pnpm build`, 49 static pages plus dynamic routes |
| Android debug compilation | Pass | Gradle `assembleDebug` |
| Android lint and unit tests | Pass | Gradle `lintDebug testDebugUnitTest`; 0 errors, 17 generated-asset warnings |
| Android signed release APK | Pass | Permanent local key; Gradle `assembleRelease lintRelease testReleaseUnitTest` |
| iOS simulator compile | Pass | Draft PR CI on GitHub `macos-26`; Xcode compile completed in 2m13s without signing |
| iOS project sync | Pass | `pnpm mobile:ios:sync` with Swift Package Manager |
| Authentication source tests | Pass | 11/11 crypto, cookie, session, CSRF, role, and server tests |
| Backend source syntax audit | Pass | 32 Python source files parsed; this recovery repository has no test suite |
| Android GitHub Actions build | Pass | Draft PR `preview-debug` completed in 2m38s |
| Existing Preview baseline CI | Pass | Draft PR validation completed in 59s |
| Vercel pull-request preview | Pass | Preview deployment completed; no Production deployment |
| iOS Ad Hoc archive/export | Blocked on Apple signing inputs | Workflow prepared with no TestFlight or store-upload step |

A passing compile is not treated as proof of an authenticated device workflow.

Final Preview debug APK:

- Package: `com.muthufarms.app`
- Version: `1.0.0` (`versionCode=1`)
- Size: 9,937,539 bytes
- SHA-256: `1A04C90929ACE97D29C71CDA6C38C727E266C2FF5156A9AE0FDCEEDF56294D92`
- Debug signature verification: pass using APK Signature Scheme v2. This is the
  Android debug certificate, not a Play release certificate.
- Manifest inspection: minimum SDK 24, target SDK 36, and only Internet,
  Camera, Coarse Location, and Fine Location plus Android's generated
  non-exported-receiver permission.

Final signed Preview release APK:

- Package/version: `com.muthufarms.app` 1.0.0 (`versionCode=1`)
- SHA-256: `E3291D2440DD5FAED5E52C8DE7841AF352554711CBC43FFDA19BB049BE975655`
- APK Signature Scheme v2 verification: pass
- Certificate SHA-256: `5bd94927e052e01b215d01d7063c3e364b7fab4441ef4a13178c1070b91ca1b1`
- Signing key: 4096-bit RSA, private material stored outside Git
- Physical install/launch: pass on Samsung SM-S928B, Android 16/API 36
- Invalid credentials: pass after the Android WebView HTTP-error correction;
  the existing `Incorrect username or password.` response remains visible
- Camera and precise-location permissions remain denied until requested

The first invalid-login attempt revealed that Capacitor's default Android
`server.errorPath` handling replaced the auth service's valid HTTP 403 page with
the offline screen. The custom WebView client now preserves HTTP 401/403 pages
while retaining the offline path for transport failures. This was reproduced,
fixed, rebuilt with the same signing key, and retested on the physical Samsung.

## Live endpoint checks completed

- Preview returns the existing gateway redirect to
  `https://auth.muthufarms.com/login?next=...`.
- The auth login page is HTTPS and returns the existing Strict, Secure, HttpOnly
  login-CSRF cookie.
- No mobile-specific CORS, cookie, CSRF, session, or logout backend change was
  made.
- The source audit confirmed Admin/Manager/Tester/Viewer enforcement happens at
  the gateway and protected backend routes also verify signed identity.
- A negative build test confirmed that selecting `https://muthufarms.com`
  without `ALLOW_PRODUCTION_MOBILE_TARGET=true` fails configuration parsing.

## Physical Android checks completed

The debug APK installed and launched successfully on a Lenovo TB335FC tablet,
Android 16 / API 36, 1600-by-2560 at 320 dpi.

- Package ID, label, version, SDK levels, and requested permissions matched the
  reviewed manifest.
- Camera and both location permissions remained ungranted at launch; the app did
  not ask before a relevant website feature was used.
- The tablet was in Airplane mode with no validated network. The app displayed
  the branded local connectivity screen and stated that it had not queued or
  submitted a farm record.
- No crash, SSL bypass, or fatal WebView exception appeared in the launch log.
- Portrait and landscape rotations retained a readable, usable connectivity
  screen; the temporary test rotation lock was returned to its original `free`
  state.
- Back consumed the failed-navigation WebView history first, then exited to the
  prior app on the second press, as designed.

## Device and account matrix still required

The following cannot be honestly marked passed without supplied role test
accounts and physical/simulator access to the relevant platform. They are
mandatory Preview acceptance gates, not omitted tests.

| Scenario | Preview expected result | Status |
| --- | --- | --- |
| Valid Admin login | Login succeeds; Preview functions follow Admin policy | Blocked on test credential/device |
| Invalid login | Generic authentication error; no session | Blocked on device test credential |
| Manager login | Preview denied except existing restricted sync contract | Blocked on role test account |
| Tester login | Preview denied by gateway | Blocked on role test account |
| Viewer login | Preview denied by gateway | Blocked on role test account |
| Logout | Server session revoked and login shown | Blocked on valid session |
| Idle/absolute expiry | Redirect to login with no unauthorized data access | Time-based device test pending |
| Coconut, jackfruit, nutmeg, irrigation, well-water | Pages and allowed actions match website | Authenticated device test pending |
| Tree maps and orthomosaic | Tiles render; pan, pinch, marker selection work | Authenticated device/GPU test pending |
| Forms and data submission | Valid save once; interruption does not duplicate | Requires approved disposable Preview records |
| Camera/photo upload | Prompt is contextual; capture/select/upload succeeds | Physical Android and iPhone test pending |
| GPS | While-in-use precise prompt and field capture succeed | Physical Android and iPhone test pending |
| Excel/CSV/PDF downloads | File opens/saves with correct content | Authenticated device test pending |
| Android Back | Navigates history then exits | Pass for offline/fallback history; authenticated history pending |
| External links | Open safely outside protected app navigation | Device test pending |
| Rotation and screen sizes | No blocked controls or unusable maps | Pass for 1600-by-2560 fallback in both orientations; authenticated pages/device matrix pending |
| Poor or absent internet at launch | Branded fallback; no queued/submitted record | Pass on physical Android tablet in Airplane mode |
| Interrupted internet during submission | No duplicate/conflicting save | Authenticated network-conditioning test pending |

Preview itself is intentionally Admin-only for general use. Testing Manager,
Tester, and Viewer means confirming the gateway's expected denial in this build;
their allowed Production/Test workflows cannot be exercised by silently pointing
this branch at Production.

## Required device matrix

- Android API 24 minimum compatibility build, API 36 target emulator, and at
  least one current physical Android device with camera/GPS.
- iPhone simulator on Xcode 26 plus at least one physical iPhone for camera,
  photo library, precise location, WKWebView cookie, Ad Hoc installation, and
  registered-device behavior.
- Portrait and landscape; compact phone and tablet-sized viewport.
- Wi-Fi, mobile data, offline launch, mid-submit disconnect, and recovery.

All test records must be clearly disposable Preview records. Production testing
or deletion requires separate explicit approval.
