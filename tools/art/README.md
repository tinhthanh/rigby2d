# Character art pipeline

Turns generated artwork into a layered PSD that AutoRig rigs well, and previews the result.
Python 3 with `pillow`, `numpy` and `scipy` (`python3 -m venv .venv && .venv/bin/pip install pillow numpy scipy`).

1. **Model and parts.** Generate (or draw) two images on a flat magenta (`#FF00FF`) background:
   - `model.png`: the whole character in side view, standing, arms hanging, legs straight. It sets
     the proportions and positions.
   - `parts.png`: the same character cut into separate pieces. Draw each **arm and leg as one
     straight piece** (sleeve to wrist, hip to cuff): AutoRig splits a whole limb into two bones and
     a weighted mesh, so elbows and knees bend smoothly instead of hinging between two pictures.
2. **Cut.** `python tools/art/cut.py parts.png parts/` keys out the magenta (un-mixing the edge
   pixels so outlines keep their colour) and saves each piece as `partN.png`, top to bottom.
3. **Assemble.** `python tools/art/assemble.py layout.json parts/ model.png layers/` scales each
   piece to the model, finds its anchor from its own silhouette (`edge` top/bottom centre, or
   `center`) and puts it on the model point given in `at` (model pixels). `crop_top`,
   `crop_bottom` and `fade_bottom` trim rims that would show at joints; `keep_rows: [from, to]` keeps a
   band of a placed piece (a hand cut from a whole arm, so it can turn at the wrist under the
   cuff); `recolor: {from, to}` scales a piece's colours when it was drawn in the wrong shade; `far: true` darkens the far limbs; `merge: [parts]` makes one layer of several parts (an arm with its hand, so the wrist
   never opens); layer order is bottom first. `layers/preview.png` shows model, assembly and overlay.
   Name layers for AutoRig: `head`, `hair_bun`, `torso`, `arm_l`, `hand_l`, `leg_l`, `foot_l`, ...
4. **PSD.** `node tools/art/topsd.mjs layers/layers.json character.psd`.
5. **Rig and walk.** `node tools/walkcycle.mjs <folder> character.psd character.rigby` (see
   `character/walk.mjs` for per-character settings). `gait: 'data'` drives the legs and pelvis
   from human gait data (`tools/gait.mjs`); it looks the most natural.
6. **Preview.** `node tools/art/frames.mjs character.rigby walk 30 > f.json` then
   `python tools/art/gif.py f.json layers/ walk.gif 0.3 x0 x1 y0 y1 30` (world bounds, Y up).

**Pose drawings for a limb.** A limb that must change shape as it moves (a hand that curls on
the forward swing) can be several drawings instead of one bending picture: cut them with `cut.py`,
measure them with `python tools/art/limbposes.py poses.json name=piece.png ...` and pass them to
`tools/walkcycle.mjs` as `limbPoses` (see `tools/limbswap.mjs` and `character/adventurer/walk.mjs`).
Draw enough of them that neighbours differ only a little (seven for an arm swing, a few degrees
apart): then a plain swap looks smooth. `blend: true` dissolves neighbours into each other
instead, which helps when there are few drawings but shows double outlines mid-dissolve.

`character/art/` (chibi girl) and `character/adventurer/art/` hold models, parts and layouts as
examples. A costume that covers the joints (long sleeves, boots, a hem over the hips) hides the
seams of a cut-out rig best; see `character/adventurer/README.md`.
