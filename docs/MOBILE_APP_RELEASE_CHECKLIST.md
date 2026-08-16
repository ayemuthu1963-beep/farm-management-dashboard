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

## Android signing and Play preparation

- [ ] Google Play developer account owner confirms application ID
      `com.muthufarms.app` is permanently reserved.
- [ ] Play App Signing policy and a recoverably backed-up upload key are approved.
- [ ] Signing values are provided through a protected environment only.
- [ ] Signed release APK and AAB are built from the reviewed commit.
- [ ] `apksigner verify --verbose --print-certs` passes and the expected
      certificate fingerprint is recorded outside the repository.
- [ ] Release AAB is tested through Play internal testing.
- [ ] Store listing, privacy policy, data-safety answers, screenshots, support
      contact, and content rating are approved.

## iOS signing and TestFlight preparation

- [ ] Apple Developer/App Store Connect team owns `com.muthufarms.app`.
- [ ] Distribution certificate, App Store profile, and least-privilege App Store
      Connect API key are installed as protected environment secrets.
- [ ] GitHub `mobile-ios-signing` environment has a required owner reviewer.
- [ ] iOS simulator compile passes on Xcode 26.
- [ ] Signed archive validates and the expected team/bundle/entitlements are recorded.
- [ ] TestFlight upload is manually approved and processed successfully.
- [ ] TestFlight build completes the physical-iPhone matrix.
- [ ] App privacy answers, privacy policy, support URL, screenshots, age rating,
      export compliance, and review account/instructions are approved.

## Architecture and store-review gate

- [ ] Owner reviews Capacitor's warning that `server.url`/`allowNavigation` are
      not intended for production.
- [ ] Apple minimum-functionality review risk for a remote website wrapper is
      resolved with documented native value or an approved local-shell/API design.
- [ ] Google Play webview/content and minimum-functionality policy review is complete.
- [ ] Cookie, CSRF, SameSite, Origin, CORS, session refresh, logout, and expiry
      are reverified in the signed release candidates.
- [ ] Security review confirms backend role enforcement for every protected route.

## Explicit owner approvals

- [ ] Approval to point any release candidate at Production.
- [ ] Approval to make any Production deployment or backend/auth change.
- [ ] Approval to merge the pull request.
- [ ] Approval to upload to TestFlight or Play internal testing.
- [ ] Approval to submit to App Store review or Google Play review.
- [ ] Approval to publish either store release.

Until every applicable gate is complete, distribute only the clearly labelled
Preview debug/test build.
