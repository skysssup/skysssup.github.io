"""Offline pipeline for the home-page hero.

Turns assets/avatar.jpg into the data the WebGL engine (js/hero.js) stipples at load:

  assets/hero/ink.webp       896x896, lossless, gray: where the dots go on light paper, the engraving's ink density
                             in 64 levels (dense where the statue is dark)
  assets/hero/light.webp     896x896, lossless, gray: where the dots go on dark paper, where they stand for light
                             (dense where the statue is lit), in 64 levels
  assets/hero/depth.webp     448x448, lossless: R = depth (near = bright, 0 = outside the figure), G = detail,
                             B = the sky's stars (0, or 1 + 254 x a star's strength)
  assets/hero/color.webp     448x448, lossless RGBA: R = material (gold, marble, cloud, lightning, glint) x 51,
                             G = how strongly the pixel belongs to it, B = how much of the figure there is the cloud
                             bank's alone (drawn only in Gear Two), A = 128 + its sparkle highlights
  assets/hero/bluenoise.png  64x64 void-and-cluster threshold map, tiled by the engine
  assets/hero/hero.json      map sizes, figure bounds and centre of mass, used to frame the figure
  assets/hero/still.webp     transparent still frame, used before WebGL starts and without WebGL; preview.webp is
                             the same at 512 px, preloaded; still-dark.webp and preview-dark.webp are drawn from the
                             light map, for dark paper

The source is the 424 px GitHub avatar (tools/hero/avatar-424.jpg) upscaled 4x into assets/avatar.jpg: an
even blend of Real-ESRGAN x4plus, which sharpens edges, and Real-ESRNet x4plus, its PSNR-trained sibling,
which does not invent texture (both BSD-3-Clause). The depth map comes from Depth Anything V2 Base
(CC BY-NC 4.0) run at 1036 px and is cached as 16-bit in tools/hero/depth.png; the surface normals from Marigold
normals v1.1 (CreativeML Open RAIL++-M) run at 768 px, cached in tools/hero/normals.png. Rebuilding from the
caches needs only numpy and Pillow; --upscale, --depth, and --normals redo those steps (torch, spandrel,
transformers, diffusers). --color stops after the material map (color.webp); --stars only writes the sky's stars into depth.webp.

    python3 tools/hero/build.py [--upscale] [--depth] [--normals] [--color]
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
NORMALS_INPUT = 768
INK_LEVELS = 64
DENSITY = 0.85
SHARPEN = 0.7                          # the unsharp mask over the whole figure
CAVITY_INK, CAVITY_LIGHT = 0.35, 0.45  # how much a hollow darkens the ink, and takes from the light
CLOUD_INK, CLOUD_LIGHT = 0.62, 0.6     # the clouds' darkest ink on light paper, and their brightest light on dark
# The core of the body, in the chest (figure units): a sheen's wave of light runs out of the body from here.
CORE = (0.52, 0.63)
# The head and the hands, as ellipses (x, y, rx, ry, turn in radians; figure units, 0..1 across the map): their
# highlights are light on hair and skin, so the engine keeps the avatar's star glints off them. Read from hero.json.
FEATURES = [(0.497, 0.455, 0.094, 0.09, 0.0),     # the head, its face upturned, and its curls
            (0.236, 0.284, 0.064, 0.072, 0.0),    # the fist on the caduceus
            (0.852, 0.832, 0.108, 0.062, 0.2)]    # the open hand

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


def normal_map():
    """Surface normals at N px (x right, y down, z towards the viewer) from Marigold normals v1.1 (CreativeML Open
    RAIL++-M), run on the upscale at the model's working resolution, 768 px, five predictions ensembled (at each pixel
    the one nearest their mean), and cached as an ordinary 8-bit normal map in tools/hero/normals.png (x right, y up).
    The depth map is smooth over the torso and the clouds; the normals keep the grooves between the muscles, the
    curls, and the billows' turn."""
    path = os.path.join(ROOT, 'tools', 'hero', 'normals.png')
    if '--normals' in sys.argv or not os.path.exists(path):
        import torch
        from diffusers import MarigoldNormalsPipeline
        pipe = MarigoldNormalsPipeline.from_pretrained('prs-eth/marigold-normals-v1-1')
        out = pipe(Image.open(AVATAR).convert('RGB'), num_inference_steps=4, ensemble_size=5, processing_resolution=NORMALS_INPUT,
                   match_input_resolution=False, output_type='np', generator=torch.Generator().manual_seed(7))
        Image.fromarray(u8((out.prediction[0] + 1) / 2)).save(path, optimize=True)
    n = np.asarray(Image.open(path).convert('RGB'), np.float32) / 255 * 2 - 1
    nx, ny = (np.asarray(Image.fromarray(np.ascontiguousarray(c)).resize((N, N), Image.BICUBIC)) for c in (n[..., 0], -n[..., 1]))
    return nx, ny, np.sqrt(np.clip(1 - nx ** 2 - ny ** 2, 0, 1))


