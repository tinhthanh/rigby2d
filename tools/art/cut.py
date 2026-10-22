# SPDX-License-Identifier: MIT OR Apache-2.0
# Keys out the magenta background of a parts sheet and saves each part as a cropped RGBA PNG.
import sys, json
import numpy as np
from PIL import Image
from scipy import ndimage

src, out = sys.argv[1], sys.argv[2]
rgb = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
# "Magenta-ness": red and blue high, green low.
m = np.clip((np.minimum(r, b) - g) / 255.0, 0, 1)
alpha = np.clip(1 - (m - 0.35) / 0.45, 0, 1)
alpha[m < 0.35] = 1
# Unmix: edge pixels are the colour blended with magenta; take the magenta share back out.
a3 = np.maximum(alpha, 0.05)[..., None]
rgb = (rgb - (1 - a3) * np.array([255.0, 0.0, 255.0])) / a3
# Whatever magenta tint is left (purple outlines) goes toward neutral.
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
spill = np.clip(np.minimum(r, b) - g, 0, None)
rgb[..., 0] -= spill * 0.8; rgb[..., 2] -= spill * 0.8
solid = alpha > 0.5
solid = ndimage.binary_opening(solid, iterations=2)
labels, n = ndimage.label(ndimage.binary_dilation(solid, iterations=6))
parts = []
for i, sl in enumerate(ndimage.find_objects(labels), 1):
    area = int((labels[sl] == i).sum())
    if area < 4000: continue
    ys, xs = sl
    a = (alpha[sl] * (labels[sl] == i)).copy()
    img = np.dstack([np.clip(rgb[sl], 0, 255), a * 255]).astype(np.uint8)
    parts.append({'x': xs.start, 'y': ys.start, 'w': xs.stop - xs.start, 'h': ys.stop - ys.start, 'area': area, 'img': img})
parts.sort(key=lambda p: (p['y'] // 400, p['x']))
for k, p in enumerate(parts):
    Image.fromarray(p.pop('img')).save(f'{out}/part{k}.png')
    p['file'] = f'part{k}.png'
print(json.dumps(parts, indent=0))
