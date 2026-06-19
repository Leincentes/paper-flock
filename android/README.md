# Paper Flock Android app

This project packages the verified Paper Flock web runtime as local Android
assets. It does not request Internet, advertising, account, location, camera,
microphone, contacts, or storage permissions.

## Build prerequisites

- Android Studio with Android SDK 36
- Android Gradle Plugin 8.13.2
- Gradle 8.13
- JDK 17
- Node.js 22 and npm 10 for the web verification/build

## Prepare web assets

From the repository root:

```bash
npm ci
npm run verify:production
npm run build
npm run android:sync
npm run verify:play-store
```

## Create an upload key once

Keep the keystore and passwords outside Git. The package name
`com.gamelostudio.paperflock` cannot be changed after the first Play release.

```bash
keytool -genkeypair -v   -keystore paper-flock-upload.jks   -alias paper-flock-upload   -keyalg RSA -keysize 4096 -validity 10000
```

## Build a signed AAB

```bash
export ANDROID_KEYSTORE_PATH=/absolute/path/paper-flock-upload.jks
export ANDROID_KEYSTORE_PASSWORD='...'
export ANDROID_KEY_ALIAS='paper-flock-upload'
export ANDROID_KEY_PASSWORD='...'

gradle -p android bundleRelease
```

Output:

`android/app/build/outputs/bundle/release/app-release.aab`

Never commit the keystore or passwords. Enroll in Play App Signing when the
first bundle is uploaded.
