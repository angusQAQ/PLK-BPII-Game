import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {getBrowser} from '../scripts/browser.mjs';
import {assertFinishedDoll} from './finished-doll.mjs';

const browser=await getBrowser(),engine=process.env.BROWSER_ENGINE||'chromium';
await mkdir('test-results',{recursive:true});
try{
  const context=await browser.newContext({viewport:{width:1111,height:730},deviceScaleFactor:2});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  // Exercise display independently of the test machine's media codecs/voices.
  await page.route('**/assets/voice/**/manifest.json*',route=>route.fulfill({json:{}}));
  await page.route('**/assets/voice/manifest.json*',route=>route.fulfill({json:{}}));
  await page.addInitScript(()=>{
    Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[{lang:'zh-HK'}],addEventListener(){},cancel(){},speak(){}}});
    window.SpeechSynthesisUtterance=class{};
  });
  await page.goto(process.env.TEST_URL||'http://127.0.0.1:3000/');
  await page.getByRole('button',{name:'開始製作'}).click();
  for(const gender of ['男生','女生']){
    await page.getByRole('button',{name:`製作${gender}玩偶`}).click();
    for(const name of ['短短的頭髮','圓圓的眼睛','小小的耳朵','小小的鼻子','小小的嘴巴','小小的臉',gender==='男生'?'西裝':'校服']){
      await page.getByRole('button',{name,exact:true}).click();
      await page.locator('#next-button:not([disabled])').waitFor();
      await page.locator('#next-button').click();
    }
    await page.locator('#celebration:not([hidden])').waitFor();
    await page.locator('#celebration').waitFor({state:'hidden'});
    for(const viewport of [{width:1111,height:730},{width:1920,height:1080},{width:390,height:844}]){
      await page.setViewportSize(viewport);await assertFinishedDoll(page);
      const layout=await page.evaluate(()=>{
        const doll=document.querySelector('.finished-doll').getBoundingClientRect();
        const story=document.querySelector('.story-card').getBoundingClientRect();
        return {viewport:innerWidth,width:document.documentElement.scrollWidth,dollWidth:doll.width,
          withinPage:doll.left>=0&&story.left>=0&&doll.right<=innerWidth+1&&story.right<=innerWidth+1};
      });
      assert(layout.dollWidth>=250&&layout.width<=layout.viewport&&layout.withinPage,JSON.stringify(layout));
      await page.screenshot({path:`test-results/${engine}-${gender==='男生'?'boy':'girl'}-${viewport.width}.png`,fullPage:true});
    }
    const snapshot=await page.locator('.finished-doll').evaluate(doll=>doll.outerHTML);
    const restored=await context.newPage();await restored.setContent(snapshot);await assertFinishedDoll(restored);
    await page.bringToFront();await restored.close();await assertFinishedDoll(page);
    console.log(`PASS ${engine} ${gender}: completed doll pixels, desktop/mobile widths, Retina display, restored HTML and tabs`);
    await page.setViewportSize({width:1111,height:730});
    await page.getByRole('button',{name:'下一個製作'}).click();
  }
  assert.deepEqual(errors,[]);
}finally{await browser.close();}
