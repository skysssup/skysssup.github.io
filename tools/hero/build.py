"""Offline pipeline for the home-page hero.

Turns assets/avatar.jpg into the data the WebGL engine (js/hero.js) stipples at load:

  assets/hero/ink.webp       896x896, lossless, gray: where the dots go, the engraving's ink density in 64 levels
  assets/hero/depth.webp     448x448, lossless: R = depth (near = bright, 0 = outside the figure), G = detail
  assets/hero/color.webp     448x448, RGBA: the avatar's own colors for the dots, A = its sparkle highlights
  assets/hero/bluenoise.png  64x64 void-and-cluster threshold map, tiled by the engine
  assets/hero/hero.json      map sizes, figure bounds and centre of mass, used to frame the figure
  assets/hero/still.webp     transparent still frame, used before WebGL starts and without WebGL

The source is the 424 px GitHub avatar (tools/hero/avatar-424.jpg) upscaled 4x into assets/avatar.jpg: an
even blend of Real-ESRGAN x4plus, which sharpens edges, and Real-ESRNet x4plus, its PSNR-trained sibling,
which does not invent texture (both BSD-3-Clause). The depth map comes from Depth Anything V2 Base
(CC BY-NC 4.0) run at 1036 px and is cached as 16-bit in tools/hero/depth.png. Rebuilding from the caches
needs only numpy and Pillow; --upscale and --depth redo those steps (torch, spandrel, transformers).
--color rewrites only color.webp.

    python3 tools/hero/build.py [--upscale] [--depth] [--color]
"""
import hashlib, json, os, sys, urllib.request
import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'assets', 'hero')
AVATAR = os.path.join(ROOT, 'assets', 'avatar.jpg')
N = 896          # ink map: about one map pixel per stipple cell at the largest figure
M = 448          # depth, detail, and color maps: smooth fields, half the resolution
DEPTH_INPUT = 1036
INK_LEVELS = 64
DENSITY = 0.85

UPSCALERS = [  # (url, sha256)
    ('https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth',
     '4fa0d38905f75ac06eb49a7951b426670021be3018265fd191d2125df9d682f1'),
    ('https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.1/RealESRNet_x4plus.pth',
     'a820b9bde89a874d7599d545567308ce6c128fc8754a53208eda016d40aa81df'),
]


def upscale():
    """assets/avatar.jpg from the 424 px original: each network's 4x output, averaged."""
    import torch
    from spandrel import ModelLoader
    cache = os.path.join(os.path.expanduser('~'), '.cache', 'hero-upscalers')
    os.makedirs(cache, exist_ok=True)
    src = np.asarray(Image.open(os.path.join(ROOT, 'tools', 'hero', 'avatar-424.jpg')).convert('RGB'), np.float32) / 255
    x = torch.from_numpy(src).permute(2, 0, 1)[None]
    outs = []
    for url, digest in UPSCALERS:
        path = os.path.join(cache, os.path.basename(url))
        if not os.path.exists(path):
            urllib.request.urlretrieve(url, path)
        assert hashlib.sha256(open(path, 'rb').read()).hexdigest() == digest, f'{path} does not match its checksum'
        model = ModelLoader().load_from_file(path).eval()
        tile, pad, s = 128, 16, model.scale
        H, W = src.shape[:2]
        y = torch.zeros(1, 3, H * s, W * s)
        with torch.no_grad():  # in tiles with an overlap, so the seams never show
            for i in range(0, H, tile):
                for j in range(0, W, tile):
                    i0, j0, i1, j1 = max(0, i - pad), max(0, j - pad), min(H, i + tile + pad), min(W, j + tile + pad)
                    o = model(x[:, :, i0:i1, j0:j1])
                    h, w = (min(i + tile, H) - i) * s, (min(j + tile, W) - j) * s
                    y[:, :, i * s:i * s + h, j * s:j * s + w] = o[:, :, (i - i0) * s:(i - i0) * s + h, (j - j0) * s:(j - j0) * s + w]
        outs.append(y[0].permute(1, 2, 0).clamp(0, 1).numpy())
    blend = (outs[0] + outs[1]) / 2
    Image.fromarray(np.round(blend * 255).astype(np.uint8)).save(AVATAR, 'JPEG', quality=92, optimize=True)


def depth_map():
    path = os.path.join(ROOT, 'tools', 'hero', 'depth.png')
    if '--depth' in sys.argv or not os.path.exists(path):
        import torch
        from transformers import AutoImageProcessor, AutoModelForDepthEstimation
        model_id = 'depth-anything/Depth-Anything-V2-Base-hf'
        proc = AutoImageProcessor.from_pretrained(model_id)
        model = AutoModelForDepthEstimation.from_pretrained(model_id).eval()
        img = Image.open(AVATAR).convert('RGB').resize((DEPTH_INPUT, DEPTH_INPUT), Image.LANCZOS)
        inputs = proc(images=img, return_tensors='pt', do_resize=False)
        with torch.no_grad():
            d = model(**inputs).predicted_depth[0].numpy().astype(np.float64)
        d = (d - d.min()) / (d.max() - d.min() + 1e-9)
        Image.fromarray(np.round(d * 65535).astype(np.uint16)).save(path)
    d = np.asarray(Image.open(path)).astype(np.float32) / 65535
    return np.asarray(Image.fromarray(d).resize((N, N), Image.BICUBIC))


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


