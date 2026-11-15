const { chromium } = require('playwright');
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsImVtYWlsIjoiZGV2LmFsaWFsd2FqaWhAZ21haWwuY29tIiwidHYiOjMsImlhdCI6MTc5NDc1MDUwOCwiZXhwIjoxNzk1MzU1MzA4fQ.bK1ehkFc6hOyPbnqpa3w036YHlJeXrVBl7ADF5WO1eY';

(async () => {
  const b = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
  await p.goto('http://127.0.0.1:5173/admin');
  await p.evaluate((t) => localStorage.setItem('portfolio-token', t), token);
  await p.reload();
  await p.waitForTimeout(2000);

  // Click on 2nd tab (works)
  const tabs = p.locator('.tabs button');
  console.log('Tabs count:', await tabs.count());
  if (await tabs.count() > 1) {
    await tabs.nth(1).click();
    await p.waitForTimeout(1000);
  }

  const data = await p.evaluate(() => {
    return {
      windowHeight: window.innerHeight,
      docHeight: document.documentElement.scrollHeight,
      bodyHeight: document.body.scrollHeight,
      adminCard: {
        scrollHeight: document.querySelector('.wrap.admin')?.scrollHeight,
        clientHeight: document.querySelector('.wrap.admin')?.clientHeight,
        offsetHeight: document.querySelector('.wrap.admin')?.offsetHeight,
        overflowY: getComputedStyle(document.querySelector('.wrap.admin') || document.body).overflowY
      },
      panel: {
        scrollHeight: document.querySelector('.panel')?.scrollHeight,
        clientHeight: document.querySelector('.panel')?.clientHeight,
        offsetHeight: document.querySelector('.panel')?.offsetHeight,
        overflowY: getComputedStyle(document.querySelector('.panel') || document.body).overflowY
      }
    };
  });
  console.log(JSON.stringify(data, null, 2));
  await b.close();
})();
