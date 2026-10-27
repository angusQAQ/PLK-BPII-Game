import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {getBrowser} from '../scripts/browser.mjs';
const base=(process.env.TEST_URL||'http://127.0.0.1:3000').replace(/\/+$/,'');
const report=JSON.parse(await readFile('public/assets/runtime/report.json','utf8'));
assert(report.totalBytes<5*1048576);assert(report.homeBytes<600*1024);
const bundle=await readFile('public/game.bundle.js','utf8');assert(!/import\(|import\.meta|createImageBitmap/.test(bundle));
const browser=await getBrowser();await mkdir('test-results',{recursive:true});
try{
 const compatibility=await browser.newPage(),compatErrors=[];compatibility.on('pageerror',error=>compatErrors.push(error.message));
 await compatibility.addInitScript(()=>{
  window.createImageBitmap=undefined;Image.prototype.decode=undefined;
  Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[],cancel:()=>{},speak:()=>{}},configurable:true});
 });
 await compatibility.goto(base+'/');await compatibility.getByRole('button',{name:'開始製作'}).click();await compatibility.getByRole('button',{name:'製作女生玩偶'}).click();
 await compatibility.getByRole('button',{name:'短短的頭髮',exact:true}).click();await compatibility.waitForFunction(()=>!document.querySelector('#next-button').disabled);
 assert.deepEqual(compatErrors,[]);await compatibility.close();
 console.log('PASS Embedded-browser compatibility without bitmap/decode or speech event APIs');
 const page=await browser.newPage({viewport:{width:1111,height:734}}),errors=[],responses=[];
 page.on('pageerror',error=>errors.push(error.message));page.on('crash',()=>errors.push('Renderer crashed'));
 page.on('response',response=>{responses.push(response);if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`);});
 const cdp=await page.context().newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,downloadThroughput:200000,uploadThroughput:100000,latency:150});
 await page.route(base+'/performance-host',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><iframe title="遊戲" src="${base}/" allow="autoplay" sandbox="allow-scripts allow-same-origin" style="position:fixed;inset:0;width:100%;height:100%;border:0"></iframe>`}));
 const started=Date.now();await page.goto(base+'/performance-host',{waitUntil:'domcontentloaded'});const frame=page.frameLocator('iframe');
 await frame.getByRole('button',{name:'開始製作'}).waitFor({timeout:15000});const interactiveMs=Date.now()-started;
 await frame.locator('.hero-doll canvas[data-doll-rendered]').first().waitFor({timeout:15000});const illustratedHomeMs=Date.now()-started;
 const homeResponses=[...responses];let homeBytes=0;for(const response of homeResponses){if(response.url().includes('/assets/'))homeBytes+=(await response.body().catch(()=>Buffer.alloc(0))).length;}
 assert(homeBytes<1200*1024,`Home transferred ${homeBytes} bytes`);
 await page.screenshot({path:'test-results/performance-home.png',fullPage:true});
 for(const gender of ['boy','girl','boy']){
  const startButton=frame.getByRole('button',{name:'開始製作'});if(await startButton.count())await startButton.click();else await frame.getByRole('button',{name:'下一個製作'}).click();
  await frame.getByRole('button',{name:gender==='boy'?'製作男生玩偶':'製作女生玩偶'}).click();
  const labels=[gender==='girl'?'長長的頭髮':'捲曲的頭髮','圓圓的眼睛','小小的鼻子','小小的嘴巴','方方的臉','校服'];
  for(const label of labels){await frame.getByRole('button',{name:label,exact:true}).click();await frame.locator('#next-button:not([disabled])').waitFor({timeout:30000});await frame.locator('#next-button').click();}
  await frame.locator('.story-text').waitFor();await frame.locator('#celebration:not([hidden])').waitFor({timeout:30000});await frame.locator('#celebration').waitFor({state:'hidden',timeout:15000});
  const text=await frame.locator('.story-text').innerText();assert(text.startsWith(gender==='girl'?'她有':'他有'));
 }
 assert.deepEqual(errors,[]);
 // Exercise the exact animation pager over every frame, measuring retained pages.
 const gameFrame=page.frames().find(frame=>frame.url().startsWith(base)&&!frame.url().endsWith('performance-host'));
 const animation=await gameFrame.evaluate(async()=>{
  const {loadSequence,animationStats}=await import('./frames.js');const sequence=await loadSequence('celebrate',90);
  for(let index=0;index<90;index++)await sequence.frame(index);
  const peak=animationStats();sequence.release();return {peak,after:animationStats()};
 });
 assert(animation.peak.every(item=>item.maxDecodedPages<=2));assert(animation.peak.every(item=>item.decodedBytes<35*1048576));
 assert(animation.after.every(item=>item.decodedPages===0));
 await page.screenshot({path:'test-results/performance-summary.png',fullPage:true});
 const results={interactiveMs,illustratedHomeMs,homeBytes,totalRuntimeArtBytes:report.totalBytes,rounds:3,network:'1.6 Mbps / 150 ms',animation,errors};
 await writeFile('test-results/performance.json',JSON.stringify(results,null,2));console.log('PASS Three complete rounds inside an iframe over a throttled connection, with no crashes or page errors');console.log(JSON.stringify(results));
}finally{await browser.close();}
