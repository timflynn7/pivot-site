"""Computer renders of doors from their exact cutting geometry.

    node scripts/render-geometry.js > /tmp/doors.json
    python3 scripts/render_designs.py /tmp/doors.json public/img/designs

For each door it builds a height map in millimetres (0 = the face, negative =
cut away) from the engine's toolpaths: pockets with 1.5 mm inside corners,
V-grooves, bevels, the beaded shaker's round-over and the slab's chamfer.
Then it lights it from the top left (shading, cast shadows in the recesses,
a little ambient occlusion) and paints it. Needs numpy and Pillow.
These are renders, not photos: the site labels them "Render".
"""
import json
import math
import sys

import numpy as np
from PIL import Image, ImageFilter

S = 2.0            # pixels per mm for full doors
CORNER_R = 1.5     # inside-corner radius of pockets, mm
EDGE_R = 1.2       # slight softening of every door edge, mm
LIGHT = np.array([-0.5, -0.62, 0.58])
LIGHT = LIGHT / np.linalg.norm(LIGHT)


def box_blur(a, r):
    """Mean over a (2r+1) square, using an integral image."""
    if r < 1:
        return a.copy()
    p = np.pad(a, r + 1, mode="edge")
    c = p.cumsum(0).cumsum(1)
    k = 2 * r + 1
    out = c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]
    return out[: a.shape[0], : a.shape[1]] / (k * k)


def rect_of(pts):
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)


def sd_round_rect(X, Y, r4, rad):
    """Signed distance to a rectangle with rounded corners (negative inside)."""
    x0, y0, x1, y1 = r4
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    hx, hy = (x1 - x0) / 2 - rad, (y1 - y0) / 2 - rad
    qx, qy = np.abs(X - cx) - hx, np.abs(Y - cy) - hy
    outside = np.hypot(np.maximum(qx, 0), np.maximum(qy, 0))
    inside = np.minimum(np.maximum(qx, qy), 0)
    return outside + inside - rad


def dist_polyline(X, Y, pts):
    d = np.full(X.shape, np.inf)
    for (ax, ay), (bx, by) in zip(pts[:-1], pts[1:]):
        vx, vy = bx - ax, by - ay
        L2 = vx * vx + vy * vy or 1e-9
        t = np.clip(((X - ax) * vx + (Y - ay) * vy) / L2, 0, 1)
        d = np.minimum(d, np.hypot(X - (ax + t * vx), Y - (ay + t * vy)))
    return d


def height_map(door, X, Y):
    W, H = door["W"], door["H"]
    Z = np.zeros(X.shape)
    for p in door["paths"]:
        tool, pts = p["tool"], p["pts"]
        if tool == "cutout":
            continue
        if tool.startswith("pocket"):
            sd = sd_round_rect(X, Y, rect_of(pts), CORNER_R)
            Z = np.where(sd <= 0, np.minimum(Z, -p["depth"]), Z)
        elif tool.startswith("bevel") and p["inner"]:
            x0, y0, x1, y1 = rect_of(pts)
            ix0, iy0, ix1, iy1 = rect_of(p["inner"])
            b = ix0 - x0
            inside = (X >= x0) & (X <= x1) & (Y >= y0) & (Y <= y1)
            d_in = np.minimum.reduce([X - x0, x1 - X, Y - y0, y1 - Y])
            Z = np.where(inside, np.minimum(Z, -np.minimum(d_in, b)), Z)
        elif tool == "roundover":
            R = p["width"] / 2
            sd = sd_round_rect(X, Y, rect_of(pts), CORNER_R)
            d = np.clip(sd, 0, R)
            drop = R - np.sqrt(np.maximum(R * R - (R - d) ** 2, 0))
            Z = np.where((sd > 0) & (sd < R), np.minimum(Z, -drop), Z)
        elif tool.startswith("pchamfer"):
            # Chamfer on the pocket edge (Sharp corners): its depth on the line, rising 45 degrees
            # to the face that far out (and, inside, down to the line if it's deeper than the pocket).
            dc = p["depth"]
            x0, y0, x1, y1 = rect_of(pts)
            sd = np.maximum.reduce([x0 - X, X - x1, y0 - Y, Y - y1])   # square contours outside, distance to the edge inside
            Z = np.minimum(Z, -np.clip(dc - np.abs(sd), 0, dc))
        elif tool in ("v90d5p", "v90d2"):
            # V-grooves measured from the face (a groove in a pocket cuts through air first).
            dp = {"v90d5p": 5, "v90d2": 2}[tool]
            d = dist_polyline(X, Y, pts)
            Z = np.minimum(Z, -np.clip(dp - d, 0, dp))
        elif tool == "chamfer":
            d_edge = np.minimum.reduce([X, W - X, Y, H - Y])
            Z = np.minimum(Z, -np.clip(3 - d_edge, 0, 3))
        elif tool.startswith("v90"):
            dp = p["width"] / 2
            d = dist_polyline(X, Y, pts)
            Z = Z - np.clip(dp - d, 0, dp)       # grooves add to whatever is there (e.g. a pocket floor)
        else:                                      # rounded grooves: flutes, reeds, beads
            w = p["width"]; dp = {"flute16": 5, "flute8": 4, "reed13": 4, "reed5": 5, "arch5": 5, "bead6": 3}.get(tool, 3)
            R = ((w / 2) ** 2 + dp * dp) / (2 * dp)
            d = dist_polyline(X, Y, pts)
            Z = Z - np.where(d < w / 2, np.sqrt(np.maximum(R * R - d * d, 0)) - (R - dp), 0)
    d_edge = np.minimum.reduce([X, W - X, Y, H - Y])
    Z = Z - np.where(d_edge < EDGE_R, EDGE_R - np.sqrt(np.maximum(EDGE_R ** 2 - (EDGE_R - d_edge) ** 2, 0)), 0)
    return Z


