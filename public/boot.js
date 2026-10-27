// Keep a visible retry screen even when a module cannot be downloaded or parsed.
document.addEventListener('click',event=>{
  if(event.target.closest('[data-reload]')){event.preventDefault();location.reload();}
});
import('./game.js').catch(error=>{
  console.error('Game startup failed',error);
  document.querySelector('#app').innerHTML='<main class="boot-screen" role="alert"><h1>玩偶小工房</h1><p>未能載入遊戲</p><a class="reload-link" href="./" role="button" data-reload>重新載入</a></main>';
});
