import {STEPS,optionsFor,labelFor,jyutpingFor,summaryParts,emptySelections} from './data.js';
import {dollMarkup,previewMarkup,renderDoll,paintStaticDolls} from './doll.js';
import {applyPaintedUI} from './artwork.js';
import {enableWordDragging} from './drag.js';
import {paintWordPictures} from './word-pictures.js';
import {assetURL} from './release.js';
import {loadSequence,warmSequence,playFrames,changeFrames,CHANGE_FRAMES,PARTY_FRAMES} from './frames.js';
import {speakCard,speakSummary,stopVoice,playChange,voiceAvailable,showVoiceNotice} from './audio.js';

const app=document.querySelector('#app');
const state={screen:'home',gender:null,step:0,selections:emptySelections(),busy:false};
let animation=new AbortController();
let viewId=0;
let currentDoll=null;
let toastTimer;
const icons={
  arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
  back:'<path d="M19 12H5m6-6-6 6 6 6"/>',
  home:'<path d="m3 10 9-7 9 7M5 9v11h5v-6h4v6h5V9"/>',
  reset:'<path d="M4 10a8 8 0 1 1 1 8M4 4v6h6"/>',
  sound:'<path d="m11 4-6 5H2v6h3l6 5V4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  sparkle:'<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5ZM20 2v4m-2-2h4"/>',
  hair:'<path d="M4 17v-6a8 8 0 0 1 16 0v6M5 10q5 1 8-6 1 5 6 6M6 12v5q6 7 12 0v-5"/>',
  ears:'<path d="M7 19c-2-2-3-5-3-9a8 8 0 0 1 16 0c0 4-2 5-5 7-2 1-1 5-5 5-2 0-3-1-3-3Z"/><path d="M8 10a4 4 0 0 1 8 0c0 3-4 2-4 6M8 13l2 2"/>',
  eyes:'<path d="M2 12q10-14 20 0-10 14-20 0Z"/><circle cx="12" cy="12" r="3"/>',
  nose:'<path d="m12 4-5 13q5 5 10 0M10 20h4"/>',
  mouth:'<path d="M3 8q9 4 18 0-2 15-9 15T3 8Z"/><path d="M7 17q5-4 10 0"/>',
  face:'<path d="M4 11q0-9 8-9t8 9q0 10-8 11Q4 21 4 11Z"/><path d="M8 10h1m6 0h1m-6 6q2 2 4 0"/>',
  outfit:'<path d="m8 3 4 3 4-3 6 5-4 5-2-2v10H8V11l-2 2-4-5 6-5Z"/>',
  spool:'<path d="M7 3h10M6 5h12M8 6v12M16 6v12M6 19h12M7 21h10M8 8l8 3-8 3 8 3"/>',
};
function icon(name,cls=''){return `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${icons[name]||icons.sparkle}</svg>`;}
function navIcon(name){return `<span class="painted-nav nav-${name}" aria-hidden="true"></span>`;}
function header(){return `<header class="site-header">
  <button class="brand" data-action="home" aria-label="玩偶小工房主頁"><img class="brand-emblem" src="${assetURL('./assets/runtime/brand.webp')}" crossorigin="anonymous" alt="" width="56" height="56"><span>玩偶小工房</span></button>
  ${state.screen==='home'?'':`<div class="header-actions"><button class="nav-button" data-action="home" aria-label="回到主頁">${navIcon('home')}<span>主頁</span></button><button class="nav-button" data-action="restart" aria-label="重新開始">${navIcon('reset')}<span>重做</span></button><button class="nav-button voice-button" data-action="voice" aria-label="檢查粵語朗讀">${navIcon('sound')}<span>讀音</span></button></div>`}
</header>`;}
function home(){return `<main class="home-page home-simple">
 <section class="hero-copy">
 <h1>一起<br><span class="rose-text">做玩偶！</span></h1>
 <button class="primary-button start-button" data-action="start">開始製作 ${icon('arrow')}</button>
 </section>
 <section class="hero-art" aria-label="兩位人類玩偶站在溫暖的手繪工房裡">
  <div class="hero-scene"><div class="scene-wash"></div><div class="hero-doll boy">${previewMarkup('boy')}</div><div class="hero-doll girl">${previewMarkup('girl')}</div></div>
 </section>
</main>`;}
function gender(){return `<main class="gender-page"><h1 class="page-heading">選玩偶</h1>
 <div class="gender-cards">${[['boy','男生'],['girl','女生']].map(([value,name])=>`<button class="gender-card ${value}" data-action="gender" data-gender="${value}" aria-label="製作${name}玩偶"><div class="gender-portrait">${previewMarkup(value)}</div><span class="gender-card-label"><strong>${name}</strong><span class="gender-arrow">${icon('arrow')}</span></span></button>`).join('')}</div></main>`;}