def hollows(dep, figure, normals, lum):
    """Where the surface is concave, 0..1: the navel, the grooves between the muscles, under the pectorals, between the
    fingers, the feathers, and the curls, the snakes against the staff. Two estimates, each normalised inside the
    statue and compressed so a crease reads without a deep occlusion swamping it: the depth's own hollows (how far
    the depth smoothed around a point, inside the figure only so the sky never pulls it in, lies in front of the
    point), which see steps between forms (a finger before the palm, a snake before the staff); and the normals'
    convergence (minus their divergence), which sees the gentle grooves the depth smooths away. The normals come from
    a generative model, which reads an upturned face or a hand in shadow less well than the avatar shows them, so a
    hollow they see counts only where the avatar is locally darker too: the model never adds a groove the image does
    not show."""
    inside = (figure > 0.5).astype(np.float32)
    within = lambda a, r: blurf(a * inside, r) / np.maximum(blurf(inside, r), 1e-3)
    core = blurf(inside, 3.0) > 0.98
    near = within(dep, 0.8)
    steps = (within(dep, 2.0) - near) + 0.5 * (within(dep, 5.0) - near)
    nx, ny, _ = normals
    bend = -(np.gradient(blurf(nx, 1.2), axis=1) + np.gradient(blurf(ny, 1.2), axis=0))
    darker = smoothstep(0.0, 0.05, blurf(lum, 3.0) - blurf(lum, 0.8))
    squash = lambda a: 1 - np.exp(-np.clip(a, 0, None) / np.percentile(a[core], 93))
    return np.maximum(squash(steps), squash(bend) * darker) * inside


