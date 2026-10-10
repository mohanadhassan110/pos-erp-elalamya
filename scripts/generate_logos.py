import os
from PIL import Image, ImageDraw, ImageFont

def create_brand_logo(output_path, text_color, is_white=True):
    # Canvas dimensions: 600 x 140 (high-DPI 2x for crisp rendering)
    width, height = 600, 140
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 1. Draw Emblem on the right (RTL layout)
    # Center of emblem: x=510, y=70, radius=48
    cx, cy, r = 510, 70, 46

    # Draw refined geometric emblem: outer ring + inner diamond / textile motif
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=text_color, width=4)
    # Inner diamond
    ir = 28
    draw.polygon([(cx, cy - ir), (cx + ir, cy), (cx, cy + ir), (cx - ir, cy)], outline=text_color, width=3)
    # Inner cross-weave
    draw.line([(cx - 16, cy), (cx + 16, cy)], fill=text_color, width=2)
    draw.line([(cx, cy - 16), (cx, cy + 16)], fill=text_color, width=2)
    # Small center square
    draw.rectangle([cx - 4, cy - 4, cx + 4, cy + 4], fill=text_color)

    # 2. Typography
    # Try finding an Arabic font on Windows
    font_paths = [
        r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\arial.ttf",
        r"C:\Windows\Fonts\tahoma.ttf",
    ]
    font_path = None
    for p in font_paths:
        if os.path.exists(p):
            font_path = p
            break

    try:
        font_main = ImageFont.truetype(font_path, 34) if font_path else ImageFont.load_default()
        font_sub = ImageFont.truetype(font_path, 18) if font_path else ImageFont.load_default()
    except Exception:
        font_main = ImageFont.load_default()
        font_sub = ImageFont.load_default()

    # Main text: "معرض العالمية للمفروشات"
    # Secondary text: "AL-ALAMIYA HOME TEXTILES"
    main_text = "معرض العالمية للمفروشات"
    sub_text = "AL-ALAMIYA HOME TEXTILES"

    # Draw text right-aligned near the emblem
    # We will draw main text at y=36, sub text at y=84
    # Right edge at x=440
    draw.text((440, 34), main_text, fill=text_color, font=font_main, anchor="ra")
    draw.text((440, 84), sub_text, fill=text_color, font=font_sub, anchor="ra")

    img.save(output_path, "PNG")
    print(f"Created {output_path} with mode={img.mode}, size={img.size}")

if __name__ == "__main__":
    os.makedirs(r"frontend\src\assets\brand", exist_ok=True)
    # logo-white.png for navy surfaces (pure white #FFFFFF on transparent)
    create_brand_logo(r"frontend\src\assets\brand\logo-white.png", (255, 255, 255, 255), is_white=True)
    # logo-black.png for print/light surfaces (pure black #000000 on transparent)
    create_brand_logo(r"frontend\src\assets\brand\logo-black.png", (11, 18, 32, 255), is_white=False)
