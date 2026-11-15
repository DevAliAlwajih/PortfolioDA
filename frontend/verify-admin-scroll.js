const { chromium } = require('playwright');

const baseUrl = 'http://localhost:4173';
const publicPayload = {
  profile: {
    nameAr: 'علي',
    nameEn: 'Ali',
    phone: '+966500000000',
    photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=80'
  },
  works: [
    {
      id: 1,
      type: 'WEB',
      titleAr: 'عمل 1',
      titleEn: 'Work 1',
      summaryAr: 'ملخص عربي',
      summaryEn: 'English summary',
      imageUrl: 'https://images.unsplash.com/photo-1516321165247-4aa89a48be28?auto=format&fit=crop&w=1200&q=80',
      featured: true,
      order: 1,
      link: 'https://example.com',
      files: [],
      steps: [],
      gallery: []
    },
    {
      id: 2,
      type: 'MOBILE',
      titleAr: 'عمل 2',
      titleEn: 'Work 2',
      summaryAr: 'ملخص عربي',
      summaryEn: 'English summary',
      imageUrl: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80',
      featured: false,
      order: 2,
      link: 'https://example.com',
      files: [],
      steps: [],
      gallery: []
    }
  ],
  reviews: [
    { id: 1, name: 'Test User', email: 'test@example.com', rating: 5, comment: 'Nice work', approved: true }
  ],
  links: [{ id: 1, title: 'GitHub', url: 'https://github.com' }],
  contacts: [{ id: 1, title: 'WhatsApp', value: '+966500000000' }],
  sections: [],
  layout: [
    { key: 'about', labelAr: 'من نحن', labelEn: 'About', visible: true },
    { key: 'vision', labelAr: 'الرؤية', labelEn: 'Vision', visible: true },
    { key: 'works', labelAr: 'الأعمال', labelEn: 'Works', visible: true },
    { key: 'links', labelAr: 'الروابط', labelEn: 'Links', visible: true },
    { key: 'contact', labelAr: 'التواصل', labelEn: 'Contact', visible: true },
    { key: 'reviews', labelAr: 'التقييمات', labelEn: 'Reviews', visible: true }
  ]
};

async function mockApi(route) {
  const url = route.request().url();
  if (url.endsWith('/public')) {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(publicPayload) });
  }
  if (url.endsWith('/auth/me')) {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ email: 'admin@example.com' }) });
  }
  if (url.endsWith('/admin/works')) {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  }
  if (url.endsWith('/admin/layout')) {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(publicPayload.layout) });
  }
  if (url.endsWith('/admin/reviews')) {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(publicPayload.reviews) });
  }
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
}

async function verifyPublicPage(browser, path, width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', err => errors.push('pageerror:' + err.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push('console:' + msg.text()); });
  page.on('requestfailed', req => errors.push('requestfailed:' + req.url()));
  await page.addInitScript(() => localStorage.setItem('portfolio-admin-token', 'mock-admin-token'));
  await page.route('**/api/**', mockApi);
  await page.goto(baseUrl + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const data = await page.evaluate(() => {
    const selectors = ['.topbar', '.dock', '.hero-view h1', '.phone-pill', '.hero-actions .btn', '.showcase'];
    const rows = selectors.map(selector => {
      const el = document.querySelector(selector);
      if (!el) {
        return { selector, ok: false, opacity: null, visibility: null, display: null, rect: null };
      }
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        selector,
        ok: Number(s.opacity) >= 0.99 && s.visibility !== 'hidden' && s.display !== 'none' && r.width > 0 && r.height > 0,
        opacity: s.opacity,
        visibility: s.visibility,
        display: s.display,
        rect: { x: r.x, y: r.y, width: r.width, height: r.height }
      };
    });
    return {
      rows,
      bodyScroll: document.documentElement.scrollHeight > window.innerHeight
    };
  });

  const allPass = data.rows.every(row => row.ok) && !data.bodyScroll;
  console.log(`PUBLIC ${path} ${width}x${height} ${allPass ? 'PASS' : 'FAIL'}`);
  for (const row of data.rows) console.log(JSON.stringify(row));
  console.log(`bodyScroll=${data.bodyScroll}; errors=${errors.length}`);
  await page.close();
  return allPass && errors.length === 0;
}

