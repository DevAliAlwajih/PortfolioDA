const { test, expect } = require('@playwright/test');

test('route check', async ({ page }) => {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push('console:' + msg.text());
  });
  page.on('pageerror', err => errors.push('pageerror:' + err.message));
  page.on('requestfailed', req => errors.push('requestfailed:' + req.url() + ' ' + req.failure()?.errorText));

  await page.goto('http://localhost:5173/works/2', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const title = await page.title();
  const bodyText = await page.locator('body').innerText();
  console.log('TITLE=' + title);
  console.log('BODY=' + bodyText.slice(0, 500));
  console.log('ERRORS=' + JSON.stringify(errors));
});
