# SPDX-License-Identifier: MIT OR Apache-2.0
# Places cut parts on the positions of a full-body model image. Each part gets a scale (to match
# the model's widths) and anchors found from its own silhouette; each anchor goes to a point
# measured on the model. Writes layers (+ raw RGBA), layers.json and a preview next to the model.
# Usage: assemble3.py <config.json> <parts_dir> <model.png> <out_dir>
import sys, json
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

cfg, parts_dir, model_file, out = json.load(open(sys.argv[1])), sys.argv[2], sys.argv[3], sys.argv[4]
K = cfg['upscale']  # canvas pixels per model pixel

def edge_center(a, which, depth):
    """Centre of the opaque pixels in the top/bottom `depth` share of the rows."""
    rows = np.where(a.any(axis=1))[0]; top, bot = rows[0], rows[-1]; h = bot - top
    band = range(top, top + max(2, int(h * depth))) if which == 'top' else range(bot - max(2, int(h * depth)), bot + 1)
    xs = np.concatenate([np.where(a[y])[0] for y in band if a[y].any()])
    return float(xs.mean()), (top if which == 'top' else bot)

def anchor(a, spec):
    kind, *args = spec
    if kind == 'center':
        ys, xs = np.where(a); return float(xs.mean()), float(ys.mean())
    which, depth, inset = args  # e.g. ['edge', 'top', 0.08, 0.1]: inset is a share of the height
    x, y = edge_center(a, which, depth)
    rows = np.where(a.any(axis=1))[0]; h = rows[-1] - rows[0]
    return x, y + (h * inset if which == 'top' else -h * inset)

def placed(part, far=False, dx=0):
    """The part's image (trimmed, scaled, maybe darkened) and its top-left on the canvas."""
    p = cfg['parts'][part]
    im = Image.open(f"{parts_dir}/part{p['k']}.png").convert('RGBA')
    im.putalpha(im.getchannel('A').filter(ImageFilter.MinFilter(3)))
    if p.get('crop_top'):
        # Drop the top share of the part (a rim that would show at the joint).
        bb = im.getbbox(); cut = bb[1] + round((bb[3] - bb[1]) * p['crop_top'])
        im = im.crop((0, cut, im.width, im.height))
    if p.get('crop_bottom'):
        bb = im.getbbox(); cut = bb[3] - round((bb[3] - bb[1]) * p['crop_bottom'])
        im = im.crop((0, 0, im.width, cut))
    s = p['scale']
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    if p.get('fade_bottom'):
        # Fade the lowest share of the part so it melts into what overlaps it.
        a0 = np.asarray(im.getchannel('A')).astype(np.float32); rows = np.where(a0.max(axis=1) > 0)[0]
        f0, f1 = rows[-1] - (rows[-1] - rows[0]) * p['fade_bottom'], rows[-1]
        ramp = np.clip((f1 - np.arange(im.height)) / max(1, f1 - f0), 0, 1)[:, None]
        im.putalpha(Image.fromarray((a0 * ramp).astype(np.uint8)))
    if far:
        rgb = ImageEnhance.Brightness(im.convert('RGB')).enhance(cfg['far_brightness']); rgb.putalpha(im.getchannel('A')); im = rgb
    ax, ay = anchor(np.asarray(im.getchannel('A')) > 128, p['anchor'])
    tx, ty = p['at']
    return im, (tx * K + dx - ax, ty * K - ay)

layers = []
for L in cfg['layers']:
    if 'merge' in L:
        # Several parts as one layer (e.g. arm and hand, so the wrist never opens), bottom first.
        pieces = [placed(part, L.get('far'), L.get('dx', 0)) for part in L['merge']]
        x0 = min(at[0] for _, at in pieces); y0 = min(at[1] for _, at in pieces)
        x1 = max(at[0] + im.width for im, at in pieces); y1 = max(at[1] + im.height for im, at in pieces)
        im = Image.new('RGBA', (round(x1 - x0) + 1, round(y1 - y0) + 1))
        for piece, at in pieces: im.alpha_composite(piece, (round(at[0] - x0), round(at[1] - y0)))
        layers.append(dict(name=L['name'], im=im, at=(x0, y0)))
    else:
        im, at = placed(L['part'], L.get('far'), L.get('dx', 0))
        layers.append(dict(name=L['name'], im=im, at=at))

model = Image.open(model_file).convert('RGBA')
W, H = model.width * K, model.height * K
canvas = Image.new('RGBA', (W, H))
for L in layers: canvas.alpha_composite(L['im'], (round(L['at'][0]), round(L['at'][1])))
x0, y0, x1, y1 = canvas.getbbox(); pad = 40; ox, oy = x0 - pad, y0 - pad
meta = []
for L in layers:
    f = f"{out}/{L['name']}.png"; L['im'].save(f); open(f[:-4] + '.rgba', 'wb').write(L['im'].tobytes())
    meta.append(dict(name=L['name'], file=f, left=round(L['at'][0] - ox), top=round(L['at'][1] - oy), w=L['im'].width, h=L['im'].height))
json.dump(dict(width=x1 - x0 + 2 * pad, height=y1 - y0 + 2 * pad, layers=meta), open(f'{out}/layers.json', 'w'), indent=1)
# Preview: model (left), assembly (middle), assembly over a faded model (right); same scale.
mk = np.asarray(model.resize((W, H))).copy(); mag = (mk[..., 0] > 200) & (mk[..., 1] < 80) & (mk[..., 2] > 200); mk[mag] = (235, 235, 240, 255)
m = Image.fromarray(mk)
ghost = Image.blend(Image.new('RGBA', (W, H), (235, 235, 240, 255)), m, 0.35)
side = Image.new('RGBA', (W * 3, H), (235, 235, 240, 255))
side.alpha_composite(m); side.alpha_composite(canvas, (W, 0))
over = canvas.copy(); over.putalpha(over.getchannel('A').point(lambda v: v * 0.6))
ghost.alpha_composite(over); side.alpha_composite(ghost, (2 * W, 0))
side.convert('RGB').resize((W * 3 // 3, H // 3)).save(f'{out}/preview.png')
print((W, H), canvas.getbbox())
