# Chibi girl (side view)

| File | Use |
| --- | --- |
| `01.png` | Reference artwork (front view) the character is based on |
| `chibi_side.psd` | Side-view layered artwork, facing right: one layer per part (`head`, `hair_bun`, `torso`, `pelvis`, arms and legs `_l` / `_r`; the far side is darker) |
| `chibi_side.rigby` | AutoRigged from the PSD, with `walk` (in place, 0.9 s) and `walk_across` (walks right, turns, walks back). The bun bounces behind the body. The editor opens it from *File ▸ Open walk demo (chibi girl)* |
| `walk.mjs` | Rebuilds the rig and both walks from the PSD: `node character/walk.mjs` |

The walk itself comes from `tools/walkcycle.mjs`, which fits any AutoRigged side-view character:
sizes are fractions of the leg length. `walk.mjs` sets a quicker, shorter, bouncier step for the
short chibi legs (`cycle`, `stride`, `crouch`, `bob`).
