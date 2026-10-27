export const BUILD_ID=typeof __DOLL_BUILD__!=='undefined'?__DOLL_BUILD__:'development';
export function assetURL(path){
  const url=new URL(path,document.baseURI);
  if(BUILD_ID!=='development')url.searchParams.set('v',BUILD_ID);
  return url.href;
}
