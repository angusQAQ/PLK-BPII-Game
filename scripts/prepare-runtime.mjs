import sharp from 'sharp';
import {build} from 'esbuild';
import {readFile,writeFile,mkdir,readdir,rm,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../public/',import.meta.url)),source=path.join(root,'assets/painted'),output=path.join(root,'assets/runtime');
const art=JSON.parse(await readFile(path.join(source,'manifest.json'),'utf8'));
const hash=createHash('sha256').update(await readFile(fileURLToPath(import.meta.url)));
for(const file of (await readdir(source)).filter(file=>/\.(png|json)$/.test(file)).sort())hash.update(await readFile(path.join(source,file)));
for(const name of ['change','celebrate'])for(const file of (await readdir(path.join(root,'assets/frames',name))).sort())hash.update(await readFile(path.join(root,'assets/frames',name,file)));
for(const file of ['brand-icon.png','workshop.png'])hash.update(await readFile(path.join(root,'assets',file)));
const digest=hash.digest('hex');let cached=false;
try{cached=JSON.parse(await readFile(path.join(output,'report.json'),'utf8')).sourceDigest===digest;}catch{}
if(!cached){
 await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
 const runtime={sheets:{},previews:{},navigation:{},faceVariants:{},gentleEyes:{},earlessFaces:{},ears:{},animations:{},images:{}},files=[];
 async function save(name,bytes,extra={}){
  const filename=`${name}.${createHash('sha256').update(bytes).digest('hex').slice(0,12)}.webp`;
  await writeFile(path.join(output,filename),bytes);files.push({file:filename,bytes:bytes.length,...extra});return filename;
 }
 async function crop(file,spec,maxWidth=480,maxHeight=720){
  const [left,top,width,height]=spec.rect;
  let pipeline=sharp(path.join(source,file)).extract({left,top,width,height}).ensureAlpha();
  if(spec.clipRuns){
   const mask=Buffer.alloc(width*height*4);
   for(const [x,y,length] of spec.clipRuns)mask.fill(255,(y*width+x)*4,(y*width+x+length)*4);
   pipeline=pipeline.composite([{input:mask,raw:{width,height,channels:4},blend:'dest-in'}]);
  }
  const {data,info}=await pipeline.raw().toBuffer({resolveWithObject:true});
  const resized=sharp(data,{raw:{width:info.width,height:info.height,channels:info.channels}}).resize({width:maxWidth,height:maxHeight,fit:'inside',withoutEnlargement:true});
  return resized.webp({quality:86,alphaQuality:100,effort:4}).toBuffer();
 }
 for(const [name,sheet] of Object.entries(art.sheets)){
  const sprites=[];
  for(const [index,spec] of sheet.sprites.entries()){
   const {clipRuns,...metadata}=spec;
   const bytes=await crop(sheet.file,spec,name==='ui'?800:480);
   sprites.push({...metadata,file:await save(`${name}-${index}`,bytes)});
  }
  runtime.sheets[name]={sprites};
 }
 for(const group of ['previews','navigation','faceVariants','gentleEyes','earlessFaces','ears'])for(const [key,spec] of Object.entries(art[group])){
  const bytes=await crop(spec.file,spec,group==='navigation'?80:520,group==='previews'?720:600);
  runtime[group][key]={rect:spec.rect,...(spec.eyeBoxes?{eyeBoxes:spec.eyeBoxes}:{}),...(spec.earAttach?{earAttach:spec.earAttach}:{}),file:await save(`${group}-${key}`,bytes)};
 }
 for(const [key,file,width,height] of [['brand','brand-icon.png',128,128],['background','workshop.png',1280,854],['workbench','painted/workbench.png',1600,900]]){
  const bytes=await sharp(path.join(root,'assets',file)).resize({width,height,fit:'inside',withoutEnlargement:true}).webp({quality:84,alphaQuality:100,effort:4}).toBuffer();
  runtime.images[key]=await save(key,bytes);
 }
 for(const [name,count,width,height,columns,perPage] of [['change',24,360,300,6,24],['celebrate',90,640,444,5,15]]){
  const rows=Math.ceil(perPage/columns),pages=[];
  for(let first=0;first<count;first+=perPage){
   const inputs=[];
   for(let index=first;index<Math.min(first+perPage,count);index++){
    const input=await sharp(path.join(root,'assets/frames',name,`${String(index).padStart(3,'0')}.png`)).resize(width,height).png().toBuffer();
    const slot=index-first;inputs.push({input,left:(slot%columns)*width,top:Math.floor(slot/columns)*height});
   }
   const bytes=await sharp({create:{width:width*columns,height:height*rows,channels:4,background:'#00000000'}}).composite(inputs).webp({quality:82,alphaQuality:100,effort:4}).toBuffer();
   pages.push(await save(`${name}-${pages.length}`,bytes,{decodedBytes:width*columns*height*rows*4}));
  }
  runtime.animations[name]={count,fps:30,width,height,columns,rows,perPage,pages};
 }
 await writeFile(path.join(output,'manifest.json'),JSON.stringify(runtime));
 const totalBytes=files.reduce((sum,file)=>sum+file.bytes,0);
 const homeFiles=['previews-boy','previews-girl','brand','background','ui-0','ui-1','ui-2','ui-3','navigation-home','navigation-reset','navigation-sound'];
 const homeBytes=files.filter(file=>homeFiles.some(name=>file.file.startsWith(name+'.'))).reduce((sum,file)=>sum+file.bytes,0);
 await writeFile(path.join(output,'report.json'),JSON.stringify({sourceDigest:digest,totalBytes,homeBytes,files},null,2));
 console.log(`Optimized artwork: ${files.length} WebP files, ${(totalBytes/1048576).toFixed(2)} MiB; home ${(homeBytes/1024).toFixed(0)} KiB.`);
}
const runtime=JSON.parse(await readFile(path.join(output,'manifest.json'),'utf8'));
// Small static URLs work before JavaScript starts, including the favicon.
await writeFile(path.join(root,'runtime.css'),`:root{--workshop-image:url('./assets/runtime/${runtime.images.background}');--workbench-image:url('./assets/runtime/${runtime.images.workbench}')}\n`);
await writeFile(path.join(output,'brand.webp'),await readFile(path.join(output,runtime.images.brand)));
await build({entryPoints:[path.join(root,'game.js')],outfile:path.join(root,'game.bundle.js'),bundle:true,format:'iife',target:['es2018'],minify:true,legalComments:'none',define:{__DOLL_BUILD__:JSON.stringify(process.env.GITHUB_SHA||'development')}});
console.log('Prepared classic browser bundle and compact runtime manifest.');
