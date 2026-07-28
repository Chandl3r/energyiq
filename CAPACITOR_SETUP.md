# EnergyIQ — Setup Capacitor (iOS + Android)

Guida completa, comandi nell'ordine esatto da eseguire da terminale **nella cartella del progetto**.

---

## 0. Prerequisiti

| Tool | Versione | Come verificare |
|------|----------|-----------------|
| Node.js | ≥ 18 | `node -v` |
| Xcode | ≥ 15 | Mac App Store |
| CocoaPods | qualsiasi | `pod --version` (se mancante: `sudo gem install cocoapods`) |
| Android Studio | ≥ Hedgehog | developer.android.com |

---

## 1. Installa Capacitor e i plugin

```bash
# Core Capacitor
npm install @capacitor/core @capacitor/cli

# Piattaforme native
npm install @capacitor/ios @capacitor/android

# Plugin usati dall'app
npm install @capacitor/browser @capacitor/app @capacitor/status-bar @capacitor/splash-screen
```

---

## 2. Copia i file in progetto

```bash
# Config principale (va alla root del progetto, accanto a package.json)
cp ~/Downloads/capacitor.config.ts ./capacitor.config.ts

# Utility OAuth nativa
cp ~/Downloads/authNative.js src/lib/authNative.js

# File aggiornati
cp ~/Downloads/Auth.jsx       src/components/Auth.jsx
cp ~/Downloads/main.jsx       src/main.jsx
```

---

## 3. Inizializza Capacitor

```bash
npx cap init
```

Quando chiede:
- **App Name**: `EnergyIQ`
- **App ID**: `com.energyiq.app`
- **Web asset directory**: `dist`

> Se `capacitor.config.ts` esiste già (l'hai copiato al passo 2) puoi saltare questo comando —
> Capacitor lo legge direttamente.

---

## 4. Build web + aggiungi piattaforme

```bash
# Build Vite
npm run build

# Aggiungi iOS e Android
npx cap add ios
npx cap add android
```

---

## 5. Sincronizza

```bash
npx cap sync
```

> Da ripetere **ogni volta** dopo `npm run build` per aggiornare le app native con il nuovo `dist/`.

---

## 6. Configura il Deep Link (URL Scheme)

Il deep link `energyiq://` permette all'app di ricevere il callback OAuth da Google.

### iOS — Xcode

1. Apri il progetto iOS: `npx cap open ios`
2. In Xcode → seleziona il target **App** → tab **Info**
3. Espandi **URL Types** → clicca **+**
4. Imposta:
   - **Identifier**: `com.energyiq.app`
   - **URL Schemes**: `energyiq`

### Android — AndroidManifest.xml

Apri `android/app/src/main/AndroidManifest.xml` e aggiungi dentro `<activity>`:

```xml
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="energyiq" />
</intent-filter>
```

---

## 7. Configura Supabase Dashboard

1. Vai su **supabase.com** → tuo progetto → **Authentication → URL Configuration**
2. In **Redirect URLs** aggiungi:
   ```
   energyiq://auth/callback
   ```
3. Salva.

---

## 8. Configura Google Cloud Console

1. Vai su **console.cloud.google.com** → tuo progetto → **APIs & Services → Credentials**
2. Clicca sul tuo OAuth 2.0 Client ID (quello che usi per Supabase)
3. In **Authorized redirect URIs** aggiungi:
   ```
   energyiq://auth/callback
   ```
4. Salva (propagazione ~5 minuti).

---

## 9. Lancia l'app

### iOS (simulatore)
```bash
npx cap open ios
# In Xcode: seleziona simulatore → ▶ Run
```

### iOS (dispositivo fisico)
- In Xcode → Signing & Capabilities → team Apple Developer
- Connetti iPhone via USB → seleziona device → ▶ Run

### Android (emulatore o dispositivo)
```bash
npx cap open android
# In Android Studio → Run (▶)
```

---

## 10. Workflow di sviluppo quotidiano

```bash
# Modifica il codice React → build → sync → riapri
npm run build
npx cap sync

# Oppure, per iterare veloce su web (stessa app):
npm run dev
```

---

## 11. Icone e Splash Screen

Per sostituire le icone default con il logo EnergyIQ:

```bash
# Installa il generatore automatico
npm install -D @capacitor/assets

# Crea queste immagini nella cartella assets/:
# assets/icon.png       → 1024x1024 px, sfondo #080808, fulmine amber centrato
# assets/splash.png     → 2732x2732 px, sfondo #080808, logo centrato
# assets/icon-foreground.png → per Android Adaptive Icon (foreground)
# assets/icon-background.png → sfondo solido #080808

# Genera tutte le dimensioni automaticamente
npx capacitor-assets generate
npx cap sync
```

---

## 12. Build per App Store / Play Store

### iOS — TestFlight
1. In Xcode: **Product → Archive**
2. **Distribute App → App Store Connect → Upload**
3. Su App Store Connect → TestFlight → invita tester

### Android — Google Play
```bash
# Build release APK / AAB
cd android
./gradlew bundleRelease
# Output: android/app/build/outputs/bundle/release/app-release.aab
```
Carica l'`.aab` su Google Play Console → Internal Testing.

---

## Riepilogo comandi frequenti

```bash
npm run build && npx cap sync   # build + sync (usare sempre insieme)
npx cap open ios                # apri in Xcode
npx cap open android            # apri in Android Studio
npx cap run ios                 # lancia direttamente su simulatore (senza aprire Xcode)
npx cap run android             # lancia direttamente su emulatore
```