def sharpen(a, mask):
    """An unsharp mask (1.5 px) over the whole figure."""
    return np.clip(a + SHARPEN * (a - blurf(a, 1.5)), 0, 1) * (mask > 0.02)


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
    # The statue is everything the depth model puts in front of the sky, with the near cloud bank right under it.
    figure = smoothstep(0.24, 0.32, dep)
    base = 1 - smoothstep(0.80, 0.985, yy)
    sides = smoothstep(0.0, 0.06, xx) * smoothstep(0.0, 0.06, 1 - xx)
    cloud = smoothstep(0.68, 0.78, yy)                     # where the clouds start
    under = np.exp(-((xx - 0.50) / 0.22) ** 2)             # the bank under the statue, which the depth test keeps
    # ...and the outstretched arm and open hand, which cross the cloud band towards the lower right. The band is
    # generous: the clouds around the hand lie far behind it, so the depth test above already leaves them out.
    ax, ay, bx, by = 0.58, 0.69, 0.92, 0.82
    t = np.clip(((xx - ax) * (bx - ax) + (yy - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2), 0, 1)
    arm = 1 - smoothstep(0.06, 0.10, np.hypot(xx - (ax + t * (bx - ax)), yy - (ay + t * (by - ay))))
    statue = figure * base * sides * (1 - cloud * (1 - np.maximum(under, arm)))
    statue = np.where(statue < 0.08, 0, statue)
    # The cloud bank around and below him, beyond what the depth model puts in front of the sky: the avatar's billows
    # wherever they are lit against the dark sky between them, across the band below the statue, fading into the
    # paper over a long soft gradient at the bottom and both sides, and before the open hand, which reads against
    # the paper. The statue's frame (its bounds and centre in hero.json) is the statue's alone, so the bank's faint
    # edge may run past it.
    billow = smoothstep(0.05, 0.15, blurf(lum, 1.5))
    bank = billow * blurf(clouds(N).astype(np.float32), 6.0) * smoothstep(0.0, 0.17, xx) \
        * (1 - smoothstep(0.56, 0.76, xx)) * (1 - smoothstep(0.83, 0.985, yy))
    mask = blurf(np.maximum(statue, bank), 1.6)
    statue = blurf(statue, 1.6)
    # How much of the figure at each pixel is the bank's alone (0 on the statue and the modest cloud right under it, 1
    # out in the billows): the engine draws the bank only in Gear Two, so on light and dark paper the statue rises from
    # its own base cloud as it did before the bank came in.
    own = np.clip(1 - statue / np.maximum(mask, 1e-3), 0, 1) * (mask > 0.02)

    # Shade it like an engraving. The image's own light carries the features (eye sockets, nostrils, the open
    # mouth are its local darks), so its tone and local shadows lead; the depth surface, lit from the upper left,
    # adds the turn of the form; contours come from the silhouette and from steps in depth (fingers against the
    # palm, snakes against the staff); the hollows (hollows()) are darker; a floor keeps lit stone drawn instead of
    # blank.
    d = blurf(dep, 2.5) * 140.0
    gy, gx = np.gradient(d)
    nz = 1 / np.sqrt(gx ** 2 + gy ** 2 + 1)
    nx, ny = -gx * nz, -gy * nz
    L = np.array([-0.55, -0.62, 0.56]); L /= np.linalg.norm(L)
    lambert = np.clip(nx * L[0] + ny * L[1] + nz * L[2], 0, 1)
    solid = statue > 0.5
    shadow = lum - blurf(lum, 8.0)
    tone = np.clip(1 - (lum - lum[solid].mean()) * 1.4, 0, 1.6) / 1.6
    rim = np.clip(np.hypot(*np.gradient(blurf(mask, 2.8))) * 18, 0, 1)
    step = np.hypot(*np.gradient(blurf(dep, 1.2)))
    step = np.clip(step / np.percentile(step[solid], 97), 0, 1)
    normals = normal_map()
    cavity = hollows(dep, figure, normals, lum)
    ink = 0.14 + 0.20 * (1 - lambert) + 0.55 * tone + np.clip(-shadow * 7.0, -0.3, 0.55) + 0.30 * rim + 0.40 * step \
        + CAVITY_INK * cavity
    # a contrast curve around 0.62: lit stone lighter, deep shadow darker, so features stand off the skin
    ink = np.clip((np.clip(ink, 0, 1) / 0.62) ** 1.35 * 0.62, 0, 1)

    # Fine structure (eyes, lips, fingers, hair, the snakes) is where the image has local contrast: it gets up
    # to 1.6x the ink, so more dots, and a detail value that shrinks them, so features are drawn with small dense
    # dots and broad shadows with larger sparse ones, as in an engraving.
    contrast = np.abs(lum - blurf(lum, 3.0))
    contrast = np.clip(contrast / np.percentile(contrast[solid], 98), 0, 1)
    ink = ink * np.minimum(1.6, 1 + 0.6 * contrast) * mask / 1.6
    # The whole figure is sharpened (an unsharp mask on the features), so the eye socket, the open mouth, the fingers,
    # the curls, the feathers, and the snakes stand off the stone.
    ink = sharpen(ink, mask)
    detail = blurf(contrast, 3.0)
    detail = np.clip(detail / np.percentile(detail[solid], 98), 0, 1)

    # The light map, for dark paper, where the dots are light: a positive engraving, like a lit statue in a dark room
    # (the avatar is exactly that). Drawn from the ink map, white dots would make a negative: shadows and crevices
    # bright, lit marble dark, the rim glowing. Here density follows the image's own light (lit marble dense, shadow
    # sparse, highlights and its bright rims kept); the depth surface lit from the upper left adds the turn of the
    # form; the image's local contrast, signed, keeps the features (the eye socket, the nostrils, the open mouth, the
    # grooves between the muscles) as darker gaps between lit forms; steps in depth open thin gaps between forms
    # (fingers against the palm) and the hollows take light away; a soft shoulder keeps broad lit stone stippled instead
    # of filling in; and where the statue meets the sky its edge falls away into the dark instead of glowing.
    tone_l = blurf(lum, 0.6)
    light = 0.08 + 0.92 * tone_l ** 1.1 + 0.10 * (lambert - 0.5) + 2.6 * (tone_l - blurf(tone_l, 2.0)) \
        + 0.8 * (tone_l - blurf(tone_l, 6.0)) - 0.2 * step
    light = 1.15 * (1 - np.exp(-np.clip(light, 0, None) / 1.15)) * (1 - CAVITY_LIGHT * cavity)
    light = light * mask * (0.5 + 0.5 * smoothstep(0.5, 1.0, blurf(np.maximum(figure > 0.5, bank), 1.5)))
    light = sharpen(light, mask)

    # The clouds have their own light and shadow: the sky lights the billows from above, so their tops are lit and
    # their undersides fall into shade (the normals turned towards the sky, with the avatar's own light on them, which
    # keeps their pink tops and lilac shadows where the image has them). On light paper they are drawn lighter than
    # the stone, as cloud is; on dark paper as lit cloud, its tops dense with light. Their shading is sharpened but not
    # their fade into the paper, so no edge of the bank is outlined. The gold rubble and the lightning in them are
    # drawn like the statue.
    Lab = lab(np.dstack([blurf(rgb[..., c], 1.5) for c in range(3)]))
    vapour = clouds(N) & (Lab[..., 2] < 6) & ~((Lab[..., 2] < -8) & (Lab[..., 0] > 60))
    vapour = blurf(vapour.astype(np.float32), 2.0)
    S = np.array([-0.3, -0.85, 0.43]); S /= np.linalg.norm(S)
    sky = np.clip(normals[0] * S[0] + normals[1] * S[1] + normals[2] * S[2], 0, 1)
    glow = np.clip(blurf(lum, 1.0) / np.percentile(lum[(vapour > 0.5) & (mask > 0.3)], 97), 0, 1)
    lit = smoothstep(0.28, 0.92, 0.5 * glow + 0.5 * sky + 1.5 * (lum - blurf(lum, 2.5)))
    whole = np.ones_like(mask)
    # (on light paper the billows' edges, where they thin out against the sky, are lit too, so they are never inked)
    edge_lit = lit + (1 - lit) * (1 - smoothstep(0.6, 0.95, blurf(billow, 4.0)))
    ink = ink * (1 - vapour) + vapour * sharpen(CLOUD_INK * (1 - edge_lit) ** 1.2, whole) * mask
    light = light * (1 - vapour) + vapour * sharpen(CLOUD_LIGHT * (0.12 + 0.88 * lit), whole) * mask
    # The clouds lie in a shallow relief of their own. The depth model puts the far billows well behind the near bank,
    # and that step would show as a seam of tilted dots, and the billows would slide apart as the figure turns; so
    # inside the bank the depth is smoothed and drawn into a narrow range around the statue's base.
    calm = blurf(vapour, 5.0)
    relief = dep * (1 - calm) + calm * (0.64 + 0.28 * blurf(dep, 8.0))
    return relief, ink, light, mask, statue, detail, own


# The five materials, in index order. css/site.css gives each a base and a lit color per mode.
MATERIALS = ['gold', 'marble', 'cloud', 'lightning', 'glint']
# The hair, in the 424 px avatar's coordinates: around the curls from the nape on the left, over the crown, down the
# right side behind the jaw, and back along the hairline at the brow and the temples, leaving the face out.
HAIR = [(171, 203), (172, 196), (175, 190), (178, 184), (181, 179), (185, 175), (189, 171), (194, 169), (199, 169),
        (203, 167), (209, 166), (215, 166), (220, 168), (224, 171), (228, 175), (231, 180), (234, 186), (235, 192),
        (234.5, 198), (233, 204), (232, 211), (230, 218), (228, 222), (225, 222), (225, 215), (224, 207), (223, 199),
        (221, 191), (219, 185), (217, 180), (213, 177.5), (207, 177), (201, 177.5), (196, 180), (193, 184), (191, 190),
        (190, 197), (190, 203), (190, 208), (184, 207), (178, 206)]
# The torso and the outstretched arm, which rise out of the clouds.
TORSO = [(168, 280), (276, 280), (268, 338), (240, 350), (200, 350), (178, 338)]
ARM = [(250, 318), (300, 322), (385, 352), (380, 372), (300, 360), (250, 345)]


def lab(rgb):
    c = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    x = (c @ np.array([0.4124, 0.2126, 0.0193]), c @ np.array([0.3576, 0.7152, 0.1192]), c @ np.array([0.1805, 0.0722, 0.9505]))
    f = lambda t: np.where(t > 0.008856, np.cbrt(t), 7.787 * t + 16 / 116)
    fx, fy, fz = f(x[0] / 0.9505), f(x[1]), f(x[2] / 1.089)
    return np.dstack([116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)])


