# 📱 Omcha FBF432 — App Android (Capacitor)

Wrapper natif de l'app web. L'app reste 100 % offline : tous les assets
(HTML/JS/CSS, Tone.js local plus tard, samples) sont embarqués dans l'APK.

---

## 🚀 Obtenir un APK SANS rien installer (recommandé)

Le workflow GitHub Actions `.github/workflows/android.yml` build un **APK debug**
à chaque push sur `main`.

1. GitHub → onglet **Actions** → run **Build Android APK**
2. En bas, section **Artifacts** → télécharge **`omcha-fbf432-debug-apk`**
3. Transfère l'`app-debug.apk` sur ton téléphone et installe-le
   (autorise « sources inconnues »).

> APK **debug** = pour tester. Pour le Play Store il faut un APK/AAB **signé**
> (voir plus bas).

---

## 🛠️ Build en local (optionnel — nécessite Android Studio)

```bash
npm install
npm run build:web        # copie les assets → www/
npx cap add android      # génère le projet android/ (une fois)
npx cap sync android
npx cap open android     # ouvre Android Studio → Run
```

À chaque modif de l'app web : `npm run sync` puis relance depuis Android Studio.

---

## 🔊 Audio robuste (le cœur du passage natif)

- **keep-awake** (`@capacitor-community/keep-awake`) est déjà câblé : pendant le
  FLUX, l'app empêche la mise en veille CPU/écran → moins de throttle Doze →
  **moins de craquement Bluetooth**. (Actif uniquement dans l'APK ; ignoré sur web.)

### Phase 2 — Foreground service (écran éteint, longues sessions)
Pour l'audio qui continue écran verrouillé avec priorité CPU, ajouter un
foreground service. Étapes (après `npx cap add android`, projet `android/`) :

1. `android/app/src/main/AndroidManifest.xml` → ajouter :
   ```xml
   <uses-permission android:name="android.permission.WAKE_LOCK"/>
   <uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
   <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK"/>
   ```
2. Déclarer une `MediaSession` en JS pour réclamer l'audio focus natif.
3. (Option) plugin `@capacitor-community/background-mode` pour le service +
   notification persistante.

> On committe le dossier `android/` quand on passe en phase 2 (pour conserver
> ces réglages). En phase 1, la CI le régénère à chaque build.

---

## 🏪 Publier sur le Play Store

1. **Compte Google Play Developer** (25 € une fois).
2. Générer une **clé de signature** (garde-la précieusement) :
   ```bash
   keytool -genkey -v -keystore omcha.keystore -alias omcha \
     -keyalg RSA -keysize 2048 -validity 10000
   ```
3. Configurer la signature release dans `android/app/build.gradle`.
4. `cd android && ./gradlew bundleRelease` → `app-release.aab`
5. Upload l'`.aab` dans la Play Console → publier.

> La clé de signature ne doit JAMAIS être committée ni partagée. Pour signer en
> CI : la stocker en **GitHub Secret** (base64) et l'injecter au build release.

---

## Identité de l'app

| Champ   | Valeur            |
|---------|-------------------|
| appId   | `com.omcha.flux`  |
| appName | `Omcha FBF432`    |
| webDir  | `www`             |

(Modifiables dans `capacitor.config.json`.)
