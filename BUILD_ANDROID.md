# Sharel — Build Android APK (ARM64)

## Architecture

**Expo Bare Workflow** : Code natif Kotlin + Expo modules + Config plugins.

- **Plugins** : `withWifiDirect.js`, `withHotspotNative.js` (génèrent le code Kotlin natif)
- **Package** : `com.sharel.app` (défini dans `app.json`)
- **Modules natifs** : WifiDirect, Hotspot, FileExplorer, MediaGallery, Contacts, Apps, Storage, HttpServer, Logs
- **Target** : Android 13+ (minSdkVersion=26, targetSdkVersion=35)
- **Architecture** : arm64-v8a

---

## Build Local (Machine Dev)

### Prérequis

```bash
# Node.js 20+
node --version

# Java 17+
java -version

# Android SDK/NDK (install via Android Studio ou command-line tools)
export ANDROID_SDK_ROOT=$HOME/android-sdk

# Expo CLI
npm install -g expo-cli

# Install dependencies
npm ci
```

### Générer le projet Android natif

```bash
# Crée le dossier android/ avec la config Gradle
npx expo prebuild --clean --platform android
```

### Builder l'APK release (signé)

#### Option 1 : Build via Gradle (recommandé)

```bash
cd android
./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
```

#### Option 2 : Build via AAB + bundletool (Play Store compliant)

```bash
cd android
./gradlew bundleRelease
# AAB: android/app/build/outputs/bundle/release/app-release.aab

# Extraire APK arm64-v8a
cd ..
curl -L -o bundletool.jar https://github.com/google/bundletool/releases/download/1.15.6/bundletool-all-1.15.6.jar

cat > device-spec.json <<'EOF'
{
  "supportedAbis": ["arm64-v8a"],
  "sdkVersion": 33,
  "screenDensity": 420
}
EOF

java -jar bundletool.jar build-apks \
  --bundle=android/app/build/outputs/bundle/release/app-release.aab \
  --output=app-arm64.apks \
  --device-spec=device-spec.json

unzip app-arm64.apks -d apks_out
# APK: apks_out/standalone-arm64_v8a.apk (ou similaire)
```

### Signer l'APK (manuel)

Si vous avez une keystore :

```bash
ANDROID_SDK_ROOT=$HOME/android-sdk
ZIPALIGN="$ANDROID_SDK_ROOT/build-tools/35.0.0/zipalign"
APKSIGNER="$ANDROID_SDK_ROOT/build-tools/35.0.0/apksigner"

# Aligner
$ZIPALIGN -v -p 4 app-release.apk app-aligned.apk

# Signer
$APKSIGNER sign \
  --ks path/to/release.keystore \
  --ks-pass pass:YOUR_KEYSTORE_PASSWORD \
  --ks-key-alias YOUR_KEY_ALIAS \
  --key-pass pass:YOUR_KEY_PASSWORD \
  --out app-signed.apk app-aligned.apk
```

---

## Build Automatisé (GitHub Actions)

### Configuration des secrets (une seule fois)

1. Générez ou préparez votre keystore (ou laissez vide pour unsigned APK) :

```bash
keytool -genkey -v -keystore release.keystore -alias my-key-alias \
  -keyalg RSA -keysize 2048 -validity 10000
```

2. Encodez en base64 et sauvegardez comme secret :

```bash
base64 release.keystore > keystore.b64
```

3. Dans GitHub (Settings → Secrets and variables → Actions) :

   - `ANDROID_KEYSTORE_BASE64` : contenu du fichier `keystore.b64`
   - `ANDROID_KEYSTORE_PASSWORD` : mot de passe de la keystore
   - `ANDROID_KEY_ALIAS` : alias de la clé (ex: `my-key-alias`)
   - `ANDROID_KEY_PASSWORD` : mot de passe de la clé

### Trigger le build

**Manuelement** : Aller sur Actions → "Build Android arm64 APK" → Run workflow

**Automatiquement** : Push sur `main` (configurable)

**En release** : Tag un commit `v1.0.0` → crée une Release GitHub avec l'APK

### Output

- Artifact `sharel-arm64-apk` contient l'APK (signé ou non)
- Si tag de release → APK attaché à la Release GitHub

---

## Troubleshooting

### `compileReleaseKotlin failed`

→ Vérifiez que le package Kotlin = `com.sharel.app` dans tous les `.kt`

→ Vérifiez `app.json` : `android.package = "com.sharel.app"`

### `NativeModules.*Module undefined` (JS)

→ Vérifiez que `MainApplication.kt` contient `add(SharelPackage())`

→ Rebuild : `npx expo prebuild --clean --platform android`

### `AAB build OK, APK extraction fails`

→ Installez `bundletool` (voir commandes ci-dessus)

→ Vérifiez que `device-spec.json` est valide

### `Signing failed`

→ Si pas de secrets → APK restera unsigned (OK pour test)

→ Si secrets fournis → Vérifiez alias, password, format base64

---

## Architecture Details

### Expo Bare Setup

```
sharel/
├── app.json                          # Config Expo + Android package
├── plugins/
│   ├── withHotspotNative.js          # Génère Kotlin modules
│   └── withWifiDirect.js             # Permissions WiFi
├── android/                          # (généré par `expo prebuild`)
│   ├── app/
│   │   ├── src/main/AndroidManifest.xml
│   │   ├── src/main/java/com/sharel/app/
│   │   │   ├── HotspotModule.kt
│   │   │   ├── HttpServerModule.kt
│   │   │   ├── WifiDirectModule.kt
│   │   │   ├── FileExplorerModule.kt
│   │   │   ├── MediaGalleryModule.kt
│   │   │   ├── ContactsModule.kt
│   │   │   ├── AppsModule.kt
│   │   │   ├── StorageModule.kt
│   │   │   ├── LogModule.kt
│   │   │   ├── SharelPackage.kt
│   │   │   ├── MainApplication.kt    # (generated)
│   │   │   └── MainActivity.kt       # (generated)
│   │   └── build.gradle
│   └── build.gradle
└── .github/workflows/
    └── build-android-arm64.yml       # CI/CD
```

### Native Modules Bridge

```
JS (React Native)
        ↓
NativeModules.* (import from 'react-native')
        ↓
MainApplication.kt (loads SharelPackage)
        ↓
SharelPackage (ReactPackage, créé en Kotlin)
        ↓
[HotspotModule, HttpServerModule, ..., LogModule]
        ↓
Android APIs (WiFi, FileSystem, MediaStore, Contacts, etc.)
```

---

## Next Steps

1. **Local test** : `npx expo prebuild --platform android` → `cd android && ./gradlew assembleRelease`
2. **Setup secrets** : Configurez les secrets GitHub pour signing
3. **Push & release** : Merge to `main` ou créez un tag pour trigger le build
4. **Iterate** : Modifiez les plugins Kotlin, rebuildez avec `expo prebuild --clean`

---

**Clean build** (resetup natif) :

```bash
npx expo prebuild --clean --platform android
```

**Sync dependencies** :

```bash
npm ci
npx expo install
```

