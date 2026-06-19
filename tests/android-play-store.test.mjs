import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");

test("Android package is fixed and targets a current Play SDK", () => {
  const gradle = read("android/app/build.gradle.kts");
  assert.match(gradle, /applicationId = "com\.gamelostudio\.paperflock"/);
  assert.match(gradle, /targetSdk = 36/);
  assert.match(gradle, /versionCode = 10404/);
  assert.match(gradle, /versionName = "1\.4\.4"/);
});

test("Android release has no network or sensitive permissions", () => {
  const manifest = read("android/app/src/main/AndroidManifest.xml");
  assert.doesNotMatch(manifest, /android\.permission\.INTERNET/);
  assert.doesNotMatch(manifest, /ACCESS_(FINE|COARSE|BACKGROUND)_LOCATION/);
  assert.doesNotMatch(manifest, /CAMERA|RECORD_AUDIO|READ_CONTACTS/);
  assert.match(manifest, /android\.permission\.VIBRATE/);
});

test("Android wrapper serves packaged assets and blocks in-WebView external navigation", () => {
  const activity = read(
    "android/app/src/main/java/com/gamelostudio/paperflock/MainActivity.java"
  );
  assert.match(activity, /WebViewAssetLoader/);
  assert.match(activity, /appassets\.androidplatform\.net/);
  assert.match(activity, /PaperFlockAndroid\/1\.4\.4/);
  assert.match(activity, /openExternal\(uri\)/);
});

test("native document bridge supports backup export and restore", () => {
  const activity = read(
    "android/app/src/main/java/com/gamelostudio/paperflock/MainActivity.java"
  );
  assert.match(activity, /saveTextFile/);
  assert.match(activity, /ACTION_CREATE_DOCUMENT/);
  assert.match(activity, /ACTION_OPEN_DOCUMENT/);
  assert.match(read("src/settings-ui.js"), /PaperFlockAndroid\?\.saveTextFile/);
  assert.match(read("src/boot-guard.js"), /PaperFlockAndroid\?\.saveTextFile/);
});

test("Android wrapper skips browser service-worker registration", () => {
  const platform = read("src/app-platform-ui.js");
  assert.match(platform, /IS_ANDROID_WRAPPER/);
  assert.match(platform, /IS_ANDROID_WRAPPER \|\|/);
});

test("Level 11 recovery lesson is non-penalizing and persisted", () => {
  const experience = read("src/experience-core.js");
  const player = read("src/game-player-ui.js");
  assert.match(experience, /level11RecoveryExplained/);
  assert.match(
    experience,
    /More open paths are not always safer/
  );
  assert.match(player, /if \(!level11RecoveryLesson\) \{\s*state\.deadlocks \+= 1;/);
  assert.match(player, /recoveryLessonShown: level11RecoveryLesson/);
});