def half(a):
    return np.asarray(Image.fromarray(a.astype(np.float32)).resize((M, M), Image.BILINEAR))


def u8(a):
    return np.clip(np.round(a * 255), 0, 255).astype(np.uint8)


def maps():
    src = Image.open(AVATAR).convert('RGB').resize((N, N), Image.LANCZOS)
    rgb = np.asarray(src, np.float32) / 255
    lum = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    dep = depth_map()

    yy, xx = np.mgrid[0:N, 0:N] / (N - 1)
    # The figure is everything the depth model puts in front of the sky. The cloud bank fades out
    # towards the bottom and sides so the sculpture has no hard cut where the avatar's frame ends.
    figure = smoothstep(0.24, 0.32, dep)
    base = 1 - smoothstep(0.80, 0.985, yy)
    sides = smoothstep(0.0, 0.06, xx) * smoothstep(0.0, 0.06, 1 - xx)
    cloud = smoothstep(0.68, 0.78, yy)                     # where the clouds start
    under = np.exp(-((xx - 0.50) / 0.22) ** 2)             # keep a cloud bank under the statue only
    # ...and the outstretched arm and open hand, which cross the cloud band towards the lower right. The band is
    # generous: the clouds around the hand lie far behind it, so the depth test above already leaves them out.
    ax, ay, bx, by = 0.58, 0.69, 0.92, 0.82
    t = np.clip(((xx - ax) * (bx - ax) + (yy - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2), 0, 1)
    arm = 1 - smoothstep(0.06, 0.10, np.hypot(xx - (ax + t * (bx - ax)), yy - (ay + t * (by - ay))))
    cloud_keep = 1 - cloud * (1 - np.maximum(under, arm))
    mask = figure * base * sides * cloud_keep
    mask = np.where(mask < 0.08, 0, mask)
    mask = blurf(mask, 1.6)

    # Shade it like an engraving. The image's own light carries the features (eye sockets, nostrils, the open
    # mouth are its local darks), so its tone and local shadows lead; the depth surface, lit from the upper left,
    # adds the turn of the form; contours come from the silhouette and from steps in depth (fingers against the
    # palm, snakes against the staff); a floor keeps lit stone drawn instead of blank.
    d = blurf(dep, 2.5) * 140.0
    gy, gx = np.gradient(d)
    nz = 1 / np.sqrt(gx ** 2 + gy ** 2 + 1)
    nx, ny = -gx * nz, -gy * nz
    L = np.array([-0.55, -0.62, 0.56]); L /= np.linalg.norm(L)
    lambert = np.clip(nx * L[0] + ny * L[1] + nz * L[2], 0, 1)
    shadow = lum - blurf(lum, 8.0)
    tone = np.clip(1 - (lum - lum[mask > 0.5].mean()) * 1.4, 0, 1.6) / 1.6
    rim = np.clip(np.hypot(*np.gradient(blurf(mask, 2.8))) * 18, 0, 1)
    step = np.hypot(*np.gradient(blurf(dep, 1.2)))
    step = np.clip(step / np.percentile(step[mask > 0.5], 97), 0, 1)
    ink = 0.14 + 0.20 * (1 - lambert) + 0.55 * tone + np.clip(-shadow * 7.0, -0.3, 0.55) + 0.30 * rim + 0.40 * step
    # a contrast curve around 0.62: lit stone lighter, deep shadow darker, so features stand off the skin
    ink = np.clip((np.clip(ink, 0, 1) / 0.62) ** 1.35 * 0.62, 0, 1)

    # Fine structure (eyes, lips, fingers, hair, the snakes) is where the image has local contrast: it gets up
    # to 1.6x the ink, so more dots, and a detail value that shrinks them, so features are drawn with small dense
    # dots and broad shadows with larger sparse ones, as in an engraving.
    contrast = np.abs(lum - blurf(lum, 3.0))
    contrast = np.clip(contrast / np.percentile(contrast[mask > 0.5], 98), 0, 1)
    ink = ink * np.minimum(1.6, 1 + 0.6 * contrast) * mask / 1.6
    detail = blurf(contrast, 3.0)
    detail = np.clip(detail / np.percentile(detail[mask > 0.5], 98), 0, 1)
    return dep, ink, mask, detail


def color_map():
    """The avatar's colors for the dots (saturation lifted a little, since each dot shows only a speck of it)
    and, in alpha, its sparkles: small bright specks against their surroundings, which the engine twinkles."""
    src = Image.open(AVATAR).convert('RGB').resize((M, M), Image.LANCZOS)
    rgb = np.asarray(src, np.float32) / 255
    lum = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    # Dots sit in the image's shadows, so a dot takes the color of its surroundings, not of the dark pixel
    # under it: blur the color first, then lift its saturation.
    soft = np.dstack([blurf(rgb[..., c], 4.0) for c in range(3)])
    soft_lum = 0.2126 * soft[..., 0] + 0.7152 * soft[..., 1] + 0.0722 * soft[..., 2]
    color = np.clip(soft_lum[..., None] + (soft - soft_lum[..., None]) * 1.8, 0, 1)
    sparkle = np.clip((lum - blurf(lum, 2.5) - 0.10) / 0.22, 0, 1) * smoothstep(0.55, 0.85, lum)
    sparkle = np.clip(blurf(sparkle, 0.7) * 1.4, 0, 1)
    # Alpha carries the sparkle on top of an opaque floor (128 + sparkle * 127): browsers premultiply canvas
    # pixels by alpha, so a fully transparent pixel would lose its color on the way to the engine.
    rgba = np.dstack([color, 0.502 + sparkle * 0.498])
    Image.fromarray(u8(rgba), 'RGBA').save(os.path.join(OUT, 'color.webp'), 'WEBP', quality=82, method=6, exact=True)
    return sparkle


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


def lossless(a, name):
    Image.fromarray(a).save(os.path.join(OUT, name), 'WEBP', lossless=True, quality=100, method=6, exact=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    if '--upscale' in sys.argv:
        upscale()
    sparkle = color_map()
    if '--color' in sys.argv:
        print('wrote color.webp;', int((sparkle > 0.5).sum()), 'sparkle pixels')
        return
    dep, ink, mask, detail = maps()
    # The ink is quantized to 64 levels: the stipple cannot show finer steps, and it halves the file.
    levels = np.round(ink * (INK_LEVELS - 1)) / (INK_LEVELS - 1)
    lossless(u8(levels), 'ink.webp')
    inside = half(mask) > 0.04
    relief = np.dstack([np.where(inside, np.maximum(u8(half(dep)), 1), 0), np.where(inside, u8(half(detail)), 0), np.zeros((M, M), np.uint8)])
    lossless(relief.astype(np.uint8), 'depth.webp')
    bn_path = os.path.join(OUT, 'bluenoise.png')
    if not os.path.exists(bn_path) or '--bluenoise' in sys.argv:
        Image.fromarray(void_and_cluster(), 'L').save(bn_path, optimize=True)
    bn = np.asarray(Image.open(bn_path), np.float32)

    ys, xs = np.nonzero(mask > 0.05)
    w = mask[ys, xs]
    meta = {
        'size': N,
        'depth': M,
        'bounds': [round(xs.min() / N, 4), round(ys.min() / N, 4), round((xs.max() + 1) / N, 4), round((ys.max() + 1) / N, 4)],
        'center': [round(float((xs * w).sum() / w.sum() / N), 4), round(float((ys * w).sum() / w.sum() / N), 4)],
        'density': DENSITY,
        # The ring circles the torso, tilted towards the viewer (radians).
        'ring': {'x': 0.47, 'y': 0.6, 'r': 0.4, 'tilt': 0.3},
    }
    json.dump(meta, open(os.path.join(OUT, 'hero.json'), 'w'), indent=1)

    # Still frame: the same threshold stipple, drawn flat at 1000px with round dots, smaller where detail is high.
    res = 860
    sx, sy, sv = stipple(levels, bn, res)
    sd = detail[np.minimum((sy + 0.5) / res * N, N - 1).astype(int), np.minimum((sx + 0.5) / res * N, N - 1).astype(int)]
    S = 1000
    im = Image.new('L', (S * 2, S * 2), 0)
    dr = ImageDraw.Draw(im)
    scale = 2 * S / res
    for x, y, v, dd in zip(sx, sy, sv, sd):
        r = (0.9 + 0.55 * v) * 1.2 * (1 - 0.3 * dd)
        cx, cy = (x + 0.5) * scale, (y + 0.5) * scale
        dr.ellipse([cx - r, cy - r, cx + r, cy + r], fill=int(160 + 95 * min(1, v * 1.4)))
    im = im.resize((S, S), Image.LANCZOS)
    rgba = Image.merge('RGBA', [Image.new('L', (S, S), 0)] * 3 + [im])
    rgba.save(os.path.join(OUT, 'still.webp'), 'WEBP', lossless=True, quality=100, method=6)
    rgba.resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, 'preview.webp'), 'WEBP', lossless=True, quality=100, method=6)
    print(json.dumps(meta), len(sx), 'still points')


if __name__ == '__main__':
    main()
