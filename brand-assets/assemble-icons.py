"""Assemble the multi-size .ico and the macOS .icns from the PNGs that
brand-assets/generate-icons.mjs produced. Run from vselite/:
    python brand-assets/assemble-icons.py
Requires Pillow (already available)."""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
PNG = os.path.join(HERE, "png")

# --- Windows .ico (multi-size) ---
ico_sizes = [16, 24, 32, 48, 64, 128, 256]
base = Image.open(os.path.join(PNG, "app-256.png")).convert("RGBA")
ico_path = os.path.join(REPO, "resources", "win32", "code.ico")
base.save(ico_path, format="ICO", sizes=[(s, s) for s in ico_sizes])
print("wrote", ico_path)

# --- macOS .icns ---
icns_path = os.path.join(REPO, "resources", "darwin", "code.icns")
os.makedirs(os.path.dirname(icns_path), exist_ok=True)
icns_base = Image.open(os.path.join(PNG, "icns-1024.png")).convert("RGBA")
# Pillow's ICNS writer derives the required sizes from the source image.
icns_base.save(icns_path, format="ICNS")
print("wrote", icns_path)

# --- Web favicon.ico (code-server) ---
fav_path = os.path.join(REPO, "resources", "server", "favicon.ico")
fav_base = Image.open(os.path.join(PNG, "favicon-256.png")).convert("RGBA")
fav_base.save(fav_path, format="ICO", sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (256, 256)])
print("wrote", fav_path)
