from PIL import Image, ImageDraw
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'icons')
os.makedirs(OUT, exist_ok=True)

BG = (16, 17, 20, 255)
ACCENT = (124, 158, 255, 255)
WHITE = (232, 233, 237, 255)


def draw_barbell(size, padding_ratio):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = int(size * padding_ratio)
    # rounded square background
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=size * 0.22, fill=BG)

    cx, cy = size / 2, size / 2
    bar_half_len = size * 0.30
    bar_thick = size * 0.045

    # bar
    d.rounded_rectangle(
        [cx - bar_half_len, cy - bar_thick / 2, cx + bar_half_len, cy + bar_thick / 2],
        radius=bar_thick / 2, fill=ACCENT
    )

    plate_w = size * 0.07
    plate_h_outer = size * 0.30
    plate_h_inner = size * 0.20

    for sign in (-1, 1):
        x_outer = cx + sign * bar_half_len * 1.05
        x_inner = cx + sign * bar_half_len * 0.72
        # outer big plate
        d.rounded_rectangle(
            [x_outer - plate_w / 2, cy - plate_h_outer / 2, x_outer + plate_w / 2, cy + plate_h_outer / 2],
            radius=plate_w * 0.3, fill=WHITE
        )
        # inner smaller plate
        d.rounded_rectangle(
            [x_inner - plate_w * 0.6 / 2, cy - plate_h_inner / 2, x_inner + plate_w * 0.6 / 2, cy + plate_h_inner / 2],
            radius=plate_w * 0.25, fill=ACCENT
        )
    return img


for size, name, pad in [(192, 'icon-192.png', 0.0), (512, 'icon-512.png', 0.0), (512, 'icon-maskable-512.png', 0.14)]:
    img = draw_barbell(size, pad)
    img.save(os.path.join(OUT, name))
    print('saved', name)
