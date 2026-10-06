"""Source-adjacent matched crops, workload and grayscale/thumbnail evidence.
Usage: python tools/qa/stage-1/boards.py <evidence/stage-1>
Before geometry is read from the recorded baseline commit, never current maps.
"""
import io, json, math, pathlib, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parents[3]
OUT = pathlib.Path(sys.argv[1]).resolve()
BASE = '31ab973f60d805a143609acd677b4073624929ba'
def old(name):
    return subprocess.check_output(['git', 'show', f'{BASE}:assets/hero/{name}'], cwd=ROOT)
metas = {'before': json.loads(old('hero.json')), 'after': json.loads((ROOT/'assets/hero/hero.json').read_text())}
depths = {'before': np.asarray(Image.open(io.BytesIO(old('depth.webp'))))[..., 0]/255,
          'after': np.asarray(Image.open(ROOT/'assets/hero/depth.webp'))[..., 0]/255}
source = Image.open(ROOT/'tools/hero/avatar-424.jpg').convert('RGB')
regions = [('Open hand / wrist', [.735,.765,.96,.91]), ('Raised grip', [.17,.245,.31,.365]),
           ('Face / throat', [.385,.375,.615,.585]), ('Chest / connected planes', [.405,.51,.66,.795]),
           ('Wing / attachment', [.07,.375,.425,.66]), ('Crown / coils', [.015,.05,.44,.26]),
           ('Torso / support', [.32,.72,.66,.92])]
try:
    font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 18)
except OSError:
    font = ImageFont.load_default(size=18)

def crop(stage, mode, dpr, bounds):
    folder = OUT/stage/f'{mode}-dpr{dpr}'
    info = json.loads((folder/'metadata.json').read_text())
    image = Image.open(folder/'viewport.png').convert('RGB')
    meta, depth = metas[stage], depths[stage]
    cx, cy = meta['center']; yaw, pitch = info['uniforms']['u_rot']
    points = []
    for fy in [bounds[1], (bounds[1]+bounds[3])/2, bounds[3]]:
        for fx in [bounds[0], (bounds[0]+bounds[2])/2, bounds[2]]:
            z = (max(.3, depth[min(447,round(fy*447)),min(447,round(fx*447))])-.62)*.34
            x,y = fx-cx,cy-fy
            x,z = x*math.cos(yaw)+z*math.sin(yaw),-x*math.sin(yaw)+z*math.cos(yaw)
            y,z = y*math.cos(pitch)-z*math.sin(pitch),y*math.sin(pitch)+z*math.cos(pitch)
            k = 3.2/(3.2-z); frame = info['frame']
            points.append(((frame['left']+(cx+x*k)*frame['scale'])*dpr,
                           (frame['top']+(cy-y*k)*frame['scale'])*dpr))
    xs,ys = zip(*points)
    return image.crop((min(xs)-3*dpr,min(ys)-3*dpr,max(xs)+3*dpr,max(ys)+3*dpr))

workload = []
for mode in ['light','dark','blue','gear']:
    for dpr in [1,2]:
        board = Image.new('RGB',(950,120+len(regions)*220),'#edf1f2'); draw = ImageDraw.Draw(board)
        draw.text((20,15),f'STAGE 1 / {mode.upper()} / DPR {dpr} / quiet pose 0.12, 0.02 rad',font=font,fill='#142b38')
        for x,label in [(20,'Original source (unrotated)'),(335,'Before'),(650,'After')]:
            draw.text((x,55),label,font=font,fill='#142b38')
        for r,(name,b) in enumerate(regions):
            y=100+r*220; draw.text((20,y),name,font=font,fill='#142b38')
            src=source.crop(tuple(v*424 for v in b))
            for x,im in [(20,src),(335,crop('before',mode,dpr,b)),(650,crop('after',mode,dpr,b))]:
                im.thumbnail((290,180)); board.paste(im,(x,y+30))
        board.save(OUT/f'comparison-{mode}-dpr{dpr}.jpg',quality=94)
        records = {}
        for stage in ['before','after']:
            info=json.loads((OUT/stage/f'{mode}-dpr{dpr}'/'metadata.json').read_text())
            records[stage]={'submitted_points': info['draws'][-1][2], 'label':info['pointCountLabel'], 'renderer':info['renderer']}
        workload.append({'mode':mode,'dpr':dpr,**records})
    thumbs=Image.new('RGB',(960,570),'#edf1f2'); draw=ImageDraw.Draw(thumbs)
    for x,stage in [(0,'before'),(480,'after')]:
        im=Image.open(OUT/stage/f'{mode}-dpr1/hero.png').convert('L').convert('RGB'); im.thumbnail((460,460))
        thumbs.paste(im,(x+10,45)); draw.text((x+15,10),f'{stage} / grayscale at smaller scale',font=font,fill='#142b38')
        tiny=im.copy(); tiny.thumbnail((140,140)); thumbs.paste(tiny,(x+330,425))
    thumbs.save(OUT/f'grayscale-{mode}.jpg',quality=94)
(OUT/'workload.json').write_text(json.dumps(workload,indent=2))
print(json.dumps(workload,indent=2))
