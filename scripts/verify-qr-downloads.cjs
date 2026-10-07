const { chromium } = require('C:/Users/byron.reyes/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`https://pipe-institutional-regardless-lift.trycloudflare.com/share/${process.argv[2]}`);
    for (const layout of ['Single', 'Double']) {
      await page.getByRole('button', { name: layout, exact: true }).click();
      for (const kind of ['Image', 'Video']) {
        await page.getByRole('button', { name: kind, exact: true }).click();
        if (kind === 'Video') await page.waitForFunction(() => document.querySelector('video')?.currentTime > .5);
        const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: `Download ${kind.toLowerCase()}` }).click()]);
        assert.equal(await download.failure(), null);
        assert.match(download.suggestedFilename(), kind === 'Image' ? /\.png$/ : /\.mp4$/);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        console.log('PASS', layout, kind, download.suggestedFilename());
      }
    }
    await page.screenshot({ path: 'qr-mobile-check.png' });
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
