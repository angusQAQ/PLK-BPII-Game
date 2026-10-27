export const BUILD_ID='development';
export function assetURL(path){
  const url=new URL(path,document.baseURI);
  if(BUILD_ID!=='development')url.searchParams.set('v',BUILD_ID);
  return url.href;
}
