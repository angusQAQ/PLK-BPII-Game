import {assetURL} from './release.js';
// Animation source: sequences of actual PNG frames, displayed at 30 fps.
// There are deliberately no CSS transitions or vector animations.
export const FPS=30;
export const CHANGE_FRAMES=24;
export const PARTY_FRAMES=90;
const promises=new Map();
export function loadSequence(name,count) {
  const key=name+count;
  if(!promises.has(key))promises.set(key,Promise.all(Array.from({length:count},(_,i)=>{
    const image=new Image();image.src=assetURL(`./assets/frames/${name}/${String(i).padStart(3,'0')}.png`);
    return image.decode().then(()=>image);
  })));
  return promises.get(key);
}
export function playFrames(frames,draw,{signal}={}) {
  return new Promise((resolve,reject)=>{
    let start=null,last=-1;
    const tick=now=>{
      if(signal?.aborted){resolve(false);return;}
      // Use the rAF clock from its first callback: a callback's timestamp can
      // precede performance.now() from the task that scheduled it.
      start??=now;
      const frame=Math.max(0,Math.floor((now-start)*FPS/1000));
      if(frame>=frames.length){resolve(true);return;}
      try{if(frame!==last){draw(frames[frame],frame);last=frame;}}
      catch(error){reject(error);return;}
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
export async function changeFrames(before,after,effects,part) {
  // Bake the before/after artwork and the effect into raster images before playback.
  const frameCanvas=document.createElement('canvas');
  frameCanvas.width=600;frameCanvas.height=750;
  const ctx=frameCanvas.getContext('2d');
  const images=[];
  for(let i=0;i<CHANGE_FRAMES;i++){
    ctx.clearRect(0,0,600,750);
    const progress=i/(CHANGE_FRAMES-1);
    const scale=1+Math.sin(progress*Math.PI)*.035;
    ctx.save();ctx.translate(300,375);ctx.scale(scale,scale);
    ctx.drawImage(i<9?before:after,-300,-375,600,750);ctx.restore();
    if(part==='outfit')ctx.drawImage(effects[i],70,335,460,360);
    else ctx.drawImage(effects[i],25,60,550,480);
    const bitmap=await createImageBitmap(frameCanvas);
    images.push(bitmap);
  }
  return images;
}
