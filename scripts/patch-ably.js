import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targets = [
  path.resolve(__dirname, '../node_modules/ably/build/ably.js'),
  path.resolve(__dirname, '../node_modules/ably/build/ably.min.js'),
  path.resolve(__dirname, '../node_modules/ably/build/modular/index.mjs'),
];

for (const targetPath of targets) {
  if (fs.existsSync(targetPath)) {
    let content = fs.readFileSync(targetPath, 'utf8');
    // Replace all variations of var __super = (...args) => { super(...args); };
    const newContent = content.replace(
      /var\s+__super\s*=\s*\(\.\.\.args\)\s*=>\s*\{[\s\r\n]*super\(\.\.\.args\);?[\s\r\n]*\};?/g,
      'super(typeof messageOrValues === "object" ? messageOrValues?.message : messageOrValues); var __super = () => {};'
    );
    if (newContent !== content) {
      fs.writeFileSync(targetPath, newContent, 'utf8');
      console.log(`[Patch] Successfully patched ${path.basename(targetPath)}`);
    }
  }
}
