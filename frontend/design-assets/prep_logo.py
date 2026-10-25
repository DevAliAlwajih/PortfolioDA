"""
prep_logo.py – logo asset pipeline
Run from: frontend/design-assets/
Output:   frontend/public/
"""

import sys, os, subprocess

# ── auto-install missing packages ─────────────────────────────────────────────
for pkg in ("pillow", "numpy"):
    try:
        __import__("PIL" if pkg == "pillow" else pkg)
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install", pkg])

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

# ── paths ──────────────────────────────────────────────────────────────────────
HERE   = os.path.dirname(os.path.abspath(__file__))
SRC    = os.path.join(HERE, "logo-original.png")
OUTDIR = os.path.join(HERE, "..", "public")
os.makedirs(OUTDIR, exist_ok=True)

# ── Step 1: inspect ────────────────────────────────────────────────────────────
img = Image.open(SRC)
print(f"[INSPECT] mode={img.mode}  size={img.size}")

if img.mode in ("RGBA", "LA"):
    a_ch = np.array(img)[:, :, -1]
    print(f"          alpha min={a_ch.min()}  max={a_ch.max()}"
          f"  pixels_below_250={int((a_ch < 250).sum())}")
    branch = "T" if int((a_ch < 250).sum()) > (a_ch.size * 0.05) else "K"
else:
    print("          no alpha channel -> Branch K")
    branch = "K"

print(f"[BRANCH]  {branch} ({'real transparency' if branch=='T' else 'baked background - colour-key'})")

# ── Step 2: produce RGBA ───────────────────────────────────────────────────────
if branch == "T":
    rgba = img.convert("RGBA")
    p    = np.array(rgba, dtype=np.float32)     # H x W x 4
    r, g, b, a_out = p[...,0], p[...,1], p[...,2], p[...,3]
else:
    rgb  = img.convert("RGB")
    p    = np.array(rgb, dtype=np.float32)      # H x W x 3
    r, g_ch, b = p[...,0], p[...,1], p[...,2]

    # colour key
    alpha = np.clip((b - r - 6) / 70.0, 0, 1)

    # measure background tone from neutral pixels
    mask_bg = (b - r) < 6
    bg_tone = float(np.median(p[mask_bg])) if mask_bg.any() else 235.0
    print(f"[BG TONE] g = {bg_tone:.1f}  (median of {int(mask_bg.sum())} neutral pixels)")

    denom   = np.maximum(alpha, 0.001)
    col     = np.clip((p - (1 - alpha[..., None]) * bg_tone) / denom[..., None], 0, 255)

    a_uint8 = (alpha * 255).astype(np.uint8)

    # ── zero out small connected blobs of alpha ────────────────────────────────
    try:
        from scipy.ndimage import label as nd_label
        binary = (a_uint8 > 12).astype(np.uint8)
        labeled, n = nd_label(binary)
        for i in range(1, n + 1):
            if int((labeled == i).sum()) < 200:
                a_uint8[labeled == i] = 0
        print(f"[DENOISE] scipy available - cleaned {n} regions")
    except ImportError:
        print("[DENOISE] scipy not available - skipping connected-component filter")

    rgba = Image.fromarray(
        np.dstack([col.astype(np.uint8), a_uint8]), "RGBA"
    )

# ── Step 3: crop to non-transparent bounding box ──────────────────────────────
arr  = np.array(rgba)
mask = arr[..., 3] > 12
rows = np.where(mask.any(axis=1))[0]
cols = np.where(mask.any(axis=0))[0]
r0, r1 = int(rows[0]), int(rows[-1]) + 1
c0, c1 = int(cols[0]), int(cols[-1]) + 1
full = rgba.crop((c0, r0, c1, r1))
print(f"[CROP]    full logo  {full.size}")

# ── Step 4: emblem-only crop ───────────────────────────────────────────────────
farr = np.array(full)
H, W = farr.shape[:2]
row_counts = (farr[..., 3] > 12).sum(axis=1)

# search for fully empty row below the emblem (below 30% of height)
split_row = None
for i in range(int(H * 0.30), H):
    if row_counts[i] == 0:
        split_row = i
        break

