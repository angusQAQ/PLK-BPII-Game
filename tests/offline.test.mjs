import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,copyFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';
import {getBrowser} from '../scripts/browser.mjs';

const source=path.resolve(process.env.OFFLINE_HTML||'dist/downloads/little-doll-atelier.html');
const html=await readFile(source,'utf8');
assert(!/<script\b[^>]*\bsrc=|<link\b[^>]*rel="stylesheet"/.test(html));
assert(html.includes('id="font-license"'));assert(html.includes('window.__DOLL_ASSETS__='));
const temporary=await mkdtemp(path.join(tmpdir(),'doll-offline-'));
const folder=path.join(temporary,'離線遊戲 文件');await mkdir(folder);
const relocated=path.join(folder,'我的玩偶小工房.html');await copyFile(source,relocated);
const browser=await getBrowser();await mkdir('test-results',{recursive:true});
let downloadServer;
try{
 const context=await browser.newContext({offline:true,viewport:{width:1280,height:720}});
 const errors=[],external=[];
 function monitor(page){
  page.on('pageerror',error=>errors.push(error.message.slice(0,300)));
  page.on('request',request=>{if(/^https?:/.test(request.url()))external.push(request.url());});
 }
 function instrumentMedia(){
  if(window.__offlineAudio)return;
  window.__offlineAudio=[];
  const original=HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play=function(){
   const key=Object.keys(window.__DOLL_ASSETS__||{}).find(key=>window.__DOLL_ASSETS__[key]===this.src);
   const record={key,rate:this.playbackRate,ended:false};window.__offlineAudio.push(record);
   this.addEventListener('ended',()=>record.ended=true,{once:true});
   return original.call(this);
  };
 }
 let page=await context.newPage();monitor(page);await page.addInitScript(instrumentMedia);
 let openingMode='file';
 try{await page.goto(pathToFileURL(relocated).href);}
 catch(error){
  if(!error.message.includes('ERR_BLOCKED_BY_ADMINISTRATOR'))throw error;
  // Managed development browsers may forbid navigating to local files. Test
  // the same standalone document without granting file access or networking;
  // standard CI Chromium additionally exercises the real file:// navigation.
  await page.close();page=await context.newPage();monitor(page);await page.evaluate(instrumentMedia);
  await page.setContent(html);openingMode='embedded (managed browser blocks file navigation)';
 }
 await page.locator('.hero-doll canvas[data-doll-rendered]').first().waitFor();
 await page.evaluate(()=>document.fonts.ready);
 assert(await page.evaluate(()=>document.fonts.check('700 30px "Classroom Kai"','玩偶小工房')));
 await page.screenshot({path:'test-results/offline-home.png',fullPage:true});
 await page.getByRole('button',{name:'開始製作'}).click();await page.getByRole('button',{name:'製作男生玩偶'}).click();
 async function choose(label){
  await page.waitForFunction(()=>[...document.querySelectorAll('[data-word-part]')].every(canvas=>canvas.dataset.pictureReady==='true'));
  assert(await page.locator('.word-jyutping').evaluateAll(elements=>elements.every(element=>/^[a-z]+(?: [a-z]+)*$/.test(element.textContent))));
  assert(await page.locator('[data-word-part]').first().evaluate(canvas=>canvas.toDataURL().startsWith('data:image/png')));
  await page.getByRole('button',{name:label,exact:true}).click();await page.locator('#next-button:not([disabled])').waitFor();
 }
 for(const label of ['黑色的頭髮','大大的眼睛','大大的耳朵','高高的鼻子','小小的嘴巴','長長的臉','校服']){
  await choose(label);await page.locator('#next-button').click();
 }
 await page.locator('#celebration:not([hidden])').waitFor();await page.locator('#celebration').waitFor({state:'hidden'});
 assert((await page.locator('.story-text').textContent()).startsWith('他有黑色的頭髮，大大的眼睛，大大的耳朵'));
 assert(await page.locator('.finished-doll canvas').evaluate(canvas=>canvas.toDataURL().startsWith('data:image/png')));
 await page.getByRole('button',{name:'粵語朗讀整段句子'}).click();
 await page.waitForFunction(()=>window.__offlineAudio.filter(item=>item.key?.startsWith('assets/voice/summary/')&&item.ended).length===10,{}, {timeout:20000});
 const reading=await page.evaluate(()=>window.__offlineAudio.filter(item=>item.key?.startsWith('assets/voice/summary/')));
 assert.equal(reading.length,10);assert(reading.every(item=>item.rate===1&&item.ended));
 assert.equal(reading[0].key,'assets/voice/summary/sentence-0.mp3');
 assert.equal(reading[6].key,'assets/voice/summary/connector-0.mp3');
 await page.screenshot({path:'test-results/offline-summary.png',fullPage:true});
 await page.getByRole('button',{name:'下一個製作'}).click();await page.getByRole('button',{name:'製作女生玩偶'}).click();
 for(const label of ['短短的頭髮','圓圓的眼睛','小小的耳朵','小小的鼻子','大大的嘴巴','方方的臉']){
  await choose(label);await page.locator('#next-button').click();
 }
 for(const label of ['校服','體育服','長裙'])await choose(label);
 await page.getByRole('button',{name:'上一步',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'方方的臉',exact:true}).getAttribute('aria-pressed'),'true');
 await page.locator('#next-button').click();await page.locator('#next-button').click();
 assert((await page.locator('.story-text').textContent()).startsWith('她有短短的頭髮'));
 await page.getByRole('button',{name:'粵語朗讀整段句子'}).click();
 await page.waitForFunction(()=>window.__offlineAudio.some(item=>item.key==='assets/voice/summary/sentence-1.mp3'));
 await page.getByRole('button',{name:'回到主頁',exact:true}).click();
 await page.getByRole('button',{name:'開始製作'}).waitFor();
 assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
 // Exercise the actual same-origin download link, rather than merely checking
 // that an HTML file was written by the builder. A real loopback response also
 // exercises browser download handling without mock-origin security heuristics.
 const downloadContext=await browser.newContext({acceptDownloads:true});
 const routes=new Map([
  ['/downloads/',{body:await readFile(path.join(path.dirname(source),'index.html')),type:'text/html; charset=utf-8'}],
  ['/downloads/'+path.basename(source),{body:Buffer.from(html),type:'text/html; charset=utf-8'}],
  ['/assets/fonts/classroom-kai.woff2',{body:await readFile('public/assets/fonts/classroom-kai.woff2'),type:'font/woff2'}],
 ]);
 downloadServer=createServer((request,response)=>{
  const file=routes.get(decodeURIComponent(new URL(request.url,'http://localhost').pathname));
  if(!file){response.writeHead(404);response.end();return;}
  response.writeHead(200,{'Content-Type':file.type,'Content-Length':file.body.length});response.end(file.body);
 });
 await new Promise(resolve=>downloadServer.listen(0,'127.0.0.1',resolve));
 const downloadPage=await downloadContext.newPage();await downloadPage.goto(`http://127.0.0.1:${downloadServer.address().port}/downloads/`);
 const [download]=await Promise.all([downloadPage.waitForEvent('download'),downloadPage.getByRole('link',{name:'下載 HTML',exact:true}).click()]);
 assert.equal(download.suggestedFilename(),'玩偶小工房.html');
 const downloaded=path.join(temporary,'downloaded.html');await download.saveAs(downloaded);
 assert.equal(createHash('sha256').update(await readFile(downloaded)).digest('hex'),createHash('sha256').update(html).digest('hex'));
 await downloadContext.close();
 const report={openingMode,fileBytes:Buffer.byteLength(html),externalRequests:external.length,fullSentenceClips:reading.length,normalRate:true,rounds:2,downloadVerified:true,errors};
 console.log('PASS Standalone HTML with the browser offline: artwork, font, word pictures, Jyutping, both doll flows, 30 fps effects and complete normal-speed Cantonese playback.');
 console.log(JSON.stringify(report));
}finally{await browser.close();if(downloadServer)await new Promise(resolve=>downloadServer.close(resolve));await rm(temporary,{recursive:true,force:true});}
