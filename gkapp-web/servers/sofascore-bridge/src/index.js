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

    await page.goto('about:blank', { waitUntil: 'domcontentloaded' });
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

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (!page || page.isClosed()) {
        await init();
      }
      const resp = await page.goto(target, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      const status = resp.status();
      const ct = resp.headers()['content-type'] || 'unknown';
      console.log(`[Bridge] Status: ${status}, Content-Type: ${ct}`);
      if (status !== 200) {
        const text = await resp.text().catch(() => '');
        throw new Error(`HTTP ${status}: ${text.slice(0, 300)}`);
      }
      const data = await resp.json();
      console.log(`[Bridge] OK: ${path}`);
      return res.json(data);
    } catch (err) {
      console.error(`[Bridge] Intento ${attempt + 1} falló: ${err.message}`);
    }
  }
  res.status(502).json({ error: 'SofaScore no disponible, intenta de nuevo' });
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`[Bridge] Server escuchando en puerto ${PORT}`);
  init().catch(err => console.error(`[Bridge] init falló: ${err.message}`));
});
