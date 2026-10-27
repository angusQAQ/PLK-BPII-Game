import {cp,mkdir,readdir,readFile,rm,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const source=fileURLToPath(new URL('../public/',import.meta.url));
const output=fileURLToPath(new URL('../dist/',import.meta.url));
async function files(root){const results=[];for(const entry of await readdir(root,{withFileTypes:true})){if(entry.name.startsWith('.'))continue;const file=path.join(root,entry.name);if(entry.isDirectory())results.push(...await files(file));else if(entry.isFile())results.push(file);}return results.sort();}
const sourceFiles=await files(source),hash=createHash('sha256');
for(const file of sourceFiles){hash.update(path.relative(source,file));hash.update(await readFile(file));}
const version=process.env.GITHUB_SHA||process.env.RELEASE_ID||hash.digest('hex').slice(0,16);
if(!/^[a-zA-Z0-9_.-]+$/.test(version))throw new Error('Invalid build version');
await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});await cp(source,output,{recursive:true,filter:file=>!path.relative(source,file).split(path.sep).some(part=>part.startsWith('.'))});
for(const file of await files(output)){
  if(!/\.(html|css|js|json)$/.test(file))continue;
  let text=await readFile(file,'utf8');
  if(path.basename(file)==='release.js')text=text.replace("export const BUILD_ID='development';",`export const BUILD_ID='${version}';`);
  // Fingerprint module imports, style/image references and atlas/audio filenames.
  // Source assets remain unchanged. Dynamic frame URLs use release.js at runtime.
  text=text.replace(/(["'])([./A-Za-z0-9_-]+\.(?:js|css|json|png|webp|svg|wav|mp3|woff2))\1/g,(_,quote,url)=>`${quote}${url}?v=${version}${quote}`);
  await writeFile(file,text);
}
await writeFile(path.join(output,'.nojekyll'),'');
await writeFile(path.join(output,'version.json'),JSON.stringify({id:version,builtAt:new Date().toISOString()})+'\n');
console.log(`GitHub Pages build: ${version}, ${sourceFiles.length} source files → dist/`);