function stepper(){return `<nav class="stepper" aria-label="玩偶製作進度">${STEPS.map((step,i)=>`<div class="step-item ${i===state.step?'current':''} ${state.selections[step.key]?'done':''}" ${i===state.step?'aria-current="step"':''}><span class="step-icon">${state.selections[step.key]&&i!==state.step?icon('check'):icon(step.key)}</span><span>${step.name}</span>${i<STEPS.length-1?'<i class="step-connector"></i>':''}</div>`).join('')}</nav>`;}
function wordCard([value],step){const label=labelFor(step.key,value),jyutping=jyutpingFor(step.key,value),selected=state.selections[step.key]===value;return `<button class="word-card ${selected?'selected':''}" data-action="select" data-value="${value}" aria-pressed="${selected}" aria-label="${label}" aria-description="${jyutping}"><span class="word-visual" aria-hidden="true"><canvas width="160" height="160" data-word-part="${step.key}" data-word-value="${value}" data-gender="${state.gender}"></canvas><span class="word-symbol">${icon(step.key)}</span></span><span class="word-copy"><span class="word-label">${label}</span><span class="word-jyutping" lang="yue-Latn">${jyutping}</span></span><span class="card-audio" aria-hidden="true">${selected?icon('check'):icon('sound')}</span></button>`;}
function workshop(){const step=STEPS[state.step],options=optionsFor(step,state.gender),split=Math.ceil(options.length/2);return `<main class="workshop-page">
 ${stepper()}<div class="workshop-heading"><span class="eyebrow">製作工序 ${String(state.step+1).padStart(2,'0')} / ${String(STEPS.length).padStart(2,'0')}</span><h1 class="page-heading">${step.title}</h1><p class="page-description">${step.hint}</p></div>
 <div class="workbench"><div class="word-column left-words">${options.slice(0,split).map(option=>wordCard(option,step)).join('')}</div>
 <div class="doll-stage"><div class="stage-label"><span class="label-dot"></span>${state.gender==='boy'?'男生':'女生'}玩偶<span class="label-divider">/</span>製作中</div><canvas id="doll-canvas" width="600" height="750" aria-label="正在製作的玩偶"></canvas><p class="selection-caption" id="selection-caption">${state.selections[step.key]?`已選擇：${labelFor(step.key,state.selections[step.key])}`:'點選或拖拉詞卡'}</p></div>
 <div class="word-column right-words">${options.slice(split).map(option=>wordCard(option,step)).join('')}</div></div>
 <div class="workshop-controls"><button class="secondary-button" data-action="back">${icon('back')}上一步</button><button class="primary-button" id="next-button" data-action="next" ${!state.selections[step.key]?'disabled':''}>${state.step===STEPS.length-1?'完成製作':'製作'} ${icon(state.step===STEPS.length-1?'check':'arrow')}</button></div>
</main>`;}
function summary(){const pronoun=state.gender==='boy'?'他':'她',parts=summaryParts(state.selections);return `<main class="summary-page"><p class="eyebrow centered">小小工房，完成了一位新朋友</p><h1 class="page-heading">你的玩偶，製作完成！<span class="rose-text">✧</span></h1><p class="page-description">看看它的模樣，一起讀一讀這段描寫吧。</p><div class="summary-layout"><div class="finished-doll"><div class="finished-stamp">手作完成<br><b>✦</b></div>${dollMarkup(state.selections,state.gender)}<span class="finished-name">我的${state.gender==='boy'?'男生':'女生'}玩偶</span></div><section class="story-card" aria-label="玩偶外貌總結"><h2>認識我的新朋友</h2><div class="story-text"><span>${pronoun}有</span>${parts.map((part,i)=>`<button class="story-word" data-action="read" data-text="${part}">${part}</button><span>${i===parts.length-1?'。':'，'}</span>`).join('')}<br><span>${pronoun}平日喜歡穿</span><button class="story-word outfit-word" data-action="read" data-text="${labelFor('outfit',state.selections.outfit)}">${labelFor('outfit',state.selections.outfit)}</button><span>。</span></div><div class="story-footnote"><button class="read-summary" data-action="read-summary" aria-label="粵語朗讀整段句子">${navIcon('sound')}<span>朗讀句子</span></button></div><span class="story-decoration">✻</span></section></div><div class="summary-controls"><button class="secondary-button" data-action="edit">${icon('back')}返回修改</button><button class="primary-button" data-action="another">下一個製作 ${icon('arrow')}</button></div></main>`;}

