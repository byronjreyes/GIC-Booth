const { chromium } = require('C:/Users/byron.reyes/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  try {
    const page = await browser.newPage({ permissions: ['camera'] });
    page.on('pageerror', e => console.log('ERROR', e.message));
    let shareId;
    page.on('request', req => {
      if (req.method() === 'POST' && req.url().includes('/api/shares/')) {
        shareId = req.url().split('/').pop();
        const body = req.postDataJSON();
        console.log('PUBLISH', shareId, Object.keys(body), body.progress, body.videoError || '');
      }
    });
    await page.goto('http://127.0.0.1:5173');
    await page.locator('.welcome').click();
    await page.getByRole('button', { name: /Classic 4 Cut/ }).click();
    await page.locator('.timer-options button').first().click();
    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await page.getByRole('heading', { name: 'Keep the good ones.' }).waitFor({ timeout: 45000 });
    const photos = page.locator('.photo-grid button');
    for (let i = 0; i < 4; i++) await photos.nth(i).click();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.waitForTimeout(25000);
    assert.ok(shareId);
    const data = await (await page.request.get(`http://127.0.0.1:5173/api/shares/${shareId}`)).json();
    console.log('RESULT', JSON.stringify(data));
    assert.ok(data.video, data.videoError || 'Video missing');
    await page.goto(`http://127.0.0.1:5173/share/${shareId}`);
    await page.getByRole('button', { name: 'Video', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('video')?.currentTime > 0.5);
    for (const layout of ['Single', 'Double']) {
      await page.getByRole('button', { name: layout, exact: true }).click();
      await page.waitForFunction(() => document.querySelector('video')?.currentTime > 0.5);
      console.log('PLAYING', layout, await page.locator('video').evaluate(v => ({ width:v.videoWidth, height:v.videoHeight, time:v.currentTime, error:v.error?.message })));
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
