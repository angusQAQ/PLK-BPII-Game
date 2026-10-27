import {STEPS,optionsFor,labelFor,summaryParts,emptySelections} from './data.js';
import {dollMarkup,renderDoll,paintStaticDolls} from './doll.js';
import {applyPaintedUI} from './artwork.js';
import {enableWordDragging} from './drag.js';
import {loadSequence,playFrames,changeFrames,CHANGE_FRAMES,PARTY_FRAMES} from './frames.js';
import {speakCard,stopVoice,playChange,voiceAvailable,showVoiceNotice} from './audio.js';

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
  eyes:'<path d="M2 12q10-14 20 0-10 14-20 0Z"/><circle cx="12" cy="12" r="3"/>',
  nose:'<path d="m12 4-5 13q5 5 10 0M10 20h4"/>',
  mouth:'<path d="M3 8q9 4 18 0-2 15-9 15T3 8Z"/><path d="M7 17q5-4 10 0"/>',
  face:'<path d="M4 11q0-9 8-9t8 9q0 10-8 11Q4 21 4 11Z"/><path d="M8 10h1m6 0h1m-6 6q2 2 4 0"/>',
  outfit:'<path d="m8 3 4 3 4-3 6 5-4 5-2-2v10H8V11l-2 2-4-5 6-5Z"/>',
  spool:'<path d="M7 3h10M6 5h12M8 6v12M16 6v12M6 19h12M7 21h10M8 8l8 3-8 3 8 3"/>',
};
function icon(name,cls=''){return `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${icons[name]||icons.sparkle}</svg>`;}
const demoBoy={hair:'black',eyes:'big',nose:'small',mouth:'small',face:'round',outfit:'school'};
const demoGirl={hair:'brown',eyes:'big',nose:'round',mouth:'small',face:'round',outfit:'dress'};
function header(){return `<header class="site-header">
  <button class="brand" data-action="home" aria-label="玩偶小工房主頁"><img class="brand-emblem" src="./assets/brand-icon.png" alt="" width="56" height="56"><span>玩偶小工房</span></button>
  <div class="header-actions">${state.screen==='home'?'':`<button class="nav-button" data-action="home" aria-label="回到主頁">${icon('home')}<span>回到主頁</span></button><button class="nav-button" data-action="restart" aria-label="重新開始">${icon('reset')}<span>重新開始</span></button>`}
  <button class="voice-button" data-action="voice" aria-label="檢查粵語朗讀" title="點選詞卡會自動朗讀粵語">${icon('sound')}${state.screen==='home'?'':'<span>粵語朗讀</span>'}<i class="voice-dot ${voiceAvailable()?'available':''}"></i></button></div>
</header>`;}
function footer(){return '<footer class="site-footer"><span>每個模樣，都有自己的可愛。</span><span>選詞語 · 做玩偶 · 學描寫</span></footer>';}
function home(){return `<main class="home-page home-simple">
 <section class="hero-copy">
 <h1>一起<br><span class="rose-text">做玩偶！</span></h1>
 <button class="primary-button start-button" data-action="start">開始製作 ${icon('arrow')}</button>
 </section>
 <section class="hero-art" aria-label="兩位人類玩偶站在溫暖的手繪工房裡">
  <div class="hero-scene"><div class="scene-wash"></div><div class="hero-doll boy">${dollMarkup(demoBoy,'boy')}</div><div class="hero-doll girl">${dollMarkup(demoGirl,'girl')}</div></div>
 </section>
</main>`;}
function gender(){return `<main class="gender-page"><p class="eyebrow centered">一段新朋友的故事，從這裡開始</p><h1 class="page-heading">今天，想製作哪一位？</h1><p class="page-description">選擇一位玩偶，然後用詞語為它添上模樣。</p>
 <div class="gender-cards">${[['boy','男生',demoBoy],['girl','女生',demoGirl]].map(([value,name,demo])=>`<button class="gender-card ${value}" data-action="gender" data-gender="${value}" aria-label="製作${name}玩偶"><span class="gender-card-number">${value==='boy'?'01':'02'}</span><div class="gender-portrait">${dollMarkup(demo,value)}</div><span class="gender-card-label"><span><strong>${name}玩偶</strong></span><span class="gender-arrow">${icon('arrow')}</span></span></button>`).join('')}</div>
 <p class="gentle-note">${icon('sparkle')}每個選擇，都能做出不一樣的朋友。</p></main>`;}
