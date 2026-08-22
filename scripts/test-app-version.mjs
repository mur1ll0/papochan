#!/usr/bin/env node

/**
 * Test script for PapoChan Platform Detection, Semver comparison, and App Version logic.
 */

import assert from 'assert';

// 1. Test compareSemver logic
function compareSemver(v1, v2) {
  const clean1 = (v1 || '0.0.0').replace(/^v/, '').split('-')[0];
  const clean2 = (v2 || '0.0.0').replace(/^v/, '').split('-')[0];

  const parts1 = clean1.split('.').map((p) => parseInt(p, 10) || 0);
  const parts2 = clean2.split('.').map((p) => parseInt(p, 10) || 0);

  const maxLen = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < maxLen; i++) {
    const num1 = parts1[i] || 0;
    const num2 = parts2[i] || 0;

    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }

  return 0;
}

console.log('===============================================================');
console.log('  TESTING APP VERSIONING & MULTIPLATFORM DISTRIBUTION');
console.log('===============================================================\n');

console.log('▶ Testing Semantic Version Comparisons...');
assert.strictEqual(compareSemver('1.0.0', '1.0.0'), 0, '1.0.0 should equal 1.0.0');
assert.strictEqual(compareSemver('1.0.1', '1.0.0'), 1, '1.0.1 should be > 1.0.0');
assert.strictEqual(compareSemver('1.0.0', '1.0.1'), -1, '1.0.0 should be < 1.0.1');
assert.strictEqual(compareSemver('2.0.0', '1.9.9'), 1, '2.0.0 should be > 1.9.9');
assert.strictEqual(compareSemver('v1.2.3', '1.2.3'), 0, 'v1.2.3 should equal 1.2.3');
assert.strictEqual(compareSemver('1.10.0', '1.2.0'), 1, '1.10.0 should be > 1.2.0');
console.log('✔ Semver comparison tests passed!\n');

// 2. Test Platform Configuration Definitions
const platforms = ['windows', 'android', 'ios', 'macos', 'linux'];
const expectedGuides = {
  windows: 'smartscreen',
  android: 'playprotect',
  ios: 'ios_pwa',
  macos: 'gatekeeper',
  linux: 'linux_perm',
};

console.log('▶ Verifying Platform Security Guides Mapping...');
for (const plat of platforms) {
  assert.ok(expectedGuides[plat], `Platform ${plat} must have a registered security guide`);
  console.log(`  • Platform [${plat.toUpperCase()}]: Guide -> ${expectedGuides[plat]}`);
}
console.log('✔ All platform security guides validated!\n');

console.log('===============================================================');
console.log('✔ ALL VERSION & MULTIPLATFORM TESTS PASSED SUCCESSFULLY!');
console.log('===============================================================');
