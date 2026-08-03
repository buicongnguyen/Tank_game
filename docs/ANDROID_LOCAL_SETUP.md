# Android Local Setup

## Project Layout

The Android app lives in the same repository as the web game:

```text
Tank_game/
  src/                 Phaser/Vite source shared by web and Android
  public/              Browser and game assets
  dist/                Web build output
  capacitor.config.ts  Capacitor native wrapper config
  android/             Native Android project
```

Do not duplicate the Phaser game into another folder. Build the web app, then sync the `dist/` bundle into Android.

## Installed Toolchain On This Machine

- JDK 21: `C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot`
- Android SDK: `C:\Users\n\AppData\Local\Android\Sdk`

The generated `android/local.properties` points Gradle at the local Android SDK and is intentionally ignored by Git. If command-line Gradle reports that `JAVA_HOME` is missing, set it to the JDK path above or run through Android Studio.

## Common Commands

Build the web app and sync it into Android:

```bash
npm run android:sync
```

Build a debug APK:

```bash
cd android
gradlew assembleDebug
```

The debug APK is created here:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Run on a connected Android phone:

```bash
npm run android:run
```

## Phone Setup

1. On the Android phone, enable Developer options.
2. Enable USB debugging.
3. Connect the phone by USB.
4. Accept the RSA debugging prompt on the phone.
5. Confirm the device is visible:

```bash
adb devices
```

Then run:

```bash
npm run android:run
```

## Emulator Setup

List available virtual devices:

```bash
emulator -list-avds
```

List devices Capacitor can deploy to:

```bash
npm run android:run -- --list
```

Install and open the app on a running emulator or connected phone:

```bash
npm run android:run
```

If you want to install the already-built APK manually:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell monkey -p com.tankgame.arcade -c android.intent.category.LAUNCHER 1
```

## GitHub APK Download

GitHub Pages deploys the browser version. Android APK builds are handled by:

```text
.github/workflows/android-apk.yml
```

On pushes to `main`, the workflow builds a debug APK and uploads it as a GitHub Actions artifact named:

```text
tank-game-debug-apk
```

For a public, shareable APK download link, create and push a tag that starts with `android-v`:

```bash
git tag android-v0.1.0
git push origin android-v0.1.0
```

That tag creates a prerelease on GitHub with this APK attached:

```text
tank-game-debug.apk
```

This debug APK is good for personal testing and phone install via "Install unknown apps". For production or wider public sharing, create a signed release APK or Android App Bundle with a private keystore stored in GitHub Actions secrets.

