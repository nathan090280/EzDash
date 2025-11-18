const express = require('express');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const app = express();
const port = process.env.PORT || 3000;

// Queue system to process screenshots sequentially
const screenshotQueue = [];
let isProcessing = false;

async function processQueue() {
  if (isProcessing || screenshotQueue.length === 0) return;
  
  isProcessing = true;
  const { url, w, h, res } = screenshotQueue.shift();
  
  try {
    await takeScreenshot(url, w, h, res);
  } catch (err) {
    console.error('Queue processing error:', err);
  }
  
  isProcessing = false;
  
  // Process next item
  if (screenshotQueue.length > 0) {
    setTimeout(processQueue, 100);
  }
}

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

// Screenshot function
async function takeScreenshot(url, w, h, res) {
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
      args: [
        ...chromium.args, 
        '--no-sandbox', 
        '--disable-setuid-sandbox', 
        '--disable-dev-shm-usage', 
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ],
      executablePath: execPath,
      timeout: 15000
    });
    
    const page = await browser.newPage();
    
    // Set viewport with validated dimensions
    console.log(`Setting viewport: ${w}x${h}`);
    await page.setViewport({ 
      width: w, 
      height: h,
      deviceScaleFactor: 1
    });
    
    // Simple, fast navigation - just wait for DOM
    await page.goto(url, { 
      waitUntil: 'load', 
      timeout: 30000 
    });
    
    // Wait for dynamic content to render
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Take viewport screenshot (not full page - that's causing the 0 width issue)
    const buffer = await page.screenshot({ 
      type: 'png',
      clip: {
        x: 0,
        y: 0,
        width: w,
        height: h
      }
    });
    
    await browser.close();
    browser = null;

    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.send(buffer);
    
    console.log(`Screenshot completed for: ${url}`);
  } catch (err) {
    console.error('Screenshot error:', err.message);
    if (browser) {
      try { await browser.close(); } catch (e) { console.error('Browser close error:', e); }
    }
    res.status(500).json({ error: 'Failed to take screenshot: ' + err.message });
  }
}

// GET endpoint - adds to queue
app.get('/screenshot', async (req, res) => {
  const url = req.query.url;
  let w = parseInt(req.query.w, 10);
  let h = parseInt(req.query.h, 10);
  
  // Ensure valid dimensions
  if (isNaN(w) || w <= 0) w = 1920;
  if (isNaN(h) || h <= 0) h = 1080;

  if (!url) return res.status(400).json({ error: 'URL is required' });
  
  // Add to queue
  screenshotQueue.push({ url, w, h, res });
  console.log(`Queued screenshot request. Queue length: ${screenshotQueue.length}`);
  
  // Start processing
  processQueue();
});

app.listen(port, () => {
  console.log(`Snapshot server running on port ${port}`);
});
