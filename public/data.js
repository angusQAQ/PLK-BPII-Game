export const STEPS = [
  { key: 'hair', name: '頭髮', title: '先來選一款頭髮吧！', hint: '把詞卡拖到頭上，或點選喜歡的頭髮。', options: [['black','黑色的'],['brown','棕色的'],['long','長長的'],['short','短短的'],['curly','捲曲的']] },
  { key: 'eyes', name: '眼睛', title: '為玩偶加上明亮的眼睛', hint: '把詞卡拖到臉上，或點選喜歡的眼睛。', options: [['big','大大的'],['small','小小的'],['round','圓圓的']] },
  { key: 'ears', name: '耳朵', title: '為玩偶加上一雙耳朵', hint: '把詞卡拖到頭上，或點選喜歡的耳朵。', options: [['big','大大的'],['small','小小的']] },
  { key: 'nose', name: '鼻子', title: '接著，選一個可愛的鼻子', hint: '拖到臉上或點選詞卡，看看鼻子的變化。', options: [['high','高高的'],['big','大大的'],['small','小小的'],['round','圓圓的']] },
  { key: 'mouth', name: '嘴巴', title: '讓玩偶露出一個笑容', hint: '拖到臉上或點選詞卡，看看嘴巴的大小。', options: [['big','大大的'],['small','小小的']] },
  { key: 'face', name: '臉', title: '你想要一張怎樣的臉？', hint: '拖到臉上或點選詞卡，試試不同的臉形。', options: [['round','圓圓的'],['square','方方的'],['long','長長的'],['small','小小的']] },
  { key: 'outfit', name: '衣服', title: '最後，換上喜歡的衣服', hint: '把詞卡拖到身體上，或點選喜歡的衣服。', options: [['school','校服'],['sports','體育服'],['suit','西裝'],['dress','長裙']] }
];
export function optionsFor(step, gender) {
  return step.options.filter(([key]) => {
    if(step.key==='hair'&&gender==='boy'&&key==='long')return false;
    return step.key!=='outfit'||(gender==='boy'?key!=='dress':key!=='suit');
  });
}
export function labelFor(key, value) {
  const step = STEPS.find(step => step.key === key);
  const text = step?.options.find(([id]) => id === value)?.[1];
  return text ? text + (key === 'outfit' ? '' : step.name) : '';
}
// Jyutping without tone digits or diacritics, matching each complete word card.
const JYUTPING={
  hair:{black:'hak sik dik tau faat',brown:'zung sik dik tau faat',long:'coeng coeng dik tau faat',short:'dyun dyun dik tau faat',curly:'gyun kuk dik tau faat'},
  eyes:{big:'daai daai dik ngaan zing',small:'siu siu dik ngaan zing',round:'jyun jyun dik ngaan zing'},
  ears:{big:'daai daai dik ji do',small:'siu siu dik ji do'},
  nose:{high:'gou gou dik bei zi',big:'daai daai dik bei zi',small:'siu siu dik bei zi',round:'jyun jyun dik bei zi'},
  mouth:{big:'daai daai dik zeoi baa',small:'siu siu dik zeoi baa'},
  face:{round:'jyun jyun dik lim',square:'fong fong dik lim',long:'coeng coeng dik lim',small:'siu siu dik lim'},
  outfit:{school:'haau fuk',sports:'tai juk fuk',suit:'sai zong',dress:'coeng kwan'},
};
export function jyutpingFor(key,value){return JYUTPING[key]?.[value]||'';}
export function summaryParts(selections) { return STEPS.filter(step=>step.key!=='outfit').map(step => labelFor(step.key, selections[step.key])); }
export const emptySelections = () => STEPS.reduce((selections,step)=>{selections[step.key]=null;return selections;},{});
