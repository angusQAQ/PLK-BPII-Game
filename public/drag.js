import {DOLL_LAYOUT} from './geometry.js';
// Pointer events support mouse, touchscreens and whiteboard pens. A drop selects
// a trait; its artwork always uses the renderer's anatomical anchors.
export function enableWordDragging(host,{getPart,onSelect,onNotice}){
  let gesture=null,suppressUntil=0,suppressCard=null;
  function region(part){
    const canvas=host.querySelector('#doll-canvas');if(!canvas)return null;
    const bounds=canvas.getBoundingClientRect();
    const scale=Math.min(bounds.width/600,bounds.height/750);
    const left=bounds.left+(bounds.width-600*scale)/2,top=bounds.top+(bounds.height-750*scale)/2;
    const box=part==='outfit'?DOLL_LAYOUT.bodyDrop:DOLL_LAYOUT.faceDrop;
    return {left:left+box[0]*scale,top:top+box[1]*scale,width:box[2]*scale,height:box[3]*scale};
  }
  function contains(box,x,y){return !!box&&x>=box.left&&x<=box.left+box.width&&y>=box.top&&y<=box.top+box.height;}
  function clear(){
    const previous=gesture;gesture=null;if(!previous)return null;
    previous.ghost?.remove();previous.target?.remove();previous.card.classList.remove('being-dragged');
    if(previous.card.hasPointerCapture?.(previous.id))previous.card.releasePointerCapture(previous.id);
    return previous;
  }
  function begin(event){
    const card=event.target.closest('.word-card');
    if(!card||card.disabled||!getPart()||gesture||event.isPrimary===false||(event.pointerType==='mouse'&&event.button!==0))return;
    gesture={card,id:event.pointerId,x:event.clientX,y:event.clientY,value:card.dataset.value,part:getPart(),dragging:false};
    card.setPointerCapture(event.pointerId);
  }
  function move(event){
    const current=gesture;if(!current||event.pointerId!==current.id)return;
    if(!current.dragging&&Math.hypot(event.clientX-current.x,event.clientY-current.y)<10)return;
    event.preventDefault();
    if(!current.dragging){
      current.dragging=true;current.card.classList.add('being-dragged');
      const ghost=document.createElement('div');ghost.className='drag-word';ghost.textContent=current.card.getAttribute('aria-label');ghost.setAttribute('aria-hidden','true');document.body.append(ghost);current.ghost=ghost;
      const target=document.createElement('div');target.className='drop-target';target.setAttribute('aria-hidden','true');target.dataset.label=current.part==='outfit'?'放到身體上':current.part==='hair'?'放到頭上':'放到臉上';document.body.append(target);current.target=target;
    }
    const box=region(current.part);
    current.ghost.style.left=`${event.clientX}px`;current.ghost.style.top=`${event.clientY-25}px`;
    if(box){Object.assign(current.target.style,{left:`${box.left}px`,top:`${box.top}px`,width:`${box.width}px`,height:`${box.height}px`});current.target.classList.toggle('is-over',contains(box,event.clientX,event.clientY));}
  }
  function end(event){
    const current=gesture;if(!current||event.pointerId!==current.id)return;
    const valid=current.dragging&&contains(region(current.part),event.clientX,event.clientY);
    clear();if(!current.dragging)return;
    event.preventDefault();suppressUntil=performance.now()+500;suppressCard=current.card;
    if(valid)onSelect(current.value);
    else onNotice(current.part==='outfit'?'把衣服詞卡放到玩偶的身體上，也可以直接點選詞卡。':'把詞卡放到玩偶的臉上，也可以直接點選詞卡。');
  }
  host.addEventListener('pointerdown',begin);
  host.addEventListener('pointermove',move,{passive:false});
  host.addEventListener('pointerup',end);
  host.addEventListener('pointercancel',()=>clear());
  host.addEventListener('lostpointercapture',event=>{if(gesture?.id===event.pointerId)clear();});
  host.addEventListener('dragstart',event=>{if(event.target.closest('.word-card'))event.preventDefault();});
  window.addEventListener('blur',()=>clear());
  return {cancel:()=>clear(),suppressClick:card=>card===suppressCard&&performance.now()<suppressUntil};
}
