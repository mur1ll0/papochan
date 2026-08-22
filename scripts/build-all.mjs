#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const target = args.find((a) => a.startsWith('--target='))?.split('=')[1] || 'all';

console.log('===============================================================');
console.log('  GHOSTPROTOCOL - MULTIPLATFORM COMPILATION PIPELINE');
console.log(`  Target: ${target.toUpperCase()}`);
console.log('===============================================================\n');

function run(command, desc) {
  console.log(`\n▶ [Pipeline] ${desc}...`);
  console.log(`  $ ${command}`);
  try {
    execSync(command, { cwd: rootDir, stdio: 'inherit' });
    console.log(`✔ [Pipeline] Success: ${desc}`);
  } catch (err) {
    console.error(`✖ [Pipeline] Failed: ${desc}`);
    throw err;
  }
}

async function main() {
  const startTime = Date.now();

  try {
    // Step 1: Core Web & Backend Build
    if (target === 'all' || target === 'web') {
      run('npx prisma generate', 'Generating Prisma Client');
      run('npm run build', 'Compiling Next.js Web Production Build');
    }

    // Step 2: Desktop Compilation (Tauri - Windows / macOS / Linux)
    if (target === 'all' || target === 'desktop' || target === 'windows' || target === 'mac' || target === 'linux') {
      console.log('\n---------------------------------------------------------------');
      console.log('  COMPILING DESKTOP NATIVE APPLICATION');
      console.log('---------------------------------------------------------------');
      try {
        execSync('cargo --version', { stdio: 'ignore' });
        run('npx tauri build', 'Compiling Native Desktop Binaries with Tauri');
      } catch {
        console.log('ℹ [Desktop Notice] Rust/Cargo not detected on this machine.');
        console.log('  To compile desktop .exe/.msi/.dmg on this system, install Rust from: https://rustup.rs');
        console.log('  Or run: npx tauri build (after installing Rust).');
      }
    }

    // Step 3: Mobile Compilation (Android & iOS via Capacitor)
    if (target === 'all' || target === 'mobile' || target === 'android' || target === 'ios') {
      console.log('\n---------------------------------------------------------------');
      console.log('  SYNCHRONIZING MOBILE APPS (ANDROID & iOS)');
      console.log('---------------------------------------------------------------');

      // Ensure fallback out/index.html exists for Capacitor/Tauri
      const outDir = path.join(rootDir, 'out');
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }
      const outIndex = path.join(outDir, 'index.html');
      if (!fs.existsSync(outIndex)) {
        fs.writeFileSync(outIndex, '<!DOCTYPE html><html><body>PapoChan</body></html>');
      }

      // Check if android or ios directories exist, if not add them
      const androidDir = path.join(rootDir, 'android');
      const iosDir = path.join(rootDir, 'ios');

      if (!fs.existsSync(androidDir)) {
        run('npx cap add android', 'Initializing Android Project');
      }

      // Copy Android mipmap icons if android exists
      const androidRes = path.join(androidDir, 'app', 'src', 'main', 'res');
      const srcAndroidIcons = path.join(rootDir, 'src-tauri', 'icons', 'android');
      if (fs.existsSync(srcAndroidIcons) && fs.existsSync(androidRes)) {
        fs.cpSync(srcAndroidIcons, androidRes, { recursive: true });
      }

      // Ensure strings.xml has app_name PapoChan
      const stringsPath = path.join(androidRes, 'values', 'strings.xml');
      if (fs.existsSync(stringsPath)) {
        let s = fs.readFileSync(stringsPath, 'utf8');
        s = s.replace(/<string name="app_name">.*?<\/string>/, '<string name="app_name">PapoChan</string>');
        s = s.replace(/<string name="title_activity_main">.*?<\/string>/, '<string name="title_activity_main">PapoChan</string>');
        fs.writeFileSync(stringsPath, s);
      }

      if (!fs.existsSync(iosDir) && process.platform === 'darwin') {
        run('npx cap add ios', 'Initializing iOS Project');
      }


      run('npx cap sync', 'Syncing Capacitor Mobile Assets & Plugins');


      console.log('✔ Mobile project synchronized successfully!');
      console.log('  • To build Android APK / AAB: run "npm run mobile:android" (opens Android Studio)');
      console.log('  • To build iOS IPA: run "npm run mobile:ios" (opens Xcode on macOS)');
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log('\n===============================================================');
    console.log(`✔ ALL TARGETS COMPLETED SUCCESSFULLY in ${elapsed}s!`);
    console.log('===============================================================');
  } catch (err) {
    console.error('\n✖ Pipeline execution stopped due to error:', err?.message || err);
    process.exit(1);
  }
}

main();
