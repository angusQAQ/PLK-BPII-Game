import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {getBrowser} from '../scripts/browser.mjs';
const base=(process.env.TEST_URL||'http://127.0.0.1:3000').replace(/\/+$/,'')+'/';
const browser=await getBrowser();try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{window.__audioSources=[];const original=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){window.__audioSources.push(this.src);return original.call(this);};});
 // GitHub Pages permits public CORS requests. Mirror that header on the test server.
 await page.route(base+'**',async route=>{const response=await route.fetch();await route.fulfill({response,headers:{...response.headers(),'access-control-allow-origin':'*'}});});
 const response=await page.request.get(base);let html=await response.text();
 html=html.replace(/<base[^>]*>/g,'').replace('<head>',`<head><base href="${base}">`);
 const escaped=html.replace(/&/g,'&amp;').replace(/"/g,'&quot;');
 await page.route('http://preview.invalid/',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><iframe sandbox="allow-scripts allow-same-origin" allow="autoplay" srcdoc="${escaped}" style="position:fixed;inset:0;width:100%;height:100%;border:0"></iframe>`}));
 await page.goto('http://preview.invalid/');const frame=page.frameLocator('iframe');
 await frame.getByRole('button',{name:'開始製作'}).click();await frame.getByRole('button',{name:'製作女生玩偶'}).click();
 for(const label of ['短短的頭髮','圓圓的眼睛','小小的鼻子','小小的嘴巴','圓圓的臉','校服']){
  await frame.getByRole('button',{name:label,exact:true}).click();await frame.locator('#next-button:not([disabled])').waitFor();await frame.locator('#next-button').click();
 }
 await frame.getByRole('button',{name:'粵語朗讀整段句子'}).click();
 const child=page.frames().find(frame=>frame.url()==='about:srcdoc');assert(child);
 await child.waitForFunction(()=>window.__audioSources.some(source=>source.includes('sentence-1.mp3')));
 assert((await child.evaluate(()=>window.__audioSources)).every(source=>source.startsWith(new URL(base).origin)));
 assert.deepEqual(errors,[]);assert(await frame.locator('#load-status').isHidden());
 console.log('PASS Cross-origin HTML preview resolves artwork and classic scripts without tainted-canvas readback');
}finally{await browser.close();}
