"""Does the opening's still fade into its first drawn frame in place? Compares the hold frame's coverage (raw RGBA from
tools/qa/holdframe.mjs with OUT=) with the still's, block by block, at 1440 x 900 (the figure's box is 696 px, the hero
canvas 946 px with 125 px of padding each side):
    for s in light dark; do SCHEME=$s OUT=/tmp/hold-$s.raw node tools/qa/holdframe.mjs; done
    python3 tools/qa/stillmatch.py
Prints each paper's total coverage (hold, still) and the median and 10th/90th percentiles of the block ratio
hold / still; keep the medians within about 1 +- 0.05 (STILL_GAIN in tools/hero/build.py tunes the stills' dots).
"""
import os
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
for paper, still in [('light', 'still'), ('dark', 'still-dark')]:
    raw = np.frombuffer(open(f'/tmp/hold-{paper}.raw', 'rb').read(), np.uint8).reshape(946, 946, 4)[::-1]
    hold = raw[..., 3].astype(np.float32) / 255
    alpha = Image.open(os.path.join(ROOT, 'assets', 'hero', f'{still}.webp')).split()[3].resize((696, 696), Image.LANCZOS)
    drawn = np.zeros((946, 946), np.float32)
    drawn[125:821, 125:821] = np.asarray(alpha, np.float32) / 255
    block = lambda a: a[:928, :928].reshape(29, 32, 29, 32).mean(axis=(1, 3))
    a, b = block(hold), block(drawn)
    seen = (a > 0.02) | (b > 0.02)
    ratio = (a[seen] + 1e-3) / (b[seen] + 1e-3)
    print(f'{paper}: coverage hold {hold.mean():.4f} still {drawn.mean():.4f}; block ratio median {np.median(ratio):.3f} '
          f'p10 {np.percentile(ratio, 10):.3f} p90 {np.percentile(ratio, 90):.3f}')