if split_row is None:
    # fallback: row with fewest pixels between 55%-75%
    band = row_counts[int(H * 0.55): int(H * 0.75)]
    split_row = int(H * 0.55) + int(band.argmin())
    print(f"[EMBLEM]  no empty row found - using minimum-count row at {split_row}")
else:
    print(f"[EMBLEM]  empty separator row at {split_row}")

emblem_crop = full.crop((0, 0, W, split_row))
emask  = np.array(emblem_crop)[..., 3] > 12
erows  = np.where(emask.any(axis=1))[0]
ecols  = np.where(emask.any(axis=0))[0]
er0, er1 = int(erows[0]), int(erows[-1]) + 1
ec0, ec1 = int(ecols[0]), int(ecols[-1]) + 1
emblem = emblem_crop.crop((ec0, er0, ec1, er1))
print(f"[EMBLEM]  emblem     {emblem.size}")

# ── helpers ────────────────────────────────────────────────────────────────────
def resize_w(im, w):
    ratio = w / im.width
    return im.resize((w, int(im.height * ratio)), Image.LANCZOS)

def resize_h(im, h):
    ratio = h / im.height
    return im.resize((int(im.width * ratio), h), Image.LANCZOS)

def make_favicon(emblem_img, size, rounded=True, padding_frac=0.12):
    bg_color = (238, 244, 255, 255)   # #eef4ff
    canvas   = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    if rounded:
        mask_img = Image.new("L", (size, size), 0)
        d = ImageDraw.Draw(mask_img)
        r_px = int(size * 0.22)
        d.rounded_rectangle([(0, 0), (size - 1, size - 1)], radius=r_px, fill=255)
        bg = Image.new("RGBA", (size, size), bg_color)
        canvas.paste(bg, mask=mask_img)
    else:
        canvas = Image.new("RGBA", (size, size), bg_color)

    pad   = int(size * padding_frac)
    avail = size - 2 * pad
    em_s  = emblem_img.copy()
    ew, eh = em_s.size
    scale = min(avail / ew, avail / eh)
    nw, nh = int(ew * scale), int(eh * scale)
    em_s  = em_s.resize((nw, nh), Image.LANCZOS)
    ox = (size - nw) // 2
    oy = (size - nh) // 2
    canvas.paste(em_s, (ox, oy), em_s)
    return canvas

# ── Step 5: write output files ─────────────────────────────────────────────────
logo_full_out = resize_w(full, 900)
logo_full_out.save(os.path.join(OUTDIR, "logo-full.png"))
print(f"[SAVE]    logo-full.png  {logo_full_out.size}")

logo_mark_out = resize_h(emblem, 360)
logo_mark_out.save(os.path.join(OUTDIR, "logo-mark.png"))
print(f"[SAVE]    logo-mark.png  {logo_mark_out.size}")

for fname, sz, rounded in [
    ("favicon.png",          64,  True),
    ("favicon-32.png",       32,  True),
    ("icon-192.png",        192,  True),
    ("apple-touch-icon.png", 180, False),
]:
    out = make_favicon(emblem, sz, rounded=rounded)
    out.save(os.path.join(OUTDIR, fname))
    print(f"[SAVE]    {fname}  {out.size}")

# ── Step 6: composite previews ─────────────────────────────────────────────────
def composite_preview(fg, bg_hex, out_path):
    bg_rgb = tuple(int(bg_hex[i:i+2], 16) for i in (1, 3, 5))
    canvas = Image.new("RGBA", fg.size, bg_rgb + (255,))
    canvas.paste(fg, mask=fg)
    canvas.convert("RGB").save(out_path)
    print(f"[PREVIEW] {out_path}")

full_prev = resize_w(full, 500)
mark_prev = resize_h(emblem, 200)

composite_preview(full_prev, "#0a0f1f", os.path.join(HERE, "preview_full_dark.png"))
composite_preview(full_prev, "#ffffff", os.path.join(HERE, "preview_full_white.png"))
composite_preview(mark_prev, "#0a0f1f", os.path.join(HERE, "preview_mark_dark.png"))
composite_preview(mark_prev, "#ffffff", os.path.join(HERE, "preview_mark_white.png"))

print("\n[DONE] All assets written. Check preview_*.png in design-assets/.")
