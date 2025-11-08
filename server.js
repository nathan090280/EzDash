const express = require('express');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
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

app.post('/screenshot', async (req, res) => {
  const { url } = req.body;

  if (!url) return res.status(400).json({ error: 'URL is required' });

  try {
    // Validate URL and protocol
    let parsed;
    try { parsed = new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL' }); }
    if (!/^https?:$/.test(parsed.protocol)) return res.status(400).json({ error: 'Only http/https URLs allowed' });

    const execPath = await chromium.executablePath();
    const browser = await puppeteer.launch({
      headless: chromium.headless,
      args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-zygote', '--single-process'],
      executablePath: execPath,
      defaultViewport: chromium.defaultViewport,
      ignoreHTTPSErrors: true,
      timeout: 120000,
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 }); // default viewport for full-page screenshot
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    const buffer = await page.screenshot({ fullPage: true });
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
    // Validate URL and protocol
    let parsed;
    try { parsed = new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL' }); }
    if (!/^https?:$/.test(parsed.protocol)) return res.status(400).json({ error: 'Only http/https URLs allowed' });

    const execPath = await chromium.executablePath();
    const browser = await puppeteer.launch({
      headless: chromium.headless,
      args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-zygote', '--single-process'],
      executablePath: execPath,
      defaultViewport: chromium.defaultViewport,
      ignoreHTTPSErrors: true,
      timeout: 120000,
    });
    const page = await browser.newPage();
    await page.setViewport({ width: isNaN(w) ? 1280 : w, height: isNaN(h) ? 800 : h });
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    const buffer = await page.screenshot({ fullPage: true });
    await browser.close();

    res.set('Content-Type', 'image/png');
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to take screenshot' });
  }
});

app.listen(port, () => {
  console.log(`Snapshot server running on port ${port}`);
});
