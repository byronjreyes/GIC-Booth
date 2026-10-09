const { chromium } = require('C:/Users/byron.reyes/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    for (const [width, height] of [[1440, 900], [390, 844]]) {
      await page.setViewportSize({ width, height });
      await page.goto('http://localhost:5173');
      await page.locator('.welcome').click();
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.locator('.layout-option').count(), 10);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `layout-${width}.png`, fullPage: true });
      for (let index = 0; index < 10; index++) {
        await page.locator('.layout-option').nth(index).click();
        await page.locator('.timer-options').waitFor();
        await page.getByRole('button', { name: 'Go back', exact: true }).click();
      }
      await page.locator('.layout-option').first().focus();
      await page.keyboard.press('Enter');
      await page.locator('.timer-options').waitFor();
      console.log(`PASS ${width}: ten layouts, no overflow, all choices and keyboard advance to timer`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
