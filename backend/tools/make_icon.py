"""Generate mcpb/icon.png.

A directory listing without an icon reads as unfinished, and there is no image
library in this project's dependencies -- so this writes the PNG by hand, which
for flat rectangles is about thirty lines of zlib and struct.

The mark is the product in one picture: four bars for the four wealth tiers
that partition the population, ascending, with the top bar's cap split off to
show the top 0.1% nested inside the top 1% rather than standing beside it. That
distinction is the thing Financert gets right and most comparisons get wrong,
so it may as well be the logo.

It is a placeholder in the sense that anyone with a designer should replace it,
not in the sense that it is unfinished. Run:

    python tools/make_icon.py
"""

from __future__ import annotations

import struct
import zlib
from pathlib import Path

SIZE = 512
OUT = Path(__file__).resolve().parent.parent / "mcpb" / "icon.png"

GROUND = (0x0F, 0x16, 0x20)
BAR = (0x6E, 0xC2, 0x94)
CAP = (0xF2, 0xE8, 0xC9)

# x, width and height as fractions of the canvas: bottom 50%, next 40%,
# next 9%, top 1%. Heights are illustrative, not the real numbers -- an icon
# that claimed to be data would have to be kept true to it.
BARS = ((0.14, 0.15, 0.22), (0.33, 0.15, 0.38), (0.52, 0.15, 0.58), (0.71, 0.15, 0.84))
CAP_FRACTION = 0.26  # of the tallest bar's height, split off as the top 0.1%
BASELINE = 0.88


def _rows() -> list[list[tuple[int, int, int]]]:
    rows = [[GROUND] * SIZE for _ in range(SIZE)]
    baseline = int(BASELINE * SIZE)

    for i, (x_frac, w_frac, h_frac) in enumerate(BARS):
        x0 = int(x_frac * SIZE)
        x1 = x0 + int(w_frac * SIZE)
        top = baseline - int(h_frac * SIZE)
        # Only the tallest bar carries a cap: the top 0.1% sits inside the
        # top 1%, so it is drawn as part of that bar, never as a fifth one.
        split = top + int(h_frac * SIZE * CAP_FRACTION) if i == len(BARS) - 1 else top

        for y in range(top, baseline):
            colour = CAP if y < split else BAR
            row = rows[y]
            for x in range(x0, x1):
                row[x] = colour
    return rows


def _png(rows: list[list[tuple[int, int, int]]]) -> bytes:
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
        + chunk(b"IHDR", struct.pack(">IIBBBBB", SIZE, SIZE, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )


def main() -> int:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_bytes(_png(_rows()))
    print(f"wrote {OUT} ({OUT.stat().st_size:,} bytes, {SIZE}x{SIZE})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
