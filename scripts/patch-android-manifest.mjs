#!/usr/bin/env node
/**
 * Declares the camera and microphone permissions in the generated Android
 * project.
 *
 * The native project is not committed - CI runs `npx cap add android` on every
 * build - so the Capacitor template manifest comes back with INTERNET and
 * nothing else. Without CAMERA and RECORD_AUDIO declared, Capacitor's
 * WebChromeClient cannot grant the WebView's getUserMedia permission request:
 * the runtime request fails immediately and the page sees NotAllowedError, which
 * is why camera and microphone were dead in the Android app while working fine
 * in the mobile browser.
 *
 *   node scripts/patch-android-manifest.mjs [path/to/AndroidManifest.xml]
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

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
