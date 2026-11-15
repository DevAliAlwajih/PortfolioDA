const { test, expect } = require('@playwright/test');

const baseUrl = 'http://localhost:4173';
const publicPayload = { profile: { nameAr: 'علي', nameEn: 'Ali', phone: '+966500000000', photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=80' }, works: [{ id: 1, type: 'WEB', titleAr: 'عمل 1', titleEn: 'Work 1', summaryAr: 'ملخص عربي', summaryEn: 'English summary', imageUrl: 'https://images.unsplash.com/photo-1516321165247-4aa89a48be28?auto=format&fit=crop&w=1200&q=80', featured: true, order: 1, link: 'https://example.com', files: [], steps: [], gallery: [] }, { id: 2, type: 'MOBILE', titleAr: 'عمل 2', titleEn: 'Work 2', summaryAr: 'ملخص عربي', summaryEn: 'English summary', imageUrl: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80', featured: false, order: 2, link: 'https://example.com', files: [], steps: [], gallery: [] }], reviews: [{ id: 1, name: 'Test', email: 'test@example.com', rating: 5, comment: 'Nice', approved: true }], links: [{ id: 1, title: 'GitHub', url: 'https://github.com' }], contacts: [{ id: 1, title: 'WhatsApp', value: '+966500000000' }], sections: [], layout: [{ key: 'about', labelAr: 'من نحن', labelEn: 'About', visible: true }, { key: 'vision', labelAr: 'الرؤية', labelEn: 'Vision', visible: true }, { key: 'works', labelAr: 'الأعمال', labelEn: 'Works', visible: true }, { key: 'links', labelAr: 'الروابط', labelEn: 'Links', visible: true }, { key: 'contact', labelAr: 'التواصل', labelEn: 'Contact', visible: true }, { key: 'reviews', labelAr: 'التقييمات', labelEn: 'Reviews', visible: true }] };

async function mockApi(route) {
  const url = route.request().url();
  if (url.endsWith('/public')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(publicPayload) });
  if (url.endsWith('/auth/me')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ email: 'admin@example.com' }) });
  if (url.endsWith('/admin/works')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  if (url.endsWith('/admin/layout')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(publicPayload.layout) });
  if (url.endsWith('/admin/reviews')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(publicPayload.reviews) });
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('portfolio-admin-token', 'mock-admin-token'));
  await page.route('**/api/**', mockApi);
});

test('public pages remain visible', async ({ page }) => {
  for (const [path, width, height] of [['/', 1366, 768], ['/works', 1366, 768], ['/contact', 1366, 768], ['/', 390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.goto(baseUrl + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    const rows = await page.locator('.topbar, .dock, .hero-view h1, .phone-pill, .hero-actions .btn, .showcase').evaluateAll((els) => els.map(el => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { selector: el.className || el.tagName, opacity: s.opacity, visibility: s.visibility, display: s.display, width: r.width, height: r.height };
    }));
    console.log(`${path} ${width}x${height}`, JSON.stringify(rows));
    expect(rows.every(x => Number(x.opacity) >= 0.99 && x.visibility !== 'hidden' && x.display !== 'none' && x.width > 0 && x.height > 0)).toBeTruthy();
  }
});

test('admin works editor uses a single native scrollbar', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(baseUrl + '/admin', { waitUntil: 'networkidle' });
  await page.locator('[role="tab"]').filter({ hasText: 'إدارة الأعمال' }).click();
  await page.locator('button:has-text("+ إضافة عمل أو تطبيق")').click();
  await page.waitForTimeout(800);
  const info = await page.evaluate(() => {
    const oldButtons = [...document.querySelectorAll('[class*="scroll"], [aria-label*="scroll"], [class*="fab"], [class*="back-to-top"], [class*="go-down"], [class*="go-up"], [class*="scroll-btn"], [class*="scroll-fab"]')];
    const scroller = document.querySelector('.wrap.admin');
    return {
      oldButtons: oldButtons.length,
      bodyScroll: document.body.scrollHeight > window.innerHeight || document.documentElement.scrollHeight > window.innerHeight,
      scroller: scroller ? {
        scrollHeight: scroller.scrollHeight,
        clientHeight: scroller.clientHeight,
        offsetWidth: scroller.offsetWidth,
        clientWidth: scroller.clientWidth,
        overflowY: getComputedStyle(scroller).overflowY,
        opacity: getComputedStyle(scroller).opacity,
        visibility: getComputedStyle(scroller).visibility,
        display: getComputedStyle(scroller).display
      } : null
    };
  });
  console.log(JSON.stringify(info));
  expect(info.oldButtons).toBe(0);
  expect(info.scroller && info.scroller.scrollHeight > info.scroller.clientHeight).toBeTruthy();
  expect(info.scroller && (info.scroller.offsetWidth - info.scroller.clientWidth) >= 10).toBeTruthy();
  expect(info.bodyScroll).toBeFalsy();
});
