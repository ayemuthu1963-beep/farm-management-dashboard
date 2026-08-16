# Mobile security and permissions summary

## Identity and secrets

- The apps use the existing Muthu Farms login page and server-side session.
- They do not contain a mobile user table, password cache, embedded username,
  API key, refresh token, service credential, keystore, or Apple certificate.
- Password submission remains an HTTPS form to `auth.muthufarms.com`.
- The opaque session cookie remains Secure and HttpOnly, so application
  JavaScript and the native download bridge cannot read it.
- Authorization remains an upstream gateway/backend decision for every request.
- Logout and session expiry remain server-controlled. An expired request follows
  the existing redirect back to login.

## Web security behavior

- Only HTTPS origins on the Muthu Farms allowlist can be configured.
- Cleartext Android traffic and mixed WebView content are disabled.
- The auth host is allowed in the same WebView to preserve the existing
  cookie-domain, SameSite, CSRF, and redirect behavior.
- No permissive mobile CORS rule or CSRF exception was added.
- Android backup and device-to-device transfer exclude app/WebView data.
- WebView content debugging is disabled in the Capacitor configuration.
- Native blob downloads are accepted only from a trusted current page, have a
  25 MiB decoded-size limit, use sanitized filenames, and never persist cookies
  or passwords.
- Ordinary Android downloads attach the WebView cookie only to the selected
  trusted HTTPS URL so authenticated server exports keep working.

## Android permissions

| Permission | Why it is needed | When it is used |
| --- | --- | --- |
| `INTERNET` | Load the Muthu Farms website, APIs, maps, and uploads | While the app is in use |
| `CAMERA` | Photograph a farm/field record from a website file input | Only after the user chooses camera capture and approves Android's prompt |
| `ACCESS_COARSE_LOCATION` | Android's fallback location access level | Only after a page requests location and the user approves |
| `ACCESS_FINE_LOCATION` | Capture precise GPS coordinates for a farm/field record | Only after a page requests precise location and the user approves |

Camera and GPS hardware are marked optional so users can still install the app
on devices without them. No broad storage permission is requested. The Android
system picker handles file/photo selection and MediaStore/DownloadManager handles
downloads.

## iOS usage messages

| Key | User-facing explanation |
| --- | --- |
| `NSCameraUsageDescription` | Muthu Farms uses the camera only when you choose to photograph and upload a farm or field record. |
| `NSLocationWhenInUseUsageDescription` | Muthu Farms uses your precise location only when you choose to capture GPS coordinates for a farm or field record. |
| `NSPhotoLibraryUsageDescription` | Muthu Farms accesses photos only when you choose an existing farm or field image to upload. |

There is no Always Location request, background location mode, microphone
permission, contacts permission, advertising identifier, push notification
entitlement, or unrestricted photo-library write permission in Version 1.

## Internet and offline behavior

Version 1 requires internet connectivity. The local fallback page explains that
records cannot be loaded or submitted while offline and does not queue a
submission. The pre-existing Worker Management offline implementation was not
expanded or altered by the mobile work.

## Signing and release secrets

Android signing reads only process environment variables. iOS CI reads only
protected GitHub secrets and imports them into a temporary macOS keychain. All
common keystore, certificate, provisioning profile, API key, APK, AAB, and IPA
files are ignored by Git. A final release audit must still inspect the Git diff
and generated package before distribution. The iOS workflow exports only an Ad
Hoc IPA whose embedded provisioning profile contains registered devices; it has
no TestFlight, App Store Connect, or store-upload operation. The Android release
key password is stored only as a Windows current-user DPAPI blob outside Git.
