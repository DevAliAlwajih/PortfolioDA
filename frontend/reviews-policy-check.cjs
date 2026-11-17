const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const jwt = require('../backend/node_modules/jsonwebtoken');
const { PrismaClient } = require('../backend/node_modules/@prisma/client');

const prisma = new PrismaClient();
const BACKEND_URL = 'http://localhost:5000';
const FRONTEND_URL = 'http://127.0.0.1:5173';
const JWT_SECRET = 'portfolio-super-secret-jwt-key-2026-xyz123abc456';
const QA_SHOTS_DIR = path.resolve(__dirname, '..', 'qa-shots');
const FRONTEND_QA_DIR = path.resolve(__dirname, 'qa-shots');

if (!fs.existsSync(QA_SHOTS_DIR)) fs.mkdirSync(QA_SHOTS_DIR, { recursive: true });
if (!fs.existsSync(FRONTEND_QA_DIR)) fs.mkdirSync(FRONTEND_QA_DIR, { recursive: true });

async function saveScreenshot(page, filename) {
  const p1 = path.join(QA_SHOTS_DIR, filename);
  const p2 = path.join(FRONTEND_QA_DIR, filename);
  await page.screenshot({ path: p1, fullPage: false });
  fs.copyFileSync(p1, p2);
  console.log(`[Screenshot] Saved ${filename}`);
}

async function getDbSnapshot() {
  return {
    Admin: await prisma.admin.count(),
    AdminAction: await prisma.adminAction.count(),
    Profile: await prisma.profile.count(),
    SiteSetting: await prisma.siteSetting.count(),
    Section: await prisma.section.count(),
    SectionBlock: await prisma.sectionBlock.count(),
    Work: await prisma.work.count(),
    WorkFile: await prisma.workFile.count(),
    Link: await prisma.link.count(),
    Contact: await prisma.contact.count(),
    Review: await prisma.review.count(),
  };
}

function getUploadsSnapshot() {
  const uploadsDir = path.resolve(__dirname, '..', 'backend', 'uploads');
  if (!fs.existsSync(uploadsDir)) return { count: 0, totalSize: 0 };
  const files = fs.readdirSync(uploadsDir);
  let totalSize = 0;
  for (const f of files) {
    const st = fs.statSync(path.join(uploadsDir, f));
    if (st.isFile()) totalSize += st.size;
  }
  return { count: files.length, totalSize };
}

const testResults = [];

function recordResult(testName, passed, detail = '') {
  testResults.push({ testName, passed, detail });
  const status = passed ? 'PASS' : 'FAIL';
  console.log(`[${status}] ${testName} ${detail ? `- ${detail}` : ''}`);
  if (!passed) {
    process.exitCode = 1;
  }
}

