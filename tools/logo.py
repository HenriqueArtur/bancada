#!/usr/bin/env python3
"""Draw the mark: a bench, and what rests on it.

Parameters rather than hand-written paths, so a round of iteration is changing
a number instead of retyping five curves — and so the *relationships* stay
true when one thing moves. Every mark is a filled outline, never a stroke: a
stroke has one width and machine ends, and no amount of curving hides that.

    tools/logo.py web/probe/logo.svg
"""

import sys
from pathlib import Path

# ── the palette, from theme.css ──────────────────────────────────────────
INK = "#1d1c1a"
CLAY = "#c15f3c"
INK_DARK = "#ece8df"
CLAY_DARK = "#dd8560"

BENCH_Y = 47.0

# One mark: where it stands, how tall, how wide at the base, and how much
# lean the brush had. Uneven on purpose — spacing that grows a little, heights
# that answer each other. Random would read as a mistake; this reads as a hand.
#
# The clay one is neither the tallest nor the first. What wants you is not the
# biggest thing on the bench, and putting the accent on the tallest would say
# it was.
# Four upright verticals on a line is how every chart in the world is drawn,
# and the first attempt read as a skyline. Things resting against a bench
# lean; a bar never does. The lean is what stops it being a graph.
VARIANTS = {
    # x     top   base  lean  clay
    "upright": [
        (16.5, 13.0, 6.2, 0.6, False),
        (26.5, 8.5, 6.4, -0.4, False),
        (36.5, 11.5, 6.5, 0.4, True),
        (46.5, 10.0, 6.0, -0.5, False),
    ],
    # Alternating lean draws triangles, and the thing read as an easel. All
    # of them leaning the same way, at angles that differ, is what a row of
    # tools propped against a bench actually looks like.
    "resting": [
        (13.8, 12.5, 4.9, 4.4, False),
        (24.2, 8.2, 5.1, 2.9, False),
        (34.4, 11.0, 4.85, 5.2, True),
        (45.0, 9.4, 4.8, 3.5, False),
    ],
    # Three, and wider apart: fewer things read as objects rather than data.
    "three": [
        (18.5, 11.5, 5.6, 5.0, False),
        (31.0, 7.6, 5.9, 2.6, False),
        (43.5, 9.8, 5.65, 4.6, True),
    ],
}
# Three rather than four. It wins at the sizes an icon actually lives at —
# the dock, the tab, the menu bar — and the 256 nobody sees.
MARKS = VARIANTS["three"]

# How much of the base width survives at the tip. Not zero: a brush lifted
# off leaves a blunt end, and a needle point disappears into the pixel grid
# at 16px, which is where this has to work hardest.
TIP = 0.74

# The bow on each long side, in user units, in opposite directions. A third
# of a pixel at 512. Nobody sees it; everybody feels it.
BOW = 0.34


def mark(x, top, base, lean, clay):
    """One brush stroke standing on the bench."""
    hb = base / 2
    ht = base * TIP / 2
    bx, tx = x, x + lean  # the brush drifts as it rises

    # Two thirds of the way up, where the bow is widest.
    ly = top + (BENCH_Y - top) * 0.34
    lx_l = bx - hb + (tx - bx) * 0.66 + BOW
    lx_r = bx + hb + (tx - bx) * 0.66 - BOW

    # The tip is cut at a slight angle: the brush leaves the paper on one
    # corner first, which is what a flat end never looks like.
    tilt = 0.34 if lean > 0 else -0.34

    return (
        f"M{bx - hb:.2f} {BENCH_Y:.2f} "
        f"C{bx - hb + 0.1:.2f} {BENCH_Y - 4:.2f} {lx_l:.2f} {ly:.2f} {tx - ht:.2f} {top + tilt:.2f} "
        f"Q{tx:.2f} {top - 0.5:.2f} {tx + ht:.2f} {top - tilt:.2f} "
        f"C{lx_r:.2f} {ly:.2f} {bx + hb - 0.1:.2f} {BENCH_Y - 4:.2f} {bx + hb:.2f} {BENCH_Y:.2f} Z"
    )


def bench():
    """The surface. Also a brush stroke — a ruled line under brushed marks
    would give the whole thing away.

    Thinner than the marks and cut square at the ends. The first attempt gave
    it rounded caps and the weight of a bar, and it stopped being a surface
    and became the heaviest object in the picture."""
    y = BENCH_Y
    return (
        f"M8.4 {y - 0.05:.2f} "
        f"C20 {y - 0.75:.2f} 42 {y - 0.85:.2f} 55.8 {y - 0.35:.2f} "
        f"L56.4 {y + 1.15:.2f} "
        f"C42 {y + 1.75:.2f} 20 {y + 1.85:.2f} 8.2 {y + 1.45:.2f} Z"
    )


GROUND = "#faf9f5"


def svg(ground=None, pad=0.0):
    """The mark. With `ground`, on a tile — an app icon cannot follow a theme
    the way a page can, so it commits to one."""
    paths = [f'  <path class="ink" d="{bench()}"/>']
    for x, top, base, lean, clay in MARKS:
        # Clay reads lighter than ink on the same ground, so the one that
        # carries the colour is drawn a touch heavier. The same correction a
        # typeface makes when an `o` overshoots the baseline — and its base
        # is set narrower to pay for it, or the correction lands on top of a
        # mark that was already the widest and it just reads as the fat one.
        w = base * 1.04 if clay else base
        paths.append(f'  <path class="{"clay" if clay else "ink"}" d="{mark(x, top, w, lean, clay)}"/>')

    if ground:
        # No `rx`: a rounded rect from a vector tool has four identical
        # corners, and nothing else in this mark is identical to anything.
        tile = (
            f'  <path fill="{ground}" d="M0.4 15.6 C1.1 6.4 6.2 1.2 15.4 0.5 '
            f"C27 -0.2 37.4 -0.1 48.8 0.6 C57.6 1.4 62.6 6.5 63.4 15.8 "
            f"C64.1 27 64.1 37.2 63.4 48.4 C62.7 57.5 57.4 62.7 48.2 63.5 "
            f'C37 64.1 27 64.2 15.6 63.5 C6.4 62.8 1.3 57.6 0.5 48.2 '
            f'C-0.1 37 -0.2 26.8 0.4 15.6 Z"/>'
        )
        body = "\n".join(f"  {p}" for p in paths)
        inner = 1 - pad
        return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="bancada">
  <style>.ink {{ fill: {INK}; }} .clay {{ fill: {CLAY}; }}</style>
{tile}
  <g transform="translate({32 * pad:.2f} {32 * pad:.2f}) scale({inner:.3f})">
{body}
  </g>
</svg>
"""

    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="bancada">
  <style>
    .ink {{ fill: {INK}; }}
    .clay {{ fill: {CLAY}; }}
    @media (prefers-color-scheme: dark) {{
      .ink {{ fill: {INK_DARK}; }}
      .clay {{ fill: {CLAY_DARK}; }}
    }}
  </style>
{chr(10).join(paths)}
</svg>
"""


if __name__ == "__main__":
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "web/probe/logo.svg")
    out.write_text(svg())
    print(out)