def zone(points, size=M):
    """A filled polygon (points in the 424 px avatar's coordinates) at `size` px."""
    im = Image.new('L', (size, size), 0)
    ImageDraw.Draw(im).polygon([(x / 424 * size, y / 424 * size) for x, y in points], fill=255)
    return np.asarray(im) > 0


def clouds(size):
    """Where the clouds are, at `size` px: everything below the statue, and the billows that rise higher on the left,
    beside the torso, but not the torso or the outstretched arm."""
    yy, xx = np.mgrid[0:size, 0:size] * (424 / size)
    return ((yy > 330) | ((xx < 165) & (yy > 280))) & ~zone(TORSO, size) & ~zone(ARM, size)


def material_map(inside, own):
    """Which material each pixel of the figure is made of. Color alone cannot tell them apart in this image: gold,
    marble, cloud, and glint overlap in every CIELAB channel, and a five-way k-means over the figure splits it by
    lightness instead (shadows one cluster, highlights another). So the avatar's layout names a few zones once,
    and color decides inside some of them, by how far a pixel leans warm (b* > 0) or blue (b* < 0): the wings and the
    caduceus are gold, except where the sky's blue glints catch them; the hair is gold, all of it, inside a polygon
    that follows the curls around the marble face (lit as warm as the hair, so color alone would gild it, and the
    curls in shadow are as cool as the stone, so color alone would leave them out); below the statue the clouds are
    rose, with cyan lightning and gold rubble in them; everything else is marble.
    Writes color.webp: R = material index x 51; G = how strongly the pixel belongs to it, fading to 0 within
    2 px of a boundary, so a dot on an edge shows ink instead of flickering between two materials; B = how much of
    the figure there is the cloud bank's alone (`own` from maps(), 0 on the statue), which the engine draws only in
    Gear Two; A = 128 + sparkle (an opaque floor: browsers premultiply canvas pixels by alpha, so a transparent pixel would
    lose its other channels on the way to the engine)."""
    src = Image.open(AVATAR).convert('RGB').resize((M, M), Image.LANCZOS)
    rgb = np.asarray(src, np.float32) / 255
    L, _, b = lab(np.dstack([blurf(rgb[..., c], 1.5) for c in range(3)])).transpose(2, 0, 1)
    fist = zone([(86, 104), (124, 100), (130, 140), (92, 142)])
    caduceus = zone([(0, 0), (200, 0), (200, 88), (128, 88), (126, 104), (122, 150), (125, 200), (122, 248), (100, 250),
                     (86, 200), (84, 150), (88, 104), (84, 88), (0, 88)]) & ~fist
    wing = zone([(30, 158), (95, 182), (150, 215), (178, 238), (172, 268), (120, 266), (70, 240), (38, 205)]) \
        & ~zone([(118, 128), (140, 140), (200, 230), (170, 250), (128, 170)])
    hair = zone(HAIR)
    below = clouds(M)
    warm, blue = smoothstep(6, 14, b), smoothstep(4, 14, -b)
    index = np.full((M, M), MATERIALS.index('marble'))
    weight = np.ones((M, M))
    def paint(area, name, strength):
        index[area] = MATERIALS.index(name)
        weight[area] = strength[area]
    paint(caduceus | wing, 'gold', np.ones((M, M)))
    # glints are small bright blue specks, brighter than the bronze around them, not whole blue regions
    speck = smoothstep(2, 10, L - blurf(L, 4.0))
    glint = smoothstep(4, 12, -b) * smoothstep(25, 45, L) * speck
    paint((caduceus | wing) & (glint > 0.25), 'glint', glint)
    paint(hair, 'gold', np.ones((M, M)))
    paint(below, 'cloud', np.ones((M, M)))
    paint(below & (b > 8), 'gold', warm)
    lightning = blue * smoothstep(50, 70, L)
    paint(below & (lightning > 0.35), 'lightning', lightning)
    edge = np.zeros((M, M))
    edge[:, 1:] += index[:, 1:] != index[:, :-1]
    edge[1:, :] += index[1:, :] != index[:-1, :]
    weight = blurf(weight, 1.0) * (1 - np.clip(blurf(np.clip(edge, 0, 1), 2.0) * 3, 0, 1))
    weight[index == MATERIALS.index('marble')] = 0   # marble is the figure's ink, exactly, in every mode
    index[~inside] = MATERIALS.index('marble')
    weight[~inside] = 0
    levels = set(np.unique(index[inside]).tolist())
    assert levels == set(range(len(MATERIALS))), f'the figure must hold all five materials, found {sorted(levels)}'
    lum = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    sparkle = np.clip((lum - blurf(lum, 2.5) - 0.10) / 0.22, 0, 1) * smoothstep(0.55, 0.85, lum)
    sparkle = np.clip(blurf(sparkle, 0.7) * 1.4, 0, 1)
    rgba = np.dstack([index * 51, u8(weight), np.where(inside, u8(np.round(half(own) * 15) / 15), 0), 128 + np.round(sparkle * 127)]).astype(np.uint8)
    lossless(rgba, 'color.webp')
    return index, weight, sparkle


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


