import {build} from 'esbuild';
import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url)),source=path.join(root,'public');
const output=process.argv[2]?path.resolve(process.argv[2]):path.join(root,'dist/downloads/little-doll-atelier.html');
const mime={'.webp':'image/webp','.mp3':'audio/mpeg','.wav':'audio/wav','.woff2':'font/woff2','.json':'application/json'};
const assets={};
async function embed(relative){
  const bytes=await readFile(path.join(source,relative));
  assets[relative]=`data:${mime[path.extname(relative)]};base64,${bytes.toString('base64')}`;
}
for(const file of (await readdir(path.join(source,'assets/runtime'))).sort()){
  if(file.endsWith('.webp')||file==='manifest.json')await embed('assets/runtime/'+file);
}
for(const folder of ['assets/voice','assets/voice/summary']){
  for(const file of (await readdir(path.join(source,folder))).sort()){
    if(file.endsWith('.mp3')||file==='manifest.json')await embed(folder+'/'+file);
  }
}
await embed('assets/change.wav');await embed('assets/fonts/classroom-kai.woff2');
function inlineURL(url){
  if(url.startsWith('data:'))return url;
  const key=new URL(url,'https://offline.invalid/').pathname.slice(1);
  if(!assets[key])throw new Error(`Asset was not embedded: ${key}`);
  return assets[key];
}
function inlineCSS(css){
  return css.replace(/^@charset[^;]+;/,'').replace(/url\(\s*(?:(["'])(.*?)\1|([^\s)]+))\s*\)/gs,(_,quote,quoted,plain)=>`url("${inlineURL(quoted||plain)}")`);
}
const styles=inlineCSS((await readFile(path.join(source,'style.css'),'utf8'))+'\n'+(await readFile(path.join(source,'runtime.css'),'utf8')));
const compiled=await build({entryPoints:[path.join(source,'game.js')],bundle:true,write:false,format:'iife',target:['es2018'],minify:true,legalComments:'none',define:{__DOLL_BUILD__:JSON.stringify('offline')}});
const bundle=compiled.outputFiles[0].text;
const version=createHash('sha256').update(styles).update(bundle).update(JSON.stringify(assets)).update(await readFile(fileURLToPath(import.meta.url))).update(await readFile(path.join(source,'index.html'))).digest('hex').slice(0,16);
const safeScript=text=>text.replace(/<\/script/gi,'<\\/script');
const bootstrap=`window.__DOLL_ASSETS__=${JSON.stringify(assets).replace(/</g,'\\u003c')};\ndocument.addEventListener('click',function(event){if(event.target.closest('[data-reload]')){event.preventDefault();location.reload();}});`;
const license='Copyright (c)2026 Ministry of Digital Affairs.\nClassroom Kai is a renamed subset of TW-Kai.\n\n'+await readFile(path.join(source,'assets/fonts/LICENSE-TW-Kai.md'),'utf8');
let html=await readFile(path.join(source,'index.html'),'utf8');
// A virtual base gives file://, srcdoc and about:blank the same asset keys.
// Every resource is resolved to embedded data before any request is made.
html=html.replace('<head>','<head>\n  <base href="https://doll-offline.invalid/">');
html=html.replace(/<link\b[^>]*rel="stylesheet"[^>]*>\s*/g,'');
html=html.replace(/(href|src)="(\.\/assets\/[^\"]+)"/g,(_,attribute,url)=>`${attribute}="${inlineURL(url)}"`);
html=html.replace('</head>',`  <meta name="doll-offline-version" content="${version}">\n  <style>${styles}</style>\n</head>`);
html=html.replace(/<script src="\.\/boot\.js"[^>]*><\/script>/,`<script>${safeScript(bootstrap)}\n${safeScript(bundle)}</script>\n<script type="text/plain" id="font-license">${safeScript(license)}</script>`);
await mkdir(path.dirname(output),{recursive:true});await writeFile(output,html);
const bytes=Buffer.byteLength(html),sha256=createHash('sha256').update(html).digest('hex');
await writeFile(path.join(path.dirname(output),'manifest.json'),JSON.stringify({file:path.basename(output),version,sha256,bytes,embeddedAssets:Object.keys(assets).length},null,2)+'\n');
const filename=encodeURIComponent(path.basename(output));
const downloadPage=`<!doctype html>
<html lang="zh-HK"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>下載玩偶小工房</title>
<style>@font-face{font-family:Kai;src:local("DFKai-SB"),local("BiauKai"),url("../assets/fonts/classroom-kai.woff2") format("woff2");font-weight:400;font-display:swap}*{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;background:#faf6ee;color:#514438;font:700 24px Kai,"DFKai-SB","標楷體",serif;text-align:center;padding:28px}main{max-width:620px}h1{font-size:42px}p{line-height:1.7}a{color:inherit}.download{display:inline-block;background:#b36e68;color:#fffaf0;border-radius:16px;padding:20px 34px;font-size:32px;text-decoration:none;box-shadow:0 5px 0 #92564f}.details{font-size:20px}</style></head>
<body><main><h1>玩偶小工房</h1><p>單一 HTML 檔案，可離線遊玩。</p><p><a class="download" id="download-html" href="./${filename}?v=${version}" download="玩偶小工房.html">下載 HTML</a></p><p class="details">約 ${(bytes/1048576).toFixed(1)} MB，包含圖片、動畫、字型和粵語錄音。<br>下載後，用瀏覽器開啟檔案即可遊玩。</p><p><a href="../">回到網上遊戲</a></p></main></body></html>\n`;
await writeFile(path.join(path.dirname(output),'index.html'),downloadPage);
console.log(`Standalone HTML: ${output}; ${(bytes/1048576).toFixed(2)} MiB, ${Object.keys(assets).length} embedded assets, version ${version}.`);
