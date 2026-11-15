const { chromium } = require('playwright');
const base = process.env.BASE_URL || 'http://localhost:5173';
const viewports = [{ width: 1366, height: 768 }, { width: 390, height: 844 }];
const pages = ['/', '/works', '/contact'];
const common = { topbar: '.topbar', dock: '.dock', stage: '.stage', view: '.view' };
const homeOnly = { heroName: '.hero-view h1', phonePill: '.phone-pill', buttons: '.hero-actions', showcase: '.showcase' };
const waits = [0, 1000, 3000, 6000];

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' }); let failures = 0;
  for (const viewport of viewports) for (const route of pages) {
    const page = await browser.newPage({ viewport });
    await page.goto(`${base}${route}`, { waitUntil: 'networkidle' }); let elapsed = 0;
    for (const sample of waits) {
      await page.waitForTimeout(sample - elapsed); elapsed = sample;
      const selectors = route === '/' ? { ...common, ...homeOnly } : common;
      const result = await page.evaluate((entries) => Object.fromEntries(entries.map(([name, selector]) => {
        const el = document.querySelector(selector); if (!el) return [name, { missing: true }];
        const s = getComputedStyle(el), r = el.getBoundingClientRect();
        const fullyInside = r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
        const intersects = r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
        return [name, { opacity: Number(s.opacity), visibility: s.visibility, display: s.display, x: r.x, y: r.y, width: r.width, height: r.height, inside: name === 'view' || (innerWidth < 760 && name === 'showcase') ? intersects : fullyInside }];
      })), Object.entries(selectors));
      for (const [name, value] of Object.entries(result)) {
        const ok = !value.missing && value.opacity >= 1 && value.visibility === 'visible' && value.display !== 'none' && value.width > 0 && value.height > 0 && value.inside;
        if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'} ${viewport.width}x${viewport.height} ${route} ${sample}ms ${name}`, value);
      }
    }
    await page.close();
  }
  await browser.close(); if (failures) { console.error(`FAILURES: ${failures}`); process.exit(1); } console.log('ALL VISIBILITY SAMPLES PASSED');
})().catch(error => { console.error(error); process.exit(1); });
