"""Download the parts of a NVIDIA SimReady asset needed to build a costume (CC BY 4.0).

Only the USD layers and albedo textures are fetched (a few MB instead of ~60 MB per asset).
Usage: python fetch.py <asset_folder> <out_dir>
"""
import json, os, ssl, sys, urllib.request

try:  # python.org builds on macOS ship without system certificates
    import certifi
    _ctx = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    _ctx = None

REPO = 'https://huggingface.co/datasets/nvidia/simready-assets'
SKIP = ('/.thumbs/', '/.simready/', '/runnables/', '/source_assets/', '/materials/', '/Physics/')


def wanted(path):
    if any(s in path for s in SKIP):
        return False
    if path.endswith(('.usd', '.usda', 'LICENSE.txt')):
        return '/instances_' not in path
    name = path.rsplit('/', 1)[-1].lower()
    return name.endswith('.png') and ('_alb' in name or 'albedo' in name or 'basecolor' in name or 'diff' in name)


def fetch(asset, out):
    listing = json.load(urllib.request.urlopen(f'https://huggingface.co/api/datasets/nvidia/simready-assets/tree/main/{asset}?recursive=true', context=_ctx))
    for item in listing:
        if item['type'] != 'file' or not wanted(item['path']):
            continue
        dest = os.path.join(out, os.path.relpath(item['path'], asset))
        if os.path.exists(dest) and os.path.getsize(dest) == item.get('size'):
            continue
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with urllib.request.urlopen(f'{REPO}/resolve/main/{item["path"]}', context=_ctx) as r, open(dest, 'wb') as f:
            f.write(r.read())
    return out


if __name__ == '__main__':
    print(fetch(sys.argv[1], sys.argv[2]))
