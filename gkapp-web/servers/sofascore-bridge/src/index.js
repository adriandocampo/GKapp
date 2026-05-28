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
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    page.on('pageerror', err => console.log(`[Bridge] Page error: ${err.message}`));
    page.on('error', err => console.log(`[Bridge] Page crash: ${err.message}`));
    page.on('requestfailed', req => console.log(`[Bridge] Request failed: ${req.url()} ${req.failure()?.errorText}`));

    console.log('[Bridge] Abriendo pagina en blanco...');
    await page.goto('about:blank', { waitUntil: 'domcontentloaded' });
    ready = true;
    console.log('[Bridge] Listo — esperando peticiones');
  } catch (err) {
    console.error(`[Bridge] init error: ${err.message}`);
    if (browser && browser.isConnected()) {
      try { const pages = await browser.pages(); for (const p of pages) { try { await p.close(); } catch {} } } catch {}
    }
    throw err;
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

app.get('/health', (_req, res) => {
  res.json({ ok: ready, ready });
});

app.get('/api/v1/*', async (req, res) => {
  const path = req.originalUrl;
  const target = `${SOFASCORE_ORIGIN}${path}`;
  console.log(`[Bridge] Proxying: ${path}`);

  for (let attempt = 0; attempt < 3; attempt++) {
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
      console.log(`[Bridge] OK: ${path}`);
      return res.json(data);
    } catch (err) {
      console.error(`[Bridge] Intento ${attempt + 1} falló: ${err.message}`);
      if (attempt < 2) {
        await sleep(2000 * (attempt + 1));
        try { await page.goto('about:blank', { waitUntil: 'domcontentloaded', timeout: 10000 }); } catch {}
      }
    }
  }
  res.status(502).json({ error: 'SofaScore no responde (Cloudflare), intenta de nuevo' });
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`[Bridge] Server escuchando en puerto ${PORT}`);
  init()
    .then(() => {
      setInterval(() => {
        if (!page || page.isClosed()) { ready = false; }
      }, 60 * 1000);
    })
    .catch(err => console.error(`[Bridge] init falló: ${err.message}`));
});
