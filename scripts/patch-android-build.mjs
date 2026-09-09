#!/usr/bin/env node
/**
 * Prepares the generated Android project: permissions, and the version the app
 * reports about itself.
 *
 * The native project is not committed - CI runs `npx cap add android` on every
 * build - so the Capacitor template manifest comes back with INTERNET and
 * nothing else. Without CAMERA and RECORD_AUDIO declared, Capacitor's
 * WebChromeClient cannot grant the WebView's getUserMedia permission request:
 * the runtime request fails immediately and the page sees NotAllowedError, which
 * is why camera and microphone were dead in the Android app while working fine
 * in the mobile browser.
 *
 * Capacitor also hardcodes versionName "1.0" in its template build.gradle and
 * nothing ever raised it, so every APK ever built reported 1.0 regardless of the
 * release it came from - which made the in-app update check compare against a
 * version that was never true.
 *
 *   node scripts/patch-android-build.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const DEFAULT_PATH = 'android/app/src/main/AndroidManifest.xml';

const PERMISSIONS = [
  'android.permission.CAMERA',
  'android.permission.RECORD_AUDIO',
  // Lets the WebRTC stack pick the speaker/earpiece route and manage the
  // voice-call audio stream instead of fighting the ringer volume.
  'android.permission.MODIFY_AUDIO_SETTINGS',
  'android.permission.INTERNET',
  'android.permission.ACCESS_NETWORK_STATE',
  // Keeps the connection alive while the screen is off during a call.
  'android.permission.WAKE_LOCK',
];

// Declared not-required so the app still installs on hardware missing them.
const FEATURES = ['android.hardware.camera', 'android.hardware.microphone'];

export function patchManifest(xml) {
  let out = xml;
  const additions = [];

  for (const name of PERMISSIONS) {
    if (!out.includes(`android:name="${name}"`)) {
      additions.push(`    <uses-permission android:name="${name}" />`);
    }
  }

  for (const name of FEATURES) {
    if (!out.includes(`<uses-feature android:name="${name}"`)) {
      additions.push(`    <uses-feature android:name="${name}" android:required="false" />`);
    }
  }

  if (!additions.length) return { xml: out, added: [] };

  const closing = out.lastIndexOf('</manifest>');
  if (closing === -1) {
    throw new Error('AndroidManifest.xml has no closing </manifest> tag');
  }

  out = `${out.slice(0, closing)}${additions.join('\n')}\n${out.slice(closing)}`;
  return { xml: out, added: additions };
}

const GRADLE_PATH = 'android/app/build.gradle';

/**
 * Android needs a monotonically increasing integer alongside the display name;
 * packing the semver keeps it ordered without a separate counter.
 */
export function versionCodeFrom(version) {
  const [major = 0, minor = 0, patch = 0] = version
    .replace(/^v/, '')
    .split('-')[0]
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  return major * 10000 + minor * 100 + patch;
}

export function patchGradle(gradle, version) {
  const code = versionCodeFrom(version);
  return gradle
    .replace(/versionCode\s+\d+/, `versionCode ${code}`)
    .replace(/versionName\s+"[^"]*"/, `versionName "${version}"`);
}

function applyGradleVersion() {
  if (!existsSync(GRADLE_PATH)) {
    console.warn(`[android] ${GRADLE_PATH} not found; version left at the template default.`);
    return;
  }
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  const patched = patchGradle(readFileSync(GRADLE_PATH, 'utf8'), pkg.version);
  writeFileSync(GRADLE_PATH, patched);
  console.log(`[android] versionName ${pkg.version}, versionCode ${versionCodeFrom(pkg.version)}.`);
}

function main() {
  const target = process.argv[2] || DEFAULT_PATH;

  if (!existsSync(target)) {
    console.error(`[android] Manifest not found at ${target}; run "npx cap add android" first.`);
    process.exit(1);
  }

  const { xml, added } = patchManifest(readFileSync(target, 'utf8'));

  if (!added.length) {
    console.log('[android] Manifest already declares camera and microphone access.');
  } else {
    writeFileSync(target, xml);
    console.log(`[android] Added ${added.length} declaration(s) to ${target}:`);
    added.forEach((line) => console.log(`  ${line.trim()}`));
  }

  applyGradleVersion();
}

// Only when run as a command, so the helpers above stay importable by tests.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
