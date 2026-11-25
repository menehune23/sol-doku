import base64, io, os, re
from PIL import Image
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
with sync_playwright() as p:
    b = p.chromium.connect_over_cdp("http://localhost:29229")
    ctx = b.new_context(viewport={"width": 180, "height": 180})
    pg = ctx.new_page(); pg.goto("file://" + HERE + "/icon.html"); pg.wait_for_load_state("networkidle")
    pg.evaluate("document.fonts.ready"); pg.wait_for_timeout(500)
    png = pg.locator("#i").screenshot(); ctx.close()
im = Image.open(io.BytesIO(png)).convert("RGB"); im.save(HERE + "/icon-180.png")
buf = io.BytesIO(); im.save(buf, "PNG", optimize=True)
uri = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()
path = os.path.join(HERE, "..", "static", "index.html"); s = open(path).read()
s, n = re.subn(r'(<link rel="(?:icon|apple-touch-icon)"[^>]*href=")data:image/png;base64,[^"]+', lambda m: m.group(1) + uri, s)
assert n == 2, n
open(path, "w").write(s); print("embedded", n, len(uri))