def still(levels, bn, dep, detail, meta, suffix):
    """Still frame: the same threshold stipple at 1000px with round dots, smaller where detail is high, placed the way
    the engine draws the figure facing the viewer: its bounds fill the box less a 2% margin (fit() in js/hero.js) and
    each dot is foreshortened by its depth around the centre of mass. The still covers the page until the first frame
    is drawn, so in the opening, where that frame is the figure held still in its ink, one turns into the other in
    place. One still per dot map: still.webp and preview.webp from the ink map, still-dark.webp and
    preview-dark.webp from the light map, for dark paper."""
    res = 860
    sx, sy, sv = stipple(levels, bn, res)
    iy, ix = np.minimum((sy + 0.5) / res * N, N - 1).astype(int), np.minimum((sx + 0.5) / res * N, N - 1).astype(int)
    sd, sz = detail[iy, ix], dep[iy, ix]
    (x0, y0, x1, y1), (px, py) = meta['bounds'], meta['center']
    k = 0.96 / max(x1 - x0, y1 - y0)
    ox, oy = (1 - (x1 - x0) * k) / 2 - x0 * k, (1 - (y1 - y0) * k) / 2 - y0 * k
    persp = 3.2 / (3.2 - (sz - 0.62) * 0.34)
    fx, fy = (sx + 0.5) / res, (sy + 0.5) / res
    S = 1000
    u, v_ = (ox + (px + (fx - px) * persp) * k) * 2 * S, (oy + (py + (fy - py) * persp) * k) * 2 * S
    im = Image.new('L', (S * 2, S * 2), 0)
    dr = ImageDraw.Draw(im)
    for cx, cy, v, dd, f in zip(u, v_, sv, sd, persp):
        r = (0.9 + 0.55 * v) * 1.2 * (1 - 0.3 * dd) * k * f
        dr.ellipse([cx - r, cy - r, cx + r, cy + r], fill=int(160 + 95 * min(1, v * 1.4)))
    im = im.resize((S, S), Image.LANCZOS)
    rgba = Image.merge('RGBA', [Image.new('L', (S, S), 0)] * 3 + [im])
    rgba.save(os.path.join(OUT, f'still{suffix}.webp'), 'WEBP', lossless=True, quality=100, method=6)
    rgba.resize((512, 512), Image.LANCZOS).save(os.path.join(OUT, f'preview{suffix}.webp'), 'WEBP', lossless=True, quality=100, method=6)
    return len(sx)


