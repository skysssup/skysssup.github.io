"""Side-by-side crops of the hero's features at 2x: the avatar, then each pose that tools/qa/poses.mjs wrote, each crop
centred on the feature as the figure is turned (the engine's rotation and projection, depth from depth.webp).
    python3 tools/qa/crops.py <poses-dir> <out.png> [pose,pose,...]
A pose is a name in <poses-dir> or <other-dir>:<name>, so a column can come from another run (before and after).
FEATS=face,fist,cad-top,wing-big,chest,open hand picks the rows; ROOT reads hero.json and depth.webp from another
checkout. Needs numpy and Pillow.
"""
import json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw

SITE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
args = sys.argv[1:]
src, out = args[0], args[1]
names = args[2].split(',') if len(args) > 2 else ['rest', 'turn-20', 'sway-plus', 'sway-minus']
names = [n if ':' in n else src + ':' + n for n in names]
info = json.load(open(os.path.join(src, 'poses.json')))
feats = os.environ.get('FEATS')
root = os.environ.get('ROOT', SITE)
meta = json.load(open(os.path.join(root, 'assets/hero/hero.json')))
depth = np.asarray(Image.open(os.path.join(root, 'assets/hero/depth.webp')).convert('RGB'))[..., 0].astype(np.float32) / 255
avatar = Image.open(os.path.join(SITE, 'tools/hero/avatar-424.jpg')).convert('RGB')
fr, clip, dpr = info['frame'], info['clip'], info.get('dpr', 1)
cx, cy = meta['center']
# features: name, centre (figure units), half-size (figure units)
FEAT = [('face', (0.497, 0.45), 0.085), ('fist', (0.236, 0.29), 0.075), ('caduceus top', (0.24, 0.13), 0.11),
        ('wing', (0.24, 0.50), 0.12), ('chest', (0.53, 0.62), 0.09), ('open hand', (0.855, 0.83), 0.085)]
ZOOM = 2


def project(fx, fy, yaw, pitch):
    d = depth[min(447, max(0, round(fy * 447))), min(447, max(0, round(fx * 447)))]
    p = np.array([fx - cx, cy - fy, (max(d, 0.3) - 0.62) * 0.34])
    c, s = math.cos(yaw), math.sin(yaw)
    p = np.array([p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c])
    c, s = math.cos(pitch), math.sin(pitch)
    p = np.array([p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c])
    k = 3.2 / (3.2 - p[2])
    return fr['left'] + (cx + p[0] * k) * fr['scale'], fr['top'] + (cy - p[1] * k) * fr['scale']


FEAT2 = {'wing-big': ('wing', (0.25, 0.50), 0.16), 'cad-top': ('caduceus top', (0.23, 0.13), 0.13), 'rubble': ('rubble', (0.40, 0.84), 0.14)}
if feats:
    FEAT = [next(f for f in FEAT if f[0] == k) if k not in FEAT2 else FEAT2[k] for k in feats.split(',')]
cells = []
for fname, (fx, fy), r in FEAT:
    row = []
    side = int(round(2 * r * fr['scale'])) * ZOOM
    a = avatar.crop((int((fx - r) * 424), int((fy - r) * 424), int((fx + r) * 424), int((fy + r) * 424))).resize((side, side), Image.LANCZOS)
    row.append(a)
    for col in names:
        d_, n = col.split(':')
        pinfo = json.load(open(os.path.join(d_, 'poses.json')))
        pose = pinfo['poses'][n]
        sx, sy = project(fx, fy, math.radians(pose['yaw']), math.radians(pose['pitch']))
        shot = Image.open(os.path.join(d_, n + '.png')).convert('RGB')
        half = r * fr['scale']
        box = [(sx - half - clip['x']) * dpr, (sy - half - clip['y']) * dpr, (sx + half - clip['x']) * dpr, (sy + half - clip['y']) * dpr]
        c = shot.crop(tuple(int(round(v)) for v in box)).resize((side, side), Image.NEAREST if dpr == 1 else Image.LANCZOS)
        row.append(c)
    cells.append(row)
cw = [max(r[i].width for r in cells) for i in range(len(cells[0]))]
ch = [max(c.height for c in r) for r in cells]
pad, top = 6, 18
sheet = Image.new('RGB', (sum(cw) + pad * (len(cw) + 1), sum(ch) + pad * (len(ch) + 1) + top), (128, 128, 128))
d = ImageDraw.Draw(sheet)
x = pad
for i, label in enumerate(['avatar'] + [f"{os.path.basename(c.split(':')[0])} {c.split(':')[1]}" for c in names]):
    d.text((x + 2, 3), label, fill=(255, 255, 255))
    x += cw[i] + pad
y = pad + top
for j, row in enumerate(cells):
    x = pad
    for i, c in enumerate(row):
        sheet.paste(c, (x, y))
        x += cw[i] + pad
    y += ch[j] + pad
sheet.save(out)
print(out, sheet.size)
