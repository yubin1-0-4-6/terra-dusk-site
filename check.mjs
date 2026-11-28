#!/usr/bin/env node
/*
  暮土 · Terra Dusk — repeatable smoke test.
  Serves this folder, drives a headless Chrome over the DevTools protocol and
  asserts the pieces that break quietly: the WebGL globe, the tag filter, the
  reading progress bar, the Kunming pin and its recentre behaviour, plus the
  degraded path when the browser has no WebGL at all.

  Usage:  node check.mjs [--verbose]
  Needs:  Node 22+ (for the global WebSocket) and a local Chrome/Chromium
          (set CHROME=/path/to/binary).
  No npm packages, no running server: it starts its own on a random port.
*/
import http from 'node:http';
import { createReadStream, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const VERBOSE = process.argv.includes('--verbose');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

/* ------------------------------------------------------------------ server */
function serve() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, {
      'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

/* ----------------------------------------------------------------- browser */
const CANDIDATES = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

async function launchBrowser(extraArgs = []) {
  const binary = CANDIDATES.find((p) => existsSync(p));
  if (!binary) throw new Error('Chrome not found — set CHROME=/path/to/chrome');
  const profile = mkdtempSync(path.join(tmpdir(), 'terra-check-'));
  const child = spawn(
    binary,
    [
      '--headless=new',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      // GitHub Actions 的 runner 里 Chrome 起不来除非关掉 sandbox
      ...(process.env.CI ? ['--no-sandbox'] : []),
      ...extraArgs,
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  const portFile = path.join(profile, 'DevToolsActivePort');
  let port = 0;
  for (let i = 0; i < 100 && !port; i++) {
    await sleep(100);
    if (existsSync(portFile)) {
      const [first] = readFileSync(portFile, 'utf8').split('\n');
      port = Number(first);
    }
  }
  if (!port) throw new Error('Chrome did not open a debugging port');

  let target;
  for (let i = 0; i < 50 && !target; i++) {
    await sleep(100);
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find((t) => t.type === 'page');
    } catch {
      /* still starting */
    }
  }
  if (!target) throw new Error('Chrome exposed no page target');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });

  let id = 0;
  const pending = new Map();
  const consoleErrors = [];
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
      return;
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
    }
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      consoleErrors.push(msg.params.entry.text);
    }
  });

  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const n = ++id;
      pending.set(n, resolve);
      ws.send(JSON.stringify({ id: n, method, params }));
    });

  const evaluate = async (expression) => {
    const out = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (out.result?.exceptionDetails) {
      throw new Error(out.result.exceptionDetails.exception?.description || 'evaluate failed');
    }
    return out.result?.result?.value;
  };

  const close = async () => {
    try {
      ws.close();
    } catch {
      /* already gone */
    }
    child.kill();
    await new Promise((resolve) => {
      if (child.exitCode !== null) return resolve();
      child.once('exit', resolve);
      setTimeout(resolve, 3000);
    });
    await sleep(400);
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 });
    } catch {
      /* a locked crashpad file is harmless: it lives in the temp folder */
    }
  };

  return { send, evaluate, close, consoleErrors };
}

/* ------------------------------------------------------------------ runner */
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  if (VERBOSE || !ok) console.log(`${ok ? '✓' : '✗'} ${name}${detail ? '  — ' + detail : ''}`);
};

const { server, port } = await serve();
const base = `http://127.0.0.1:${port}`;
const browser = await launchBrowser();
const { send, evaluate, close, consoleErrors } = browser;

const viewport = (width, height) =>
  send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });

const goto = async (route, { width = 1440, height = 900, ready = '' } = {}) => {
  await viewport(width, height);
  await send('Page.navigate', { url: base + route });
  for (let i = 0; i < 120; i++) {
    await sleep(100);
    if (await evaluate(`document.readyState === 'complete' && ${ready || 'true'}`).catch(() => false)) {
      await sleep(600);
      return;
    }
  }
  throw new Error(`page not ready: ${route}`);
};

