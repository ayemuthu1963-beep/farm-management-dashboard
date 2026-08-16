# Muthu Farms mobile architecture and audit

Audit date: 2026-08-16

## Scope and repositories

The implementation branch is `agent/muthu-farms-mobile-preview`, based on the
frontend repository's `preview-release` commit
`ec763d202f215097d7ef354a09e02b1c1178e311`.

Read-only supporting audits covered:

- `ayemuthu1963-beep/farm-management-dashboard`: Next.js 16 App Router frontend
  and server-side API routes.
- `ayemuthu1963-beep/mfms-backend-live-baseline`: FastAPI service receiving
  signed gateway identity for protected administrative endpoints.
- `ayemuthu1963-beep/mfms-auth-source-preservation`: the authoritative
  self-hosted login, session, and gateway authorization source.

No backend, auth service, Preview deployment, Production deployment, or database
was changed by this branch.

## Existing website and PWA state

The application is not a site-wide PWA. Worker Management has its own manifest,
service worker, and an existing offline queue. The rest of the application is a
server-rendered Next.js system with server routes, authenticated requests, maps,
forms, downloads, and live data dependencies.

Version 1 does not introduce a second offline queue or general offline data
synchronisation. The existing Worker Management implementation is preserved,
but expansion of offline mutation is deliberately excluded because it could
duplicate or conflict with farm records.

## Authentication and authorization findings

The mobile projects do not implement login or store a user database. Navigation
to Preview follows the existing `303` gateway redirect to
`https://auth.muthufarms.com/login`, and the same website session is returned to
the WebView.

The audited gateway behavior is:

- Passwords are scrypt-hashed server-side (`N=2^17`, `r=8`, `p=1`).
- The browser receives an opaque `__Secure-mfms_session` cookie with
  `Domain=muthufarms.com`, `Path=/`, `Secure`, `HttpOnly`, and `SameSite=Lax`.
- Default expiry is 12 hours idle and 7 days absolute. Activity refreshes the
  server-side last-seen time; it does not expose a refresh token to JavaScript.
- Login uses a separate 15-minute `__Host-mfms_login_csrf` cookie with
  `Secure`, `HttpOnly`, and `SameSite=Strict`.
- POST routes validate Origin. Session-protected administrative POSTs also
  validate the session CSRF token.
- Logout revokes the server-side session and clears the shared-domain cookie.
- The gateway makes the authorization decision before forwarding a request and
  emits authenticated user, role, environment, and permission headers.
- Roles are `admin`, `manager`, `tester`, and `viewer`. Preview is Admin-only
  apart from the existing narrowly restricted Manager beetle-trap sync route;
  Manager write scope is Production, Tester write scope is Test, and Viewer is
  read-only only in assigned environments.

These controls remain backend/gateway controls. Nothing in the native project
attempts to grant a role or to substitute hidden UI for authorization.

## Capacitor decision

Capacitor is suitable for Preview development because it preserves one frontend
codebase and the exact same-origin website authentication flow while adding
native packaging, icons, splash screens, Android back behavior, permission
metadata, and download handling.

The current Next.js application cannot be safely reduced to a static local
`webDir`: it relies on server components, API routes, cookies, live maps, forms,
and runtime data. Version 1 therefore uses a remote HTTPS Preview origin inside
Capacitor. The configuration rejects cleartext HTTP, unapproved hosts, URL
credentials, ports, paths, query strings, and fragments.

Capacitor documents `server.url` and `allowNavigation` as live-reload features
that are not intended for production. Therefore this is an installable,
testable Preview build, not an assertion that the same remote-wrapper design is
already App Store-review-ready. Before store submission, the release owner must
approve either:

1. retaining the remote model with enough native value and completed store
   review evidence; or
2. a later architecture that packages more client code locally and introduces
   a security-reviewed mobile API/session exchange without changing identities,
   passwords, roles, or backend enforcement.

The branch does not make that irreversible release decision.

## Native behavior included

- Permanent Android application ID and iOS bundle ID: `com.muthufarms.app`.
- Existing 1024-by-1024 Muthu Farms logo reused for app icons and branded splash
  assets.
- Preview is the default and only CI target.
- Production origins require the explicit local build guard
  `ALLOW_PRODUCTION_MOBILE_TARGET=true`; documentation treats owner approval as
  an additional mandatory gate.
- Auth navigation stays inside the WebView so the domain cookie and CSRF flow
  are shared exactly as on the website.
- Android hardware Back navigates WebView history before closing the activity.
- iOS enables native back/forward swipe gestures.
- Standard HTTPS downloads carry the WebView cookie on Android.
- Blob and programmatic exports are handled only on trusted Muthu Farms pages,
  capped at 25 MiB, and transferred to native file-saving UI.
- Camera, system photo/file selection, and location remain user-initiated web
  capabilities with native permission declarations.
- Cleartext traffic, WebView debugging in packaged builds, and Android backup of
  WebView session data are disabled.

## External links and remaining review gate

The app permits in-WebView navigation only to the selected Muthu Farms origin
and `auth.muthufarms.com`. Other origins use Capacitor/WebView external-navigation
behavior and cannot call the injected download bridge. A signed-device test must
still confirm every external link used by the live site before release.
