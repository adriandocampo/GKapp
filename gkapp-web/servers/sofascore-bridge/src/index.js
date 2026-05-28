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
  try {
    if (browser && browser.isConnected()) {
      try { await browser.close(); } catch {}
    }
    console.log('[Bridge] Lanzando Chromium...');
    browser = await puppeteer.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
      ],
      headless: true,
    });
    console.log('[Bridge] Chromium lanzado');
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    page.on('pageerror', err => console.log(`[Bridge] Page error: ${err.message}`));
    page.on('error', err => console.log(`[Bridge] Page crash: ${err.message}`));
    page.on('requestfailed', req => console.log(`[Bridge] Request failed: ${req.url()} ${req.failure()?.errorText}`));
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    });
    console.log('[Bridge] Navegando a SofaScore...');
    await page.goto(SOFASCORE_ORIGIN, { waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log('[Bridge] DOM cargado, esperando 15s para Cloudflare...');
    await new Promise(r => setTimeout(r, 15000));
    console.log(`[Bridge] URL actual: ${page.url()}`);
    ready = true;
    console.log('[Bridge] Listo');
  } catch (err) {
    console.error(`[Bridge] init error: ${err.message}`);
    throw err;
  }
}

app.get('/health', (_req, res) => {
  res.json({ ok: ready, ready });
});

app.get('/api/v1/*', async (req, res) => {
  const path = req.originalUrl;
  const target = `${SOFASCORE_ORIGIN}${path}`;
  console.log(`[Bridge] Proxying: ${path}`);

  try {
    if (!page || page.isClosed()) {
      console.log('[Bridge] Page cerrada, reiniciando...');
      await init();
    }
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
    res.status(502).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`[Bridge] Server escuchando en puerto ${PORT}`);
  init()
    .then(() => {
      setInterval(() => {
        if (!page || page.isClosed()) { ready = false; return; }
        page.goto(SOFASCORE_ORIGIN, { waitUntil: 'domcontentloaded', timeout: 20000 })
          .then(() => setTimeout(() => {}, 1000))
          .catch(() => { ready = false; });
      }, 4 * 60 * 1000);
    })
    .catch(err => console.error(`[Bridge] init falló: ${err.message}`));
});