function cancelAnimation(){animation.abort();animation=new AbortController();state.busy=false;const canvas=document.querySelector('#celebration');canvas.hidden=true;canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);}
function artworkFailed(error){
  console.error('Artwork could not load',error);
  document.querySelector('#load-status').hidden=false;
}
async function render(){
  dragging.cancel();cancelAnimation();currentDoll?.close();currentDoll=null;const id=++viewId;
  app.innerHTML=header()+({home,gender,workshop,summary}[state.screen]());
  window.scrollTo(0,0);
  document.querySelector('#announcer').textContent=state.screen==='workshop'?STEPS[state.step].title:state.screen==='summary'?'玩偶製作完成！':state.screen==='gender'?'請選擇玩偶性別':'歡迎來到玩偶小工房';
  await paintStaticDolls(app).catch(artworkFailed);
  if(id!==viewId)return;
  if(state.screen==='workshop'){
    if(state.step>=1)warmSequence('celebrate',PARTY_FRAMES).catch(()=>{});
    document.querySelectorAll('.word-card').forEach(card=>card.disabled=true);
    const canvas=document.querySelector('#doll-canvas');canvas.setAttribute('aria-busy','true');
    const status=document.createElement('p');status.className='doll-loading';status.textContent='載入玩偶中……';canvas.after(status);
    try{
      const image=await renderDoll(state.selections,state.gender);
      if(id!==viewId){image.close();return;}
      setCurrentDoll(image);drawDoll(image);canvas.setAttribute('aria-busy','false');status.remove();
      document.querySelectorAll('.word-card').forEach(card=>card.disabled=false);
      paintWordPictures(app).catch(error=>console.warn('Word illustrations could not load',error));
    }catch(error){if(id===viewId){status.textContent='圖片未能載入';artworkFailed(error);}}
  }
}
function setCurrentDoll(image){if(currentDoll!==image)currentDoll?.close();currentDoll=image;}
function drawDoll(image){const canvas=document.querySelector('#doll-canvas');if(!canvas)return;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,600,750);ctx.drawImage(image,0,0,600,750);}
function reset(){stopVoice();state.gender=null;state.step=0;state.selections=emptySelections();state.screen='gender';render();}
function refreshSelectionUI(){const step=STEPS[state.step];document.querySelectorAll('.word-card').forEach(card=>{const selected=card.dataset.value===state.selections[step.key];card.classList.toggle('selected',selected);card.setAttribute('aria-pressed',String(selected));card.querySelector('.card-audio').innerHTML=icon(selected?'check':'sound');});document.querySelector('#selection-caption').textContent=state.selections[step.key]?`已選擇：${labelFor(step.key,state.selections[step.key])}`:'點選或拖拉詞卡';}
function updateBusy(){const next=document.querySelector('#next-button');if(next)next.disabled=state.busy||!state.selections[STEPS[state.step].key];}
async function select(value){
  if(state.screen!=='workshop')return;
  const step=STEPS[state.step];if(!optionsFor(step,state.gender).some(([key])=>key===value))return;
  animation.abort();animation=new AbortController();const signal=animation.signal,id=viewId;
  const before=currentDoll,previousValue=state.selections[step.key];state.selections[step.key]=value;state.busy=true;
  refreshSelectionUI();updateBusy();
  const label=labelFor(step.key,value);document.querySelector('#announcer').textContent=`已選擇${label}`;
  playChange();speakCard(label);
  let frames,after;
  const motionCanvas=document.querySelector('#doll-canvas');
  motionCanvas.dataset.motion='rendering';
  try{
    const effects=await loadSequence('change',CHANGE_FRAMES);
    after=await renderDoll(state.selections,state.gender);
    if(signal.aborted||id!==viewId)return;
    motionCanvas.dataset.motion='baking';
    frames=await changeFrames(before||after,after,effects,step.key);
    if(signal.aborted||id!==viewId)return;
    motionCanvas.dataset.motion='playing';
    await playFrames(frames,frame=>drawDoll(frame),{signal});
    if(signal.aborted||id!==viewId)return;
    setCurrentDoll(after);drawDoll(after);after=null;
  }catch(error){
    console.error('Change animation failed',error);
    if(!signal.aborted&&id===viewId){
      try{const fallback=await renderDoll(state.selections,state.gender);if(signal.aborted||id!==viewId){fallback.close();return;}setCurrentDoll(fallback);drawDoll(fallback);}
      catch(artError){if(signal.aborted||id!==viewId)return;state.selections[step.key]=previousValue;refreshSelectionUI();artworkFailed(artError);}
      notify('變裝圖片暫未載入，請重新載入後再試。');
    }
  }
  finally{frames?.release?.();after?.close();if(!signal.aborted&&id===viewId){state.busy=false;motionCanvas.dataset.motion='idle';updateBusy();}}
}
async function celebrate(){
  const signal=animation.signal,canvas=document.querySelector('#celebration');canvas.width=960;canvas.height=667;
  const ctx=canvas.getContext('2d');let frames;
  try{frames=await loadSequence('celebrate',PARTY_FRAMES);if(signal.aborted)return;canvas.hidden=false;await playFrames(frames,image=>{ctx.clearRect(0,0,960,667);ctx.drawImage(image,0,0,960,667);},{signal});}
  catch(error){console.error('Celebration frames failed',error);}
  finally{frames?.release();if(!signal.aborted){canvas.hidden=true;canvas.width=1;canvas.height=1;}}
}
function notify(text){const toast=document.querySelector('#toast');toast.textContent=text;toast.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.hidden=true,6500);}
window.addEventListener('doll-notice',event=>notify(event.detail));
window.addEventListener('doll-voice-status',event=>document.querySelector('.voice-dot')?.classList.toggle('available',event.detail.available));
const dragging=enableWordDragging(app,{getPart:()=>state.screen==='workshop'?STEPS[state.step].key:null,onSelect:select,onNotice:notify});
app.addEventListener('click',async event=>{
  const button=event.target.closest('[data-action]');if(!button||button.disabled)return;
  const action=button.dataset.action;
  if(action==='select'){if(!dragging.suppressClick(button))select(button.dataset.value);return;}
  if(action==='voice'){if(voiceAvailable())speakCard('黑色的頭髮');else showVoiceNotice();return;}
  if(action==='read'){speakCard(button.dataset.text);return;}
  if(action==='read-summary'){speakSummary(summaryParts(state.selections),labelFor('outfit',state.selections.outfit),state.gender);return;}
  stopVoice();
  if(action==='home'){state.screen='home';await render();}
  else if(['start','restart','another'].includes(action))reset();
  else if(action==='gender'){state.gender=button.dataset.gender;state.screen='workshop';state.step=0;state.selections=emptySelections();await render();}
  else if(action==='back'){if(state.step>0)state.step--;else state.screen='gender';await render();}
  else if(action==='next'&&!state.busy&&state.selections[STEPS[state.step].key]){if(state.step<STEPS.length-1){state.step++;await render();}else{state.screen='summary';await render();celebrate();}}
  else if(action==='edit'){state.screen='workshop';state.step=STEPS.length-1;await render();}
});
applyPaintedUI().catch(artworkFailed);
render().catch(artworkFailed);
// Warm the small transformation sequence without blocking first paint.
loadSequence('change',CHANGE_FRAMES).catch(()=>{});
