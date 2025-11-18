const express = require('express');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const app = express();
const port = process.env.PORT || 3000;

// Serve static files (HTML, CSS, JS)
app.use(express.static(__dirname));

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
      args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      executablePath: execPath,
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 }); // default viewport for full-page screenshot
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
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
  const w = parseInt(req.query.w || '1920', 10);
  const h = parseInt(req.query.h || '1080', 10);

  if (!url) return res.status(400).json({ error: 'URL is required' });

  let browser;
  try {
    // Validate URL and protocol
    let parsed;
    try { parsed = new URL(url); } catch { return res.status(400).json({ error: 'Invalid URL' }); }
    if (!/^https?:$/.test(parsed.protocol)) return res.status(400).json({ error: 'Only http/https URLs allowed' });

    console.log(`Taking screenshot of: ${url}`);
    
    const execPath = await chromium.executablePath();
    browser = await puppeteer.launch({
      headless: chromium.headless,
      args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      executablePath: execPath,
      timeout: 30000
    });
    
    const page = await browser.newPage();
    
    // Set shorter timeout and less strict wait condition
    await page.setViewport({ width: isNaN(w) ? 1920 : w, height: isNaN(h) ? 1080 : h });
    await page.goto(url, { 
      waitUntil: 'networkidle2', 
      timeout: 30000 
    });
    
    // Wait a bit for any dynamic content
    await page.waitForTimeout(1000);
    
    const buffer = await page.screenshot({ 
      fullPage: true,
      type: 'png'
    });
    
    await browser.close();
    browser = null;

    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(buffer);
    
    console.log(`Screenshot completed for: ${url}`);
  } catch (err) {
    console.error('Screenshot error:', err.message);
    if (browser) {
      try { await browser.close(); } catch (e) { console.error('Browser close error:', e); }
    }
    res.status(500).json({ error: 'Failed to take screenshot: ' + err.message });
  }
});

app.listen(port, () => {
  console.log(`Snapshot server running on port ${port}`);
});
