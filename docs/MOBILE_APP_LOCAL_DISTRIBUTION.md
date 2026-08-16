# Muthu Farms local-only mobile distribution

This release channel is limited to direct Preview builds. It does not publish to
Google Play, TestFlight, App Store Connect, or the Apple App Store. Production
remains blocked by the Capacitor configuration guard and requires separate owner
approval.

## Android

The signed artifact is an ordinary APK for direct installation. Verify it before
installation:

```powershell
apksigner verify --verbose --print-certs Muthu-Farms-Preview-1.0.0-release.apk
adb install -r Muthu-Farms-Preview-1.0.0-release.apk
```

Expected identity:

- package: `com.muthufarms.app`
- version: `1.0.0` (`versionCode=1`)
- certificate SHA-256:
  `5bd94927e052e01b215d01d7063c3e364b7fab4441ef4a13178c1070b91ca1b1`

The permanent release keystore and Windows current-user DPAPI secret blob are
kept outside Git with a restrictive ACL. Back up both files together to secure,
owner-controlled encrypted storage. Future updates must use this same key.

## iOS and iPadOS Ad Hoc requirements

Ad Hoc installation requires an active Apple Developer Program team. Before an
IPA can be signed, collect:

1. Apple Developer Team ID.
2. A device name and UDID for every approved Muthu Farms iPhone/iPad.
3. An Apple Distribution certificate exported as password-protected `.p12` with
   its private key.
4. An Ad Hoc provisioning profile for `com.muthufarms.app` that includes every
   approved device.

Do not commit or send these files in ordinary chat. Store the certificate,
password, profile, and Team ID as protected secrets in the GitHub environment
`mobile-ios-ad-hoc`, with an owner approval rule:

- `IOS_DISTRIBUTION_CERTIFICATE_BASE64`
- `IOS_CERTIFICATE_PASSWORD`
- `IOS_AD_HOC_PROVISIONING_PROFILE_BASE64`
- `APPLE_TEAM_ID`

Manually dispatch `Mobile iOS Preview` with `build_ad_hoc=true`. The job:

- validates Team ID, bundle ID, and that registered devices exist;
- imports the certificate into a temporary random-password keychain;
- archives `com.muthufarms.app` against Preview;
- exports using Xcode's registered-device distribution method;
- verifies the code signature and embedded provisioning profile;
- creates a private one-day workflow artifact;
- removes ephemeral certificate, profile, and keychain material;
- performs no store or TestFlight upload.

Download the IPA promptly, verify its SHA-256 against the workflow log, delete
the workflow artifact after transfer, and install only on a UDID included in the
embedded Ad Hoc profile. Physical-device Preview acceptance remains mandatory.
