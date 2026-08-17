// Chụp màn hình ở ĐÚNG kích thước thiết bị, qua DevTools Protocol.
//
// Vì sao không dùng `chrome --window-size ... --screenshot`: headless render ở
// viewport RỘNG HƠN cỡ yêu cầu rồi crop ảnh về đúng cỡ đó, nên bố cục nào ăn
// trọn bề rộng đều bị cắt oan. Emulation.setDeviceMetricsOverride thì chính xác.
//
//   node scripts/shot.mjs <url> <out.png> [width] [height] [dsf] [mobile] [waitMs]
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const [url, out, w = '390', h = '844', dsf = '2', mobile = '1', waitMs = '2500'] =
  process.argv.slice(2);
if (!url || !out) {
  console.error('usage: node scripts/shot.mjs <url> <out.png> [w] [h] [dsf] [mobile] [waitMs]');
  process.exit(1);
}

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find(Boolean);

const profile = resolve(tmpdir(), `ssj-shot-${process.pid}`);
const port = 9222 + (process.pid % 500);

const chrome = spawn(
  CHROME,
  [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--hide-scrollbars', '--mute-audio', `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`, 'about:blank',
  ],
  { stdio: 'ignore' },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForDevtools() {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (r.ok) return;
    } catch {
      /* chưa lên */
    }
    await sleep(100);
  }
  throw new Error('DevTools không lên');
}

function cdp(ws) {
  let id = 0;
  const pending = new Map();
  const events = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id != null && pending.has(msg.id)) {
      const { resolve: res, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : res(msg.result);
    } else if (msg.method && events.has(msg.method)) {
      events.get(msg.method).forEach((fn) => fn(msg.params));
      events.delete(msg.method);
    }
  });
  return {
    send: (method, params = {}) =>
      new Promise((res, reject) => {
        const mid = ++id;
        pending.set(mid, { resolve: res, reject });
        ws.send(JSON.stringify({ id: mid, method, params }));
      }),
    once: (method) =>
      new Promise((res) => {
        if (!events.has(method)) events.set(method, []);
        events.get(method).push(res);
      }),
  };
}

try {
  await waitForDevtools();
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res);
    ws.addEventListener('error', rej);
  });

  const c = cdp(ws);
  await c.send('Emulation.setDeviceMetricsOverride', {
    width: Number(w),
    height: Number(h),
    deviceScaleFactor: Number(dsf),
    mobile: mobile === '1',
    screenWidth: Number(w),
    screenHeight: Number(h),
  });
  if (mobile === '1') await c.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await c.send('Page.enable');
  const loaded = c.once('Page.loadEventFired');
  await c.send('Page.navigate', { url });
  await loaded;
  await sleep(Number(waitMs));

  const { data } = await c.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  mkdirSync(dirname(resolve(out)), { recursive: true });
  writeFileSync(resolve(out), Buffer.from(data, 'base64'));
  console.log(`${out}  ${w}x${h} @${dsf}x${mobile === '1' ? ' mobile' : ''}`);
  ws.close();
} finally {
  chrome.kill();
  await sleep(300);
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    /* kệ */
  }
}
