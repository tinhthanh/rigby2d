# SPDX-License-Identifier: MIT OR Apache-2.0
# Measures limb pose drawings (one limb per piece, hanging from its top, e.g. an arm swung
# forward, hanging, swung back) for tools/limbswap.mjs: the pivot (the joint at the top, half a
# limb width below the top edge), the far end and the drawn angle (degrees from straight down,
# positive toward +x, the way the character faces).
# Usage: limbposes.py <out.json> <name>=<piece.png> ...
import sys, json, math
import numpy as np
from PIL import Image

out, specs = sys.argv[1], sys.argv[2:]
result = []
for spec in specs:
    name, file = spec.split('=', 1)
    a = np.asarray(Image.open(file).convert('RGBA'))[..., 3] > 128
    ys, xs = np.where(a)
    top, bot = ys.min(), ys.max()
    band = lambda y0, y1: [np.where(a[y])[0] for y in range(y0, y1) if a[y].any()]
    cap = band(top, top + max(2, int((bot - top) * 0.03)))
    widths = [r.max() - r.min() for r in band(top + int((bot - top) * 0.05), top + int((bot - top) * 0.15))]
    px = float(np.mean([r.mean() for r in cap]))
    py = float(top + 0.5 * np.mean(widths))
    # The far end: the opaque pixels farthest from the pivot (fingertips); the direction uses
    # their centre so a curled hand still points the right way.
    d = np.hypot(xs - px, ys - py)
    far = d >= d.max() * 0.85
    ex, ey = float(xs[far].mean()), float(ys[far].mean())
    angle = math.degrees(math.atan2(ex - px, ey - py))
    h, w = a.shape
    result.append(dict(name=name, file=file, width=w, height=h, pivot=[px, py], end=[ex, ey], angle=angle, length=float(d.max())))
json.dump(result, open(out, 'w'), indent=1)
for r in result: print(r['name'], 'angle', round(r['angle'], 1), 'length', round(r['length']), 'pivot', [round(v) for v in r['pivot']])