function stepper(){return `<nav class="stepper" aria-label="玩偶製作進度">${STEPS.map((step,i)=>`<div class="step-item ${i===state.step?'current':''} ${state.selections[step.key]?'done':''}" ${i===state.step?'aria-current="step"':''}><span class="step-icon">${state.selections[step.key]&&i!==state.step?icon('check'):icon(step.key)}</span><span>${step.name}</span>${i<5?'<i class="step-connector"></i>':''}</div>`).join('')}</nav>`;}
function wordCard([value],step){const label=labelFor(step.key,value), selected=state.selections[step.key]===value;return `<button class="word-card ${selected?'selected':''}" data-action="select" data-value="${value}" aria-pressed="${selected}" aria-label="${label}"><span class="word-symbol">${icon(step.key)}</span><span class="word-label">${label}</span><span class="card-audio">${selected?icon('check'):icon('sound')}</span></button>`;}
function workshop(){const step=STEPS[state.step],options=optionsFor(step,state.gender),split=Math.ceil(options.length/2);return `<main class="workshop-page">
 ${stepper()}<div class="workshop-heading"><span class="eyebrow">製作工序 ${String(state.step+1).padStart(2,'0')} / 06</span><h1 class="page-heading">${step.title}</h1><p class="page-description">${step.hint}</p></div>
 <div class="workbench"><div class="word-column left-words">${options.slice(0,split).map(option=>wordCard(option,step)).join('')}</div>
 <div class="doll-stage"><span class="stage-stitch left-stitch">✧</span><span class="stage-stitch right-stitch">✧</span><div class="stage-backdrop"></div><div class="stage-label"><span class="label-dot"></span>${state.gender==='boy'?'男生':'女生'}玩偶<span class="label-divider">/</span>製作中</div><canvas id="doll-canvas" width="600" height="750" aria-label="正在製作的玩偶"></canvas><div class="pedestal"></div><p class="selection-caption" id="selection-caption">${state.selections[step.key]?`已選擇：${labelFor(step.key,state.selections[step.key])}`:'點選或拖拉詞卡，為玩偶添上模樣'}</p></div>
 <div class="word-column right-words">${options.slice(split).map(option=>wordCard(option,step)).join('')}<span class="listen-tip">${icon('sound')}點選或拖拉詞卡，聽聽粵語讀音</span></div></div>
 <div class="workshop-controls"><button class="secondary-button" data-action="back">${icon('back')}上一步</button><span class="control-note" id="control-note">${state.selections[step.key]?'喜歡這個模樣，就繼續製作吧！':'點選詞卡，或把它拖到玩偶上'}</span><button class="primary-button" id="next-button" data-action="next" ${!state.selections[step.key]?'disabled':''}>${state.step===5?'完成製作':'製作'} ${icon(state.step===5?'check':'arrow')}</button></div>
</main>`;}
function summary(){const pronoun=state.gender==='boy'?'他':'她';return `<main class="summary-page"><p class="eyebrow centered">小小工房，完成了一位新朋友</p><h1 class="page-heading">你的玩偶，製作完成！<span class="rose-text">✧</span></h1><p class="page-description">看看它的模樣，一起讀一讀這段描寫吧。</p><div class="summary-layout"><div class="finished-doll"><div class="finished-stamp">手作完成<br><b>✦</b></div>${dollMarkup(state.selections,state.gender)}<span class="finished-name">我的${state.gender==='boy'?'男生':'女生'}玩偶</span></div><section class="story-card" aria-label="玩偶外貌總結"><h2>認識我的新朋友</h2><div class="story-text"><span>${pronoun}有</span>${summaryParts(state.selections).map((part,i)=>`<button class="story-word" data-action="read" data-text="${part}">${part}</button><span>${i===4?'。':'，'}</span>`).join('')}<br><span>${pronoun}平日喜歡穿</span><button class="story-word outfit-word" data-action="read" data-text="${labelFor('outfit',state.selections.outfit)}">${labelFor('outfit',state.selections.outfit)}</button><span>。</span></div><div class="story-footnote">${icon('sound')}點選有底線的詞語，可以再聽一次。</div><span class="story-decoration">✻</span></section></div><div class="summary-controls"><button class="secondary-button" data-action="edit">${icon('back')}返回修改</button><button class="primary-button" data-action="another">下一個製作 ${icon('arrow')}</button></div></main>`;}

