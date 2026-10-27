import {mkdir} from 'node:fs/promises';
import {getBrowser} from './browser.mjs';

await mkdir('test-results',{recursive:true});
const browser=await getBrowser();
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on('pageerror',error=>{throw error;});
  await page.goto(process.env.TEST_URL||'http://127.0.0.1:3000');
  await page.locator('.hero-doll canvas[data-doll-rendered]').first().waitFor();
  await page.screenshot({path:'test-results/painted-home.png',fullPage:true});
  await page.setViewportSize({width:1500,height:1030});
  await page.evaluate(async()=>{
    const {renderDoll}=await import('./doll.js');
    document.body.style.background='#faf2e4';
    document.querySelector('#app').innerHTML='<h1 style="text-align:center;font:28px serif;padding:20px">新版手繪素材 · 人類玩偶接合檢查</h1><div id="review" style="display:grid;grid-template-columns:repeat(5,1fr);gap:5px;padding:15px"></div>';
    for(const gender of ['boy','girl'])for(const hair of (gender==='boy'?['black','brown','short','curly']:['black','brown','long','short','curly'])){
      const figure=document.createElement('figure');figure.style.cssText='margin:0;text-align:center';
      const canvas=document.createElement('canvas');canvas.width=600;canvas.height=750;canvas.style.cssText='width:100%;height:auto';
      const image=await renderDoll({hair,eyes:'big',nose:'small',mouth:'small',face:'round',outfit:gender==='girl'?'dress':'school'},gender);
      canvas.getContext('2d').drawImage(image,0,0);image.close();
      figure.append(canvas);const label=document.createElement('figcaption');label.textContent=(gender==='boy'?'男生':'女生')+' · '+({black:'黑色',brown:'棕色',long:'長長',short:'短短',curly:'捲曲'}[hair]);figure.append(label);document.querySelector('#review').append(figure);
    }
  });
  await page.screenshot({path:'test-results/painted-characters.png',fullPage:true});
  await page.setViewportSize({width:1440,height:820});
  await page.evaluate(async()=>{
    const {renderDoll}=await import('./doll.js');
    document.querySelector('#app').innerHTML='<h1 style="text-align:center;font:28px serif;padding:25px">按實物參考重繪 · 校服與體育服</h1><div id="uniform-review" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:20px 30px"></div>';
    for(const [gender,outfit,label] of [['boy','school','男生校服'],['girl','school','女生校服'],['boy','sports','男生體育服'],['girl','sports','女生體育服']]){
      const figure=document.createElement('figure');figure.style.cssText='margin:0;text-align:center';
      const canvas=document.createElement('canvas');canvas.width=600;canvas.height=750;canvas.style.cssText='width:100%;height:auto';
      const image=await renderDoll({hair:gender==='girl'?'brown':'black',eyes:'big',nose:'small',mouth:'small',face:'round',outfit},gender);
      canvas.getContext('2d').drawImage(image,0,0);image.close();
      const caption=document.createElement('figcaption');caption.textContent=label;caption.style.cssText='font-size:22px;letter-spacing:2px';figure.append(canvas,caption);document.querySelector('#uniform-review').append(figure);
    }
  });
  await page.screenshot({path:'test-results/reference-uniforms.png',fullPage:true});
  console.log('Painted artwork review screenshots saved in test-results/.');
}finally{await browser.close();}