async function verifyAdmin(browser, width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', err => errors.push('pageerror:' + err.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push('console:' + msg.text()); });
  page.on('requestfailed', req => errors.push('requestfailed:' + req.url()));
  await page.addInitScript(() => localStorage.setItem('portfolio-admin-token', 'mock-admin-token'));
  await page.route('**/api/**', mockApi);

  await page.goto(baseUrl + '/admin', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.locator('[role="tab"]').filter({ hasText: 'إدارة الأعمال' }).click();
  await page.waitForSelector('button:has-text("+ إضافة عمل أو تطبيق")', { timeout: 30000 });
  await page.locator('button:has-text("+ إضافة عمل أو تطبيق")').click();
  await page.waitForTimeout(800);

  const result = await page.evaluate(() => {
    const oldButtons = [...document.querySelectorAll(
      '[class*="scroll"], [aria-label*="scroll"], [class*="fab"], [class*="back-to-top"], [class*="go-down"], [class*="go-up"], [class*="scroll-btn"], [class*="scroll-fab"]'
    )].map(el => ({
      tag: el.tagName,
      className: el.className,
      aria: el.getAttribute('aria-label') || '',
      text: (el.textContent || '').trim()
    }));

    const scroller = document.querySelector('.wrap.admin');
    const bodyScroll = document.body.scrollHeight > window.innerHeight || document.documentElement.scrollHeight > window.innerHeight;
    const info = scroller ? {
      className: scroller.className,
      scrollHeight: scroller.scrollHeight,
      clientHeight: scroller.clientHeight,
      offsetWidth: scroller.offsetWidth,
      clientWidth: scroller.clientWidth,
      scrollTop: scroller.scrollTop,
      opacity: getComputedStyle(scroller).opacity,
      visibility: getComputedStyle(scroller).visibility,
      display: getComputedStyle(scroller).display,
      overflowY: getComputedStyle(scroller).overflowY,
      scrollbarGutter: getComputedStyle(scroller).scrollbarGutter,
      rect: scroller.getBoundingClientRect(),
      bodyScroll
    } : null;

    const hasVisibleScrollbar = !!scroller && scroller.scrollHeight > scroller.clientHeight && (scroller.offsetWidth - scroller.clientWidth) >= 10;
    const pass = oldButtons.length === 0 && hasVisibleScrollbar && !bodyScroll && scroller && Number(getComputedStyle(scroller).opacity) >= 0.99;
    return { pass, oldButtons, bodyScroll, hasVisibleScrollbar, info };
  });

  console.log(`ADMIN ${width}x${height} ${result.pass ? 'PASS' : 'FAIL'}`);
  console.log(JSON.stringify({ oldButtons: result.oldButtons.length, hasVisibleScrollbar: result.hasVisibleScrollbar, bodyScroll: result.bodyScroll, info: result.info }, null, 2));
  console.log(`errors=${errors.length}`);
  await page.close();
  return result.pass && errors.length === 0;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  let ok = true;

  ok = (await verifyPublicPage(browser, '/', 1366, 768)) && ok;
  ok = (await verifyPublicPage(browser, '/works', 1366, 768)) && ok;
  ok = (await verifyPublicPage(browser, '/contact', 1366, 768)) && ok;
  ok = (await verifyPublicPage(browser, '/', 390, 844)) && ok;
  ok = (await verifyAdmin(browser, 1366, 768)) && ok;
  ok = (await verifyAdmin(browser, 390, 844)) && ok;

  console.log(`OVERALL ${ok ? 'PASS' : 'FAIL'}`);
  await browser.close();
  process.exit(ok ? 0 : 1);
})();
