from pathlib import Path
from PIL import Image, ImageEnhance
import math


ROOT = Path(__file__).resolve().parents[2]
QA = Path(__file__).resolve().parent


def feathered_union_mask(size, circles, exclusions=()):
    width, height = size
    mask = Image.new("L", size)
    pixels = mask.load()
    for y in range(height):
        for x in range(width):
            alpha = 0.0
            for cx, cy, radius, feather in circles:
                distance = math.hypot(x - cx, y - cy)
                alpha = max(alpha, min(1.0, max(0.0, (radius - distance) / feather)))
            for left, top, right, bottom in exclusions:
                if left <= x <= right and top <= y <= bottom:
                    alpha = 0.0
            pixels[x, y] = round(alpha * 255)
    return mask


def export(source_name, output_name, circles, exclusions=(), transform=None):
    image = Image.open(QA / source_name).convert("RGBA")
    image.putalpha(feathered_union_mask(image.size, circles, exclusions))
    if transform:
        image = transform(image)
    output = ROOT / "xinghai-workbench" / "assets" / output_name
    image.save(output, optimize=True)
    installed = ROOT / "test-vault" / ".obsidian" / "plugins" / "xinghai-workbench" / "assets" / output_name
    image.save(installed, optimize=True)


export(
    "shadow-planet-light-source.png",
    "xinghai-shadow-planet-dark.png",
    [(77, 73, 58, 5), (124, 104, 18, 4)],
    transform=lambda image: ImageEnhance.Color(ImageEnhance.Brightness(image).enhance(0.42)).enhance(1.28),
)
export(
    "shadow-planet-light-source.png",
    "xinghai-shadow-planet-light.png",
    [(77, 73, 58, 5), (124, 104, 18, 4)],
)
