import {sprite,standaloneSprite} from './artwork.js';
import {DOLL_LAYOUT as layout} from './geometry.js';
const hairIndex={black:0,brown:1,long:2,short:3,curly:4};
const eyeIndex={big:0,small:1,round:2};
const noseIndex={high:0,big:1,small:2,round:3};

export function dollMarkup(selections={},gender='boy'){
  return `<canvas class="painted-doll" data-painted-doll="${encodeURIComponent(JSON.stringify(selections))}" data-gender="${gender}" width="600" height="750" role="img" aria-label="手繪${gender==='girl'?'女生':'男生'}玩偶"></canvas>`;
}
export function previewMarkup(gender){
  return `<canvas class="painted-doll" data-preview-doll="${gender}" width="600" height="750" role="img" aria-label="穿校服的${gender==='girl'?'女生':'男生'}玩偶"></canvas>`;
}
function paint(ctx,part,x,y,width,height){ctx.drawImage(part.image,x,y,width,height);}
export async function renderDoll(selections={},gender='boy'){
  selections={...selections};
  const girl=gender==='girl',outfit=selections.outfit;
  const uniform=outfit==='school'||outfit==='sports';
  const bodyIndex=uniform?(outfit==='sports'?2:0)+(girl?1:0):(girl?2:0)+(outfit==='dress'||outfit==='suit'?1:0);
  const [body,face,hair,eyes,nose,mouth,fringe,ears]=await Promise.all([
    sprite(uniform?'uniforms':'bodies',bodyIndex),standaloneSprite('earlessFaces',selections.face||'round'),
    selections.hair&&girl?sprite('hair',hairIndex[selections.hair]+5):null,
    selections.eyes==='big'?standaloneSprite('gentleEyes',gender):selections.eyes?sprite('eyes',eyeIndex[selections.eyes]+(girl?3:0)):null,
    selections.nose?sprite('features',noseIndex[selections.nose]):null,
    selections.mouth?sprite('features',selections.mouth==='big'?4:5):null,
    selections.hair?sprite('fringes',girl?({black:4,brown:5,long:6,short:7,curly:8}[selections.hair]):({black:0,brown:1,long:0,short:2,curly:3}[selections.hair])):null,
    selections.ears?Promise.all(['left','right'].map(side=>standaloneSprite('ears',`${selections.ears}-${side}`))):null,
  ]);
  const canvas=document.createElement('canvas');canvas.width=600;canvas.height=750;
  const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  // Bodies mount by their actual painted neck, not by the sheet-cell center.
  const bodyScale=layout.bodyHeight/body.rect[3];
  paint(ctx,body,300-(body.neck[0]-body.rect[0])*bodyScale,layout.bodyTop,body.rect[2]*bodyScale,layout.bodyHeight);
  ctx.save();ctx.translate(...layout.headPivot);ctx.scale(layout.headScale,layout.headScale);
  ctx.translate(-300,-398);
  const [faceWidth,faceHeight,headFit]=({round:[280,281,1],square:[278,278,348/344],long:[252,309,320/344],small:[224,248,284/344]}[selections.face]||[280,281,1]);
  const hairBox=hair?(()=>{const m=hair.mount;return [300-(m.anchorX-hair.rect[0])*m.scaleX*headFit,m.y+(1-headFit)*100,hair.rect[2]*m.scaleX*headFit,hair.rect[3]*m.scaleY];})():null;
  // Long side locks sit behind the cheeks, so the painted jaw remains visible.
  if(hair&&girl){ctx.save();ctx.beginPath();ctx.rect(0,195,600,555);ctx.clip();paint(ctx,hair,...hairBox);ctx.restore();}
  // Ears tuck behind the cheek edge and in front of side locks. Both sizes use
  // the same anatomical anchor; dragging never changes their position.
  if(ears){
    const scale=Math.min(1,headFit),width=(selections.ears==='big'?50:24)*scale,height=(selections.ears==='big'?70:34)*scale;
    ears.forEach((ear,index)=>{
      const anchor=300-faceWidth/2+face.earAttach[index]*faceWidth;
      paint(ctx,ear,anchor-width*(index===0 ? .76 : .24),398-faceHeight*.32-height/2,width,height);
    });
  }
  paint(ctx,face,300-faceWidth/2,398-faceHeight,faceWidth,faceHeight);
  ctx.save();ctx.translate(300,320);ctx.scale(Math.min(1,headFit),Math.min(1,headFit));ctx.translate(-300,-320);
  if(eyes){
    const eyeWidth=({big:92,round:58,small:33}[selections.eyes]);
    // Each eyeball keeps its source aspect ratio and a stable pupil anchor.
    eyes.eyeBoxes.forEach(([x,y,w,h],index)=>{
      const scale=eyeWidth/w,center=index===0?240:360;
      ctx.save();ctx.beginPath();ctx.rect(center-eyeWidth*.65,175,eyeWidth*1.3,150);ctx.clip();
      paint(ctx,eyes,center-(x+w/2)*scale,267-(y+h/2)*scale,eyes.rect[2]*scale,eyes.rect[3]*scale);ctx.restore();
    });
  }
  if(nose)paint(ctx,nose,...({high:[290,286,20,52],big:[275,305,50,33],small:[295,317,10,9],round:[287,309,26,26]}[selections.nose]));
  if(mouth)paint(ctx,mouth,...(selections.mouth==='big'?[266,343,68,40]:[284,349,32,13]));
  ctx.restore();
  // Separate painted fringe caps keep their natural strand edges above the cheeks.
  if(fringe){const width=(girl?410:370)*headFit;paint(ctx,fringe,300-width/2,55+(1-headFit)*100,width,205);}
  ctx.restore();
  canvas.close=()=>{canvas.width=0;canvas.height=0;};
  return canvas;
}
export async function paintStaticDolls(root){
  await Promise.all([...root.querySelectorAll('[data-preview-doll]')].map(async canvas=>{
    const {image}=await standaloneSprite('previews',canvas.dataset.previewDoll);
    const height=650,width=image.width*height/image.height;
    if(canvas.isConnected){canvas.getContext('2d').drawImage(image,(600-width)/2,710-height,width,height);canvas.dataset.dollRendered='true';}
  }));
  await Promise.all([...root.querySelectorAll('[data-painted-doll]')].map(async canvas=>{
    const image=await renderDoll(JSON.parse(decodeURIComponent(canvas.dataset.paintedDoll)),canvas.dataset.gender);
    if(canvas.isConnected){canvas.getContext('2d').drawImage(image,0,0);canvas.dataset.dollRendered='true';}
    image.close();
  }));
}
