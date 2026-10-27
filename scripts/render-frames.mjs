import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {getBrowser} from './browser.mjs';

// Bake animation PNG frames from the generated painted effect sprites.
// These are source game assets, not a downloadable single-HTML export.
const root=fileURLToPath(new URL('../public/assets/frames/',import.meta.url));
const artRoot=new URL('../public/assets/painted/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',artRoot),'utf8'));
const source=(await readFile(new URL('effects.png',artRoot))).toString('base64');
const rects=manifest.sheets.effects.sprites.map(s=>s.rect);
const browser=await getBrowser();
try{
  const page=await browser.newPage();
  for(const [name,count,width,height] of [['change',24,600,500],['celebrate',90,1440,1000]]){
    await mkdir(root+name,{recursive:true});
    const frames=await page.evaluate(async({name,count,width,height,source,rects})=>{
      const sheet=new Image();sheet.src='data:image/png;base64,'+source;await sheet.decode();
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
      const ctx=canvas.getContext('2d');ctx.imageSmoothingQuality='high';
      const output=[];
      function random(seed){return Math.abs(Math.sin(seed*127.1+311.7)*43758.5453)%1;}
      function image(index,x,y,w,h,rotation=0,alpha=1){
        if(alpha<=0)return;
        ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.globalAlpha=Math.min(1,alpha);
        ctx.drawImage(sheet,...rects[index],-w/2,-h/2,w,h);ctx.restore();
      }
      for(let frame=0;frame<count;frame++){
        ctx.clearRect(0,0,width,height);const t=frame/(count-1);
        if(name==='change'){
          const bloom=Math.sin(t*Math.PI),spread=30+t*165;
          image(1,300,245,180+bloom*160,155+bloom*140,t*.12,bloom*.95);
          image(9,250-spread*.15,250,80+bloom*90,75+bloom*80,-t*.2,bloom*.48);
          image(10,354+spread*.12,230,80+bloom*70,70+bloom*60,t*.2,bloom*.5);
          for(let i=0;i<12;i++){
            const angle=i*Math.PI/6,x=300+Math.cos(angle)*spread*1.16,y=240+Math.sin(angle)*spread*.83;
            const size=(i%3===0?45:28)*(1-t*.4);
            image(i%3===0?8:i%2?7:0,x,y,size,size,t*1.6+i,bloom*.95);
          }
        }else{
          const ids=[2,3,4,5,6,7,11];
          for(let i=0;i<135;i++){
            const side=i%2,delay=random(i+5)*.3,age=Math.max(0,t-delay);
            if(t<delay)continue;
            const speed=440+random(i+12)*940;
            const x=(side?width+30:-30)+(side?-1:1)*age*speed;
            const y=height*.75-age*(1400+random(i+16)*550)+age*age*2100;
            const size=12+random(i+15)*15,id=ids[i%ids.length];
            const curl=[2,4,6].includes(id);
            image(id,x,y,size*(Math.cos(age*14+i)*.25+.85),size*(curl?1.9:1),age*(i%3?11:-8)+i,Math.min(1,(1-t)*4));
          }
        }
        output.push(canvas.toDataURL('image/png').split(',')[1]);
      }
      return output;
    },{name,count,width,height,source,rects});
    await Promise.all(frames.map((base64,i)=>writeFile(`${root}${name}/${String(i).padStart(3,'0')}.png`,Buffer.from(base64,'base64'))));
    console.log(`${name}: ${frames.length} painted PNG frames, 30 fps`);
  }
  await writeFile(root+'manifest.json',JSON.stringify({fps:30,artSource:'../painted/effects.png',sourceSha256:manifest.sheets.effects.sha256,sequences:{change:{frames:24,duration:.8},celebrate:{frames:90,duration:3}}},null,2)+'\n');
}finally{await browser.close();}
