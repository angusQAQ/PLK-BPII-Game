import {assetURL} from './release.js';
// Generated source art stays intact. Runtime files are pre-cropped, smaller WebP.
const base=new URL('./assets/runtime/',document.baseURI),images=new Map(),sprites=new Map();
export async function loadImage(url){
  const image=new Image();image.crossOrigin='anonymous';image.decoding='async';
  await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error(`Image could not load: ${url}`));image.src=url;});
  return image;
}
export const artReady=fetch(assetURL('./assets/runtime/manifest.json')).then(async response=>{
  if(!response.ok)throw new Error('Artwork manifest could not load');return response.json();
});
export function runtimeImage(file){
  const url=assetURL(file,base);
  if(!images.has(url))images.set(url,loadImage(url).catch(error=>{images.delete(url);throw error;}));
  return images.get(url);
}
async function preparedSprite(key,spec){
  if(!spec)throw new Error(`Missing artwork ${key}`);
  if(!sprites.has(key))sprites.set(key,runtimeImage(spec.file).then(image=>({image,...spec})).catch(error=>{sprites.delete(key);throw error;}));
  return sprites.get(key);
}
export async function sprite(name,index){
  const manifest=await artReady;return preparedSprite(`${name}:${index}`,manifest.sheets[name]?.sprites[index]);
}
export async function standaloneSprite(group,key){
  const manifest=await artReady;return preparedSprite(`${group}:${key}`,manifest[group]?.[key]);
}
export async function applyPaintedUI(){
  const manifest=await artReady;
  // CSS uses tiny ready-to-display files; no canvas readback or base64 allocations.
  ['word-card','primary','secondary','ribbon'].forEach((name,index)=>document.documentElement.style.setProperty(`--art-${name}`,`url("${assetURL(manifest.sheets.ui.sprites[index].file,base)}")`));
  ['home','reset','sound'].forEach(name=>document.documentElement.style.setProperty(`--nav-${name}`,`url("${assetURL(manifest.navigation[name].file,base)}")`));
  document.documentElement.classList.add('painted-art-ready');
}
