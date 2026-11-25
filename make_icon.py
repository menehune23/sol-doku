"""Renders the Home Screen icon and embeds it in static/index.html as a data URI."""
import base64, io, re
from PIL import Image, ImageDraw

S = 720
ACC = (222, 138, 51)
img = Image.new("RGB", (S, S), (17, 17, 17))
d = ImageDraw.Draw(img)
m, ch = 120, 60
x0, y0, x1, y1 = m, m, S - m, S - m
d.polygon([(x0 + ch, y0), (x1, y0), (x1, y1 - ch), (x1 - ch, y1), (x0, y1), (x0, y0 + ch)], fill=(32, 32, 32), outline=ACC, width=12)
cell = (x1 - x0) / 3
for k in (1, 2):
    d.line([(x0 + k * cell, y0 + 24), (x0 + k * cell, y1 - 24)], fill=ACC, width=10)
    d.line([(x0 + 24, y0 + k * cell), (x1 - 24, y0 + k * cell)], fill=ACC, width=10)
cx, cy = x0 + cell, y0 + cell
d.rectangle([cx + 22, cy + 22, cx + cell - 22, cy + cell - 22], fill=ACC)
for (gx, gy) in [(0, 0), (2, 1), (1, 2), (2, 2), (0, 2)]:
    px, py = x0 + gx * cell + cell / 2, y0 + gy * cell + cell / 2
    d.rectangle([px - 18, py - 18, px + 18, py + 18], fill=(150, 150, 150))
img = img.resize((180, 180), Image.LANCZOS)
buf = io.BytesIO(); img.save(buf, "PNG", optimize=True)
uri = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
p = "static/index.html"; s = open(p).read()
s = re.sub(r'href="(ICON_DATA_URI|data:image/png;base64,[^"]*)"', f'href="{uri}"', s)
open(p, "w").write(s)
img.save("/tmp/icon-preview.png")
print(len(uri))
