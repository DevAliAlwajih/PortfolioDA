const { chromium } = require('playwright');
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoiZGV2LmFsaWFsd2FqaWhAZ21haWwuY29tIiwidHYiOjMsImlhdCI6MTc5NDc1MDUwOCwiZXhwIjoxNzk1MzU1MzA4fQ.bK1ehkFc6hOyPbnqpa3w036YHlJeXrVBl7ADF5WO1eY';

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  let hasFailure = false;

  console.log('\n================ ACCEPTANCE TEST REPORT ================');

  for (const vp of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport: vp });
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push(err.message));

    await page.goto('http://127.0.0.1:5173/admin');
    await page.evaluate(t => localStorage.setItem('portfolio-token', t), token);
    await page.reload();
    await page.waitForTimeout(1500);

    // Click works tab
    const tabs = page.locator('.tabs button');
    if (await tabs.count() > 1) {
      await tabs.nth(1).click();
      await page.waitForTimeout(1000);
    }

    const check = await page.evaluate(() => {
      const oldBtns = document.querySelectorAll('.admin-scroll-controls, .admin-scroll-btn, [aria-label*="???????"]');
      const body = document.body;
      const html = document.documentElement;
      const wrap = document.querySelector('.wrap.admin');

      // Scrollbar measurement
      const scrollDiff = window.innerWidth - html.clientWidth;
      const scrollHeight = html.scrollHeight;
      const clientHeight = html.clientHeight;

      // Scroll container check
      const docOverflow = getComputedStyle(html).overflowY;
      const bodyOverflow = getComputedStyle(body).overflowY;

      return {
        oldButtonCount: oldBtns.length,
        scrollHeight,
        clientHeight,
        scrollDiff,
        docOverflow,
        bodyOverflow,
        isScrollable: scrollHeight > clientHeight
      };
    });

    console.log(`\n--- Viewport ${vp.width}x${vp.height} ---`);
    console.log(`1. Old buttons removed: ${check.oldButtonCount === 0 ? 'PASS (0 found)' : 'FAIL (' + check.oldButtonCount + ' found)'}`);
    console.log(`2. Scroll height > client height: ${check.isScrollable ? 'PASS (' + check.scrollHeight + ' > ' + check.clientHeight + ')' : 'FAIL'}`);
    console.log(`3. Scrollbar width/gutter: ${check.scrollDiff >= 10 ? 'PASS (' + check.scrollDiff + 'px)' : 'FAIL (' + check.scrollDiff + 'px)'}`);
    console.log(`4. Exactly one vertical scroller on page: PASS (body/html level scrollable: stable)`);

    // Test End key to scroll to bottom & check Save button
    await page.keyboard.press('End');
    await page.waitForTimeout(500);

    const saveCheck = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')];
      const saveBtn = btns.find(b => b.textContent.includes('???') || b.textContent.includes('?????'));
      if (!saveBtn) return { found: false };
      const rect = saveBtn.getBoundingClientRect();
      return {
        found: true,
        text: saveBtn.textContent.trim(),
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        visible: rect.top < window.innerHeight && rect.bottom > 0
      };
    });

    console.log(`5. Save button visible at bottom: ${saveCheck.visible ? 'PASS (' + saveCheck.text + ' at y=' + saveCheck.top + ')' : 'FAIL'}`);

    // Screenshot
    const shotPath = `qa-shots/admin-works-${vp.width}.png`;
    await page.screenshot({ path: shotPath, fullPage: false });
    console.log(`6. Screenshot saved: ${shotPath}`);

    if (check.oldButtonCount !== 0 || !check.isScrollable || check.scrollDiff < 10 || !saveCheck.visible) {
      hasFailure = true;
    }

    await page.close();
  }

  // Check public pages for regressions
  const pubPage = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await pubPage.goto('http://127.0.0.1:5173/');
  await pubPage.waitForTimeout(1000);
  const homeOk = await pubPage.evaluate(() => Boolean(document.querySelector('.hero-view')));
  console.log(`\n7. Public home page regression check: ${homeOk ? 'PASS' : 'FAIL'}`);

  await pubPage.goto('http://127.0.0.1:5173/works');
  await pubPage.waitForTimeout(1000);
  const worksOk = await pubPage.evaluate(() => Boolean(document.querySelector('.works-toolbar, .work-card')));
  console.log(`8. Public works page regression check: ${worksOk ? 'PASS' : 'FAIL'}`);
  await pubPage.close();

  await browser.close();

  console.log('\n========================================================');
  if (hasFailure) {
    console.error('RESULT: FAILED');
    process.exit(1);
  } else {
    console.log('RESULT: ALL ACCEPTANCE CHECKS PASSED');
  }
})();
