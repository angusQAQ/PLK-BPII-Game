import {assetURL} from './release.js';
let currentRequest=0;
let notified=false;
let voice=null;
let recordedCount=0;
const synth=window.speechSynthesis;
const changeAudio=new Audio(assetURL('./assets/change.wav'));
changeAudio.volume=.20;
const manifest=fetch(assetURL('./assets/voice/manifest.json')).then(r=>r.ok?r.json():{}).catch(()=>({}));
const summaryManifest=fetch(assetURL('./assets/voice/summary/manifest.json')).then(r=>r.ok?r.json():{}).catch(()=>({}));
manifest.then(clips=>{recordedCount=Object.keys(clips).length;updateVoice();});
let recorded=null;

function updateVoice() {
  const voices=synth?.getVoices?.()||[];
  voice=voices.find(v=>/^yue([-_]|$)/i.test(v.lang))
    ||voices.find(v=>/^zh[-_]HK$/i.test(v.lang))
    ||voices.find(v=>/cantonese|廣東話|粵語|sin.ji/i.test(v.name));
  window.dispatchEvent(new CustomEvent('doll-voice-status',{detail:{available:!!voice||recordedCount>0}}));
}
updateVoice();
synth?.addEventListener?.('voiceschanged',updateVoice);

export function voiceAvailable(){return !!voice||recordedCount>0;}
export function stopVoice(){currentRequest++; synth?.cancel?.(); recorded?.pause(); recorded=null;}
export function playChange(){changeAudio.currentTime=0; changeAudio.play().catch(()=>{});}
export function showVoiceNotice() {
  window.dispatchEvent(new CustomEvent('doll-notice',{detail:'這部裝置暫未提供粵語讀音。請在裝置的語音設定加入「粵語（香港）」，再重新開啟遊戲。'}));
}
// Keep the displayed word 長, but disambiguate its coeng4 reading for device TTS.
export function pronunciationText(text){return text.replace(/長長/g,'詳詳');}
function deviceSpeak(text,rate=.78){
  updateVoice();
  if(!voice||!synth)return false;
  const utterance=new SpeechSynthesisUtterance(pronunciationText(text));
  utterance.voice=voice;utterance.lang=voice.lang;utterance.rate=rate;utterance.pitch=1.04;
  utterance.onerror=event=>{if(!['canceled','interrupted'].includes(event.error))showVoiceNotice();};
  synth.speak(utterance);return true;
}
export async function speakCard(text) {
  stopVoice();
  const request=currentRequest;
  const clips=await manifest;
  if(request!==currentRequest)return;
  if(clips[text]) {
    recorded=new Audio(assetURL(clips[text],new URL('./assets/voice/',document.baseURI)));
    try { await recorded.play(); return; } catch { if(request!==currentRequest)return; /* Try the device's Cantonese voice. */ }
  }
  if(!deviceSpeak(text)&&!notified){notified=true;showVoiceNotice();}
}
export async function speakSummary(parts,outfit,gender){
  stopVoice();const request=currentRequest,pronoun=gender==='girl'?'她':'他';
  const text=`${pronoun}有${parts.slice(0,-1).join('，')}和${parts[parts.length-1]}。${pronoun}平日喜歡穿${outfit}。`;
  const phrases=[`${pronoun}有`,...parts.slice(0,-1),'和',parts[parts.length-1],`${pronoun}平日喜歡穿`,outfit];
  const [normalClips,cardClips]=await Promise.all([summaryManifest,manifest]);if(request!==currentRequest)return;
  const normal=phrases.every(phrase=>normalClips[phrase]);
  const clips=normal?normalClips:cardClips;
  if(!phrases.every(phrase=>clips[phrase])){
    if(!deviceSpeak(text,1))showVoiceNotice();return;
  }
  // Queue normal-speed, silence-trimmed clips in advance so each next phrase is
  // already loading while the current one plays, without a new network pause.
  const queue=phrases.map(phrase=>{
    const audio=new Audio(assetURL(clips[phrase],new URL(normal?'./assets/voice/summary/':'./assets/voice/',document.baseURI)));
    audio.preload='auto';audio.playbackRate=normal?1:1/.9;audio.preservesPitch=true;return audio;
  });
  for(const audio of queue){
    if(request!==currentRequest)return;
    recorded=audio;
    try{
      await new Promise((resolve,reject)=>{
        audio.addEventListener('ended',resolve,{once:true});
        audio.addEventListener('pause',resolve,{once:true});
        audio.addEventListener('error',reject,{once:true});
        audio.play().catch(reject);
      });
    }catch{if(request===currentRequest)showVoiceNotice();return;}
  }
  if(request===currentRequest)recorded=null;
}
