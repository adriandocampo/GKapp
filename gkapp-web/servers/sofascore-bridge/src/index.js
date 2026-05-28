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
  console.log('[Bridge] Lanzando Chromium...');
  browser = await puppeteer.launch({
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process',
      '--disable-blink-features=AutomationControlled',
    ],
    headless: 'new',
  });
  page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  page.on('pageerror', err => console.log(`[Bridge] Page error: ${err.message}`));
  page.on('error', err => console.log(`[Bridge] Page crash: ${err.message}`));
  page.on('requestfailed', req => console.log(`[Bridge] Request failed: ${req.url()} ${req.failure()?.errorText}`));

  await page.evaluateOnNewDocument(() => {
    delete navigator.__proto__.webdriver;
  });

  console.log('[Bridge] Navegando a SofaScore para resolver Cloudflare...');
  try {
    await page.goto(SOFASCORE_ORIGIN, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    await new Promise(r => setTimeout(r, 5000));
    console.log(`[Bridge] URL tras navegar: ${page.url()}`);
  } catch (err) {
    console.log(`[Bridge] Homepage timeout (esperado): ${err.message}`);
  }

  console.log('[Bridge] Intentando API call de verificación...');
  try {
    const testData = await page.evaluate(async () => {
      const r = await fetch('https://www.sofascore.com/api/v1/search/players?q=test', {
        headers: { 'Accept': 'application/json', 'Referer': 'https://www.sofascore.com/' },
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    });
    console.log(`[Bridge] API verify OK: ${testData?.results?.length || 0} resultados`);
  } catch (err) {
    console.log(`[Bridge] API verify falló: ${err.message}`);
  }

  ready = true;
  console.log('[Bridge] Listo');
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
      if (!page || page.isClosed()) { await init(); }
      if (!ready) throw new Error('Bridge no listo');

      const data = await page.evaluate(async (url) => {
        const r = await fetch(url, {
          headers: { 'Accept': 'application/json', 'Referer': 'https://www.sofascore.com/' },
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      }, target);

      console.log(`[Bridge] OK: ${path}`);
      return res.json(data);
    } catch (err) {
      console.error(`[Bridge] Intento ${attempt + 1} falló: ${err.message}`);
      if (attempt === 0) {
        try { await page.goto(SOFASCORE_ORIGIN, { waitUntil: 'domcontentloaded', timeout: 15000 }); await new Promise(r => setTimeout(r, 3000)); } catch {}
      }
    }
  }
  res.status(502).json({ error: 'SofaScore no responde, intenta de nuevo' });
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`[Bridge] Server escuchando en puerto ${PORT}`);
  init().catch(err => console.error(`[Bridge] init falló: ${err.message}`));
});
