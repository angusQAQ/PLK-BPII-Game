(function(){
  document.addEventListener('click',function(event){
    if(event.target.closest('[data-reload]')){event.preventDefault();location.reload();}
  });
  // One classic script also runs in embedded browsers that reject module imports.
  var script=document.createElement('script');script.src='./game.bundle.js';
  script.onerror=function(){document.querySelector('#app').innerHTML='<main class="boot-screen" role="alert"><h1>玩偶小工房</h1><p>未能載入遊戲</p><a class="reload-link" href="./" role="button" data-reload>重新載入</a></main>';};
  document.head.appendChild(script);
})();
