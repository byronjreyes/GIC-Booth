const { chromium } = require('C:/Users/byron.reyes/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({channel:'msedge',headless:true});
 try {
  const page=await browser.newPage();
  for(const [width,height] of [[1440,900],[390,844]]) {
   await page.setViewportSize({width,height});
   await page.goto('http://localhost:5173');
   await page.locator('.welcome-photo-row img').evaluateAll(images => Promise.all(images.map(img => img.decode())));
   await page.evaluate(()=>document.fonts.ready);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.screenshot({path:`welcome-${width}.png`});
   await page.locator('.welcome').focus();
   await page.keyboard.press('Enter');
   await page.locator('.layout-options').waitFor();
   console.log('PASS',width,'image loaded, no overflow, keyboard starts session');
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
