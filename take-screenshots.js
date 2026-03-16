const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const routes = [
  { name: 'dashboard-home', url: 'http://localhost:3000/dashboard', wait: 2000 },
  { name: 'dashboard-terminal', url: 'http://localhost:3000/dashboard/terminal', wait: 2000 },
  { name: 'dashboard-agents', url: 'http://localhost:3000/dashboard/agents', wait: 2000 },
  { name: 'dashboard-skills', url: 'http://localhost:3000/dashboard/skills', wait: 2000 },
  { name: 'dashboard-settings', url: 'http://localhost:3000/dashboard/settings', wait: 2000 }
];

async function takeScreenshots() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Set to dark mode
  await page.emulateMediaFeatures([
    { name: 'prefers-color-scheme', value: 'dark' },
  ]);
  await page.setViewport({ width: 1280, height: 800 });

  const assetsDir = path.join(__dirname, 'assets', 'screenshots');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  for (const route of routes) {
    try {
      console.log(`Navigating to ${route.url}`);
      await page.goto(route.url, { waitUntil: 'networkidle0' });
      if (route.wait) await new Promise(r => setTimeout(r, route.wait));
      
      const filePath = path.join(assetsDir, `${route.name}.png`);
      await page.screenshot({ path: filePath });
      console.log(`Saved screenshot to ${filePath}`);
    } catch (e) {
      console.error(`Failed to snapshot ${route.name}`, e);
    }
  }

  await browser.close();
}

takeScreenshots().catch(console.error);
