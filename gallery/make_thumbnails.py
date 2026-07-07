from pathlib import Path
from PIL import Image, ImageOps

BASE_DIR = Path(__file__).resolve().parent
INPUT_DIR = BASE_DIR / "photos"
OUTPUT_DIR = BASE_DIR / "thumbnail_photos"
MAX_WIDTH = 900
QUALITY = 58

def make_thumbnail(input_path):
    relative_path = input_path.relative_to(INPUT_DIR)
    output_path = OUTPUT_DIR / relative_path
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(input_path) as img:
        img = ImageOps.exif_transpose(img)
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGB")
        width, height = img.size
        if width > MAX_WIDTH:
            new_height = round(height * (MAX_WIDTH / width))
            img = img.resize((MAX_WIDTH, new_height), Image.Resampling.LANCZOS)
        img.save(output_path, "WEBP", quality=QUALITY, method=6)
    print(f"saved {output_path}")

def main():
    OUTPUT_DIR.mkdir(exist_ok=True)
    for input_path in INPUT_DIR.rglob("*.webp"):
        make_thumbnail(input_path)

if __name__ == "__main__":
    main()