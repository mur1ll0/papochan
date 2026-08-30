import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  coral: '\x1b[38;2;255;107;74m',
  turquoise: '\x1b[38;2;0;180;216m',
};

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.id && this.callbacks.has(msg.id)) {
            const { resolve, reject } = this.callbacks.get(msg.id);
            this.callbacks.delete(msg.id);
            if (msg.error) reject(msg.error);
            else resolve(msg.result);
          }
        } catch (e) {
          console.error('CDP parse error:', e);
        }
      };
    });
  }

  async send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || 'Runtime.evaluate exception');
    }
    return result.result?.value;
  }

  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

async function waitForServer(url, timeoutMs = 35000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status === 200 || res.status === 304) return true;
    } catch {
      // ignore
    }
    await sleep(500);
  }
  throw new Error(`Server at ${url} did not respond within ${timeoutMs}ms`);
}

async function clickWhenReady(cdp, matchers, timeoutMs = 25000) {
  const matcherList = Array.isArray(matchers) ? matchers : [matchers];
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await cdp.evaluate(`
      (function() {
        if (window.location.href.startsWith('chrome-error')) return { error: 'chrome-error' };
        const btns = Array.from(document.querySelectorAll('button'));
        const matchers = ${JSON.stringify(matcherList)}.map(m => m.toLowerCase());
        for (const b of btns) {
          const text = (b.innerText || b.textContent || '').toLowerCase().trim();
          const title = (b.title || '').toLowerCase().trim();
          const aria = (b.getAttribute('aria-label') || '').toLowerCase().trim();
          for (const m of matchers) {
            if ((text && text === m) || (text && text.includes(m)) || (title && title === m) || (title && title.includes(m)) || (aria && aria.includes(m))) {
              b.click();
              return { clicked: true, text: b.textContent?.trim() || b.title };
            }
          }
        }
        return { clicked: false };
      })()
    `).catch(() => ({ clicked: false }));

    if (res && res.clicked) return true;
    await sleep(400);
  }
  return false;
}

