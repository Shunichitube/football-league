"""Register generated art and extract occluders in a shared 1672 x 941 space.

Usage: python scripts/prepare-arena-assets.py BASE.png NET.png
Foreground architecture is cut from the actual base, never independently scaled.
"""
from pathlib import Path
import sys
from PIL import Image, ImageDraw
import numpy as np

OUT = Path(__file__).resolve().parents[1] / 'assets' / 'arena'
OUT.mkdir(parents=True, exist_ok=True)
source = Image.open(sys.argv[1]).convert('RGBA').resize((1672, 941))
base = source.copy()

def extract(name, polygons, fill):
    mask = Image.new('L', source.size)
    md = ImageDraw.Draw(mask)
    bd = ImageDraw.Draw(base)
    for polygon in polygons:
        md.polygon(polygon, fill=255)
        bd.polygon(polygon, fill=fill)
    layer = Image.new('RGBA', source.size)
    layer.paste(source, (0, 0), mask)
    return layer

rails = extract('rails', [
    [(0,285),(232,308),(1440,308),(1671,285),(1671,319),(1440,333),(232,333),(0,319)],
    [(312,450),(1358,450),(1358,469),(312,469)],
    [(0,483),(232,449),(232,475),(0,519)],
    [(1440,449),(1671,483),(1671,519),(1440,475)],
], '#21364d')
rd = ImageDraw.Draw(rails)
# Slender foreground handrails, on the same tier edges as the cut-out fascia.
for x1,y1,x2,y2 in [(232,303,1440,303),(312,446,1358,446),(0,479,232,445),(1440,445,1671,479)]:
    rd.line((x1,y1-9,x2,y2-9), fill='#7e9bb9', width=2)
    rd.line((x1,y1,x2,y2), fill='#172d46', width=3)
    for x in range(x1,x2,34):
        y=y1+(y2-y1)*(x-x1)/(x2-x1)
        rd.line((x,y-9,x,y+5),fill='#637d98',width=2)
rails.save(OUT/'foreground-railing.png')

# Open technical areas: replace the enclosing concrete walls with a cutout of
# unobstructed concourse floor at the same depth. Seats stay independent.
floor = source.crop((750, 794, 920, 880))
for box in [(65,794,605,878),(1068,794,1607,878)]:
    base.paste(floor.resize((box[2]-box[0],box[3]-box[1]),Image.Resampling.BICUBIC),box)
seats = Image.new('RGBA', source.size)
bench = Image.new('RGBA', source.size)
for x1,x2 in [(80,583),(1087,1593)]:
    seats.paste(source.crop((x1,821,x2,846)),(x1,821))
    bench.paste(source.crop((x1,846,x2,873)),(x1,846))
seats.save(OUT/'bench-seats.png')
bench.save(OUT/'bench-front.png')
base.convert('RGB').save(OUT/'arena-base.webp', quality=93, method=6)

if len(sys.argv)>2:
    texture=Image.open(sys.argv[2]).convert('RGBA')
    texture=texture.crop(texture.getbbox())
    # Homography maps each output front-net quadrilateral into source texture.
    def warp(points):
        sw,sh=texture.size
        dest=[(0,0),(sw,0),(sw,sh),(0,sh)]
        matrix=[]; rhs=[]
        for (x,y),(u,v) in zip(points,dest):
            matrix.extend([[x,y,1,0,0,0,-u*x,-u*y],[0,0,0,x,y,1,-v*x,-v*y]])
            rhs.extend([u,v])
        coeff=np.linalg.solve(np.array(matrix),np.array(rhs))
        result=texture.transform(source.size,Image.Transform.PERSPECTIVE,coeff,Image.Resampling.BICUBIC)
        mask=Image.new('L',source.size); ImageDraw.Draw(mask).polygon(points,fill=255)
        alpha=np.asarray(result.getchannel('A')).astype(float)*np.asarray(mask)/255*.68
        result.putalpha(Image.fromarray(alpha.astype('uint8')))
        return result
    net=Image.new('RGBA',source.size)
    for points in [[(113,497),(186,480),(186,542),(113,568)],[(1486,480),(1559,497),(1559,568),(1486,542)]]:
        net.alpha_composite(warp(points))
    net.save(OUT/'goal-front-net.png')

for path in OUT.glob('*'):
    if path.suffix not in ['.png','.webp']: continue
    im=Image.open(path)
    print(path.name, im.size, im.mode, im.getchannel('A').getextrema() if im.mode=='RGBA' else '')
