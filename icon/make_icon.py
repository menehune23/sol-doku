import json, os, re
HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, "..", "static", "sol.js")).read()
sol = json.loads(re.search(r"window\.SOL = (\{.*\});", src, re.S).group(1))
bx, by, bw, bh = sol["box"]
FG = "#A57BE8"
LETTER = "#D2BDF5"
o0, o1 = 33, 147          # outer edge of border
t = 7                     # border thickness
i0, i1 = o0 + t, o1 - t   # inner square
k = 2 * t                 # cut passes through the inner square's corner
cell = (i1 - i0) / 3
frame = f"M{o0+k} {o0}H{o1}V{o1-k}L{o1-k} {o1}H{o0}V{o0+k}ZM{i0} {i0}V{i1}H{i1}V{i0}Z"
lines = "".join(f"M{i0+cell*n:.2f} {i0}V{i1}M{i0} {i0+cell*n:.2f}H{i1}" for n in (1, 2))
sc = cell * 0.52 / bh
glyphs = ""
for n, g in enumerate(["s", "o", "l"]):
    cx = cy = i0 + cell * (n + 0.5)
    x, y = cx - bw * sc / 2, cy - bh * sc / 2
    glyphs += f'<path transform="translate({x:.2f} {y:.2f}) scale({sc:.5f}) translate({-bx} {-by}) scale(1 -1)" d="{sol["glyphs"][g]}"/>'
svg = f'''<!doctype html><html><head>
<style>html,body{{margin:0;background:#000;overflow:hidden}}svg{{display:block}}</style></head><body>
<svg id="i" xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
<defs>
 <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#262626"/><stop offset="1" stop-color="#121212"/></linearGradient>
 <pattern id="st" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="8" fill="#FFFFFF" fill-opacity=".04"/></pattern>
</defs>
<rect width="180" height="180" fill="url(#bg)"/>
<rect width="180" height="180" fill="url(#st)"/>
<path d="{lines}" fill="none" stroke="{FG}" stroke-opacity=".5" stroke-width="2.2"/>
<path d="{frame}" fill="{FG}" fill-rule="evenodd"/>
<g fill="{LETTER}" stroke="{LETTER}" stroke-width="30">{glyphs}</g>
</svg></body></html>
'''
open(os.path.join(HERE, "icon.html"), "w").write(svg)
