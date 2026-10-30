import assert from 'node:assert/strict';

export async function assertFinishedDoll(scope){
  const image=scope.locator('.finished-doll img.painted-doll[data-doll-rendered="true"]');
  await image.waitFor({state:'visible'});
  const result=await image.evaluate(image=>{
    const canvas=document.createElement('canvas');canvas.width=600;canvas.height=750;
    const context=canvas.getContext('2d');context.drawImage(image,0,0);
    const pixels=context.getImageData(0,0,600,750).data;
    let painted=0;for(let i=3;i<pixels.length;i+=400)if(pixels[i]>0)painted++;
    const bounds=image.getBoundingClientRect();
    return {complete:image.complete,width:image.naturalWidth,height:image.naturalHeight,
      selfContained:image.src.startsWith('data:image/png'),painted,displayed:bounds.width>100&&bounds.height>100};
  });
  assert(result.complete&&result.selfContained&&result.displayed,JSON.stringify(result));
  assert.equal(result.width,600);assert.equal(result.height,750);
  assert(result.painted>100,'Completed doll must contain visible painted pixels');
}
