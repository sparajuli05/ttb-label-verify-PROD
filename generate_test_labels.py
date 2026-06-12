#!/usr/bin/env python3
"""Generate dummy TTB test labels covering each verification scenario."""
from PIL import Image, ImageDraw, ImageFont
import os, textwrap

OUT = "/home/claude/test-labels"
os.makedirs(OUT, exist_ok=True)

F = "/usr/share/fonts/truetype/dejavu/"
def font(name, size): return ImageFont.truetype(F + name, size)

SERIF_B = lambda s: font("DejaVuSerif-Bold.ttf", s)
SERIF   = lambda s: font("DejaVuSerif.ttf", s)
SANS    = lambda s: font("DejaVuSans.ttf", s)
SANS_B  = lambda s: font("DejaVuSans-Bold.ttf", s)

WARNING_BODY = ("(1) According to the Surgeon General, women should not drink "
"alcoholic beverages during pregnancy because of the risk of birth defects. "
"(2) Consumption of alcoholic beverages impairs your ability to drive a car "
"or operate machinery, and may cause health problems.")

CREAM = (244, 238, 222)
INK = (40, 32, 24)
GOLD = (140, 100, 30)

def draw_centered(d, y, text, fnt, W, fill=INK, spacing=4):
    lines = text.split("\n")
    for line in lines:
        w = d.textlength(line, font=fnt)
        d.text(((W - w) / 2, y), line, font=fnt, fill=fill)
        y += fnt.size + spacing
    return y

def draw_warning(d, y, W, prefix="GOVERNMENT WARNING:", prefix_bold=True, body=WARNING_BODY, fsize=17):
    pf = SANS_B(fsize) if prefix_bold else SANS(fsize)
    bf = SANS(fsize)
    full = prefix + " " + body
    wrapped = textwrap.wrap(full, width=74)
    x_margin = 50
    first = True
    for line in wrapped:
        x = x_margin
        if first and line.startswith(prefix):
            d.text((x, y), prefix, font=pf, fill=INK)
            x += d.textlength(prefix + " ", font=pf)
            rest = line[len(prefix):].lstrip()
            d.text((x, y), rest, font=bf, fill=INK)
            first = False
        else:
            d.text((x, y), line, font=bf, fill=INK)
        y += fsize + 5
    return y

def base_label(brand="OLD TOM DISTILLERY", cls="Kentucky Straight Bourbon Whiskey",
               abv="45% Alc./Vol. (90 Proof)", net="750 mL",
               bottler="Old Tom Distillery Co., Bardstown, KY",
               origin=None, warning=True, warn_prefix="GOVERNMENT WARNING:",
               warn_bold=True, warn_body=WARNING_BODY):
    W, H = 900, 1150
    img = Image.new("RGB", (W, H), CREAM)
    d = ImageDraw.Draw(img)
    # border
    d.rectangle([24, 24, W-24, H-24], outline=GOLD, width=4)
    d.rectangle([34, 34, W-34, H-34], outline=GOLD, width=1)

    y = 90
    y = draw_centered(d, y, "ESTABLISHED 1887", SANS(16), W, GOLD) + 18
    # brand possibly two lines
    bf = SERIF_B(54 if len(brand) < 20 else 44)
    y = draw_centered(d, y, brand, bf, W) + 10
    d.line([(W//2 - 140, y), (W//2 + 140, y)], fill=GOLD, width=3); y += 28
    y = draw_centered(d, y, cls, SERIF(30), W) + 30
    y = draw_centered(d, y, abv, SANS_B(26), W) + 6
    y = draw_centered(d, y, net, SANS(24), W) + 36
    y = draw_centered(d, y, "Distilled and Bottled by", SANS(17), W, GOLD) + 4
    y = draw_centered(d, y, bottler, SANS(20), W) + 14
    if origin:
        y = draw_centered(d, y, origin, SANS_B(20), W) + 10
    if warning:
        d.line([(50, H-260), (W-50, H-260)], fill=INK, width=1)
        draw_warning(d, H-240, W, prefix=warn_prefix, prefix_bold=warn_bold, body=warn_body)
    return img

# 1. Perfect — everything matches the sample application
base_label().save(f"{OUT}/label-01-perfect.png")

# 2. Brand capitalization differs (Dave's STONE'S THROW scenario)
base_label(brand="Old Tom Distillery").save(f"{OUT}/label-02-brand-case.png")

# 3. Warning prefix in title case (Jenny's catch)
base_label(warn_prefix="Government Warning:", warn_bold=True).save(f"{OUT}/label-03-warning-titlecase.png")

# 4. Wrong ABV (label says 40%, application says 45%)
base_label(abv="40% Alc./Vol. (80 Proof)").save(f"{OUT}/label-04-wrong-abv.png")

# 5. Missing government warning entirely
base_label(warning=False).save(f"{OUT}/label-05-missing-warning.png")

# 6. Reworded warning (a word changed: "should not" -> "must not")
base_label(warn_body=WARNING_BODY.replace("should not drink", "must not drink")
          ).save(f"{OUT}/label-06-reworded-warning.png")

# 7. Import label — Product of France
base_label(brand="CHATEAU VIEUX MOULIN", cls="Brandy",
           abv="40% Alc./Vol. (80 Proof)", net="700 mL",
           bottler="Maison Vieux Moulin, Cognac",
           origin="PRODUCT OF FRANCE").save(f"{OUT}/label-07-import-france.png")

# 8. Bad photo simulation — rotate + darken the perfect label
img = base_label().rotate(8, expand=True, fillcolor=(60, 55, 50))
img = Image.eval(img, lambda p: int(p * 0.55))
img.save(f"{OUT}/label-08-bad-photo.png")

print("Generated:", sorted(os.listdir(OUT)))
