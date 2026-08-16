# Muthu Farms mobile release checklist

No box in an approval section may be inferred from a successful build.

## Preview acceptance

- [ ] Draft pull request approved for Preview testing; not merged.
- [ ] Android debug APK installed from the reviewed commit.
- [ ] iOS unsigned simulator build passes on the PR's macOS runner.
- [ ] Valid and invalid login behavior verified.
- [ ] Admin allowed access verified.
- [ ] Manager, Tester, and Viewer Preview denial/restricted behavior verified.
- [ ] Logout, disabled account, password change requirement, idle expiry, and
      absolute expiry verified.
- [ ] Coconut, jackfruit, nutmeg, irrigation, well-water, and all current website
      routes verified against the website.
- [ ] Forms use approved disposable Preview records and submit exactly once.
- [ ] Camera capture and existing-photo upload verified on Android and iPhone.
- [ ] Precise while-in-use GPS verified on Android and iPhone.
- [ ] Tree maps, orthomosaic resolution, pan, pinch, markers, and rotation verified.
- [ ] Excel/CSV/PDF/other permitted downloads verified for filename and contents.
- [ ] Android Back, iOS swipe navigation, file selection, and external links verified.
- [ ] Compact phone, large phone, tablet, portrait, and landscape checked.
- [ ] Slow, interrupted, and absent internet checked; no duplicate/conflicting
      record created.
- [ ] No credentials, tokens, cookies, API keys, keystores, certificates,
      profiles, or signing passwords in source, logs, artifacts, or PR diff.

## Android local signing

- [x] Permanent local Muthu Farms release key generated outside Git.
- [x] Signing password protected with Windows current-user DPAPI and restrictive ACLs.
- [ ] Owner stores a recoverable encrypted offline backup of the key and DPAPI blob.
- [x] Signed release APK built from the reviewed Preview source.
- [x] `apksigner verify --verbose --print-certs` passes and certificate SHA-256 is recorded.
- [x] Signed APK installs and launches on a physical Android 16 Samsung device.
- [ ] All authenticated Preview acceptance scenarios pass on the signed APK.

## iOS Ad Hoc signing

- [ ] Apple Developer Team ID is supplied and owns `com.muthufarms.app`.
- [ ] Each Muthu Farms iPhone/iPad name and UDID is registered with the Apple team.
- [ ] Apple Distribution certificate and device-containing Ad Hoc provisioning
      profile are installed as protected environment secrets.
- [ ] GitHub `mobile-ios-ad-hoc` environment has a required owner reviewer.
- [ ] iOS simulator compile passes on Xcode 26.
- [ ] Ad Hoc archive/export validates the Team ID, bundle ID, certificate,
      entitlements, embedded registered-device profile, and IPA signature.
- [ ] IPA installs and launches on every registered physical Apple test device.
- [ ] Physical-iPhone/iPad Preview acceptance matrix passes.

## Architecture and local-release gate

- [ ] Owner reviews Capacitor's warning that `server.url`/`allowNavigation` are
      not intended for production.
- [ ] Cookie, CSRF, SameSite, Origin, CORS, session refresh, logout, and expiry
      are reverified in the signed release candidates.
- [ ] Security review confirms backend role enforcement for every protected route.

## Explicit owner approvals

- [ ] Approval to point any release candidate at Production.
- [ ] Approval to make any Production deployment or backend/auth change.
- [ ] Approval to merge the pull request.
- [x] Store and TestFlight publication prohibited for this local-only release.

Until every applicable gate is complete, distribute only the clearly labelled
Preview local test build to approved devices.
