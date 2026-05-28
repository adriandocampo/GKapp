import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const app = express();
app.use(cors());
app.use(express.json());

const SOFASCORE_ORIGIN = 'https://www.sofascore.com';

let browser;
let page;
let ready = false;

async function init() {
  if (browser && browser.isConnected()) {
    try { await browser.close(); } catch {}
  }
  browser = await puppeteer.launch({
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-accelerated-2d-canvas',
      '--single-process',
    ],
    headless: true,
  });
  page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
  });
  await page.goto(SOFASCORE_ORIGIN, { waitUntil: 'domcontentloaded', timeout: 60000 });
  try {
    await page.waitForNetworkIdle({ idleTime: 2000, timeout: 30000 });
  } catch (e) {
    console.log(`[Bridge] network idle timeout (esperando challenge Cloudflare): ${e.message}`);
  }
  await new Promise(r => setTimeout(r, 2000));
  const currentUrl = page.url();
  console.log(`[Bridge] URL actual: ${currentUrl}`);
  ready = true;
  console.log('[Bridge] Listo');
}

async function ensureReady() {
  if (ready && page && !page.isClosed()) return;
  console.log('[Bridge] Reiniciando sesión...');
  await init();
}

function keepalive() {
  if (!page || page.isClosed()) { ready = false; return; }
  page.goto(SOFASCORE_ORIGIN, { waitUntil: 'domcontentloaded', timeout: 20000 })
    .then(async () => {
      try { await page.waitForNetworkIdle({ idleTime: 2000, timeout: 5000 }); } catch {}
      ready = true;
    })
    .catch(() => { ready = false; });
}

app.get('/health', (_req, res) => {
  res.json({ ok: ready, ready });
});

app.get('/api/v1/*', async (req, res) => {
  const path = req.originalUrl;
  const target = `${SOFASCORE_ORIGIN}${path}`;
  console.log(`[Bridge] Proxying: ${path}`);

  try {
    await ensureReady();
    const data = await page.evaluate(async (url) => {
      const r = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'Referer': 'https://www.sofascore.com/',
        },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    }, target);
    res.json(data);
  } catch (err) {
    console.error(`[Bridge] Error: ${err.message}`);
    ready = false;
    res.status(502).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, async () => {
  console.log(`[Bridge] Server escuchando en puerto ${PORT}`);
  try {
    await init();
    setInterval(keepalive, 4 * 60 * 1000);
    setInterval(async () => {
      if (!ready) {
        console.log('[Bridge] Detectado caído, reintentando...');
        try { await init(); } catch (err) { console.error(`[Bridge] Reinit falló: ${err.message}`); }
      }
    }, 60 * 1000);
  } catch (err) {
    console.error(`[Bridge] Error fatal en startup: ${err.message}`);
  }
});
