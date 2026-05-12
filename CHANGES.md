# cisco:learn — Endringslogg

---

## 2026-04-15 — APK-fixes (runde 2)

### Fix 1: Bunnsmenyen overlapper Android-systemikoner
**Fil:** `www/index.html`, `android/app/src/main/res/values/styles.xml`

**Problem:** Bunnnavigasjonen lå oppå Androids system-nav (home/back-ikoner).

**Endring CSS (`www/index.html` linje 222):**
```css
/* FØR */
padding-bottom: env(safe-area-inset-bottom);
/* ETTER */
padding-bottom: max(env(safe-area-inset-bottom), 34px);
```

**Endring CSS — page padding (`www/index.html` linje 236):**
```css
/* FØR */
.page { padding-bottom: calc(72px + env(safe-area-inset-bottom)); }
/* ETTER */
.page { padding-bottom: calc(56px + max(env(safe-area-inset-bottom), 34px) + 16px); }
```

**Endring Android (`styles.xml`):**
```xml
<!-- Lagt til i AppTheme.NoActionBar -->
<item name="android:navigationBarColor">@android:color/transparent</item>
<item name="android:statusBarColor">@android:color/transparent</item>
<item name="android:windowDrawsSystemBarBackgrounds">true</item>
```

---

### Fix 2: Kort/bokser for store på mobil
**Fil:** `www/index.html`

**Problem:** `card-grid` brukte `minmax(270px,1fr)` som skapte overflow på smal skjerm.

**Endring CSS (i `@media (max-width: 768px)`):**
```css
/* Lagt til */
.card-grid { grid-template-columns: 1fr; }
.answer-grid { grid-template-columns: 1fr 1fr; }
```

---

### Fix 3: Innhold skjult bak bunnmenyen
**Fil:** `www/index.html`

**Problem:** `.page` hadde ikke nok `padding-bottom` til å vise alt innhold over bunnmenyen.
Løst som del av Fix 1 (ny `padding-bottom`-formel på `.page`).

---

### Fix 4: Android back-gesture (sveip tilbake)
**Fil:** `www/index.html`

**Problem:** Back-gesture avsluttet appen i stedet for å gå tilbake til forrige side.

**Endring JS (`showPage`-funksjonen):**
```js
// Lagt til i showPage():
if(!fromPop) history.pushState({page: id}, '', '#'+id);

// Ny event listener:
window.addEventListener('popstate', e => {
  if(e.state && e.state.page) showPage(e.state.page, true);
});
```

---

### Fix 5: Login-flyt (option A)
**Fil:** `www/login.html`

**Problem:** Login-siden viste alltid skjemaet, selv om brukeren allerede var innlogget.

**Endring:** Spinner vises mens Firebase sjekker auth-state. Hvis bruker er logget inn → hopper direkte til `index.html`. Hvis ikke → viser login-skjema.

---

## Filer endret denne runden
| Fil | Hva |
|-----|-----|
| `www/index.html` | CSS safe-area, card-grid, pushState |
| `www/login.html` | Auth-spinner, hopp over login |
| `android/app/src/main/res/values/styles.xml` | Transparent nav/statusbar |
| `android/app/src/main/assets/public/index.html` | Kopi av www/index.html |
| `android/app/src/main/assets/public/login.html` | Kopi av www/login.html |
| `android/local.properties` | SDK-sti satt til `AppData\Local\Android\Sdk` |

---

## APK-bygg
- **Bygget:** 2026-04-15 ~14:40
- **Fil:** `android/app/build/outputs/apk/debug/app-debug.apk`
- **Verktøy:** `gradlew.bat assembleDebug` (PowerShell)
- **SDK:** `C:\Users\chris\AppData\Local\Android\Sdk`

---

## Kjente gjenstående problemer
- [ ] Innhold forsvinner på Command Library og hjemside (ikke fullt bekreftet løst)
- [ ] Meny-fix ikke testet på fysisk enhet ennå
- [ ] `cap sync` fungerer ikke via bash — filer kopieres manuelt til android assets
