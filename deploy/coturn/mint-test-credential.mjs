#!/usr/bin/env node
/**
 * Prints a TURN credential valid for the next hour, so you can paste it into
 * Trickle ICE and confirm the relay works before wiring it into the app.
 *
 *   node deploy/coturn/mint-test-credential.mjs <static-auth-secret> [identifier]
 */

import { createHmac } from 'node:crypto';

const [secret, identifier = 'smoke-test'] = process.argv.slice(2);

if (!secret) {
  console.error('Usage: node deploy/coturn/mint-test-credential.mjs <static-auth-secret> [identifier]');
  process.exit(1);
}

const expiresAt = Math.floor(Date.now() / 1000) + 3600;
const username = `${expiresAt}:${identifier}`;
const credential = createHmac('sha1', secret).update(username).digest('base64');

console.log(`username:   ${username}`);
console.log(`credential: ${credential}`);
console.log(`expires:    ${new Date(expiresAt * 1000).toISOString()}`);
console.log('');
console.log('Test at https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/');
console.log('Add your turn: URL with the pair above, then Gather candidates.');
console.log('A line of type "relay" means the relay works. Only host/srflx means it does not.');
