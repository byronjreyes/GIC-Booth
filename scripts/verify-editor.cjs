const { chromium } = require('C:/Users/byron.reyes/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({channel:'msedge',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 try {
  const page = await browser.newPage({permissions:['camera'],ignoreHTTPSErrors:true,viewport:{width:1440,height:900}});
  await page.goto(process.env.BOOTH_URL || 'http://127.0.0.1:5173');
  await page.locator('.welcome').click();
  await page.getByRole('button',{name:/Classic 4 Cut/}).click();
  await page.locator('.timer-options button').first().click();
  await page.getByRole('button',{name:'Start',exact:true}).click();
  await page.locator('.photo-grid button').first().waitFor({timeout:45000});
  for(let i=0;i<4;i++) await page.locator('.photo-grid button').nth(i).click();
  await page.getByRole('button',{name:'Next',exact:true}).click();
  await page.locator('.result-strip').waitFor();
  for(const width of [1440,768,390]) {
   await page.setViewportSize({width,height:900});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Overflow at ${width}`);
   for(const name of ['Filters','Stickers','Doodle','Themes']) {
    const button=page.locator('.result-tabs').getByRole('button',{name,exact:true});
    await button.click();
    assert.equal(await button.getAttribute('aria-pressed'),'true');
   }
   await page.screenshot({path:`editor-${width}.png`,fullPage:true});
   console.log('PASS editor',width);
  }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