function cancelAnimation(){animation.abort();animation=new AbortController();state.busy=false;const canvas=document.querySelector('#celebration');canvas.hidden=true;canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);}
async function render(){
  dragging.cancel();cancelAnimation();const id=++viewId;
  app.innerHTML=header()+({home,gender,workshop,summary}[state.screen]())+(state.screen==='home'?'':footer());
  window.scrollTo(0,0);
  document.querySelector('#announcer').textContent=state.screen==='workshop'?STEPS[state.step].title:state.screen==='summary'?'玩偶製作完成！':state.screen==='gender'?'請選擇玩偶性別':'歡迎來到玩偶小工房';
  await paintStaticDolls(app);
  if(id!==viewId)return;
  if(state.screen==='workshop'){
    const image=await renderDoll(state.selections,state.gender);
    if(id!==viewId)return;
    currentDoll=image;drawDoll(image);
  }
}
function drawDoll(image){const canvas=document.querySelector('#doll-canvas');if(!canvas)return;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,600,750);ctx.drawImage(image,0,0,600,750);}
function reset(){stopVoice();state.gender=null;state.step=0;state.selections=emptySelections();state.screen='gender';render();}
function refreshSelectionUI(){const step=STEPS[state.step];document.querySelectorAll('.word-card').forEach(card=>{const selected=card.dataset.value===state.selections[step.key];card.classList.toggle('selected',selected);card.setAttribute('aria-pressed',String(selected));card.querySelector('.card-audio').innerHTML=icon(selected?'check':'sound');});document.querySelector('#selection-caption').textContent=`已選擇：${labelFor(step.key,state.selections[step.key])}`;document.querySelector('#control-note').textContent='喜歡這個模樣，就繼續製作吧！';}
function updateBusy(){const next=document.querySelector('#next-button');if(next)next.disabled=state.busy||!state.selections[STEPS[state.step].key];}
async function select(value){
  if(state.screen!=='workshop')return;
  const step=STEPS[state.step];if(!optionsFor(step,state.gender).some(([key])=>key===value))return;
  animation.abort();animation=new AbortController();const signal=animation.signal,id=viewId;
  const before=currentDoll;state.selections[step.key]=value;state.busy=true;
  refreshSelectionUI();updateBusy();
  const label=labelFor(step.key,value);document.querySelector('#announcer').textContent=`已選擇${label}`;
  playChange();speakCard(label);
  let frames;
  const motionCanvas=document.querySelector('#doll-canvas');
  motionCanvas.dataset.motion='rendering';
  try{
    const [after,effects]=await Promise.all([renderDoll(state.selections,state.gender),loadSequence('change',CHANGE_FRAMES)]);
    if(signal.aborted||id!==viewId)return;
    motionCanvas.dataset.motion='baking';
    frames=await changeFrames(before||after,after,effects,step.key);
    if(signal.aborted||id!==viewId)return;
    motionCanvas.dataset.motion='playing';
    await playFrames(frames,frame=>drawDoll(frame),{signal});
    if(signal.aborted||id!==viewId)return;
    currentDoll=after;drawDoll(after);
  }catch(error){console.error('Change animation failed',error);if(!signal.aborted&&id===viewId){currentDoll=await renderDoll(state.selections,state.gender);drawDoll(currentDoll);notify('變裝圖片暫未載入，請重新整理後再試。');}}
  finally{frames?.forEach(frame=>frame.close?.());if(!signal.aborted&&id===viewId){state.busy=false;motionCanvas.dataset.motion='idle';updateBusy();}}
}
async function celebrate(){const signal=animation.signal;const canvas=document.querySelector('#celebration');canvas.width=1440;canvas.height=1000;const ctx=canvas.getContext('2d');try{const frames=await loadSequence('celebrate',PARTY_FRAMES);if(signal.aborted)return;canvas.hidden=false;await playFrames(frames,image=>{ctx.clearRect(0,0,1440,1000);ctx.drawImage(image,0,0,1440,1000);},{signal});}catch(error){console.error('Celebration frames failed',error);}finally{if(!signal.aborted)canvas.hidden=true;}}
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
  stopVoice();
  if(action==='home'){state.screen='home';await render();}
  else if(['start','restart','another'].includes(action))reset();
  else if(action==='gender'){state.gender=button.dataset.gender;state.screen='workshop';state.step=0;state.selections=emptySelections();await render();}
  else if(action==='back'){if(state.step>0)state.step--;else state.screen='gender';await render();}
  else if(action==='next'&&!state.busy&&state.selections[STEPS[state.step].key]){if(state.step<5){state.step++;await render();}else{state.screen='summary';await render();celebrate();}}
  else if(action==='edit'){state.screen='workshop';state.step=5;await render();}
});
await applyPaintedUI();
await render();
// Warm the small transformation sequence without blocking first paint.
loadSequence('change',CHANGE_FRAMES).catch(()=>{});
