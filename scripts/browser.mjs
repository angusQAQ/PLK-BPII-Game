export async function getBrowser(){
  let playwright;
  try { playwright=await import('playwright'); }
  catch { playwright=await import(process.env.PLAYWRIGHT_MODULE||'/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'); }
  if(process.env.BROWSER_ENGINE==='webkit')return playwright.webkit.launch({headless:true,...(process.env.WEBKIT_EXECUTABLE_PATH?{executablePath:process.env.WEBKIT_EXECUTABLE_PATH}:{})});
  return playwright.chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
}
