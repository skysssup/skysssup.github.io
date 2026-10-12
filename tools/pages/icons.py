"""Render the shared SVG mark for legacy browser tabs and saved iOS shortcuts.

Run after build.mjs. Requires Pillow, like the existing hero asset pipeline.
"""
from pathlib import Path
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SVG = ET.parse(ROOT / "assets/favicon.svg").getroot()
NS = "{http://www.w3.org/2000/svg}"
GROUP = SVG.find(f"{NS}g")


def render(size, touch=False):
    factor = 8
    canvas = Image.new("RGBA", (size * factor, size * factor), "#090a0b" if touch else (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    scale = size * factor / 28
    # Touch icons need an opaque square; the OS supplies the corner mask.
    if not touch:
        draw.rounded_rectangle((0, 0, size * factor - 1, size * factor - 1), radius=5 * scale, fill="#090a0b")
    width = round(float(GROUP.attrib["stroke-width"]) * scale)
    color = GROUP.attrib["stroke"]
    for element in GROUP:
        if element.tag == f"{NS}line":
            points = [float(element.attrib[key]) * scale for key in ("x1", "y1", "x2", "y2")]
            draw.line(points, fill=color, width=width)
            for x, y in (points[:2], points[2:]):
                draw.ellipse((x - width / 2, y - width / 2, x + width / 2, y + width / 2), fill=color)
        elif element.tag == f"{NS}circle":
            x, y, radius = [float(element.attrib[key]) * scale for key in ("cx", "cy", "r")]
            draw.ellipse((x - radius, y - radius, x + radius, y + radius), outline=color, width=width)
    return canvas.resize((size, size), Image.Resampling.LANCZOS)


sizes = [16, 24, 32, 48, 64]
images = [render(size) for size in sizes]
images[-1].save(ROOT / "favicon.ico", format="ICO", sizes=[(size, size) for size in sizes], append_images=images[:-1])
render(32).save(ROOT / "assets/favicon-32.png")
render(180, touch=True).convert("RGB").save(ROOT / "assets/apple-touch-icon.png")
print("Rendered browser and touch icons from the shared crest")
