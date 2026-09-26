"""
Build web fonts from the Nerd Font originals.

Run:  py -3.10 fonts/build.py

Reads the extracted .ttf files in fonts/extracted/ and writes subsetted .woff2
files to public/assets/fonts/. Only the output is committed; this script and
its inputs live under fonts/, which is gitignored.

The character set below is not arbitrary. The interface renders these
characters directly, and if the subset drops one it falls back to a different
font mid-sentence — which looks like a rendering bug and is hard to trace:

    U+2713  the checklist tick
    U+2192  the arrow in activity value diffs (old -> new)
    U+00B7  the separator between list metadata items
    U+00D7  the tag remove button
    U+2026  the ellipsis in busy button labels ("Saving...")
    U+00A9  the footer copyright

Latin Extended-A is included so a task title or username containing an
accented character does not fall back either.
"""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "fonts" / "extracted"
OUT = ROOT / "public" / "assets" / "fonts"

UNICODES = ",".join([
    "U+0020-007E",   # Basic Latin
    "U+00A0-00FF",   # Latin-1 Supplement: includes copyright, middle dot, multiplication sign
    "U+0100-017F",   # Latin Extended-A: accented names and titles
    "U+2000-206F",   # General Punctuation: dashes, curly quotes, ellipsis
    "U+2190-2193",   # Arrows: the activity diff uses the rightwards arrow
    "U+2212",        # Minus sign
    "U+2713-2714",   # Check marks
    "U+20AC",        # Euro
    "U+2122",        # Trade mark
])

# source file -> output name
FILES = {
    "SauceCodeProNerdFontMono-Regular.ttf":  "source-code-pro-400.woff2",
    "SauceCodeProNerdFontMono-Medium.ttf":   "source-code-pro-500.woff2",
    "SauceCodeProNerdFontMono-SemiBold.ttf": "source-code-pro-600.woff2",
    "SauceCodeProNerdFontMono-Bold.ttf":     "source-code-pro-700.woff2",
    "IosevkaTermSlabNerdFontMono-Bold.ttf":  "iosevka-term-slab-700.woff2",
    "TerminessNerdFontMono-Regular.ttf":     "terminess-400.woff2",
}


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)

    total_before = 0
    total_after = 0

    for source, target in FILES.items():
        src = SRC / source

        if not src.is_file():
            print(f"MISSING {src}")
            return 1

        dst = OUT / target

        subprocess.run(
            [
                sys.executable, "-m", "fontTools.subset", str(src),
                f"--unicodes={UNICODES}",
                "--flavor=woff2",
                f"--output-file={dst}",
            ],
            check=True,
        )

        before = src.stat().st_size
        after = dst.stat().st_size
        total_before += before
        total_after += after

        print(f"{target:<32} {before/1024/1024:7.1f} MB -> {after/1024:7.1f} KB")

    print()
    print(f"{'TOTAL':<32} {total_before/1024/1024:7.1f} MB -> {total_after/1024:7.1f} KB")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