def sky_stars(inside):
    """The stars in the avatar's sky, found at its own 424 px, where each is a point a pixel or two across: the local
    peaks of its light outside the figure (grown by a few pixels, so the statue's own rim highlights are left out) and
    above the clouds, at least 0.08 brighter than their surroundings and small (in the 5 x 5 pixels around a peak at
    most seven are more than 60% as bright). The engine draws them on dark paper and in Gear Two as stars of the sky,
    behind the figure. Returned as an M x M channel for depth.webp's blue: 0, or 1 + 254 x the star's strength at the
    nearest pixel."""
    src = np.asarray(Image.open(os.path.join(ROOT, 'tools', 'hero', 'avatar-424.jpg')).convert('RGB'), np.float32) / 255
    lum = 0.2126 * src[..., 0] + 0.7152 * src[..., 1] + 0.0722 * src[..., 2]
    n = lum.shape[0]
    figure = np.asarray(Image.fromarray(inside.astype(np.uint8) * 255).resize((n, n), Image.NEAREST)) > 0
    grown = blurf(figure.astype(np.float32), 2.0) > 0.02
    prominence = lum - blurf(lum, 2.0)
    out = np.zeros((M, M), np.uint8)
    for y in range(2, n - 2):
        if y / (n - 1) > 0.74:
            break
        for x in range(2, n - 2):
            v = lum[y, x]
            if grown[y, x] or v < 0.22 or prominence[y, x] < 0.08:
                continue
            around = lum[y - 2:y + 3, x - 2:x + 3]
            if v < around.max() or (around > v * 0.6).sum() > 7:
                continue
            i, j = round(y / (n - 1) * (M - 1)), round(x / (n - 1) * (M - 1))
            out[i, j] = max(out[i, j], int(round(1 + 254 * min(1.0, prominence[y, x] / 0.45))))
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    if '--stars' in sys.argv:   # only the sky's stars, into the blue of the depth map as committed
        relief = np.asarray(Image.open(os.path.join(OUT, 'depth.webp')).convert('RGB')).copy()
        relief[..., 2] = sky_stars(relief[..., 0] > 0)
        lossless(relief, 'depth.webp')
        print('wrote', int((relief[..., 2] > 0).sum()), 'stars into depth.webp')
        return
    if '--upscale' in sys.argv:
        upscale()
    dep, ink, light, mask, statue, detail, own = maps()
    inside = half(mask) > 0.04
    index, weight, sparkle = material_map(inside, own)
    if '--color' in sys.argv:
        print('wrote color.webp:', ', '.join(f'{n} {float((index[inside] == k).mean()):.1%}' for k, n in enumerate(MATERIALS)))
        return
    # The ink is quantized to 64 levels: the stipple cannot show finer steps, and it halves the file.
    levels = np.round(ink * (INK_LEVELS - 1)) / (INK_LEVELS - 1)
    lossless(u8(levels), 'ink.webp')
    light_levels = np.round(light * (INK_LEVELS - 1)) / (INK_LEVELS - 1)
    lossless(u8(light_levels), 'light.webp')
    relief = np.dstack([np.where(inside, np.maximum(u8(half(dep)), 1), 0), np.where(inside, u8(half(detail)), 0), sky_stars(inside)])
    lossless(relief.astype(np.uint8), 'depth.webp')
    bn_path = os.path.join(OUT, 'bluenoise.png')
    if not os.path.exists(bn_path) or '--bluenoise' in sys.argv:
        Image.fromarray(void_and_cluster(), 'L').save(bn_path, optimize=True)
    bn = np.asarray(Image.open(bn_path), np.float32)

    # the frame and the centre (the pivot the figure turns about) are the statue's; the cloud bank's soft edge runs
    # past them
    ys, xs = np.nonzero(statue > 0.05)
    w = statue[ys, xs]
    meta = {
        'size': N,
        'depth': M,
        'bounds': [round(xs.min() / N, 4), round(ys.min() / N, 4), round((xs.max() + 1) / N, 4), round((ys.max() + 1) / N, 4)],
        'center': [round(float((xs * w).sum() / w.sum() / N), 4), round(float((ys * w).sum() / w.sum() / N), 4)],
        'core': list(CORE),
        'density': DENSITY,
        # The ring circles the torso, tilted towards the viewer (radians).
        'ring': {'x': 0.47, 'y': 0.6, 'r': 0.4, 'tilt': 0.3},
        'features': [list(z) for z in FEATURES],
    }
    json.dump(meta, open(os.path.join(OUT, 'hero.json'), 'w'), indent=1)

    # the stills cover the page on light and dark paper, where the bank is not drawn
    n = still(levels * (1 - own), bn, dep, detail, meta, '')
    still(light_levels * (1 - own), bn, dep, detail, meta, '-dark')
    print(json.dumps(meta), n, 'still points')


if __name__ == '__main__':
    main()
