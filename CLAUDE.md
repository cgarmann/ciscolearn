# cisco:learn — CLAUDE.md

## What this is
Browser-based Cisco IOS / Packet Tracer learning PWA, packaged as Android and iOS apps via Capacitor.
Norwegian UI. Firebase auth. No build step — edit HTML/JS/CSS directly.

## Project layout
```
www/              ← source of truth (edit here)
  index.html      ← entire app: all pages, CSS, JS in one file
  login.html      ← Firebase auth flow
  landing.html    ← marketing/install page
  js/
    auth.js
    db.js
    firebase-config.js
android/app/src/main/assets/public/   ← manual copy of www/ for APK builds
```

## Key rules
- `www/` is source. Android assets are copies — sync manually after changes (`cap sync` is broken in bash; copy files by hand or run `npx cap sync` in PowerShell).
- No build pipeline. No bundler. No transpilation.
- One big `index.html` — all pages live in `<div class="page">` sections, toggled via `showPage()`.

## Android build
```powershell
# in PowerShell, not bash
cd C:\Users\chris\ciscolearn
npx cap sync          # or copy www/* to android assets manually
cd android
.\gradlew.bat assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```
SDK path: `C:\Users\chris\AppData\Local\Android\Sdk`

## iOS build (requires macOS + Xcode)
```bash
# On Mac, after git pull:
cd ~/ciscolearn
npm install --legacy-peer-deps
npx cap add ios          # first time only — generates ios/ folder
npx cap sync             # subsequent syncs
open ios/App/App.xcworkspace
# In Xcode: select device → Product → Run
```
Bundle ID: `no.cgarmann.ciscolearn`
Requires Apple Developer account for device deploy (free account works for personal device).

## Known issues (as of 2026-04-15)
- `cap sync` doesn't work from bash — use PowerShell or copy manually
- Bottom nav / safe-area fixes not yet tested on physical device
- Some content may disappear behind bottom nav on Command Library / home page

## Firebase
App ID: `no.cgarmann.ciscolearn`
Config lives in `www/js/firebase-config.js` — do not commit real keys.
