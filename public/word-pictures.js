import {renderDoll,bodySprite} from './doll.js';

// Reuse the generated game artwork. Close-up views make size/shape differences
// legible without downloading a second set of illustration files.
const crops={eyes:[190,190,220,120],ears:[154,248,70,80],nose:[262,254,76,80],mouth:[255,300,90,66],face:[140,100,320,270]};
function fit(ctx,image,crop){
  const [x,y,width,height]=crop,scale=Math.min(148/width,148/height);
  ctx.clearRect(0,0,160,160);ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.drawImage(image,x,y,width,height,(160-width*scale)/2,(160-height*scale)/2,width*scale,height*scale);
}
async function paintPicture(canvas){
  const {wordPart:part,wordValue:value,gender}=canvas.dataset;
  if(part==='outfit'){
    const {image}=await bodySprite(value,gender);
    if(canvas.isConnected)fit(canvas.getContext('2d'),image,[0,0,image.width,image.height]);
  }else{
    const selection={face:'round',hair:null,eyes:null,ears:null,nose:null,mouth:null,outfit:null,[part]:value};
    if(part==='hair'||part==='face')Object.assign(selection,{eyes:'small',ears:'small',nose:'small',mouth:'small'});
    const image=await renderDoll(selection,gender);
    try{
      if(canvas.isConnected)fit(canvas.getContext('2d'),image,part==='hair'?(gender==='girl'?[110,70,380,530]:[140,70,320,320]):crops[part]);
    }finally{image.close();}
  }
  if(canvas.isConnected){canvas.dataset.pictureReady='true';canvas.parentElement.classList.add('picture-ready');}
}
export async function paintWordPictures(root){
  const queue=[...root.querySelectorAll('[data-word-part]')];let next=0;
  const worker=async()=>{
    while(next<queue.length){
      const canvas=queue[next++];if(!canvas.isConnected)return;
      // A thumbnail failure never blocks the playable doll or its word card.
      try{await paintPicture(canvas);}catch(error){console.warn('Word illustration could not load',error);}
    }
  };
  await Promise.all([worker(),worker()]);
}
