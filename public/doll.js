import {sprite} from './artwork.js';
const hairIndex={black:0,brown:1,long:2,short:3,curly:4};
const faceIndex={round:0,square:1,long:2,small:3};
const eyeIndex={big:0,small:1,round:2};
const noseIndex={high:0,big:1,small:2,round:3};

export function dollMarkup(selections={},gender='boy'){
  return `<canvas class="painted-doll" data-painted-doll="${encodeURIComponent(JSON.stringify(selections))}" data-gender="${gender}" width="600" height="750" role="img" aria-label="手繪${gender==='girl'?'女生':'男生'}玩偶"></canvas>`;
}
function paint(ctx,part,x,y,width,height){ctx.drawImage(part.image,x,y,width,height);}
export async function renderDoll(selections={},gender='boy'){
  const girl=gender==='girl',outfit=selections.outfit;
  const uniform=outfit==='school'||outfit==='sports';
  const bodyIndex=uniform?(outfit==='sports'?2:0)+(girl?1:0):(girl?2:0)+(outfit==='dress'||outfit==='suit'?1:0);
  const [body,face,hair,eyes,nose,mouth]=await Promise.all([
    sprite(uniform?'uniforms':'bodies',bodyIndex),sprite('faces',faceIndex[selections.face]??0),
    selections.hair?sprite('hair',hairIndex[selections.hair]+(girl?5:0)):null,
    selections.eyes?sprite('eyes',eyeIndex[selections.eyes]+(girl?3:0)):null,
    selections.nose?sprite('features',noseIndex[selections.nose]):null,
    selections.mouth?sprite('features',selections.mouth==='big'?4:5):null,
  ]);
  const canvas=document.createElement('canvas');canvas.width=600;canvas.height=750;
  const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  // Bodies mount by their actual painted neck, not by the sheet-cell center.
  const bodyScale=315/body.rect[3];
  paint(ctx,body,300-(body.neck[0]-body.rect[0])*bodyScale,385,body.rect[2]*bodyScale,315);
  ctx.save();ctx.translate(300,398);
  if(selections.face==='small')ctx.scale(.73,.73);
  if(selections.face==='long')ctx.scale(.77,1.12);
  if(selections.face==='square')ctx.scale(1.03,1);
  ctx.translate(-300,-398);
  paint(ctx,face,128,117,344,281);
  if(eyes)paint(ctx,eyes,...(selections.eyes==='small'?[216,245,168,42]:selections.eyes==='round'?[200,208,200,106]:[190,185,220,135]));
  if(nose)paint(ctx,nose,...({high:[290,286,20,52],big:[275,305,50,33],small:[295,317,10,9],round:[287,309,26,26]}[selections.nose]));
  if(mouth)paint(ctx,mouth,...(selections.mouth==='big'?[266,343,68,40]:[284,349,32,13]));
  if(hair){const m=hair.mount;paint(ctx,hair,300-(m.anchorX-hair.rect[0])*m.scaleX,m.y,hair.rect[2]*m.scaleX,hair.rect[3]*m.scaleY);}
  ctx.restore();
  return createImageBitmap(canvas);
}
export async function paintStaticDolls(root){
  await Promise.all([...root.querySelectorAll('[data-painted-doll]')].map(async canvas=>{
    const image=await renderDoll(JSON.parse(decodeURIComponent(canvas.dataset.paintedDoll)),canvas.dataset.gender);
    if(canvas.isConnected){canvas.getContext('2d').drawImage(image,0,0);canvas.dataset.dollRendered='true';}
    image.close();
  }));
}
