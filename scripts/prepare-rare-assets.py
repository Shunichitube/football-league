"""Cut approved source artwork into the game's transparent, registered atlases.

Usage: python3 scripts/prepare-rare-assets.py rare_character_assets_complete.zip
Requires Pillow. Does not generate or redraw artwork.
"""
from io import BytesIO
from pathlib import Path
from zipfile import ZipFile
import sys
from PIL import Image

KINDS = ['golden_egg','chick','emperor_penguin','phoenix','dragon','king_kong','sage','robot','black_hole']
# Exclude neighbouring characters when cutting the approved contact sheet.
PORTRAITS = {
    'golden_egg': (80,40,390,380), 'chick': (485,35,800,380),
    'emperor_penguin': (890,50,1230,380), 'phoenix': (0,378,453,816),
    'king_kong': (837,400,1297,814), 'sage': (15,817,449,1212),
    'robot': (478,823,800,1200), 'black_hole': (832,816,1297,1212),
}

def normalize(image, scale=None):
    image = image.crop(image.getbbox())
    scale = scale or min(280 / image.width, 400 / image.height)
    image = image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))), Image.Resampling.LANCZOS)
    result = Image.new('RGBA', (300,470))
    result.alpha_composite(image, ((300-image.width)//2,450-image.height))
    return result

def main(archive_path):
    destination = Path(__file__).resolve().parents[1] / 'assets/avatars/rare'
    destination.mkdir(parents=True, exist_ok=True)
    with ZipFile(archive_path) as archive:
        def load(name):
            return Image.open(BytesIO(archive.read('rare_character_assets_complete/' + name))).convert('RGBA')
        sheet = load('portraits_approved_sheet.png')
        for kind in KINDS:
            image = load('dragon_portrait_short_tail.png') if kind == 'dragon' else sheet.crop(PORTRAITS[kind])
            normalize(image).save(destination / (kind+'-portrait.webp'), lossless=True)
            motion = load(kind+'_motions.png')
            rows = 2 if kind == 'black_hole' else 3
            frames = [motion.crop((round(x*motion.width/4),round(y*motion.height/rows),round((x+1)*motion.width/4),round((y+1)*motion.height/rows))) for y in range(rows) for x in range(4)]
            boxes = [frame.getbbox() for frame in frames]
            scale = min(280/max(b[2]-b[0] for b in boxes),400/max(b[3]-b[1] for b in boxes))
            atlas = Image.new('RGBA',(1200,470*rows))
            for index, frame in enumerate(frames):
                atlas.alpha_composite(normalize(frame,scale),(index%4*300,index//4*470))
            atlas.save(destination / (kind+'-motions.webp'), lossless=True)

if __name__ == '__main__':
    main(sys.argv[1])
