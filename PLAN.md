# NetCLI:Learn — Neste steg (lagret 2026-04-18)

Fortsetter herfra etter at usage limit er resetet. Rekkefølge bekreftes med bruker før koding starter.

## 1. Topbar-strek (light mode) — BUG FIX
`www/index.html`:
- `[data-theme=light] .topbar` endres fra `background:rgba(240,246,241,.97)` → `background:#f0f6f1` (helt opaque).
- Dark mode er allerede fikset (ikke rør).

## 2. Terminal-persistens (innlogget bruker)
**Hva lagres:**
- `history` — array, max 50 siste kommandoer
- `scenario` — id på sist valgte scenario

**Hvor:**
- Gjest → `localStorage` (`cl-term-history`, `cl-term-scenario`)
- Innlogget → Firestore `users/{uid}/terminal` via `www/js/db.js` (`saveTerminal` / `loadTerminal`), localStorage som cache/fallback

**Når:**
- Lagre etter hver `termSubmit()` (debounce 500 ms) og ved scenario-bytte
- Last ved `onAuth` + ved åpning av Terminal-siden
- Pil opp/ned fungerer på tvers av sesjoner

## 3. Topologi-rad over terminalen
- HTML-rad rett over `#termScreen`:
  `[💻 PC] ──── [🔀 Router] ──── [☁️ ISP]`
- Ren HTML/CSS (flex + border-lines), ingen SVG
- Klikk på Router → `termInput.focus()` + subtil glow på router-ikonet når terminal er aktiv
- Link-status:
  - Default: grønn linje
  - Etter `shutdown` på aktiv interface / scenario "link-down" → rød stiplet linje + rødt kryss-badge
- Oppdateres ved scenario-bytte og etter `no shutdown` / `shutdown`

## 4. Ny "Network Map"-side
- Drawer-item `ditem-netmap`, egen `#page-netmap`
- Viser alle enheter i aktivt scenario som kort:
  - Ikon, hostname, IP(er), interface-status (up/down farget)
  - Linjer mellom enheter (flex-layout, ikke canvas)
- Read-only i første runde — speiler scenario-data
- Klikk på enhet → hopp til Terminal med den enheten valgt (senere fase)

## Åpent spørsmål
Bruker ikke svart på: kjøre alt i rekkefølge 1→4, eller (1) først og så resten separat?
