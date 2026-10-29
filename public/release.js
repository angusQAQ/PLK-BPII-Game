export const BUILD_ID=typeof __DOLL_BUILD__!=='undefined'?__DOLL_BUILD__:'development';
export function assetURL(path,relativeTo=document.baseURI){
  const url=new URL(path,relativeTo);
  if(url.protocol==='data:'||url.protocol==='blob:')return url.href;
  const embedded=window.__DOLL_ASSETS__;
  if(embedded){
    const root=new URL('./',document.baseURI);
    const key=decodeURIComponent(url.pathname.slice(root.pathname.length));
    if(url.protocol!==root.protocol||url.host!==root.host||!url.pathname.startsWith(root.pathname)||!embedded[key])throw new Error(`Missing embedded asset: ${key}`);
    return embedded[key];
  }
  if(BUILD_ID!=='development'&&!/\.[a-f0-9]{12}\.webp$/.test(url.pathname))url.searchParams.set('v',BUILD_ID);
  return url.href;
}
