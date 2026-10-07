"""Does the opening's still fade into its first drawn frame in place? Compares the hold frame's coverage (raw RGBA from
tools/qa/holdframe.mjs with OUT=) with the still's, block by block, at 1440 x 900 (the figure's box is 696 px, the hero
canvas 946 px with 125 px of padding each side):
    for s in light dark; do SCHEME=$s OUT=/tmp/hold-$s.raw node tools/qa/holdframe.mjs; done
    python3 tools/qa/stillmatch.py
Prints each paper's total coverage (hold, still) and the median and 10th/90th percentiles of the block ratio
hold / still; keep the medians within about 1 +- 0.05 (STILL_GAIN in tools/hero/build.py tunes the stills' dots).
The hold frame's coverage is its ink, not its alpha: the underpaint under the dots is opaque but in the paper's own
colour, so each pixel counts by how far its colour stands from the paper's towards the ink's.
"""
import os
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
for paper, still in [('light', 'still'), ('dark', 'still-dark')]:
    raw = np.frombuffer(open(f'/tmp/hold-{paper}.raw', 'rb').read(), np.uint8).reshape(946, 946, 4)[::-1].astype(np.float32) / 255
    # (the canvas is premultiplied; the paper and the ink are --paper and --figure-ink)
    alive = raw[..., 3] > 0
    lum = np.where(alive, (raw[..., :3] @ np.array([0.2126, 0.7152, 0.0722], np.float32)) / np.maximum(raw[..., 3], 1e-6), 0)
    page, ink = (1.0, 0.047) if paper == 'light' else (0.043, 0.92)
    hold = raw[..., 3] * np.clip((lum - page) / (ink - page), 0, 1)
    alpha = Image.open(os.path.join(ROOT, 'assets', 'hero', f'{still}.webp')).split()[3].resize((696, 696), Image.LANCZOS)
    drawn = np.zeros((946, 946), np.float32)
    drawn[125:821, 125:821] = np.asarray(alpha, np.float32) / 255
    block = lambda a: a[:928, :928].reshape(29, 32, 29, 32).mean(axis=(1, 3))
    a, b = block(hold), block(drawn)
    seen = (a > 0.02) | (b > 0.02)
    ratio = (a[seen] + 1e-3) / (b[seen] + 1e-3)
    print(f'{paper}: coverage hold {hold.mean():.4f} still {drawn.mean():.4f}; block ratio median {np.median(ratio):.3f} '
          f'p10 {np.percentile(ratio, 10):.3f} p90 {np.percentile(ratio, 90):.3f}')