const pinState = () =>
  evaluate(`(() => {
    const pin = document.querySelector('.hero__pin');
    if (!pin) return null;
    const r = pin.getBoundingClientRect();
    const c = document.querySelector('#globe').getBoundingClientRect();
    return {
      x: r.left + r.width / 2, y: r.top + r.height / 2,
      opacity: Number(getComputedStyle(pin).opacity),
      pointer: getComputedStyle(pin).pointerEvents,
      label: Number(getComputedStyle(pin.querySelector('.hero__pin__label')).opacity),
      canvas: { x: c.left, y: c.top, w: c.width, h: c.height },
    };
  })()`);

const mouse = (type, x, y, extra = {}) =>
  send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: 1, ...extra });

async function drag(x1, y1, dx, steps = 24) {
  await mouse('mouseMoved', x1, y1);
  await mouse('mousePressed', x1, y1, { buttons: 1 });
  for (let i = 1; i <= steps; i++) {
    await mouse('mouseMoved', x1 + (dx * i) / steps, y1, { buttons: 1 });
    await sleep(16);
  }
  await mouse('mouseReleased', x1 + dx, y1, { buttons: 0 });
  await sleep(1400); // let the fling die down
}

try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['https://fonts.googleapis.com/*', 'https://fonts.gstatic.com/*'] });

  /* ---------- the globe and the pin ---------- */
  await goto('/index.html?check=1', { ready: "!!document.querySelector('#globe.is-ready')" });

  const globe = await evaluate(`(() => {
    const c = document.querySelector('#globe');
    const gl = c.getContext('webgl');
    return { ready: c.classList.contains('is-ready'), failed: c.classList.contains('is-failed'),
             lost: gl ? gl.isContextLost() : 'n/a', size: c.width + 'x' + c.height };
  })()`);
  check('globe initialises', globe.ready && !globe.failed && globe.lost !== true, globe.size);
  check('globe keeps its context', globe.lost === false);

  const first = await pinState();
  const inside =
    first &&
    Math.abs(first.x - (first.canvas.x + first.canvas.w / 2)) < first.canvas.w * 0.25 &&
    Math.abs(first.y - (first.canvas.y + first.canvas.h / 2)) < first.canvas.h * 0.45;
  check('Kunming pin sits on the disc', Boolean(inside), first && `at ${Math.round(first.x)},${Math.round(first.y)}`);

  await mouse('mouseMoved', first.x, first.y);
  await sleep(500);
  const hovered = await pinState();
  check('hover reveals the place name', hovered.label === 1, `label opacity ${hovered.label}`);

  await mouse('mouseMoved', first.canvas.x + first.canvas.w * 0.7, first.canvas.y + first.canvas.h * 0.8);
  await sleep(300);

  /* drag a little: the pin must ride the surface */
  await drag(first.canvas.x + first.canvas.w * 0.6, first.canvas.y + first.canvas.h * 0.55, 140);
  const dragged = await pinState();
  check('pin follows the rotation', dragged.opacity > 0.9 && Math.abs(dragged.x - first.x) > 10,
    `${Math.round(first.x)} → ${Math.round(dragged.x)}`);

  /* click it: the meridian eases back to the middle and stays there */
  await mouse('mouseMoved', dragged.x, dragged.y);
  await sleep(200);
  await mouse('mousePressed', dragged.x, dragged.y, { buttons: 1 });
  await mouse('mouseReleased', dragged.x, dragged.y, { buttons: 0 });
  /* 慢机器上缓动走得更久：先等它真的停下来，再量剩下的漂移 */
  for (let i = 0; i < 100; i++) {
    const before = await pinState();
    await sleep(100);
    if (Math.abs((await pinState()).x - before.x) < 0.5) break;
  }
  const centred = await pinState();
  await sleep(600);
  const settled = await pinState();
  const drift = Math.abs(centred.x - settled.x);
  check('click recentres Yunnan', Math.abs(settled.x - first.x) < 2.5, `${Math.round(settled.x)} vs ${Math.round(first.x)}`);
  check('recentring stops', drift < 0.75, `drift ${drift.toFixed(2)}px`);

  /* drag far: the pin turns away and stops taking pointer events */
  await drag(first.canvas.x + first.canvas.w * 0.5, first.canvas.y + first.canvas.h * 0.5, -620, 30);
  const back = await pinState();
  check('pin hides on the far side', back.opacity < 0.02 && back.pointer === 'none',
    `opacity ${back.opacity.toFixed(2)}, pointer ${back.pointer}`);

  /* ---------- tag filter ---------- */
  /* the expectations come from the page itself: adding a fifth post never breaks this */
  const expected = await evaluate(`(() => {
    const posts = [...document.querySelectorAll('.post[data-tag]')];
    const byTag = {};
    for (const post of posts) byTag[post.dataset.tag] = (byTag[post.dataset.tag] || 0) + 1;
    const chips = [...document.querySelectorAll('[data-filter]')]
      .map((b) => b.dataset.filter)
      .filter((tag) => tag !== 'all');
    return { total: posts.length, byTag, chips };
  })()`);
  const filtered = await evaluate(`(async () => {
    const visible = () => document.querySelectorAll('.post:not([hidden])').length;
    const out = {};
    for (const chip of document.querySelectorAll('[data-filter]')) {
      chip.click();
      await new Promise((r) => setTimeout(r, 200));
      out[chip.dataset.filter] = visible();
    }
    return out;
  })()`);
  check('every tag chip matches a tag in use', expected.chips.length > 0 &&
    expected.chips.every((tag) => expected.byTag[tag] > 0),
    `chips ${expected.chips.join('/')} vs tags ${Object.keys(expected.byTag).join('/')}`);
  check('tag filter narrows each tag and restores', filtered.all === expected.total &&
    expected.chips.every((tag) => filtered[tag] === expected.byTag[tag]),
    `${expected.total} → ${JSON.stringify(expected.byTag)} / got ${JSON.stringify(filtered)}`);

  /* ---------- reading progress ---------- */
  await goto('/posts/terra-dusk.html?check=1');
  const progress = await evaluate(`(async () => {
    const bar = document.querySelector('.progress span');
    const read = () => {
      const m = bar.style.transform.match(/scaleX\\(([\\d.]+)\\)/);
      return m ? Number(m[1]) : 0;
    };
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 300));
    const top = read();
    window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * 0.6);
    await new Promise((r) => setTimeout(r, 400));
    return { top, mid: read() };
  })()`);
  check('reading progress tracks scroll', progress.top < 0.02 && progress.mid > 0.5 && progress.mid < 0.75,
    `${progress.top.toFixed(2)} → ${progress.mid.toFixed(2)}`);

  /* ---------- mobile ---------- */
  await goto('/index.html?check=mobile', { width: 390, height: 844, ready: "!!document.querySelector('#globe.is-ready')" });
  const mobile = await evaluate(`(() => {
    const c = document.querySelector('#globe');
    const pin = document.querySelector('.hero__pin');
    const r = pin.getBoundingClientRect();
    return {
      ready: c.classList.contains('is-ready'),
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      pinOpacity: Number(getComputedStyle(pin).opacity),
      pinInView: r.top > 0 && r.bottom < innerHeight,
      toggle: getComputedStyle(document.querySelector('.nav__toggle')).display,
    };
  })()`);
  check('mobile renders the globe', mobile.ready && mobile.pinOpacity > 0.9, `overflow ${mobile.overflow}`);
  check('mobile keeps the layout inside the viewport', mobile.overflow === 0);
  check('mobile shows the menu button', mobile.toggle === 'flex', mobile.toggle);

  /* ---------- degraded path: no WebGL at all ---------- */
  const degraded = await launchBrowser(['--disable-webgl']);
  try {
    const dsend = degraded.send;
    await dsend('Page.enable');
    await dsend('Runtime.enable');
    await dsend('Log.enable');
    await dsend('Network.enable');
    await dsend('Network.setBlockedURLs', {
      urls: ['https://fonts.googleapis.com/*', 'https://fonts.gstatic.com/*'],
    });
    await dsend('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await dsend('Page.navigate', { url: base + '/index.html?check=no-webgl' });

    let state = null;
    for (let i = 0; i < 120; i++) {
      await sleep(100);
      state = await degraded
        .evaluate(`(() => {
          const c = document.querySelector('#globe');
          if (!c) return null;
          const fb = document.querySelector('.hero__fallback');
          const pin = document.querySelector('.hero__pin');
          const box = fb && fb.getBoundingClientRect();
          return {
            loaded: document.readyState === 'complete',
            ready: c.classList.contains('is-ready'),
            failed: c.classList.contains('is-failed'),
            fallback: fb ? { opacity: Number(getComputedStyle(fb).opacity), w: box.width, h: box.height } : null,
            pin: pin ? Number(getComputedStyle(pin).opacity) : null,
            pinPointer: pin ? getComputedStyle(pin).pointerEvents : null,
          };
        })()`)
        .catch(() => null);
      if (state && state.loaded && state.failed) break;
    }

    check('no WebGL: the globe reports failure', Boolean(state?.failed) && state?.ready === false);
    check(
      'no WebGL: static placeholder takes over',
      state?.fallback?.opacity > 0.8 && state.fallback.w > 40,
      state?.fallback && `opacity ${state.fallback.opacity}, ${Math.round(state.fallback.w)}px wide`
    );
    check(
      'no WebGL: the pin stays hidden',
      state?.pin === 0 && state.pinPointer === 'none',
      state && `opacity ${state.pin}, pointer ${state.pinPointer}`
    );
    check('no WebGL: no console errors', degraded.consoleErrors.length === 0, degraded.consoleErrors.slice(0, 2).join(' | '));
  } finally {
    await degraded.close();
  }

  /* ---------- the pages agree with each other ---------- */
  /* Everything below is offline: it reads the files the browser never has to see. */
  const readPage = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');
  const flat = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const postFiles = readdirSync(path.join(ROOT, 'posts')).filter((f) => f.endsWith('.html')).sort();
  const home = readPage('index.html');

  const entries = [...home.matchAll(/<a class="post__link" href="posts\/([^"]+)">([\s\S]*?)<\/a>/g)].map(
    ([, file, body]) => ({
      file,
      title: flat(/<h3 class="post__title">([\s\S]*?)<\/h3>/.exec(body)?.[1] || ''),
      date: /post__meta">([\d.]+)/.exec(body)?.[1],
      tag: /<b>([^<]+)<\/b>/.exec(body)?.[1],
      minutes: /·\s*(\d+)\s*分钟/.exec(body)?.[1],
    })
  );

  const page = (file) => {
    const html = readPage(`posts/${file}`);
    return {
      h1: flat(/<h1>([\s\S]*?)<\/h1>/.exec(html)?.[1] || ''),
      eyebrow: flat(/<p class="eyebrow">([\s\S]*?)<\/p>/.exec(html)?.[1] || ''),
      minutes: /(\d+)\s*分钟阅读/.exec(html)?.[1],
      pager: [...html.matchAll(/<a[^>]*href="([\w-]+\.html)"[^>]*>\s*<span>[^<]*<\/span>\s*<strong>([\s\S]*?)<\/strong>/g)].map(
        ([, href, label]) => ({ href, label: flat(label) })
      ),
    };
  };

  check('the index lists every post', entries.length === postFiles.length,
    `${entries.length} listed / ${postFiles.length} in posts/`);
  const orphans = postFiles.filter((f) => !entries.some((e) => e.file === f));
  check('no post is missing from the index', orphans.length === 0, orphans.join(', '));
  check('the index links to real files', entries.every((e) => existsSync(path.join(ROOT, 'posts', e.file))),
    entries.map((e) => e.file).join(', '));

  const metaDrift = [];
  for (const entry of entries.filter((e) => existsSync(path.join(ROOT, 'posts', e.file)))) {
    const p = page(entry.file);
    if (p.h1 !== entry.title) metaDrift.push(`${entry.file}: 索引「${entry.title}」≠ 正文「${p.h1}」`);
    if (!p.eyebrow.includes(entry.date)) metaDrift.push(`${entry.file}: 索引日期 ${entry.date} ≠ 页眉「${p.eyebrow}」`);
    if (!p.eyebrow.includes(entry.tag)) metaDrift.push(`${entry.file}: 索引标签 ${entry.tag} ≠ 页眉「${p.eyebrow}」`);
    if (p.minutes !== entry.minutes) metaDrift.push(`${entry.file}: 索引 ${entry.minutes} 分钟 ≠ 正文 ${p.minutes} 分钟`);
  }
  check('index metadata matches the articles', metaDrift.length === 0, metaDrift.slice(0, 3).join(' | '));

  const pagerDrift = [];
  for (const file of postFiles) {
    for (const link of page(file).pager) {
      if (!postFiles.includes(link.href)) {
        pagerDrift.push(`${file}: 断链 ${link.href}`);
        continue;
      }
      const target = page(link.href).h1;
      if (target !== link.label) pagerDrift.push(`${file}: 「${link.label}」≠ ${link.href}「${target}」`);
    }
  }
  check('上一页 / 下一页 point at the right titles', pagerDrift.length === 0, pagerDrift.slice(0, 3).join(' | '));

  /* every local href/src must resolve, so a renamed page can never rot quietly */
  const broken = [];
  for (const file of ['index.html', 'about.html', '404.html', ...postFiles.map((f) => `posts/${f}`)]) {
    if (!existsSync(path.join(ROOT, file))) {
      broken.push(`${file}: 文件不存在`);
      continue;
    }
    const dir = path.posix.dirname(file);
    for (const [, ref] of readPage(file).matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (/^(?:https?:|mailto:|data:|javascript:|\/\/|#)/.test(ref)) continue;
      const target = ref.split(/[?#]/)[0];
      if (!target || !existsSync(path.join(ROOT, path.posix.normalize(path.posix.join(dir, target))))) {
        broken.push(`${file} → ${ref}`);
      }
    }
  }
  check('no broken local links or assets', broken.length === 0, broken.slice(0, 4).join(' | '));

  const sitemap = existsSync(path.join(ROOT, 'sitemap.xml')) ? readPage('sitemap.xml') : '';
  const sitemapPages = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, loc]) => {
    const tail = loc.replace(/^https?:\/\/[^/]+\//, '').replace(/^terra-dusk-site\/?/, '').replace(/\/$/, '');
    return tail === '' ? 'index.html' : tail;
  });
  const unpublished = ['index.html', 'about.html', ...postFiles.map((f) => `posts/${f}`)].filter(
    (p) => !sitemapPages.includes(p)
  );
  check('sitemap covers every published page', sitemapPages.length > 0 && unpublished.length === 0,
    unpublished.join(', ') || `${sitemapPages.length} urls`);

  /* ---------- console ---------- */
  check('no console errors', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '));
} catch (error) {
  check('run completed', false, error.message);
} finally {
  await close();
  server.close();
}

const failed = results.filter((r) => !r.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} checks passed` +
    (failed.length ? ` — failing: ${failed.map((f) => f.name).join(', ')}` : '')
);
process.exit(failed.length ? 1 : 0);
