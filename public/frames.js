import {artReady,loadImage} from './artwork.js';
import {DOLL_LAYOUT} from './geometry.js';
import {assetURL} from './release.js';
export const FPS=30,CHANGE_FRAMES=24,PARTY_FRAMES=90;
const sequences=new Map();
const base=new URL('./assets/runtime/',document.baseURI);
class RasterSequence{
  constructor(spec){
    this.spec=spec;this.length=spec.count;this.pages=new Map();this.pending=new Map();this.generation=0;this.maxDecodedPages=0;this.encoded=[];
    this.canvas=document.createElement('canvas');this.canvas.width=spec.width;this.canvas.height=spec.height;
  }
  async prepare(){
    if(!this.preparing)this.preparing=(async()=>{
      let next=0;
      const worker=async()=>{while(next<this.spec.pages.length){const index=next++;if(this.encoded[index])continue;const response=await fetch(assetURL(this.spec.pages[index],base),{priority:'low'});if(!response.ok)throw new Error('Animation could not load');this.encoded[index]=await response.blob();}};
      await Promise.all([worker(),worker()]);
    })().catch(error=>{this.preparing=null;throw error;});
    return this.preparing;
  }
  dispose(image){image.src='';if(image.objectURL)URL.revokeObjectURL(image.objectURL);}
  async page(index){
    if(this.pages.has(index))return this.pages.get(index);
    if(!this.pending.has(index)){
      // Retire an old page before decoding the next one, including decode time.
      while(this.pages.size+this.pending.size>=2&&this.pages.size){const oldest=this.pages.keys().next().value;this.dispose(this.pages.get(oldest));this.pages.delete(oldest);}
      const generation=this.generation;
      const url=URL.createObjectURL(this.encoded[index]);
      const request=loadImage(url).then(image=>{
        image.objectURL=url;
        if(generation!==this.generation){this.dispose(image);return null;}
        this.pages.set(index,image);
        while(this.pages.size>2){const oldest=this.pages.keys().next().value;this.dispose(this.pages.get(oldest));this.pages.delete(oldest);}
        this.maxDecodedPages=Math.max(this.maxDecodedPages,this.pages.size);return image;
      }).catch(error=>{URL.revokeObjectURL(url);throw error;}).finally(()=>{if(this.pending.get(index)===request)this.pending.delete(index);});
      this.pending.set(index,request);
    }
    return this.pending.get(index);
  }
  async frame(index,signal){
    if(signal?.aborted)return null;
    const spec=this.spec,page=Math.floor(index/spec.perPage),image=await this.page(page);
    if(!image||signal?.aborted)return null;
    if(page+1<spec.pages.length)this.page(page+1).catch(()=>{});
    const slot=index%spec.perPage,ctx=this.canvas.getContext('2d');
    ctx.clearRect(0,0,spec.width,spec.height);
    ctx.drawImage(image,(slot%spec.columns)*spec.width,Math.floor(slot/spec.columns)*spec.height,spec.width,spec.height,0,0,spec.width,spec.height);
    return this.canvas;
  }
  release(){this.generation++;for(const image of this.pages.values())this.dispose(image);this.pages.clear();this.pending.clear();this.canvas.getContext('2d').clearRect(0,0,this.canvas.width,this.canvas.height);}
}
async function sequenceFor(name,count){
  const manifest=await artReady,spec=manifest.animations[name];
  if(!spec||spec.count!==count)throw new Error(`Missing animation ${name}`);
  if(!sequences.has(name))sequences.set(name,new RasterSequence(spec));
  return sequences.get(name);
}
export async function warmSequence(name,count){const sequence=await sequenceFor(name,count);await sequence.prepare();}
export async function loadSequence(name,count){const sequence=await sequenceFor(name,count);await sequence.prepare();await sequence.page(0);return sequence;}
export function animationStats(){return [...sequences].map(([name,sequence])=>({name,decodedPages:sequence.pages.size,maxDecodedPages:sequence.maxDecodedPages,decodedBytes:sequence.pages.size*sequence.spec.width*sequence.spec.columns*sequence.spec.height*sequence.spec.rows*4}));}
export function playFrames(frames,draw,{signal}={}){
  return new Promise((resolve,reject)=>{
    let start=null,last=-1;
    const tick=async now=>{
      if(signal?.aborted){resolve(false);return;}
      start??=now;const index=Math.max(0,Math.floor((now-start)*FPS/1000));
      if(index>=frames.length){resolve(true);return;}
      try{
        if(index!==last){const image=await frames.frame(index,signal);if(signal?.aborted){resolve(false);return;}if(image)draw(image,index);last=index;}
      }catch(error){reject(error);return;}
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
export async function changeFrames(before,after,effects,part){
  // Compose each raster frame into one reusable surface rather than retaining
  // 24 full character bitmaps. Motion still uses the generated 30 fps images.
  const canvas=document.createElement('canvas');canvas.width=600;canvas.height=750;let released=false;
  return {length:CHANGE_FRAMES,async frame(index,signal){
    const effect=await effects.frame(index,signal);if(released||signal?.aborted)return null;
    const ctx=canvas.getContext('2d'),progress=index/(CHANGE_FRAMES-1),scale=1+Math.sin(progress*Math.PI)*.035;
    ctx.clearRect(0,0,600,750);ctx.save();ctx.translate(300,375);ctx.scale(scale,scale);ctx.drawImage(index<9?before:after,-300,-375,600,750);ctx.restore();
    ctx.drawImage(effect,...(part==='outfit'?DOLL_LAYOUT.bodyEffect:DOLL_LAYOUT.faceEffect));return canvas;
  },release(){released=true;canvas.width=0;canvas.height=0;}};
}