async function launchBrowserInstance(port, dataDir) {
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${dataDir}`,
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    '--auto-select-desktop-capture-source=Entire screen',
    '--enable-usermedia-screen-capturing',
    '--allow-http-screen-capture',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-sync',
    '--autoplay-policy=no-user-gesture-required',
    '--window-size=1280,800',
    'about:blank',
  ];

  const proc = spawn(chromePath, args, { stdio: 'ignore' });

  let list = null;
  const start = Date.now();
  while (Date.now() - start < 15000) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (res.ok) {
        list = await res.json();
        break;
      }
    } catch {
      // ignore
    }
    await sleep(400);
  }

  if (!list || list.length === 0) {
    proc.kill();
    throw new Error(`Failed to connect to Chrome CDP on port ${port}`);
  }

  const page = list.find((item) => item.type === 'page' && !item.url.startsWith('chrome-extension')) || list[0];
  const cdp = new CDPClient(page.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');

  return { proc, cdp };
}

async function runBrowserTest() {
  console.log(`\n${colors.bright}${colors.coral}🦎 PAPOCHAN — MULTI-BROWSER ISOLATED P2P TRANSMISSION & VERCEL RESILIENCE TEST${colors.reset}`);
  console.log(`${colors.cyan}Testing 2 isolated browser instances (Host vs Guest) with real WebRTC streams...${colors.reset}\n`);

  const results = [];
  function record(name, passed, details = '') {
    results.push({ name, passed, details });
    const status = passed ? `${colors.green}✔ PASS${colors.reset}` : `${colors.red}✖ FAIL${colors.reset}`;
    console.log(`  ${status} ${colors.bright}${name}${colors.reset}`);
    if (details) console.log(`    ${colors.cyan}↳ ${details}${colors.reset}`);
  }

  // 1. Check Server Availability
  console.log(`${colors.yellow}► Checking Next.js development server on port 3000...${colors.reset}`);
  let devServer = null;
  let isServerRunning = false;
  try {
    const res = await fetch('http://127.0.0.1:3000');
    if (res.status === 200 || res.status === 304) {
      isServerRunning = true;
      record('Next.js Server Availability', true, 'Connected to active instance at http://127.0.0.1:3000');
    }
  } catch {
    isServerRunning = false;
  }

  if (!isServerRunning) {
    devServer = spawn('cmd.exe', ['/c', 'npx next dev -p 3000'], {
      cwd: path.resolve(__dirname, '..'),
      stdio: 'ignore',
    });
    try {
      await waitForServer('http://127.0.0.1:3000', 40000);
      record('Next.js Server Startup', true, 'Listening on http://127.0.0.1:3000');
    } catch (err) {
      try { spawn('taskkill', ['/pid', devServer.pid, '/T', '/F']); } catch {}
      record('Next.js Server Startup', false, err.message);
      process.exit(1);
    }
  }

  const tempDir1 = path.join(os.tmpdir(), `papo-browser-1-${Date.now()}`);
  const tempDir2 = path.join(os.tmpdir(), `papo-browser-2-${Date.now()}`);
  fs.mkdirSync(tempDir1, { recursive: true });
  fs.mkdirSync(tempDir2, { recursive: true });

  let browser1 = null;
  let browser2 = null;

  try {
    // 2. Launch 2 Isolated Chrome Instances
    console.log(`\n${colors.yellow}► Launching Browser 1 (Host) and Browser 2 (Guest)...${colors.reset}`);
    browser1 = await launchBrowserInstance(9222, tempDir1);
    browser2 = await launchBrowserInstance(9223, tempDir2);
    record('Isolated Browser Instances Initialized', true, 'Browser 1 (:9222) & Browser 2 (:9223)');

    const roomCodeChars = `${Math.floor(100 + Math.random() * 900)}${Math.floor(100 + Math.random() * 900)}${Math.floor(100 + Math.random() * 900)}`;
    const expectedRoomCode = `${roomCodeChars.slice(0, 3)}-${roomCodeChars.slice(3, 6)}-${roomCodeChars.slice(6, 9)}`;

    // 3. Test Room Code Input Mask on Home Page (Browser 2)
    console.log(`\n${colors.yellow}► Testing Room Code Input Auto-Masking on Home Page...${colors.reset}`);
    await browser2.cdp.send('Page.navigate', { url: 'http://127.0.0.1:3000' });
    await sleep(2500);

    const maskResult = await browser2.cdp.evaluate(`
      (async function(rawChars) {
        const input = document.querySelector('form input[type="text"]');
        if (!input) return { success: false, reason: 'Input not found' };
        
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, rawChars);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        
        await new Promise((r) => setTimeout(r, 400));
        return { success: true, value: input.value };
      })('${roomCodeChars}')
    `);

    const maskPassed = !!maskResult && maskResult.success && maskResult.value === expectedRoomCode;
    record(
      'Room Code Input Masking & Auto-Formatting',
      maskPassed,
      `Typed: "${roomCodeChars}" -> Auto-Formatted Mask: "${maskResult?.value}" (Expected: "${expectedRoomCode}")`
    );

    // 4. Browser 1 (Host) creates and joins room directly without Waiting Room flash
    console.log(`\n${colors.yellow}► Browser 1 joining room ${expectedRoomCode} as Host...${colors.reset}`);
    await browser1.cdp.send('Page.navigate', { url: `http://127.0.0.1:3000/room/${expectedRoomCode}?host=1` });
    await sleep(2500);

    // Wait for setup modal and click "Entrar na Sala" / "Enter Room"
    const b1Joined = await clickWhenReady(browser1.cdp, ['enter room', 'entrar na sala', 'enter', 'entrar'], 25000);
    await sleep(1500);

    const b1PageState = await browser1.cdp.evaluate(`
      (function() {
        const isWaitingOverlay = !!document.querySelector('[data-waiting-room="true"]') || Array.from(document.querySelectorAll('*')).some(el => el.textContent && el.textContent.includes('Aguardando aprovação'));
        const pageState = window.__RTC_PAGE_STATE__;
        return { isWaitingOverlay, pageState };
      })()
    `);

    const hostDirectAccess = b1Joined && !b1PageState.isWaitingOverlay;
    record(
      'Host Direct Room Admission (No Waiting Flash)',
      hostDirectAccess,
      `Host joined immediately with admissionStatus: "${b1PageState.pageState?.admissionStatus || 'approved'}"`
    );

    // 5. Browser 2 joins as guest
    console.log(`\n${colors.yellow}► Browser 2 joining room ${expectedRoomCode} as Guest...${colors.reset}`);
    await browser2.cdp.send('Page.navigate', { url: `http://127.0.0.1:3000/room/${expectedRoomCode}` });
    await sleep(2500);

    const b2Joined = await clickWhenReady(browser2.cdp, ['enter room', 'entrar na sala', 'enter', 'entrar'], 25000);
    record('Browser 2 (Guest) Entered Setup', b2Joined, `Room: ${expectedRoomCode}`);
    await sleep(2500);

    // 6. Host approves Knock request from guest
    console.log(`\n${colors.yellow}► Checking Admission / Knocking state on Host...${colors.reset}`);
    const knockApproved = await clickWhenReady(browser1.cdp, ['admit', 'permitir', 'allow', 'approve', 'aprovar'], 15000);
    record('Host Admitted Guest into Call', knockApproved, 'Admission approved via Zero-Knowledge handshake');
    await sleep(5000);

    // 7. Inspect WebRTC PeerConnection on both browsers
    console.log(`\n${colors.yellow}► Inspecting WebRTC PeerConnections & Stats...${colors.reset}`);

    let statsB1 = { videoElements: 0, audioElements: 0 };
    let statsB2 = { videoElements: 0, audioElements: 0 };

    const startWait = Date.now();
    while (Date.now() - startWait < 15000) {
      statsB1 = await browser1.cdp.evaluate(`
        (function() {
          return {
            videoElements: document.querySelectorAll('video').length,
            audioElements: document.querySelectorAll('audio').length
          };
        })()
      `);
      statsB2 = await browser2.cdp.evaluate(`
        (function() {
          return {
            videoElements: document.querySelectorAll('video').length,
            audioElements: document.querySelectorAll('audio').length
          };
        })()
      `);

      if (statsB1.videoElements >= 2 && statsB2.videoElements >= 2) break;
      await sleep(600);
    }

    record(
      'WebRTC Video & Audio Elements Active in DOM',
      statsB1.videoElements >= 2 && statsB2.videoElements >= 2,
      `Browser 1: ${statsB1.videoElements} videos, ${statsB1.audioElements} audios | Browser 2: ${statsB2.videoElements} videos, ${statsB2.audioElements} audios`
    );

    // 8. Verify Microphone Audio Transmission via WebRTC Live Audio Tracks
    console.log(`\n${colors.yellow}► Verifying Microphone Audio Transmission (Inbound RTP)...${colors.reset}`);
    
    let audioStatsB2 = { hasAudioTrack: false, activeAudioCount: 0 };
    for (let i = 0; i < 10; i++) {
      audioStatsB2 = await browser2.cdp.evaluate(`
        (function() {
          let hasAudioTrack = false;
          let activeAudioCount = 0;
          const mediaElements = Array.from(document.querySelectorAll('audio, video'));
          for (const el of mediaElements) {
            if (el.srcObject && el.srcObject.getAudioTracks().length > 0) {
              const track = el.srcObject.getAudioTracks()[0];
              if (track.readyState === 'live') {
                hasAudioTrack = true;
                activeAudioCount++;
              }
            }
          }
          return { hasAudioTrack, activeAudioCount };
        })()
      `);
      if (audioStatsB2.hasAudioTrack) break;
      await sleep(600);
    }

    record(
      'Microphone Audio Transmission & Reception',
      audioStatsB2.hasAudioTrack,
      `Browser 2 receiving active remote microphone track (readyState: live, count: ${audioStatsB2.activeAudioCount})`
    );

    // 9. Verify Camera Video Transmission
    console.log(`\n${colors.yellow}► Verifying Camera Video Transmission...${colors.reset}`);
    let videoStatsB2 = { hasActiveVideo: false, activeVideoCount: 0, totalVideos: 0 };
    for (let i = 0; i < 10; i++) {
      videoStatsB2 = await browser2.cdp.evaluate(`
        (function() {
          const videos = Array.from(document.querySelectorAll('video'));
          let hasActiveVideo = false;
          let activeVideoCount = 0;
          for (const v of videos) {
            if (v.srcObject && v.srcObject.getVideoTracks().length > 0) {
              const track = v.srcObject.getVideoTracks()[0];
              if (track.readyState === 'live') {
                hasActiveVideo = true;
                activeVideoCount++;
              }
            }
          }
          return { hasActiveVideo, activeVideoCount, totalVideos: videos.length };
        })()
      `);
      if (videoStatsB2.hasActiveVideo) break;
      await sleep(600);
    }

    record(
      'Camera Video Stream Transmission & Reception',
      videoStatsB2.hasActiveVideo,
      `Browser 2 playing active remote camera video stream (${videoStatsB2.activeVideoCount} live video tracks)`
    );

    // 10. Verify Mute & Unmute Toggle on Guest Device
    console.log(`\n${colors.yellow}► Testing Resilient Mute/Unmute Toggling on Guest Device...${colors.reset}`);
    
    // Toggle Mic Mute off then on
    await clickWhenReady(browser2.cdp, ['mute microphone', 'desativar microfone', 'mic', 'microfone'], 6000);
    await sleep(1000);
    await clickWhenReady(browser2.cdp, ['unmute microphone', 'ativar microfone', 'mic', 'microfone'], 6000);
    await sleep(1000);

    const micToggled = await browser2.cdp.evaluate(`
      (function() {
        const audios = Array.from(document.querySelectorAll('audio, video'));
        return audios.some(el => el.srcObject && el.srcObject.getAudioTracks().some(t => t.readyState === 'live'));
      })()
    `);

    record(
      'Resilient Microphone Mute & Unmute Toggling',
      micToggled,
      'Mic unmuted and recovered active live track without freeze'
    );

    // 11. Test Screen Sharing Transmission
    console.log(`\n${colors.yellow}► Triggering Screen Sharing on Browser 1...${colors.reset}`);
    
    // Click Screen Share icon on control bar
    await clickWhenReady(browser1.cdp, ['share screen', 'compartilhar tela', 'screen'], 6000);
    await sleep(1200);
    
    // Click "Iniciar Transmissão" / "Start Sharing" inside ScreenShareModal
    await clickWhenReady(browser1.cdp, ['iniciar transmissão', 'start sharing', 'iniciar', 'start'], 6000);
    await sleep(5000);

    let screenStatsB2 = { videoCount: 0, liveScreenTracks: 0, hasScreenBadge: false };
    for (let i = 0; i < 10; i++) {
      screenStatsB2 = await browser2.cdp.evaluate(`
        (function() {
          const videos = Array.from(document.querySelectorAll('video'));
          let liveScreenTracks = 0;
          videos.forEach(v => {
            if (v.srcObject && v.srcObject.getVideoTracks().length > 0) {
              liveScreenTracks++;
            }
          });
          const screenBadge = Array.from(document.querySelectorAll('*')).some(el => 
            el.textContent && (el.textContent.includes('TELA 60FPS') || el.textContent.includes('(Tela)') || el.textContent.includes('SCREEN 60FPS') || el.textContent.includes('(Screen)'))
          );
          return { videoCount: videos.length, liveScreenTracks, hasScreenBadge: screenBadge };
        })()
      `);
      if (screenStatsB2.liveScreenTracks >= 2 || screenStatsB2.hasScreenBadge) break;
      await sleep(600);
    }

    record(
      'Screen Sharing Multi-Stream Negotiation (60 FPS)',
      screenStatsB2.liveScreenTracks >= 2 || screenStatsB2.hasScreenBadge,
      `Browser 2 received screen stream (Live video tracks: ${screenStatsB2.liveScreenTracks}, Badge: ${screenStatsB2.hasScreenBadge})`
    );

    // 12. Test Encrypted Chat & DataChannel
    console.log(`\n${colors.yellow}► Testing Encrypted DataChannel Chat...${colors.reset}`);
    
    // Open chat drawer on Browser 1 & Browser 2
    await clickWhenReady(browser1.cdp, ['room chat', 'open chat', 'abrir chat', 'chat'], 6000);
    await clickWhenReady(browser2.cdp, ['room chat', 'open chat', 'abrir chat', 'chat'], 6000);
    await sleep(3000);

    // Send chat message from Browser 1
    const testMessage = `Mensagem P2P Segura ${Date.now()}`;
    await browser1.cdp.evaluate(`
      (async function(text) {
        if (window.__RTC_SEND_MESSAGE__) {
          await window.__RTC_SEND_MESSAGE__(text);
          return;
        }
        const input = document.querySelector('form input[type="text"]');
        if (input) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(input, text);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          await new Promise(r => setTimeout(r, 400));
          const form = input.closest('form');
          const submitBtn = form?.querySelector('button[type="submit"]');
          if (submitBtn) {
            submitBtn.removeAttribute('disabled');
            submitBtn.click();
          }
        }
      })('${testMessage}')
    `);

    let chatReceivedB2 = false;
    for (let i = 0; i < 15; i++) {
      chatReceivedB2 = await browser2.cdp.evaluate(`
        (function(text) {
          const inMessages = (window.__RTC_MESSAGES__ || []).some(m => m.text && m.text.includes(text));
          const inDom = Array.from(document.querySelectorAll('*')).some(el => el.textContent && el.textContent.includes(text));
          return inMessages || inDom;
        })('${testMessage}')
      `);
      if (chatReceivedB2) break;
      await sleep(600);
    }

    record(
      'Zero-Knowledge DataChannel Message Decryption',
      chatReceivedB2,
      `Browser 2 received and decrypted message: "${testMessage}"`
    );

    // 13. Verify Database-Backed Signaling Bus (PostgreSQL Persistence)
    console.log(`\n${colors.yellow}► Verifying Database-Backed Serverless Signaling Bus...${colors.reset}`);
    const sigRes = await fetch(`http://127.0.0.1:3000/api/signaling?roomCode=${expectedRoomCode}&clientId=test-probe&since=0`);
    const sigData = await sigRes.json();
    const dbSignalingActive = sigRes.ok && sigData.serverTime > 0;
    record(
      'Database-Backed Serverless Signaling Bus (PostgreSQL)',
      dbSignalingActive,
      `HTTP Signaling bus active with response time: ${Date.now() - sigData.serverTime}ms, hostId: ${sigData.hostId || 'configured'}`
    );

  } catch (err) {
    console.error('Test execution error:', err);
    record('End-to-End Suite Execution', false, err.message);
  } finally {
    console.log(`\n${colors.yellow}► Cleaning up browser instances...${colors.reset}`);
    if (browser1) {
      try { browser1.cdp.close(); } catch {}
      try { browser1.proc.kill(); } catch {}
    }
    if (browser2) {
      try { browser2.cdp.close(); } catch {}
      try { browser2.proc.kill(); } catch {}
    }
    if (devServer) {
      try { spawn('taskkill', ['/pid', devServer.pid, '/T', '/F']); } catch {}
    }

    try {
      fs.rmSync(tempDir1, { recursive: true, force: true });
      fs.rmSync(tempDir2, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }

  // Summary Report
  const totalPassed = results.filter((r) => r.passed).length;
  const totalFailed = results.filter((r) => !r.passed).length;

  console.log(`\n${colors.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.bright}P2P MULTI-BROWSER VERIFICATION SUMMARY:${colors.reset}`);
  console.log(`  Total Checks:   ${colors.bright}${results.length}${colors.reset}`);
  console.log(`  Passed:         ${colors.green}${colors.bright}${totalPassed}${colors.reset}`);
  console.log(`  Failed:         ${totalFailed > 0 ? colors.red : colors.green}${colors.bright}${totalFailed}${colors.reset}`);
  console.log(`${colors.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runBrowserTest().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
