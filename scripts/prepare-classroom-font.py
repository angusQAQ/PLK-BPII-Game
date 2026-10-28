"""Subset an OFL-licensed TW-Kai source font for this game's vocabulary.

Production-only tool: python3 scripts/prepare-classroom-font.py /path/to/TW-Kai.ttf
Requires FontTools and Brotli; the website serves the committed WOFF2 directly.
"""
from pathlib import Path
import hashlib
import json
import sys
from fontTools import subset
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parent.parent
source = Path(sys.argv[1])
font = TTFont(source)
text = ''.join(path.read_text() for path in sorted((root / 'public').iterdir())
               if path.suffix in {'.html', '.js'} and path.name != 'game.bundle.js')
requested = {ord(char) for char in text} | set(range(32, 127))
cmap = font.getBestCmap()
missing = sorted(code for code in requested if 0x3400 <= code <= 0x9fff and code not in cmap)
if missing:
    raise SystemExit('Missing teaching characters: ' + ''.join(chr(code) for code in missing))
options = subset.Options()
options.name_IDs = ['*']
options.name_legacy = True
options.name_languages = ['*']
subsetter = subset.Subsetter(options=options)
subsetter.populate(unicodes=requested & cmap.keys())
subsetter.subset(font)
for record in font['name'].names:
    if record.nameID in {1, 4, 6, 16}:
        value = 'ClassroomKai' if record.nameID == 6 else 'Classroom Kai'
        record.string = value.encode(record.getEncoding())
font.flavor = 'woff2'
output = root / 'public/assets/fonts/classroom-kai.woff2'
output.parent.mkdir(parents=True, exist_ok=True)
font.save(output)
source_info = source.with_name('source.json')
metadata = json.loads(source_info.read_text()) if source_info.exists() else {}
metadata.update({'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                 'family': 'Classroom Kai', 'upstreamFamily': 'TW-Kai',
                 'license': 'SIL Open Font License 1.1',
                 'characters': ''.join(chr(code) for code in sorted(requested & cmap.keys())),
                 'bytes': output.stat().st_size})
output.with_name('classroom-kai.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n')
print(f'Prepared {len(metadata["characters"])} glyphs, {output.stat().st_size / 1024:.1f} KiB.')
