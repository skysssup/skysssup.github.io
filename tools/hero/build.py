"""Offline pipeline for the home-page hero.

Turns assets/avatar.jpg into the data the WebGL engine (js/hero.js) stipples at load:

  assets/hero/data.png       RGB, 448x448: R = depth (near = bright), G = ink density, B = figure mask
  assets/hero/bluenoise.png  64x64 void-and-cluster threshold map, tiled by the engine
  assets/hero/hero.json      figure bounds and centre of mass, used to frame the figure
  assets/hero/still.webp     transparent still frame, used before WebGL starts and without WebGL

The depth map comes from Depth Anything V2 Small (Apache-2.0) and is cached in tools/hero/depth.png,
so rebuilding only needs numpy and Pillow. Pass --depth to regenerate it (needs torch + transformers).

    python3 tools/hero/build.py [--depth]
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'hero')
N = 448


def depth_map():
    path = os.path.join(ROOT, 'tools', 'hero', 'depth.png')
    if '--depth' in sys.argv or not os.path.exists(path):
        from transformers import pipeline
        img = Image.open(os.path.join(ROOT, 'assets', 'avatar.jpg')).convert('RGB').resize((848, 848), Image.LANCZOS)
        out = pipeline('depth-estimation', model='depth-anything/Depth-Anything-V2-Small-hf', device='cpu')(img)
        d = np.asarray(out['predicted_depth'].squeeze(), dtype=np.float32)
        d = (d - d.min()) / (d.max() - d.min() + 1e-6)
        Image.fromarray((d * 255).astype(np.uint8)).resize((424, 424), Image.BICUBIC).save(path)
    return Image.open(path).convert('L')


def blur(a, r):
    im = Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8))
    return np.asarray(im.filter(ImageFilter.GaussianBlur(r)), np.float32) / 255


def blurf(a, r):
    # float-precision blur via separable gaussian
    k = np.arange(-int(3 * r) - 1, int(3 * r) + 2)
    g = np.exp(-(k ** 2) / (2 * r * r)); g /= g.sum()
    pad = len(k) // 2
    b = np.pad(a, ((0, 0), (pad, pad)), mode='edge')
    b = np.stack([np.convolve(row, g, mode='valid') for row in b])
    b = np.pad(b, ((pad, pad), (0, 0)), mode='edge')
    return np.stack([np.convolve(col, g, mode='valid') for col in b.T]).T


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def maps():
    src = Image.open(os.path.join(ROOT, 'assets', 'avatar.jpg')).convert('RGB').resize((N, N), Image.LANCZOS)
    rgb = np.asarray(src, np.float32) / 255
    lum = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    dep = np.asarray(depth_map().resize((N, N), Image.BICUBIC), np.float32) / 255
    dep = blurf(dep, 1.2)

    yy, xx = np.mgrid[0:N, 0:N] / (N - 1)
    # The figure is everything the depth model puts in front of the sky. The cloud bank fades out
    # towards the bottom and sides so the sculpture has no hard cut where the avatar's frame ends.
    figure = smoothstep(0.31, 0.40, dep)
    base = 1 - smoothstep(0.80, 0.985, yy)
    sides = smoothstep(0.0, 0.06, xx) * smoothstep(0.0, 0.06, 1 - xx)
    cloud = smoothstep(0.68, 0.78, yy)                     # where the clouds start
    under = np.exp(-((xx - 0.50) / 0.22) ** 2)             # keep a cloud bank under the statue only
    # ...and the outstretched arm, which crosses the cloud band towards the lower right
    ax, ay, bx, by = 0.60, 0.70, 0.93, 0.79
    t = np.clip(((xx - ax) * (bx - ax) + (yy - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2), 0, 1)
    arm = 1 - smoothstep(0.035, 0.07, np.hypot(xx - (ax + t * (bx - ax)), yy - (ay + t * (by - ay))))
    cloud_keep = 1 - cloud * (1 - np.maximum(under, arm))
    mask = figure * base * sides * cloud_keep
    mask = np.where(mask < 0.08, 0, mask)
    mask = blurf(mask, 0.8)

    # Light the depth surface from the upper left and shade it like an engraving:
    # more dots where it turns away from the light and in local shadow detail.
    d = blurf(dep, 2.0) * 70.0
    gy, gx = np.gradient(d)
    nz = 1 / np.sqrt(gx ** 2 + gy ** 2 + 1)
    nx, ny = -gx * nz, -gy * nz
    L = np.array([-0.55, -0.62, 0.56]); L /= np.linalg.norm(L)
    lambert = np.clip(nx * L[0] + ny * L[1] + nz * L[2], 0, 1)
    detail = lum - blurf(lum, 7.0)
    tone = np.clip(1 - (lum - lum[mask > 0.5].mean()) * 1.2, 0, 1.6) / 1.6
    rim = np.clip(np.hypot(*np.gradient(blurf(mask, 1.4))) * 9, 0, 1)
    ink = 0.10 + 0.50 * (1 - lambert) + 0.22 * tone + np.clip(-detail * 3.2, -0.25, 0.45) + 0.30 * rim
    ink = np.clip(ink, 0, 1) ** 1.15 * mask
    ink = np.clip(ink, 0, 1)
    return dep, ink, mask, lum


def void_and_cluster(n=64, sigma=1.9, seed=7):
    rng = np.random.default_rng(seed)
    k = np.arange(n); k = np.minimum(k, n - k)
    g = np.exp(-(k[:, None] ** 2 + k[None, :] ** 2) / (2 * sigma * sigma))
    G = np.fft.rfft2(g)
    energy = lambda m: np.fft.irfft2(np.fft.rfft2(m) * G, s=(n, n))
    pattern = rng.random((n, n)) < 0.1
    while True:   # relax the initial pattern: move tightest cluster pixel into largest void
        e = energy(pattern.astype(float))
        c = np.unravel_index(np.argmax(np.where(pattern, e, -np.inf)), e.shape)
        pattern[c] = False
        e = energy(pattern.astype(float))
        v = np.unravel_index(np.argmin(np.where(pattern, np.inf, e)), e.shape)
        if v == c:
            pattern[c] = True; break
        pattern[v] = True
    rank = np.zeros((n, n), int)
    ones = int(pattern.sum())
    p = pattern.copy()
    for r in range(ones - 1, -1, -1):
        e = energy(p.astype(float))
        c = np.unravel_index(np.argmax(np.where(p, e, -np.inf)), e.shape)
        p[c] = False; rank[c] = r
    p = pattern.copy()
    for r in range(ones, n * n):
        e = energy(p.astype(float))
        v = np.unravel_index(np.argmin(np.where(p, np.inf, e)), e.shape)
        p[v] = True; rank[v] = r
    return ((rank + 0.5) / (n * n) * 255).astype(np.uint8)


def stipple(ink, bn, res):
    ys, xs = np.mgrid[0:res, 0:res]
    u = (xs + 0.5) / res * (N - 1); v = (ys + 0.5) / res * (N - 1)
    i0, j0 = np.floor(v).astype(int), np.floor(u).astype(int)
    fy, fx = v - i0, u - j0
    i1, j1 = np.minimum(i0 + 1, N - 1), np.minimum(j0 + 1, N - 1)
    s = ink[i0, j0] * (1 - fx) * (1 - fy) + ink[i0, j1] * fx * (1 - fy) + ink[i1, j0] * (1 - fx) * fy + ink[i1, j1] * fx * fy
    t = bn[ys % bn.shape[0], xs % bn.shape[1]] / 255.0
    keep = s * DENSITY > t
    return xs[keep], ys[keep], s[keep]


DENSITY = 0.56


def main():
    os.makedirs(OUT, exist_ok=True)
    dep, ink, mask, lum = maps()
    data = np.stack([dep, ink, mask], -1)
    Image.fromarray(np.clip(np.round(data * 255), 0, 255).astype(np.uint8), 'RGB').save(os.path.join(OUT, 'data.png'), optimize=True)
    bn_path = os.path.join(OUT, 'bluenoise.png')
    if not os.path.exists(bn_path) or '--bluenoise' in sys.argv:
        Image.fromarray(void_and_cluster(), 'L').save(bn_path, optimize=True)
    bn = np.asarray(Image.open(bn_path), np.float32)

    ys, xs = np.nonzero(mask > 0.05)
    w = mask[ys, xs]
    meta = {
        'size': N,
        'bounds': [round(xs.min() / N, 4), round(ys.min() / N, 4), round((xs.max() + 1) / N, 4), round((ys.max() + 1) / N, 4)],
        'center': [round(float((xs * w).sum() / w.sum() / N), 4), round(float((ys * w).sum() / w.sum() / N), 4)],
        'density': DENSITY,
        # The ring of project names circles the torso, tilted towards the viewer (radians).
        'ring': {'x': 0.47, 'y': 0.6, 'r': 0.4, 'tilt': 0.3},
    }
    json.dump(meta, open(os.path.join(OUT, 'hero.json'), 'w'), indent=1)

    # Still frame: the same threshold stipple, drawn flat at 1000px with round dots.
    res = 620
    sx, sy, sv = stipple(ink, bn, res)
    S = 1000
    from PIL import ImageDraw
    im = Image.new('L', (S * 2, S * 2), 0)
    dr = ImageDraw.Draw(im)
    scale = 2 * S / res
    for x, y, v in zip(sx, sy, sv):
        r = (0.9 + 0.55 * v) * 1.35
        cx, cy = (x + 0.5) * scale, (y + 0.5) * scale
        dr.ellipse([cx - r, cy - r, cx + r, cy + r], fill=int(160 + 95 * min(1, v * 1.4)))
    im = im.resize((S, S), Image.LANCZOS)
    rgba = Image.merge('RGBA', [Image.new('L', (S, S), 0)] * 3 + [im])
    rgba.save(os.path.join(OUT, 'still.webp'), 'WEBP', lossless=True, quality=100, method=6)
    rgba.resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, 'preview.webp'), 'WEBP', lossless=True, quality=100, method=6)
    print(json.dumps(meta), len(sx), 'still points')


if __name__ == '__main__':
    main()
