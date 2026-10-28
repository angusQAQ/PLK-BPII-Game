import assert from 'node:assert/strict';
import {getBrowser} from '../scripts/browser.mjs';
const base=(process.env.TEST_URL||'http://127.0.0.1:3000').replace(/\/+$/,'')+'/';
const publicRun=process.env.PUBLIC_PREVIEW==='1';
const browser=await getBrowser();try{
 // Strict opaque origins are checked against the real public HTTPS server;
 // browser interception of that mode does not preserve CORS response headers.
 for(const sandbox of (publicRun?['allow-scripts allow-same-origin','allow-scripts']:['allow-scripts allow-same-origin'])){
  const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{window.__audioSources=[];const original=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){window.__audioSources.push(this.src);return original.call(this);};});
  const assetBase=publicRun?base:'http://game-assets.example.test/';
  if(!publicRun)await page.context().route(assetBase+'**',async route=>{
   try{const url=new URL(route.request().url().slice(assetBase.length),base),response=await page.request.get(url.href);await route.fulfill({status:response.status(),body:await response.body(),headers:{...response.headers(),'access-control-allow-origin':'*'}});}
   catch(error){if(!page.isClosed())throw error;}
  });
  const response=publicRun?await page.goto(base+'?preview-check='+Date.now(),{waitUntil:'domcontentloaded'}):await page.request.get(base);
  let html=await response.text();
  if(publicRun)assert(html.includes(`<base href="${base}">`));
  else html=html.replace(/<base[^>]*>/g,'').replace('<head>',`<head><base href="${assetBase}">`);
  const escaped=html.replace(/&/g,'&amp;').replace(/"/g,'&quot;'),host=(publicRun?'https:':'http:')+'//preview.invalid/';
  await page.route(host,route=>route.fulfill({contentType:'text/html',body:`<!doctype html><iframe sandbox="${sandbox}" allow="autoplay" srcdoc="${escaped}" style="position:fixed;inset:0;width:100%;height:100%;border:0"></iframe>`}));
  await page.goto(host);const frame=page.frameLocator('iframe');
  await frame.locator('.hero-doll canvas[data-doll-rendered]').first().waitFor();
  const child=await (await page.locator('iframe').elementHandle()).contentFrame();assert(child);
  assert(await child.evaluate(()=>[...document.styleSheets].every(sheet=>{try{return sheet.cssRules.length>0;}catch{return false;}})),'Preview stylesheets must remain readable');
  assert(await child.evaluate(()=>document.querySelector('.hero-doll canvas').toDataURL().startsWith('data:image/png')));
  await frame.getByRole('button',{name:'開始製作'}).click();await frame.getByRole('button',{name:'製作女生玩偶'}).click();
  for(const label of ['短短的頭髮','圓圓的眼睛','小小的耳朵','小小的鼻子','小小的嘴巴','圓圓的臉','校服']){
   await frame.getByRole('button',{name:label,exact:true}).click();await frame.locator('#next-button:not([disabled])').waitFor();await frame.locator('#next-button').click();
  }
  await frame.getByRole('button',{name:'粵語朗讀整段句子'}).click();
  await child.waitForFunction(()=>window.__audioSources.some(source=>source.includes('sentence-1.mp3')));
  assert(await child.evaluate(()=>document.querySelector('.finished-doll canvas').toDataURL().startsWith('data:image/png')));
  assert((await child.evaluate(()=>window.__audioSources)).every(source=>source.startsWith(new URL(assetBase).origin)));
  assert.deepEqual(errors,[]);assert(await frame.locator('#load-status').isHidden());
  console.log(`PASS Cross-origin preview, full gameplay, speech and readable canvases (${sandbox})`);await page.close();
 }
}finally{await browser.close();}
