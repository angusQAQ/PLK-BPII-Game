import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../public/assets/voice/',import.meta.url));
const clips=JSON.parse(await readFile(path.join(root,'manifest.json'),'utf8'));
const output=path.join(root,'summary');await mkdir(output,{recursive:true});
// Card recordings were made at -10%. Restore normal speech without changing
// pitch, and remove only the silence around each recording, keeping phonemes.
const filter='silenceremove=start_periods=1:start_duration=0.02:start_threshold=-50dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_duration=0.02:start_threshold=-50dB:start_silence=0.06,areverse,atempo=1.111111';
for(const filename of new Set(Object.values(clips))){
 execFileSync('ffmpeg',['-y','-v','error','-i',path.join(root,filename),'-af',filter,'-ar','24000','-ac','1','-c:a','libmp3lame','-b:a','48k',path.join(output,filename)]);
}
await writeFile(path.join(output,'manifest.json'),JSON.stringify(clips,null,2)+'\n');
console.log(`Prepared ${Object.keys(clips).length} normal-speed summary recordings.`);
