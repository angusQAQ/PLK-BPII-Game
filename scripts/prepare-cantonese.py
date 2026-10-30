"""Prepare reusable Cantonese audio assets when network access is available.

Requires edge-tts (pip install edge-tts). No API key is required.
This is an optional asset-production tool; the website has no Python dependency.
"""
import asyncio
import json
import os
from pathlib import Path
import shutil
import tempfile
import argparse

try:
    import edge_tts
except ImportError:
    raise SystemExit('Install the audio-generation dependency first: python3 -m pip install edge-tts')

ROOT = Path(__file__).resolve().parent.parent / 'public' / 'assets' / 'voice'
VOCABULARY = {
    'hair': ['黑色的頭髮', '棕色的頭髮', '長長的頭髮', '短短的頭髮', '捲曲的頭髮'],
    'eyes': ['大大的眼睛', '小小的眼睛', '圓圓的眼睛'],
    'ears': ['大大的耳朵', '小小的耳朵'],
    'nose': ['高高的鼻子', '大大的鼻子', '小小的鼻子', '圓圓的鼻子'],
    'mouth': ['大大的嘴巴', '小小的嘴巴'],
    'face': ['圓圓的臉', '方方的臉', '長長的臉', '小小的臉'],
    'outfit': ['校服', '體育服', '長裙', '西裝'],
    'sentence': ['他有', '她有', '他平日喜歡穿', '她平日喜歡穿'],
    'connector': ['和'],
}
# 詳 is the unambiguous coeng4 homophone. The visual teaching vocabulary keeps 長.
PRONUNCIATION = {'長長的頭髮': '詳詳的頭髮', '長長的臉': '詳詳的臉'}

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--corrections-only', action='store_true')
    parser.add_argument('--missing-only', action='store_true')
    args = parser.parse_args()
    # aiohttp does not inherit HTTPS_PROXY automatically. Use the environment's
    # supported route, keeping certificate verification enabled.
    proxy = os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy')
    # Add the managed environment's CA to edge-tts' existing verified trust store.
    context = getattr(edge_tts.communicate, '_SSL_CTX', None)
    managed_ca = os.environ.get('SSL_CERT_FILE') or os.environ.get('REQUESTS_CA_BUNDLE')
    if managed_ca and Path(managed_ca).is_file() and context:
        context.load_verify_locations(cafile=managed_ca)
    certificate = os.environ.get('CODEX_PROXY_CERT')
    if certificate and context:
        if 'BEGIN CERTIFICATE' in certificate:
            context.load_verify_locations(cadata=certificate)
        elif Path(certificate).is_file():
            context.load_verify_locations(cafile=certificate)
    ROOT.mkdir(parents=True, exist_ok=True)
    manifest = json.loads((ROOT / 'manifest.json').read_text()) if args.corrections_only or args.missing_only else {}
    with tempfile.TemporaryDirectory(prefix='.cantonese-', dir=ROOT) as directory:
        staging = Path(directory)
        for category, words in VOCABULARY.items():
            for index, text in enumerate(words):
                filename = f'{category}-{index}.mp3'
                if args.missing_only and text in manifest and (ROOT / manifest[text]).is_file():
                    continue
                if args.corrections_only and text not in PRONUNCIATION and category != 'sentence':
                    continue
                await edge_tts.Communicate(PRONUNCIATION.get(text, text), voice='zh-HK-HiuGaaiNeural', rate='-10%', proxy=proxy).save(str(staging / filename))
                if (staging / filename).stat().st_size < 1000:
                    raise RuntimeError(f'Incomplete audio: {text}')
                manifest[text] = filename
                print(f'Prepared {text}', flush=True)
        # Publish the manifest only after every clip has been generated.
        for source in staging.iterdir():
            shutil.copyfile(source, ROOT / source.name)
        temporary_manifest = ROOT / '.manifest.json.tmp'
        temporary_manifest.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
        temporary_manifest.replace(ROOT / 'manifest.json')
    print(f'Prepared {len(manifest)} Hong Kong Cantonese clips.')

if __name__ == '__main__':
    asyncio.run(main())
