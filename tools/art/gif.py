# SPDX-License-Identifier: MIT OR Apache-2.0
# Renders quad frames to an animated GIF. Usage: gif.py frames.json images_dir out.gif scale x0 x1 y0 y1 fps
import sys, json
from PIL import Image, ImageDraw
frames_file, img_dir, out, scale, x0, x1, y0, y1, fps = sys.argv[1:]
scale, x0, x1, y0, y1, fps = float(scale), float(x0), float(x1), float(y0), float(y1), float(fps)
frames = json.load(open(frames_file))
W, H = int((x1 - x0) * scale), int((y1 - y0) * scale)
cache = {}
def img(n):
    if n not in cache: cache[n] = Image.open(f'{img_dir}/{n}.png').convert('RGBA')
    return cache[n]
def scr(p): return ((p[0] - x0) * scale, (y1 - p[1]) * scale)
def affine_inverse(src, dst):
    # Solve dst = A*src + t from 3 points, return inverse coefficients for PIL (output -> input).
    import numpy as np
    M = np.array([[s[0], s[1], 1] for s in src], float)
    a = np.linalg.solve(M, np.array([d[0] for d in dst])); b = np.linalg.solve(M, np.array([d[1] for d in dst]))
    F = np.array([[a[0], a[1], a[2]], [b[0], b[1], b[2]], [0, 0, 1]]); inv = np.linalg.inv(F)
    return tuple(inv[0]) + tuple(inv[1])
out_frames = []
for fr in frames:
    canvas = Image.new('RGBA', (W, H), (52, 54, 64, 255))
    d = ImageDraw.Draw(canvas)
    d.line([(0, (y1 - 0) * scale + 2), (W, (y1 - 0) * scale + 2)], fill=(110, 112, 125), width=2)  # ground
    for q in fr:
        if q.get('alpha', 1) <= 0: continue
        im = img(q['image']); w, h = im.size
        if q['kind'] == 'mesh':
            P, U, T = q['pos'], q['uvs'], q['tris']
            P = [P[i:i + 2] for i in range(0, len(P), 2)] if not isinstance(P[0], list) else P
            U = [U[i:i + 2] for i in range(0, len(U), 2)] if not isinstance(U[0], list) else U
            for t in range(0, len(T), 3):
                ids = T[t:t + 3]
                src = [(U[i][0] * w, U[i][1] * h) for i in ids]; dst = [scr(P[i]) for i in ids]
                try: layer = im.transform((W, H), Image.AFFINE, affine_inverse(src, dst), resample=Image.BILINEAR)
                except Exception: continue
                mask = Image.new('L', (W, H), 0)
                # Grow the triangle slightly so neighbouring triangles leave no seams.
                cx = sum(x for x, _ in dst) / 3; cy = sum(y for _, y in dst) / 3
                grown = [(cx + (x - cx) * 1.04, cy + (y - cy) * 1.04) for x, y in dst]
                ImageDraw.Draw(mask).polygon(grown, fill=255)
                a = Image.composite(layer.getchannel('A'), Image.new('L', (W, H), 0), mask); layer.putalpha(a)
                canvas.alpha_composite(layer)
            continue
        # positions follow uvs (0,0),(1,0),(1,1),(0,1) -> image pixel corners.
        src = [(0, 0), (w, 0), (w, h)]
        dst = [scr(q['pos'][0]), scr(q['pos'][1]), scr(q['pos'][2])]
        layer = im.transform((W, H), Image.AFFINE, affine_inverse(src, dst), resample=Image.BILINEAR)
        if q.get('alpha', 1) < 1: layer.putalpha(layer.getchannel('A').point(lambda v, a=q['alpha']: round(v * a)))
        canvas.alpha_composite(layer)
    out_frames.append(canvas.convert('RGB').quantize(colors=128, dither=Image.Dither.NONE))
out_frames[0].save(out, save_all=True, append_images=out_frames[1:], duration=int(1000 / fps), loop=0, disposal=1)
out_frames[len(out_frames) // 4].convert('RGB').save(out.replace('.gif', '_frame.png'))
print(out, len(out_frames), (W, H))
