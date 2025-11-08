const express = require('express');
const path = require('path');
const puppeteer = require('puppeteer');
const app = express();
const port = process.env.PORT || 3000;

// Allow JSON requests
app.use(express.json());
// Basic CORS for frontend access (images via <img src>)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Serve static dashboard files from the current working directory (Render deploy path)
const ROOT_DIR = process.cwd();
app.use(express.static(ROOT_DIR));

app.post('/screenshot', async (req, res) => {
  const { url } = req.body;

  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 400, height: 300 }); // widget-size screenshot
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    const buffer = await page.screenshot({ fullPage: false });
    await browser.close();

    res.set('Content-Type', 'image/png');
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to take screenshot' });
  }
});

// GET variant so it can be used directly as <img src="/screenshot?url=...&w=...&h=...">
app.get('/screenshot', async (req, res) => {
  const url = req.query.url;
  const w = parseInt(req.query.w || '400', 10);
  const h = parseInt(req.query.h || '300', 10);

  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    });
    const page = await browser.newPage();
    await page.setViewport({ width: isNaN(w) ? 400 : w, height: isNaN(h) ? 300 : h });
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
    const buffer = await page.screenshot({ fullPage: false });
    await browser.close();

    res.set('Content-Type', 'image/png');
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to take screenshot' });
  }
});

// SPA fallback: send index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

app.listen(port, () => {
  console.log(`Snapshot server running on port ${port}`);
});
