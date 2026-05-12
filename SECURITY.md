# Security Policy — NetCLI:Learn

Last reviewed: 2026-04-18

## Reporting a vulnerability

If you believe you've found a security issue in NetCLI:Learn, please **do not open a public GitHub issue**. Email the details to:

**security@schjoldr.io** (or support@schjoldr.io if security address is unavailable)

Include:
- A description of the issue and its impact
- Steps to reproduce
- Affected version / APK build (if known)
- Your contact info if you'd like a reply

We aim to acknowledge within 5 business days and patch high-severity issues within 30 days. Coordinated disclosure is appreciated.

---

## Threat model

NetCLI:Learn is a client-side Android / PWA learning app that:
- Stores per-user settings, quiz progress and terminal history in Firestore
- Authenticates via Firebase Auth (email/password + Google OAuth)
- Ships a static HTML/JS/CSS bundle — no server-side code

**In scope:**
- Unauthorized access to another user's data (Firestore, Auth)
- XSS / HTML injection in user-controlled fields (config explainer, terminal, display name, search)
- Data exfiltration via malicious URLs (avatar URL, photoURL)
- Android app hardening (signing, backup, network)

**Out of scope:**
- Denial of service (client-side only — limited blast radius)
- Issues only exploitable with physical device access + root
- Third-party Firebase or Google infrastructure

---

## Implemented controls

### Authentication
- Firebase Auth (email/password + Google OAuth)
- Password reset via signed email link
- Re-authentication required for sensitive profile changes (email, password, account deletion) — enforced by Firebase SDK

### Authorization — Firestore rules
See `firestore.rules`. Summary:
- Every document under `users/{uid}` is readable/writable **only** by the authenticated user whose UID matches
- Top-level field whitelist: only `settings`, `progress`, `streak`, `terminal`, `createdAt`, `updatedAt`
- Bounds-checks on all numeric fields and array lengths to prevent abuse (fake streaks, giant payloads)
- All other collections are denied by default

**Deploy:**
```bash
firebase deploy --only firestore:rules
```
Or paste into Firebase Console → Firestore → Rules.

### XSS / HTML injection
- **`escapeHtml(str)`** helper available globally (`window.escapeHtml`) — escapes `& < > " '`
- **`safeUrl(url)`** helper rejects non-`http(s):` and non-image `data:` URLs before assigning to `img.src`
- User-pasted Cisco config in the Explainer: captured regex groups are escaped before being interpolated into descriptions
- Search input: escaped before echoing in "No results for..." message
- Terminal echo line: built with `createElement` + `textContent` — never `innerHTML` with user input
- `TERM_SCENARIOS`, `COMMANDS`, `GUIDES`, `TS_SCENARIOS`, `QUIZ_QS`, `AVATARS` are static source data — safe to interpolate
- Display name / email from Firebase are assigned via `textContent`, never `innerHTML`

**Rule for contributors:** when writing to `innerHTML`, assume **every** interpolated value is hostile unless it comes from a hard-coded constant in source. Use `escapeHtml()` or switch to `textContent` / `createElement`.

### API key / Firebase config
- `www/js/firebase-config.js` holds the Firebase web config. Per Firebase's design this is public, but:
  - API key **must** be restricted in Google Cloud Console → APIs & Services → Credentials:
    - HTTP referrers whitelist: production domain + `localhost` for dev
    - Android app restriction: SHA-1 fingerprint of the signing cert + package `no.cgarmann.ciscolearn`
  - Firebase Auth domain allow-list must only include production + localhost
  - **Without these restrictions the key can be abused to spam account creation** — verify before release.
- `firebase-config.js` is now in `.gitignore`. Copy `firebase-config.example.js` when setting up a new dev environment.
- **Action required:** the current key has been committed to git history. Once restrictions are in place the risk is bounded, but consider rotating the key if the repo is public.

### Android hardening
- APK signed with PKCS12 keystore (`ciscolearn.jks`), v2 + v3 signatures via `apksigner` (never distribute v1-only)
- Package name: `no.cgarmann.ciscolearn`
- `android:allowBackup="false"` — prevents `adb backup` from extracting user data
- `android:fullBackupContent="@xml/backup_rules"` + `android:dataExtractionRules="@xml/data_extraction_rules"` exclude all app data from cloud backup and device-to-device transfer
- `android:networkSecurityConfig="@xml/network_security_config"` + `android:usesCleartextTraffic="false"` — all HTTP traffic blocked; only HTTPS allowed

