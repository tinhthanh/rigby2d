# Chibi girl (side view)

| File | Use |
| --- | --- |
| `01.png` | Reference artwork (front view) the character is based on |
| `art/model.png` | The standard: the whole character in side view, standing, generated from `01.png`. Sets proportions and positions |
| `art/parts.png` | The same character cut into pieces, each arm and leg as one straight piece |
| `art/layout.json` | How the pieces sit on the model (scale, anchor, model point, trims, layer order) |
| `chibi_side.psd` | The layered artwork built from them with `tools/art/` (see its README) |
| `chibi_side.rigby` | AutoRigged from the PSD, with `walk` (in place, 0.9 s) and `walk_across` (walks right, turns, walks back). Arms and legs are weighted meshes over two bones, so elbows and knees bend smoothly; the bun bounces behind the body. The editor opens it from *File ▸ Open walk demo (chibi girl)* |
| `walk.mjs` | Rebuilds the rig and both walks from the PSD: `node character/walk.mjs` |

The walk comes from `tools/walkcycle.mjs`, which fits any AutoRigged side-view character: sizes are
fractions of the leg length. `walk.mjs` sets a quicker, shorter, bouncier step for the short chibi
legs (`cycle`, `stride`, `crouch`, `bob`).
