import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile} from 'node:fs/promises';
import {getBrowser} from '../scripts/browser.mjs';

const base=process.env.TEST_URL||'http://127.0.0.1:3000';
await mkdir('test-results',{recursive:true});
const browser=await getBrowser();
const errors=[];
let passed=0;
function pass(name){passed++;console.log(`PASS ${name}`);}
async function mockCantonese(page){
  await page.route('**/assets/voice/manifest.json*',route=>route.fulfill({json:{}}));
  await page.route('**/assets/voice/summary/manifest.json*',route=>route.fulfill({json:{}}));
  await page.addInitScript(()=>{
  window.__spoken=[];
  const voices=[{name:'Test Mandarin',lang:'zh-CN'},{name:'Test Cantonese',lang:'zh-HK'}];
  Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>voices,addEventListener:()=>{},cancel:()=>{},speak:u=>window.__spoken.push({text:u.text,lang:u.lang,rate:u.rate})},configurable:true});
  window.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
});}
async function dragWord(page,label,vertical=.3){
  const card=await page.getByRole('button',{name:label,exact:true}).boundingBox();
  const canvas=await page.locator('#doll-canvas').boundingBox();
  await page.mouse.move(card.x+card.width/2,card.y+card.height/2);await page.mouse.down();
  await page.mouse.move(canvas.x+canvas.width/2,canvas.y+canvas.height*vertical,{steps:16});
  await page.mouse.up();
}
async function select(page,label){
  console.log(`Selecting ${label}`);
  await page.getByRole('button',{name:label,exact:true}).click();
  try{
    await page.waitForFunction(()=>!document.querySelector('#next-button').disabled);
    assert(await page.locator('#doll-canvas').evaluate(c=>{const data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let count=0;for(let i=3;i<data.length;i+=400)if(data[i]>0)count++;return count>100;}),`Doll artwork is blank after ${label}`);
  }
  catch(error){console.error('Selection timeout',label,await page.evaluate(()=>({motion:document.querySelector('#doll-canvas')?.dataset.motion,caption:document.querySelector('#selection-caption')?.textContent})),errors);await page.screenshot({path:'test-results/failure.png',fullPage:true});throw error;}
}
async function next(page){await page.locator('#next-button').click();}
async function noHorizontalOverflow(page){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Horizontal overflow at ${JSON.stringify(page.viewportSize())}`);}
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await mockCantonese(page);await page.goto(base);await page.locator('.hero-doll canvas[data-doll-rendered]').first().waitFor();await page.screenshot({path:'test-results/home.png',fullPage:true});
  await noHorizontalOverflow(page);
  assert.equal(await page.getByRole('button',{name:'開始製作'}).count(),1);
  assert.equal(await page.locator('.header-actions,.site-footer').count(),0);
  assert.equal(await page.getByRole('button',{name:/下載|匯出/}).count(),0);
  pass('Home opens without downloads or unwanted export controls');
  await page.getByRole('button',{name:'開始製作'}).click();
  assert.equal(await page.locator('.eyebrow,.gentle-note,.site-footer').count(),0);
  assert.equal(await page.locator('[data-preview-doll]').count(),2);
  await page.getByRole('button',{name:'製作男生玩偶'}).click();
  assert(await page.locator('#next-button').isDisabled());
  const blank=await page.locator('#doll-canvas').evaluate(c=>c.toDataURL());
  await select(page,'黑色的頭髮');
  const black=await page.locator('#doll-canvas').evaluate(c=>c.toDataURL());
  assert.notEqual(blank,black);
  const hairRenders=new Set([black]);
  for(const label of ['棕色的頭髮','短短的頭髮','捲曲的頭髮']){await select(page,label);hairRenders.add(await page.locator('#doll-canvas').evaluate(c=>c.toDataURL()));}
  assert.equal(hairRenders.size,4,'All four boy hairstyles must differ');
  assert.equal(await page.getByRole('button',{name:'長長的頭髮',exact:true}).count(),0);
  await select(page,'短短的頭髮');
  const short=await page.locator('#doll-canvas').evaluate(c=>c.toDataURL());assert.notEqual(short,black);
  assert.equal(await page.locator('.word-card[aria-pressed="true"]').count(),1);
  await select(page,'黑色的頭髮');await next(page);
  await select(page,'大大的眼睛');
  await page.getByRole('button',{name:'上一步',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'黑色的頭髮',exact:true}).getAttribute('aria-pressed'),'true');
  await next(page);
  assert.equal(await page.getByRole('button',{name:'大大的眼睛',exact:true}).getAttribute('aria-pressed'),'true');
  pass('Single-choice selection changes the artwork and back navigation preserves edits');

  // Every option is exercised. Compare the actual raster output, not just labels.
  const all=[['大大的眼睛','小小的眼睛','圓圓的眼睛'],['高高的鼻子','大大的鼻子','小小的鼻子','圓圓的鼻子'],['大大的嘴巴','小小的嘴巴'],['圓圓的臉','方方的臉','長長的臉','小小的臉']];
  for(const labels of all){
    const renders=new Set();
    for(const label of labels){await select(page,label);renders.add(await page.locator('#doll-canvas').evaluate(c=>c.toDataURL()));}
    assert.equal(renders.size,labels.length,`Options need different artwork: ${labels.join(',')}`);
    if(labels[0]==='大大的眼睛')await select(page,'大大的眼睛');
    if(labels[0]==='高高的鼻子')await select(page,'高高的鼻子');
    if(labels[0]==='圓圓的臉'){
      await page.screenshot({path:'test-results/face-step.png',fullPage:true});
      await select(page,'圓圓的臉');
    }
    await next(page);
  }
  assert.equal(await page.getByRole('button',{name:'長裙',exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'西裝',exact:true}).count(),1);
  await select(page,'校服');const school=await page.locator('#doll-canvas').evaluate(c=>c.toDataURL());
  await select(page,'體育服');const sports=await page.locator('#doll-canvas').evaluate(c=>c.toDataURL());
  await select(page,'西裝');const suit=await page.locator('#doll-canvas').evaluate(c=>c.toDataURL());
  assert.equal(new Set([school,sports,suit]).size,3);
  await page.screenshot({path:'test-results/workshop.png',fullPage:true});
  await next(page);
  assert.equal(await page.locator('.story-text').textContent(),'他有黑色的頭髮，大大的眼睛，高高的鼻子，小小的嘴巴，圓圓的臉。他平日喜歡穿西裝。');
  await page.getByRole('button',{name:'粵語朗讀整段句子'}).click();
  await page.waitForFunction(()=>window.__spoken.at(-1)?.text==='他有黑色的頭髮，大大的眼睛，高高的鼻子，小小的嘴巴，圓圓的臉。他平日喜歡穿西裝。');
  assert.equal(await page.evaluate(()=>window.__spoken.at(-1).rate),1,'Whole sentences use the normal system voice rate');
  assert.equal(await page.locator('.site-footer,.listen-tip,.control-note').count(),0);
  await page.screenshot({path:'test-results/summary.png',fullPage:true});
  pass('All facial options render differently; boy clothing and all five summary clauses are correct');
  const spoken=await page.evaluate(()=>window.__spoken);
  assert(spoken.length>=17);assert(spoken.every(item=>item.lang==='zh-HK'));
  assert(spoken.some(item=>item.text==='高高的鼻子'));
  pass('Every selected card requests its full phrase in Cantonese; Mandarin is never selected (voice mocked)');

  await page.getByRole('button',{name:'下一個製作'}).click();
  await page.getByRole('button',{name:'製作女生玩偶'}).click();
  assert(await page.locator('#next-button').isDisabled());
  // Tap quickly while the previous frame sequence is still being baked/played.
  await page.getByRole('button',{name:'黑色的頭髮',exact:true}).click();
  await page.getByRole('button',{name:'棕色的頭髮',exact:true}).click();
  await page.getByRole('button',{name:'捲曲的頭髮',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('#next-button').disabled);
  assert.equal(await page.getByRole('button',{name:'捲曲的頭髮',exact:true}).getAttribute('aria-pressed'),'true');
  for(const label of ['黑色的頭髮','棕色的頭髮','長長的頭髮','短短的頭髮','捲曲的頭髮'])await select(page,label);
  await next(page);
  for(const label of ['圓圓的眼睛','小小的鼻子','大大的嘴巴','方方的臉']){await select(page,label);await next(page);}
  assert.equal(await page.getByRole('button',{name:'西裝',exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:'長裙',exact:true}).count(),1);
  await select(page,'校服');const girlSchool=await page.locator('#doll-canvas').evaluate(c=>c.toDataURL());assert.notEqual(girlSchool,school);
  await select(page,'體育服');await select(page,'長裙');
  await page.setViewportSize({width:1920,height:1080});await page.screenshot({path:'test-results/whiteboard.png',fullPage:true});await noHorizontalOverflow(page);
  await next(page);
  assert.equal(await page.locator('.story-text').textContent(),'她有捲曲的頭髮，圓圓的眼睛，小小的鼻子，大大的嘴巴，方方的臉。她平日喜歡穿長裙。');
  await page.getByRole('button',{name:'返回修改'}).click();assert.equal(await page.getByRole('button',{name:'長裙',exact:true}).getAttribute('aria-pressed'),'true');
  pass('Girl has different clothing, rapid taps settle on the latest choice, and another doll starts fresh');
  for(const viewport of [{width:1280,height:720},{width:1024,height:768},{width:390,height:844}]){
    await page.setViewportSize(viewport);await noHorizontalOverflow(page);
    if(viewport.width===1280){const dimensions=await page.evaluate(()=>({height:document.documentElement.scrollHeight,viewport:innerHeight}));assert(dimensions.height<=dimensions.viewport+4,`Whiteboard needs vertical scrolling: ${JSON.stringify(dimensions)}`);}
    if(viewport.width===390)await page.screenshot({path:'test-results/mobile.png',fullPage:true});
  }
  await page.getByRole('button',{name:'重新開始',exact:true}).click();
  assert.equal(await page.locator('.gender-cards').count(),1);
  await page.getByRole('button',{name:'回到主頁',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'開始製作'}).count(),1);
  pass('Restart, home, 720p whiteboard, 1080p whiteboard and narrow layouts work');

  const manifest=JSON.parse(await readFile('public/assets/frames/manifest.json','utf8'));
  assert.equal(manifest.fps,30);assert.equal(manifest.sequences.change.frames,24);assert.equal(manifest.sequences.celebrate.frames,90);
  assert.equal(await page.locator('style').count(),0);
  const css=await readFile('public/style.css','utf8');assert(!/@keyframes|animation\s*:|transition\s*:/.test(css));
  pass('30 fps PNG sequences are present; motion does not depend on CSS animation');
  const art=JSON.parse(await readFile('public/assets/painted/manifest.json','utf8'));
  assert.equal(Object.values(art.sheets).reduce((total,sheet)=>total+sheet.sprites.length,0),59);
  for(const sheet of Object.values(art.sheets)){
    const bytes=await readFile('public/assets/painted/'+sheet.file);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),sheet.sha256,`Painted source changed without reindexing: ${sheet.file}`);
    assert.equal(bytes.readUInt32BE(16),sheet.width);assert.equal(bytes.readUInt32BE(20),sheet.height);
  }
  assert.equal(manifest.sourceSha256,art.sheets.effects.sha256);
  for(const group of ['previews','navigation','faceVariants','gentleEyes'])for(const item of Object.values(art[group])){
    const bytes=await readFile('public/assets/painted/'+item.file);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256);
  }
  pass('All 59 painted sprites and complete previews match their generated sources; animation uses painted assets');

  await page.setViewportSize({width:1440,height:900});
  await page.getByRole('button',{name:'開始製作'}).click();
  await page.getByRole('button',{name:'製作男生玩偶'}).click();
  await dragWord(page,'黑色的頭髮');await page.waitForFunction(()=>!document.querySelector('#next-button').disabled);
  assert.equal(await page.getByRole('button',{name:'黑色的頭髮',exact:true}).getAttribute('aria-pressed'),'true');
  const beforeInvalid=await page.locator('#doll-canvas').evaluate(c=>c.toDataURL());
  await dragWord(page,'棕色的頭髮',.83);
  assert.equal(await page.getByRole('button',{name:'黑色的頭髮',exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('#doll-canvas').evaluate(c=>c.toDataURL()),beforeInvalid);
  await next(page);
  await dragWord(page,'大大的眼睛',.25);await page.waitForFunction(()=>!document.querySelector('#next-button').disabled);
  const upperDrop=await page.locator('#doll-canvas').evaluate(c=>c.toDataURL());
  await dragWord(page,'大大的眼睛',.48);await page.waitForFunction(()=>!document.querySelector('#next-button').disabled);
  assert.equal(await page.locator('#doll-canvas').evaluate(c=>c.toDataURL()),upperDrop,'Feature position must not depend on release coordinates');
  await next(page);
  for(const label of ['高高的鼻子','小小的嘴巴','圓圓的臉']){await select(page,label);await next(page);}
  await dragWord(page,'校服',.28);assert(await page.locator('#next-button').isDisabled());
  await dragWord(page,'校服',.78);await page.waitForFunction(()=>!document.querySelector('#next-button').disabled);
  const droppedClothes=await page.locator('#doll-canvas').evaluate(c=>c.toDataURL());
  await select(page,'校服');assert.equal(await page.locator('#doll-canvas').evaluate(c=>c.toDataURL()),droppedClothes);

  const touchPage=await browser.newPage({hasTouch:true,viewport:{width:1440,height:900}});await mockCantonese(touchPage);await touchPage.goto(base);
  await touchPage.getByRole('button',{name:'開始製作'}).tap();await touchPage.getByRole('button',{name:'製作女生玩偶'}).tap();
  const touchCard=await touchPage.getByRole('button',{name:'棕色的頭髮',exact:true}).boundingBox(),touchCanvas=await touchPage.locator('#doll-canvas').boundingBox();
  const cdp=await touchPage.context().newCDPSession(touchPage);
  const start={x:touchCard.x+touchCard.width/2,y:touchCard.y+touchCard.height/2},end={x:touchCanvas.x+touchCanvas.width/2,y:touchCanvas.y+touchCanvas.height*.3};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...start,id:1,radiusX:3,radiusY:3}]});
  for(let i=1;i<=12;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+(end.x-start.x)*i/12,y:start.y+(end.y-start.y)*i/12,id:1,radiusX:3,radiusY:3}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await touchPage.waitForFunction(()=>!document.querySelector('#next-button').disabled);
  assert.equal(await touchPage.getByRole('button',{name:'棕色的頭髮',exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal((await touchPage.evaluate(()=>window.__spoken)).filter(item=>item.text==='棕色的頭髮').length,1);
  assert.equal(await touchPage.locator('.drag-word').count(),0);await touchPage.close();
  pass('Mouse and real touch dragging snap traits to anatomical anchors; wrong-region drops do not move artwork');

  const noVoicePage=await browser.newPage();
  await noVoicePage.route('**/assets/voice/manifest.json*',route=>route.fulfill({json:{}}));
  await noVoicePage.addInitScript(()=>Object.defineProperty(window,'speechSynthesis',{value:{getVoices:()=>[{name:'Mandarin only',lang:'zh-CN'}],addEventListener:()=>{},cancel:()=>{},speak:()=>{window.__wrongVoice=true;}}}));
  await noVoicePage.goto(base);await noVoicePage.getByRole('button',{name:'開始製作'}).click();await noVoicePage.getByRole('button',{name:'製作男生玩偶'}).click();await select(noVoicePage,'黑色的頭髮');
  assert((await noVoicePage.locator('#toast').textContent()).includes('粵語'));
  assert.equal(await noVoicePage.evaluate(()=>window.__wrongVoice),undefined);
  pass('Missing Cantonese voice shows an honest notice and does not use Mandarin');
  const audioPage=await browser.newPage();
  await audioPage.addInitScript(()=>{
    window.__clips=[];window.__rates=[];
    window.Audio=class extends EventTarget{
      constructor(src){super();this.src=String(src);}
      play(){window.__rates.push(this.playbackRate||1);window.__clips.push(this.src.split('/').at(-1).split('?')[0]);this.timer=setTimeout(()=>this.dispatchEvent(new Event('ended')),30);return Promise.resolve();}
      pause(){clearTimeout(this.timer);this.dispatchEvent(new Event('pause'));}
    };
  });
  await audioPage.goto(base);
  const playback=await audioPage.evaluate(async()=>{
    const {speakSummary,speakCard,pronunciationText}=await import('./audio.js');
    const parts=['長長的頭髮','圓圓的眼睛','小小的鼻子','小小的嘴巴','長長的臉'];
    await speakSummary(parts,'校服','boy');const boy=[...window.__clips],rates=[...window.__rates];window.__clips=[];
    await speakSummary(parts,'校服','girl');const girl=[...window.__clips];window.__clips=[];
    const reading=speakSummary(parts,'西裝','boy');await new Promise(r=>setTimeout(r,5));await speakCard('校服');await reading;
    return {boy,girl,rates,interrupted:window.__clips,pronunciation:pronunciationText('長長的頭髮，長長的臉')};
  });
  assert.deepEqual(playback.boy,['sentence-0.mp3','hair-2.mp3','eyes-2.mp3','nose-2.mp3','mouth-1.mp3','face-2.mp3','sentence-2.mp3','outfit-0.mp3']);
  assert(playback.rates.every(rate=>rate===1),'Normal-speed summary recordings play at their natural rate');
  assert.equal(playback.girl[0],'sentence-1.mp3');assert.equal(playback.girl[6],'sentence-3.mp3');
  assert.deepEqual(playback.interrupted,['sentence-0.mp3','outfit-0.mp3']);
  assert.equal(playback.pronunciation,'詳詳的頭髮，詳詳的臉');
  await audioPage.close();
  pass('Recorded Cantonese reads both full sentences with the correct pronoun, coeng4 mapping and interruption');
  const loadingPage=await browser.newPage();
  let releaseArtwork;const artworkHeld=new Promise(resolve=>releaseArtwork=resolve),requested=[];
  loadingPage.on('request',request=>requested.push(request.url()));
  await loadingPage.route('**/assets/runtime/manifest.json*',async route=>{await artworkHeld;await route.continue();});
  await loadingPage.goto(base,{waitUntil:'domcontentloaded'});
  await loadingPage.getByRole('button',{name:'開始製作'}).waitFor({timeout:3000});
  assert.equal(await loadingPage.locator('[data-doll-rendered]').count(),0);
  await loadingPage.getByRole('button',{name:'開始製作'}).click();
  assert.equal(await loadingPage.getByRole('button',{name:'製作女生玩偶'}).count(),1);
  releaseArtwork();await loadingPage.locator('.gender-portrait canvas[data-doll-rendered]').first().waitFor();
  assert(!requested.some(url=>/\/(eyes|faces|bodies|hair|fringes|features|uniforms|effects)-\d+\./.test(url)),'Unused gameplay sheets must not delay the home screen');
  await loadingPage.close();
  const brokenArtPage=await browser.newPage();
  await brokenArtPage.route('**/assets/runtime/previews-*.webp*',route=>route.abort('failed'));
  await brokenArtPage.goto(base);
  await brokenArtPage.locator('#load-status:not([hidden])').waitFor();
  assert.equal(await brokenArtPage.getByRole('button',{name:'開始製作'}).count(),1);
  assert.equal(await brokenArtPage.locator('#load-status').getByRole('button',{name:'重新載入'}).count(),1);
  await brokenArtPage.close();
  const brokenCodePage=await browser.newPage();
  await brokenCodePage.route('**/game.bundle.js*',route=>route.abort('failed'));
  await brokenCodePage.goto(base);
  await brokenCodePage.getByText('未能載入遊戲',{exact:true}).waitFor();
  assert.equal(await brokenCodePage.getByRole('button',{name:'重新載入'}).count(),1);
  await brokenCodePage.close();
  const brokenTraitPage=await browser.newPage(),traitErrors=[];
  brokenTraitPage.on('pageerror',error=>traitErrors.push(error.message));
  await mockCantonese(brokenTraitPage);
  await brokenTraitPage.route('**/assets/runtime/fringes-*.webp*',route=>route.abort('failed'));
  await brokenTraitPage.goto(base);
  await brokenTraitPage.getByRole('button',{name:'開始製作'}).click();
  await brokenTraitPage.getByRole('button',{name:'製作男生玩偶'}).click();
  await brokenTraitPage.locator('#doll-canvas[aria-busy="false"]').waitFor();
  const priorTrait=await brokenTraitPage.locator('#doll-canvas').evaluate(canvas=>canvas.toDataURL());
  await brokenTraitPage.getByRole('button',{name:'黑色的頭髮',exact:true}).click();
  await brokenTraitPage.locator('#load-status:not([hidden])').waitFor();
  assert(await brokenTraitPage.locator('#next-button').isDisabled());
  assert.equal(await brokenTraitPage.getByRole('button',{name:'黑色的頭髮',exact:true}).getAttribute('aria-pressed'),'false');
  assert.equal(await brokenTraitPage.locator('#doll-canvas').evaluate(canvas=>canvas.toDataURL()),priorTrait);
  assert.deepEqual(traitErrors,[]);await brokenTraitPage.close();
  pass('Slow artwork does not block navigation; failed images or modules show a usable retry screen');
  assert.deepEqual(errors,[]);
  console.log(`\n${passed} checks passed. No browser errors or missing assets. Screenshots: test-results/`);
}finally{await browser.close();}