### Content Security Policy
- CSP meta tag in `index.html`, `login.html`, `landing.html`
- Scripts: self + `gstatic.com` (Firebase SDK) + `apis.google.com` (OAuth)
- Connects: Firebase/Firestore/Identity Toolkit endpoints only
- Frames: `*.firebaseapp.com` + `accounts.google.com` for Google OAuth popup
- `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`
- **Known limitation:** `'unsafe-inline'` is still permitted for scripts/styles because the app is a single-file bundle. Planned (Runde 3): migrate to external modules with nonces.

### Input validation
Enforced both client-side (for UX / fast feedback) **and** Firestore rules (for real security):
- **Display name:** 1–40 chars, `/^[\p{L}\p{N} '.\-_]+$/u` (letters, digits, spaces, and `- . _ '`)
- **Email:** max 254 chars, basic RFC-5322-ish regex (Firebase does full validation server-side)
- **Password (register / change):** min 8, max 128, must contain letters **and** at least one digit
- **Password (login):** max 256 chars (stops absurd payloads hitting Firebase)
- `maxlength` attributes on all `<input>` elements as the first line of defense

### Service worker
- Registration removed — there is no shipped `sw.js` in this build. The previous code referenced `/ciscolearn/sw.js` which never resolved, but the registration call itself is gone to avoid ever loading an untrusted worker.
- When a service worker is re-introduced it must be: (a) served from same origin, (b) scoped tightly, (c) audited for the cache-then-network / stale-while-revalidate patterns.

### Third-party SDK pinning
- Firebase SDK is pinned to **10.12.0** in every import (`auth.js`, `db.js`, inline `import()` calls). No `latest` references.
- CSP restricts SDK loads to `https://www.gstatic.com` only.
- **Known limitation:** dynamic `import()` cannot use Subresource Integrity (SRI) attributes. Options for the future: (a) bundle the SDK locally with esbuild, (b) migrate to `<script>` tags with SRI hashes, (c) wait for import map integrity to reach stable browsers.
- Version bumps require a manual review against Firebase release notes.

### Logging / PII
- No `console.log` of email, UID, tokens, or passwords anywhere in the client
- Error handlers log `e.code` only (e.g. `auth/wrong-password`), never the full error object which can include stack traces with session details
- Grep check: `rg "console\." www/` should return only generic error-code logs

### Keystore / signing
- Keystore file (`ciscolearn.jks`) is **not** committed
- Passwords are **not** stored in the repository or CI — kept in the developer's password manager
- Rotation plan: rotate alias password annually; keystore lifetime matches Google Play requirements (25+ years)

---

## Developer checklist (before every release)

- [ ] Run `firestore.rules` through the Firebase Rules Playground with a fake-UID test
- [ ] Verify Firebase API key restrictions in Cloud Console
- [ ] Grep for new `innerHTML =` — confirm each one is safe
- [ ] Confirm APK is signed with v2+v3 (`apksigner verify --verbose app.apk`)
- [ ] Bump version in `android/app/build.gradle` + `www/index.html` (if applicable)
- [ ] Sync `www/` → `android/app/src/main/assets/public/` via `npx cap sync` (PowerShell)
- [ ] No `console.log` of email / UID / tokens / passwords
- [ ] `git status` clean — no `.env`, no keystore, no API keys

---

## Data retention / GDPR

- User data is stored in Firestore under `users/{uid}`
- Account deletion (profile → Delete Account) removes the Firebase Auth record and all associated Firestore data
- Email address is the only PII collected by default; display name and avatar are user-supplied

Data Controller: **SCHJOLDR** — support@schjoldr.io

---

## Known limitations

- Firebase SDK is loaded from `gstatic.com` CDN without Subresource Integrity (SRI). Planned: bundle locally or add SRI hashes. (Runde 3)
- No rate-limiting beyond Firebase's defaults; malicious users could spam writes up to quota. Firestore rules bound payload sizes to limit damage.
- Terminal is a client-side simulation — there is no backend to attack. But all future network features must be reviewed.
