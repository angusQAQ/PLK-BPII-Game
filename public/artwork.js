// The renderer composes reference-led, generated PNG sprites. It does not draw
// substitute vector characters or procedural costume illustrations.
const base=new URL('./assets/painted/',import.meta.url);
const sheets=new Map(),sprites=new Map();
export const artReady=fetch(new URL('manifest.json',base)).then(async response=>{
  if(!response.ok)throw new Error('Painted artwork manifest is missing');
  const manifest=await response.json();
  await Promise.all(Object.entries(manifest.sheets).map(async([key,sheet])=>{
    const image=new Image();image.src=new URL(sheet.file,base).href;await image.decode();
    sheets.set(key,{image,...sheet});
  }));
  return manifest;
});
export async function sprite(name,index){
  await artReady;const key=`${name}:${index}`;
  if(!sprites.has(key)){
    const sheet=sheets.get(name),spec=sheet?.sprites[index];
    if(!spec)throw new Error(`Missing painted sprite ${key}`);
    sprites.set(key,(async()=>{
      let image;
      if(spec.clipRuns){
        // Atlas contours clip neighboring sprites at render time. The generated
        // source PNGs remain intact; no replacement shapes are painted.
        const [x,y,width,height]=spec.rect;
        const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
        const ctx=canvas.getContext('2d'),clip=new Path2D();
        for(const [left,top,length] of spec.clipRuns)clip.rect(left,top,length,1);
        ctx.clip(clip);ctx.drawImage(sheet.image,-x,-y);
        image=await createImageBitmap(canvas);
      }else image=await createImageBitmap(sheet.image,...spec.rect);
      return {image,...spec};
    })());
  }
  return sprites.get(key);
}
export async function standaloneSprite(group,key){
  const manifest=await artReady,spec=manifest[group]?.[key],id=`${group}:${key}`;
  if(!spec)throw new Error(`Missing painted artwork ${id}`);
  if(!sprites.has(id))sprites.set(id,(async()=>{
    const source=new Image();source.src=new URL(spec.file,base).href;await source.decode();
    return {image:await createImageBitmap(source,...spec.rect),...spec};
  })());
  return sprites.get(id);
}
export async function applyPaintedUI(){
  await Promise.all(['word-card','primary','secondary','ribbon'].map(async(name,index)=>{
    const {image}=await sprite('ui',index);
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
    canvas.getContext('2d').drawImage(image,0,0);
    document.documentElement.style.setProperty(`--art-${name}`,`url("${canvas.toDataURL('image/png')}")`);
  }));
  await Promise.all(['home','reset','sound'].map(async name=>{
    const {image}=await standaloneSprite('navigation',name);
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
    canvas.getContext('2d').drawImage(image,0,0);
    document.documentElement.style.setProperty(`--nav-${name}`,`url("${canvas.toDataURL('image/png')}")`);
  }));
  document.documentElement.classList.add('painted-art-ready');
}
