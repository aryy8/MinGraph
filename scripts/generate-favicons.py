from PIL import Image, ImageDraw
import os

def create_mingraph_icon(size=512, rounded=True, padding=0.15):
    # Render at 4x supersampling for ultra smooth anti-aliased edges
    scale = 4
    canvas_size = size * scale
    img = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    pad = canvas_size * padding
    inner_w = canvas_size - 2 * pad
    radius = int(inner_w * 0.23)

    if rounded:
        # Subtle drop shadow simulation
        shadow_offset = int(4 * scale)
        shadow_pad = pad
        draw.rounded_rectangle(
            [shadow_pad, shadow_pad + shadow_offset, canvas_size - shadow_pad, canvas_size - shadow_pad + shadow_offset],
            radius=radius,
            fill=(60, 64, 67, 30)
        )
        # White squircle card
        draw.rounded_rectangle(
            [pad, pad, canvas_size - pad, canvas_size - pad],
            radius=radius,
            fill=(255, 255, 255, 255),
            outline=(232, 234, 237, 255),
            width=int(1.5 * scale)
        )

    # Coordinate positions for the 5 nodes
    # Inside the squircle card (with 24% inset from card bounds)
    card_inset = pad + inner_w * 0.24
    card_span = inner_w * 0.52

    x_left = card_inset
    x_mid = pad + inner_w * 0.50
    x_right = card_inset + card_span

    y_top = card_inset
    y_mid = pad + inner_w * 0.50
    y_bottom = card_inset + card_span

    edge_color = (184, 211, 251, 255) # #B8D3FB
    edge_width = int(7.5 * scale)

    # 6 Graph edges
    # Left vertical
    draw.line([(x_left, y_top), (x_left, y_bottom)], fill=edge_color, width=edge_width)
    # Right vertical
    draw.line([(x_right, y_top), (x_right, y_bottom)], fill=edge_color, width=edge_width)
    # Diagonals to center
    draw.line([(x_left, y_top), (x_mid, y_mid)], fill=edge_color, width=edge_width)
    # Top-right to center
    draw.line([(x_right, y_top), (x_mid, y_mid)], fill=edge_color, width=edge_width)
    # Bottom-left to center
    draw.line([(x_left, y_bottom), (x_mid, y_mid)], fill=edge_color, width=edge_width)
    # Bottom-right to center
    draw.line([(x_right, y_bottom), (x_mid, y_mid)], fill=edge_color, width=edge_width)

    # 5 Nodes in Google Brand Colors
    node_radius = int(14.5 * scale)

    def draw_node(cx, cy, color):
        draw.ellipse(
            [cx - node_radius, cy - node_radius, cx + node_radius, cy + node_radius],
            fill=color
        )

    # Top-Left: Google Blue
    draw_node(x_left, y_top, (66, 133, 244, 255))
    # Top-Right: Google Red
    draw_node(x_right, y_top, (234, 67, 53, 255))
    # Center: Google Yellow
    draw_node(x_mid, y_mid, (251, 188, 4, 255))
    # Bottom-Left: Google Green
    draw_node(x_left, y_bottom, (52, 168, 83, 255))
    # Bottom-Right: Google Blue
    draw_node(x_right, y_bottom, (66, 133, 244, 255))

    # Downsample using high quality Lanczos resampling
    final_img = img.resize((size, size), Image.Resampling.LANCZOS)
    return final_img

def main():
    root = "/Users/aryan/MinGraph"

    # 1. 512x512 high-res app icon
    icon_512 = create_mingraph_icon(512, rounded=True, padding=0.08)

    # 2. Apple touch icons (180x180 and 512x512)
    icon_180 = icon_512.resize((180, 180), Image.Resampling.LANCZOS)
    icon_512.save(os.path.join(root, "src/app/apple-icon.png"), format="PNG")
    icon_180.save(os.path.join(root, "public/apple-touch-icon.png"), format="PNG")

    # 3. Multi-resolution ICO (16, 32, 48, 64, 128, 256)
    ico_sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    icon_512.save(
        os.path.join(root, "src/app/favicon.ico"),
        format="ICO",
        sizes=ico_sizes
    )
    icon_512.save(
        os.path.join(root, "public/favicon.ico"),
        format="ICO",
        sizes=ico_sizes
    )

    print("Successfully generated:")
    print(" - src/app/favicon.ico (multi-res 16..256)")
    print(" - public/favicon.ico (multi-res 16..256)")
    print(" - src/app/apple-icon.png (512x512)")
    print(" - public/apple-touch-icon.png (180x180)")

if __name__ == "__main__":
    main()