def shade(Z, s):
    gy, gx = np.gradient(Z, 1 / s)
    n = np.stack([-gx, -gy, np.ones_like(Z)])
    n /= np.linalg.norm(n, axis=0)
    diffuse = np.clip(np.tensordot(LIGHT, n, axes=1), 0, 1)
    flat = 0.38 + 0.62 * LIGHT[2]
    light = (0.38 + 0.62 * diffuse) / flat
    # Cast shadows: walk towards the light; anything higher than the ray blocks it.
    dirxy = LIGHT[:2] / np.linalg.norm(LIGHT[:2])
    tan_el = LIGHT[2] / np.linalg.norm(LIGHT[:2])
    lit = np.ones_like(Z)
    steps = int(10 * s / tan_el) + 2
    for k in range(1, steps):
        dx, dy = int(round(dirxy[0] * k)), int(round(dirxy[1] * k))
        sh = np.roll(np.roll(Z, -dy, 0), -dx, 1)
        lit = np.where(sh > Z + (k / s) * tan_el + 0.05, np.minimum(lit, 0.7), lit)
    lit = box_blur(lit, max(1, int(s * 0.6)))
    occ = 1 - np.clip((box_blur(Z, int(4 * s)) - Z) * 0.05, 0, 0.3)
    # A little satin sheen (paint), strongest on faces turned towards the light.
    half = LIGHT + np.array([0, 0, 1.0]); half /= np.linalg.norm(half)
    spec = np.clip(np.tensordot(half, n, axes=1), 0, 1) ** 60 * 0.10
    flat_spec = half[2] ** 60 * 0.10
    return light * lit * occ + (spec - flat_spec) * lit


def render(door, s=S, crop=None, margin=55):
    W, H = door["W"], door["H"]
    x0, y0, x1, y1 = crop if crop else (-margin, -margin, W + margin, H + margin)
    nx, ny = int((x1 - x0) * s), int((y1 - y0) * s)
    X, Y = np.meshgrid(x0 + (np.arange(nx) + 0.5) / s, y0 + (np.arange(ny) + 0.5) / s)
    on = (X >= 0) & (X <= W) & (Y >= 0) & (Y <= H)
    Z = height_map(door, X, Y)
    Z = np.where(on, Z, -18.0)
    L = shade(Z, s)
    rgb = np.array([int(door["colour"][i:i + 2], 16) for i in (1, 3, 5)], float) / 255
    rng = np.random.default_rng(7)
    grain = 1 + box_blur(rng.normal(0, 0.012, Z.shape), 1)        # a little paint texture
    sweep = 1.03 - 0.06 * ((X - x0) / (x1 - x0) * 0.4 + (Y - y0) / (y1 - y0) * 0.6)  # soft studio light
    paint = np.clip(rgb[None, None, :] * (L * grain * sweep)[..., None], 0, 1)
    wall = np.array([0.945, 0.935, 0.91])
    # Soft shadow of the door on the wall behind it.
    sh_mask = ((X - 10 >= 0) & (X - 10 <= W) & (Y - 14 >= 0) & (Y - 14 <= H)).astype(float)
    sh_mask = box_blur(box_blur(sh_mask, int(9 * s)), int(9 * s))
    bg = wall[None, None, :] * (1 - 0.22 * sh_mask)[..., None] * sweep[..., None]
    img = np.where(on[..., None], paint, bg)
    return Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8))


def main(src, out):
    doors = json.load(open(src))
    made = []
    for door in doors:
        im = render(door)
        im.thumbnail((1400, 1400), Image.LANCZOS)
        name = f"{door['id']}-render.jpg"
        im.save(f"{out}/{name}", "JPEG", quality=86, optimize=True, progressive=True)
        made.append(name)
        if door["id"] == "shaker":
            # Close-up of the top-left inside corner, to show the 1.5 mm radius.
            pk = next(p for p in door["paths"] if p["tool"].startswith("pocket"))
            px, py = pk["pts"][0]
            ci = render(door, s=14, crop=(px - 30, py - 30, px + 45, py + 45))
            ci.thumbnail((1000, 1000), Image.LANCZOS)
            ci.save(f"{out}/shaker-corner-render.jpg", "JPEG", quality=86, optimize=True, progressive=True)
            made.append("shaker-corner-render.jpg")
    for name in made:
        t = Image.open(f"{out}/{name}")
        w, h = t.size; s = min(w, h)
        t = t.crop(((w - s) // 2, (h - s) // 3, (w - s) // 2 + s, (h - s) // 3 + s)).resize((160, 160), Image.LANCZOS)
        t.save(f"{out}/{name.replace('.jpg', '-thumb.jpg')}", "JPEG", quality=80, optimize=True)
    print("\n".join(made))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
