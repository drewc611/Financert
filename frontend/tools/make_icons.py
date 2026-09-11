"""Generate the PWA icons in frontend/public/icons/.

Written with zlib and struct rather than pulling an image library into a
frontend whose entire runtime dependency list is react + react-dom. For flat
rectangles that is about thirty lines.

The mark matches the favicon already inlined in index.html: three ascending
bars on the brand blue. Two sizes plus a maskable variant, which is the one
Android actually needs -- without a `maskable` icon the launcher crops the
square into a circle and clips the bars.

    python tools/make_icons.py
"""

from __future__ import annotations

import struct
import zlib
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"

BRAND = (0x2A, 0x78, 0xD6)
WHITE = (0xFF, 0xFF, 0xFF)

# x, y, w, h as fractions of the canvas -- the three bars, ascending.
BARS = ((0.219, 0.531, 0.125, 0.281), (0.438, 0.375, 0.125, 0.438), (0.656, 0.188, 0.125, 0.625))

# A maskable icon must keep its content inside the safe zone (the middle 80%),
# because launchers crop to a circle. Scaling the bars to 0.6 leaves room.
MASKABLE_SCALE = 0.6


def _rows(size: int, scale: float) -> list[list[tuple[int, int, int]]]:
    rows = [[BRAND] * size for _ in range(size)]
    offset = (1 - scale) / 2
    for x_f, y_f, w_f, h_f in BARS:
        x0 = int((offset + x_f * scale) * size)
        y0 = int((offset + y_f * scale) * size)
        x1 = x0 + max(int(w_f * scale * size), 1)
        y1 = y0 + max(int(h_f * scale * size), 1)
        for y in range(y0, min(y1, size)):
            row = rows[y]
            for x in range(x0, min(x1, size)):
                row[x] = WHITE
    return rows


def _png(rows: list[list[tuple[int, int, int]]], size: int) -> bytes:
    raw = bytearray()
    for row in rows:
        raw.append(0)  # filter type 0 (None) for every scanline
        for r, g, b in row:
            raw += bytes((r, g, b))

    def chunk(kind: bytes, payload: bytes) -> bytes:
        body = kind + payload
        return struct.pack(">I", len(payload)) + body + struct.pack(">I", zlib.crc32(body))

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, size, scale in (
        ("icon-192.png", 192, 1.0),
        ("icon-512.png", 512, 1.0),
        ("icon-maskable-512.png", 512, MASKABLE_SCALE),
        ("apple-touch-icon.png", 180, 1.0),
    ):
        path = OUT / name
        path.write_bytes(_png(_rows(size, scale), size))
        print(f"wrote {path.relative_to(OUT.parent.parent)} ({path.stat().st_size:,} bytes, {size}x{size})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
