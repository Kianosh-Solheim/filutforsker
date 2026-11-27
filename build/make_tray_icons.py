"""Lager menylinje-ikonene (malbilder for macOS) for fremdrift: en ring som fylles 0–100 % med en pil i midten.
Skriver app/trayicons.js med base64-PNG i 1x (18 px) og 2x (36 px) for hvert 5. prosent."""
import base64
import io
import sys
from PIL import Image, ImageDraw

STEPS = list(range(0, 101, 5))
SS = 8  # overkjøring for kantutjevning


def frame(px, pct, done=False):
    S = px * SS
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    w = round(S * 0.115)
    pad = round(S * 0.08)
    box = (pad, pad, S - pad, S - pad)
    d.ellipse(box, outline=(0, 0, 0, 80), width=w)  # svakt spor
    if done:
        d.ellipse(box, outline=(0, 0, 0, 255), width=w)
        c = S / 2
        pts = [(c - S * 0.2, c + S * 0.01), (c - S * 0.05, c + S * 0.16), (c + S * 0.21, c - S * 0.14)]
        d.line(pts, fill=(0, 0, 0, 255), width=round(S * 0.12), joint="curve")
    else:
        if pct > 0:
            d.arc(box, start=-90, end=-90 + 360 * pct / 100, fill=(0, 0, 0, 255), width=w)
        # pil mot høyre i midten
        c = S / 2
        sh = round(S * 0.10)
        d.rectangle((c - S * 0.20, c - sh / 2, c + S * 0.06, c + sh / 2), fill=(0, 0, 0, 255))
        d.polygon([(c + S * 0.02, c - S * 0.16), (c + S * 0.23, c), (c + S * 0.02, c + S * 0.16)], fill=(0, 0, 0, 255))
    img = img.resize((px, px), Image.LANCZOS)
    b = io.BytesIO()
    img.save(b, format="PNG", optimize=True)
    return base64.b64encode(b.getvalue()).decode()


out = sys.argv[1]
lines = ["'use strict';", "// Generert av build/make_tray_icons.py. Ikke rediger for hånd.", "module.exports = {", "  steps: {"]
for p in STEPS:
    lines.append(f"    {p}: ['{frame(18, p)}', '{frame(36, p)}'],")
lines.append("  },")
lines.append(f"  done: ['{frame(18, 100, True)}', '{frame(36, 100, True)}'],")
lines.append("};")
open(out, "w").write("\n".join(lines) + "\n")
