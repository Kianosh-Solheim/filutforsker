"""Tegner app-ikonet for Filutforsker og skriver det som .icns."""
import io
import struct
import sys
from PIL import Image, ImageDraw, ImageFilter

S = 1024


def rounded(draw, box, r, fill):
    draw.rounded_rectangle(box, radius=r, fill=fill)


def make_master():
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    # Skygge under flisa
    shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((100, 112, 924, 936), radius=185, fill=(0, 0, 0, 90))
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    img.alpha_composite(shadow)

    # Flis med lys blågrå gradient
    tile = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    grad = Image.new("RGBA", (S, S))
    gd = ImageDraw.Draw(grad)
    for y in range(S):
        t = y / S
        c = (int(236 - 18 * t), int(243 - 14 * t), int(252 - 8 * t), 255)
        gd.line([(0, y), (S, y)], fill=c)
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle((100, 100, 924, 924), radius=185, fill=255)
    tile.paste(grad, (0, 0), mask)
    img.alpha_composite(tile)

    d = ImageDraw.Draw(img)
    # Mappe (bakre fane)
    d.rounded_rectangle((210, 290, 470, 400), radius=38, fill=(232, 164, 0, 255))
    d.rounded_rectangle((210, 330, 814, 740), radius=44, fill=(232, 164, 0, 255))
    # Mappe (front)
    d.rounded_rectangle((210, 395, 814, 770), radius=44, fill=(255, 200, 61, 255))
    d.rounded_rectangle((210, 395, 814, 440), radius=44, fill=(255, 217, 112, 255))
    d.rectangle((210, 420, 814, 440), fill=(255, 200, 61, 255))

    # Sky-merke nederst til høyre
    cx, cy = 690, 690
    badge = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    bd = ImageDraw.Draw(badge)
    blue = (10, 100, 200, 255)
    light = (255, 255, 255, 255)
    # hvit kant
    for (x0, y0, x1, y1) in [(cx - 190, cy - 40, cx - 40, cy + 110), (cx - 120, cy - 130, cx + 70, cy + 60),
                             (cx - 10, cy - 70, cx + 160, cy + 100)]:
        bd.ellipse((x0 - 22, y0 - 22, x1 + 22, y1 + 22), fill=light)
    bd.rounded_rectangle((cx - 120 - 22, cy + 10 - 22, cx + 110 + 22, cy + 110 + 22), radius=60, fill=light)
    for (x0, y0, x1, y1) in [(cx - 190, cy - 40, cx - 40, cy + 110), (cx - 120, cy - 130, cx + 70, cy + 60),
                             (cx - 10, cy - 70, cx + 160, cy + 100)]:
        bd.ellipse((x0, y0, x1, y1), fill=blue)
    bd.rounded_rectangle((cx - 120, cy + 10, cx + 110, cy + 110), radius=50, fill=blue)
    # hake
    bd.line([(cx - 70, cy + 25), (cx - 20, cy + 72), (cx + 70, cy - 25)], fill=light, width=34, joint="curve")
    img.alpha_composite(badge)
    return img


def png_bytes(img, size):
    b = io.BytesIO()
    img.resize((size, size), Image.LANCZOS).save(b, format="PNG")
    return b.getvalue()


def write_icns(master, path):
    entries = [(b"icp4", 16), (b"icp5", 32), (b"icp6", 64), (b"ic07", 128), (b"ic08", 256), (b"ic09", 512),
               (b"ic10", 1024), (b"ic11", 32), (b"ic12", 64), (b"ic13", 256), (b"ic14", 512)]
    body = b""
    for typ, size in entries:
        data = png_bytes(master, size)
        body += typ + struct.pack(">I", len(data) + 8) + data
    with open(path, "wb") as f:
        f.write(b"icns" + struct.pack(">I", len(body) + 8) + body)


if __name__ == "__main__":
    out_icns, out_png = sys.argv[1], sys.argv[2]
    m = make_master()
    m.save(out_png)
    write_icns(m, out_icns)