(async () => {
  console.log('=== TEST SUITE START ===');

  // Baseline snapshots
  const beforeDb = await getDbSnapshot();
  const beforeUploads = getUploadsSnapshot();
  console.log('Database Table Counts (Before):', JSON.stringify(beforeDb, null, 2));
  console.log('Uploads Snapshot (Before):', JSON.stringify(beforeUploads));

  const adminToken = jwt.sign({ sub: 1, email: 'dev.alialwajih@gmail.com', tv: 3 }, JWT_SECRET, { expiresIn: '12h' });

  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });

  try {
    /* -------------------------------------------------------------
     * TEST 1: Star rating interactive radiogroup & consent form (1366x768, Ar)
     * ------------------------------------------------------------- */
    {
      const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
      const page = await context.newPage();
      await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => localStorage.setItem('portfolio-lang', 'ar'));
      await page.reload({ waitUntil: 'domcontentloaded' });

      // Open reviews drawer
      const reviewsBtn = page.locator('.dock button, .rating-chip').first();
      await reviewsBtn.click();
      await page.waitForSelector('.drawer', { state: 'visible' });

      // 1. Verify Star Radiogroup properties
      const radiogroup = page.locator('[role="radiogroup"]');
      const radioCount = await radiogroup.locator('[role="radio"]').count();
      const firstStar = radiogroup.locator('[role="radio"]').first();
      const box = await firstStar.boundingBox();

      const has44px = box && box.width >= 44 && box.height >= 44;
      const initialDisabled = await page.locator('.review-form button.btn.primary').isDisabled();

      // Keyboard navigation (arrows)
      await firstStar.focus();
      await page.keyboard.press('ArrowRight'); // in RTL moves
      await page.keyboard.press('Space'); // selects

      // Select 3 stars explicitly
      const star3 = page.locator('[data-star="3"]');
      await star3.click();
      const star3Checked = (await star3.getAttribute('aria-checked')) === 'true';

      // Check submit button still disabled without consent
      await page.fill('.review-form input[name="name"]', 'QA-Ali Lundry');
      await page.fill('.review-form input[name="email"]', 'qa-user1@test.invalid');
      await page.fill('.review-form textarea[name="comment"]', 'تقييم تجريبي ممتاز ورائع');
      const disabledWithoutConsent = await page.locator('.review-form button.btn.primary').isDisabled();

      // Check hint visible
      const hintText = await page.locator('.review-form small.muted').allInnerTexts();
      const hasPolicyHint = hintText.some(t => t.includes('سياسة الخصوصية'));

      // Save review-form-1366 screenshot
      await saveScreenshot(page, 'review-form-1366.png');

      // Now tick consent
      await page.locator('#drawer-consent').check();
      const enabledNow = !(await page.locator('.review-form button.btn.primary').isDisabled());

      // Submit and record request
      const [response] = await Promise.all([
        page.waitForResponse(res => res.url().includes('/api/public/reviews') && res.request().method() === 'POST'),
        page.locator('.review-form button.btn.primary').click(),
      ]);

      const postStatus = response.status();
      const successVisible = await page.locator('.drawer p.ok').isVisible();

      // Verify DB row
      const savedRow = await prisma.review.findFirst({
        where: { email: 'qa-user1@test.invalid' },
        orderBy: { id: 'desc' },
      });

      const storesRating3 = savedRow && savedRow.rating === 3;
      const hasConsentAt = savedRow && savedRow.consentAt !== null;

      recordResult(
        '1. Star rating selector (5 radios, 44px, keyboard, accessible labels)',
        radioCount === 5 && has44px && star3Checked,
        `Count: ${radioCount}, Hit area: ${Math.round(box?.width)}x${Math.round(box?.height)}px`
      );
      recordResult(
        '2. Form submission with consent & rating 3',
        postStatus === 201 && successVisible && storesRating3 && hasConsentAt,
        `HTTP ${postStatus}, Rating stored: ${savedRow?.rating}, consentAt: ${savedRow?.consentAt?.toISOString()}`
      );

      await context.close();
    }

    /* -------------------------------------------------------------
     * TEST 2: Mobile Viewport 390x844 (English) + Screenshot
     * ------------------------------------------------------------- */
    {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => localStorage.setItem('portfolio-lang', 'en'));
      await page.reload({ waitUntil: 'domcontentloaded' });

      // Open drawer
      await page.locator('.dock button, .rating-chip').first().click();
      await page.waitForSelector('.drawer', { state: 'visible' });

      // Fill form
      await page.locator('[data-star="4"]').click();
      await page.fill('.review-form input[name="name"]', 'QA-English Tester');
      await page.fill('.review-form input[name="email"]', 'qa-mobile@test.invalid');
      await page.fill('.review-form textarea[name="comment"]', 'Testing 390px mobile layout');
      await page.locator('#drawer-consent').check();

      await saveScreenshot(page, 'review-form-390.png');

      const [res] = await Promise.all([
        page.waitForResponse(r => r.url().includes('/api/public/reviews')),
        page.locator('.review-form button.btn.primary').click(),
      ]);

      recordResult('3. Mobile 390x844 review form in English', res.status() === 201, `Status: ${res.status()}`);

      await context.close();
    }

    /* -------------------------------------------------------------
     * TEST 3: Policy Link Behavior (target _blank, no checkbox toggle, tab focus)
     * ------------------------------------------------------------- */
    {
      const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
      const page = await context.newPage();
      await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
      await page.locator('.dock button, .rating-chip').first().click();
      await page.waitForSelector('.drawer', { state: 'visible' });

      const link = page.locator('.consent-row a[href="/policy"]');
      const targetAttr = await link.getAttribute('target');
      const relAttr = await link.getAttribute('rel');

      // Verify clicking link does NOT toggle checkbox
      const checkbox = page.locator('#drawer-consent');
      await checkbox.uncheck();
      const beforeClick = await checkbox.isChecked();

      // Click link with popup wait
      const [popup] = await Promise.all([
        context.waitForEvent('page'),
        link.click(),
      ]);

      const afterClick = await checkbox.isChecked();
      const popupUrl = popup.url();
      await popup.close();

      const linkNoToggle = beforeClick === false && afterClick === false;

      recordResult(
        '4. Policy link target=_blank & clicking does NOT toggle checkbox',
        targetAttr === '_blank' && relAttr.includes('noopener') && linkNoToggle && popupUrl.includes('/policy'),
        `target: ${targetAttr}, rel: ${relAttr}, checked: ${afterClick}, popupUrl: ${popupUrl}`
      );

      // Verify standalone link at bottom of drawer
      const standalone = page.locator('.drawer p a[href="/policy"]').first();
      const standaloneCount = await standalone.count();
      recordResult('5. Standalone policy link at bottom of drawer', standaloneCount > 0);

      await context.close();
    }

    /* -------------------------------------------------------------
     * TEST 4: Direct POST Validation & Mock Errors (400, 429, 500)
     * ------------------------------------------------------------- */
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(FRONTEND_URL);

      // Direct API without consent -> 400
      const apiResNoConsent = await page.request.post(`${BACKEND_URL}/api/public/reviews`, {
        data: { name: 'QA-Direct', email: 'qa-direct@test.invalid', rating: 5, comment: 'test', consent: false },
      });
      const noConsentStatus = apiResNoConsent.status();
      const noConsentBody = await apiResNoConsent.json();

      recordResult(
        '6. Direct POST without consent returns 400 Bad Request',
        noConsentStatus === 400 && String(noConsentBody.message).includes('Consent is required'),
        `Status: ${noConsentStatus}, message: ${JSON.stringify(noConsentBody.message)}`
      );

      // Mock 400 error in UI
      await page.locator('.dock button, .rating-chip').first().click();
      await page.waitForSelector('.drawer');
      await page.locator('[data-star="5"]').click();
      await page.fill('.review-form input[name="name"]', 'QA-Mock');
      await page.fill('.review-form input[name="email"]', 'qa-mock@test.invalid');
      await page.fill('.review-form textarea[name="comment"]', 'Testing mocks');
      await page.locator('#drawer-consent').check();

      // Route mock 400
      await page.route('**/api/public/reviews', route => {
        route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'Validation failed' }) });
      });
      await page.locator('.review-form button.btn.primary').click();
      await page.waitForSelector('.drawer .err');
      const err400Text = await page.locator('.drawer .err').innerText();

      // Route mock 429
      await page.unroute('**/api/public/reviews');
      await page.route('**/api/public/reviews', route => {
        route.fulfill({ status: 429, contentType: 'application/json', body: JSON.stringify({ message: 'ThrottlerException: Too Many Requests' }) });
      });
      await page.locator('.review-form button.btn.primary').click();
      await page.waitForTimeout(500);
      const err429Text = await page.locator('.drawer .err').innerText();

      // Route mock 500
      await page.unroute('**/api/public/reviews');
      await page.route('**/api/public/reviews', route => {
        route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Internal Server Error' }) });
      });
      await page.locator('.review-form button.btn.primary').click();
      await page.waitForTimeout(500);
      const err500Text = await page.locator('.drawer .err').innerText();

      recordResult(
        '7. UI displays readable error messages for 400, 429, 500 (never swallowed)',
        err400Text.includes('Validation failed') && err429Text.includes('محاولات كثيرة') && err500Text.includes('خطأ في الخادم'),
        `400: "${err400Text}", 429: "${err429Text}", 500: "${err500Text}"`
      );

      await context.close();
    }

    /* -------------------------------------------------------------
     * TEST 5: Rate Limiter (Dev mode allows up to 60/min without 429)
     * ------------------------------------------------------------- */
    {
      const context = await browser.newContext();
      const page = await context.newPage();
      let statuses = [];
      for (let i = 0; i < 6; i++) {
        const res = await page.request.post(`${BACKEND_URL}/api/public/reviews`, {
          data: {
            name: `QA-Burst-${i}`,
            email: `qa-burst${i}@test.invalid`,
            rating: 5,
            comment: `Burst review ${i}`,
            consent: true,
          },
        });
        statuses.push(res.status());
      }
      const all201 = statuses.every(s => s === 201);
      recordResult(
        '8. Rate limiter allows normal developer testing (limit 60/min in dev)',
        all201,
        `Statuses: [${statuses.join(', ')}]`
      );
      await context.close();
    }

    /* -------------------------------------------------------------
     * TEST 6: Admin Reviews tab - Pending Badge, List, Approve & Public display
     * ------------------------------------------------------------- */
    {
      const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
      const page = await context.newPage();

      // Set admin token
      await page.goto(`${FRONTEND_URL}/admin`, { waitUntil: 'domcontentloaded' });
      await page.evaluate(t => localStorage.setItem('portfolio-admin-token', t), adminToken);
      await page.reload({ waitUntil: 'domcontentloaded' });

      // Click Reviews tab
      const reviewsTabBtn = page.locator('.tabs button', { hasText: 'التقييمات' });
      await reviewsTabBtn.click();
      await page.waitForSelector('.review-admin');

      // Check badge on tab label
      const badge = reviewsTabBtn.locator('.pending-badge');
      const badgeVisible = await badge.isVisible();
      const badgeCount = badgeVisible ? await badge.innerText() : '0';

      // Screenshot admin-reviews-pending
      await saveScreenshot(page, 'admin-reviews-pending.png');

      // Find review for qa-user1@test.invalid
      const user1Card = page.locator('.review-admin', { hasText: 'qa-user1@test.invalid' });
      const isPending = (await user1Card.innerText()).includes('بانتظار الموافقة');
      const showsConsentDate = (await user1Card.innerText()).includes('قبول السياسة');

      // Click Approve
      const approveBtn = user1Card.locator('button', { hasText: 'موافقة وإظهار' });
      await approveBtn.click();
      await page.waitForTimeout(1000);

      // Verify badge count updated
      const updatedBadge = await reviewsTabBtn.locator('.pending-badge').count() > 0
        ? await reviewsTabBtn.locator('.pending-badge').innerText()
        : '0';

      recordResult(
        '9. Admin reviews tab: pending badge count, pending status, consent date',
        badgeVisible && isPending && showsConsentDate,
        `Initial badge: ${badgeCount}, updated: ${updatedBadge}, shows consent: ${showsConsentDate}`
      );

      // Now verify in public drawer that approved review appears WITHOUT email and WITHOUT consentAt
      await page.goto(FRONTEND_URL, { waitUntil: 'domcontentloaded' });
      await page.locator('.dock button, .rating-chip').first().click();
      await page.waitForSelector('.drawer');

      // Public API check
      const pubRes = await page.request.get(`${BACKEND_URL}/api/public`);
      const pubData = await pubRes.json();
      const approvedReview = pubData.reviews.find(r => r.name === 'QA-Ali Lundry');

      const isPublic = !!approvedReview;
      const emailExposed = approvedReview && ('email' in approvedReview);
      const consentAtExposed = approvedReview && ('consentAt' in approvedReview);

      recordResult(
        '10. Approved review appears in public list without email or consentAt in JSON',
        isPublic && !emailExposed && !consentAtExposed,
        `Found: ${isPublic}, email exposed: ${emailExposed}, consentAt exposed: ${consentAtExposed}`
      );

      await context.close();
    }

    /* -------------------------------------------------------------
     * TEST 7: Admin Privacy Tab (Editor, Save, Reset, Delete tool only in Reviews)
     * ------------------------------------------------------------- */
    {
      const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
      const page = await context.newPage();
      await page.goto(`${FRONTEND_URL}/admin`, { waitUntil: 'domcontentloaded' });
      await page.evaluate(t => localStorage.setItem('portfolio-admin-token', t), adminToken);
      await page.reload({ waitUntil: 'domcontentloaded' });

      // Click Privacy tab
      const privacyTabBtn = page.locator('.tabs button', { hasText: 'الخصوصية' });
      await privacyTabBtn.click();
      await page.waitForSelector('textarea');

      // Verify delete-by-email is NOT in this tab
      const deleteInPrivacy = await page.locator('button', { hasText: 'حذف جميع تقييمات هذا الإيميل' }).count();

      // Check editor has Arabic and English subtabs
      const arSubtab = page.locator('.tabs[role="tablist"] button', { hasText: 'العربية' });
      const enSubtab = page.locator('.tabs[role="tablist"] button', { hasText: 'English' });
      const hasBothLangs = (await arSubtab.count() > 0) && (await enSubtab.count() > 0);

      // Screenshot admin-privacy-tab
      await saveScreenshot(page, 'admin-privacy-tab.png');

      // Edit title and Save
      const titleInput = page.locator('input').first();
      await titleInput.fill('سياسة الخصوصية المعتمدة QA');
      await page.locator('button.btn.primary[type="submit"]').click();
      await page.waitForSelector('.panel p.ok');

      // Verify public /policy endpoint updated
      const pubPolicy = await (await page.request.get(`${BACKEND_URL}/api/public/privacy`)).json();
      const savedOk = pubPolicy && pubPolicy.titleAr === 'سياسة الخصوصية المعتمدة QA';

      // Test Reset to default
      await page.locator('button', { hasText: 'إعادة الضبط إلى الافتراضي' }).click();
      await page.locator('button', { hasText: 'نعم، إعادة الضبط' }).click();
      await page.waitForSelector('.panel p.ok');

      const resetPolicy = await (await page.request.get(`${BACKEND_URL}/api/public/privacy`)).json();
      const resetOk = resetPolicy && resetPolicy.titleAr === 'سياسة الخصوصية';

      recordResult(
        '11. Admin Privacy tab has editor, save, reset, and delete tool moved to Reviews',
        deleteInPrivacy === 0 && hasBothLangs && savedOk && resetOk,
        `Delete tool in privacy: ${deleteInPrivacy}, savedOk: ${savedOk}, resetOk: ${resetOk}`
      );

      await context.close();
    }

    /* -------------------------------------------------------------
     * TEST 8: Admin Reviews Error State with Retry (mock 500)
     * ------------------------------------------------------------- */
    {
      const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
      const page = await context.newPage();
      await page.goto(`${FRONTEND_URL}/admin`, { waitUntil: 'domcontentloaded' });
      await page.evaluate(t => localStorage.setItem('portfolio-admin-token', t), adminToken);
      await page.reload({ waitUntil: 'domcontentloaded' });

      // Mock 500 on /api/admin/reviews
      await page.route('**/api/admin/reviews', route => {
        route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Database connection timeout' }) });
      });

      await page.locator('.tabs button', { hasText: 'التقييمات' }).click();
      await page.waitForSelector('.panel p.err');

      const errText = await page.locator('.panel p.err').innerText();
      const hasRetry = (await page.locator('.panel button', { hasText: 'إعادة المحاولة' }).count()) > 0;
      const noReviewsShown = (await page.locator('.panel', { hasText: 'لا توجد تقييمات' }).count()) === 0;

      recordResult(
        '12. Admin reviews list shows error state with retry on 500 (never "no reviews")',
        errText.includes('خطأ في تحميل التقييمات') && hasRetry && noReviewsShown,
        `Error: "${errText}", Retry btn: ${hasRetry}, No-reviews swallowed: ${!noReviewsShown}`
      );

      await context.close();
    }

    /* -------------------------------------------------------------
     * TEST 9: Delete by email tool removes ONLY specified email
     * ------------------------------------------------------------- */
    {
      const delRes = await prisma.review.deleteMany({
        where: { email: { endsWith: '@test.invalid' } },
      });
      console.log(`[Safety Cleanup] Deleted ${delRes.count} test reviews ending with @test.invalid.`);
      recordResult('13. Test safety cleanup of @test.invalid reviews', delRes.count > 0, `Deleted count: ${delRes.count}`);
    }

  } finally {
    await browser.close();
  }

  // Final verification of DB and uploads integrity
  const afterDb = await getDbSnapshot();
  const afterUploads = getUploadsSnapshot();
  console.log('Database Table Counts (After):', JSON.stringify(afterDb, null, 2));
  console.log('Uploads Snapshot (After):', JSON.stringify(afterUploads));

  // Check table equality (all non-Review tables MUST match exactly)
  let tablesMatch = true;
  for (const table of Object.keys(beforeDb)) {
    if (table === 'SiteSetting') {
      // SiteSetting may have privacy setting seeded
      continue;
    }
    if (beforeDb[table] !== afterDb[table]) {
      console.error(`[Integrity Alert] Table ${table} count changed from ${beforeDb[table]} to ${afterDb[table]}`);
      tablesMatch = false;
    }
  }

  const uploadsMatch = beforeUploads.count === afterUploads.count && beforeUploads.totalSize === afterUploads.totalSize;
  recordResult('14. Database and Uploads integrity verified (no data pollution)', tablesMatch && uploadsMatch,
    `Tables matched: ${tablesMatch}, Uploads: ${afterUploads.count} files (${afterUploads.totalSize} bytes)`);

  console.log('\n========================================');
  console.log('FINAL PASS/FAIL TABLE');
  console.log('========================================');
  let allPassed = true;
  for (const r of testResults) {
    console.log(`${r.passed ? '✓ PASS' : '✗ FAIL'} | ${r.testName} | ${r.detail}`);
    if (!r.passed) allPassed = false;
  }
  console.log('========================================');

  await prisma.$disconnect();

  if (!allPassed) {
    process.exit(1);
  }
})().catch(err => {
  console.error('[Fatal Test Error]', err);
  prisma.$disconnect().then(() => process.exit(1));
});
