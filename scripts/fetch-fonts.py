"""Download the §8.3 font faces into the repo so builds need no network.

next/font/google fetches from fonts.gstatic.com at build time, which is
unreliable here and would be a CI liability. Self-hosting with next/font/local
keeps the same preload/swap behaviour with no external dependency.
"""

import os
import re
import sys
import urllib.request

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)

OUT = sys.argv[1]

# (family, css-family-arg, weights, subset to keep, filename stem)
FAMILIES = [
    ("Poppins", "Poppins:wght@500;600;700", ["500", "600", "700"], "latin", "poppins"),
    ("Open Sans", "Open+Sans:wght@400;500;600;700", ["400", "500", "600", "700"], "latin", "open-sans"),
    ("Noto Kufi Arabic", "Noto+Kufi+Arabic:wght@500;600;700", ["500", "600", "700"], "arabic", "noto-kufi-arabic"),
    ("Noto Sans Arabic", "Noto+Sans+Arabic:wght@400;500;600;700", ["400", "500", "600", "700"], "arabic", "noto-sans-arabic"),
]

BLOCK = re.compile(r"/\*\s*([a-z0-9\- \[\]]+)\s*\*/\s*@font-face\s*\{(.*?)\}", re.S)


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    return urllib.request.urlopen(req, timeout=60).read()


os.makedirs(OUT, exist_ok=True)
written = []

for label, arg, weights, subset, stem in FAMILIES:
    css = get("https://fonts.googleapis.com/css2?family=%s&display=swap" % arg).decode("utf-8")

    for name, body in BLOCK.findall(css):
        if name.strip() != subset:
            continue
        weight_match = re.search(r"font-weight:\s*(\d+)", body)
        url_match = re.search(r"url\((https://[^)]+\.woff2)\)", body)
        if not weight_match or not url_match:
            continue
        weight = weight_match.group(1)
        if weight not in weights:
            continue

        filename = "%s-%s.woff2" % (stem, weight)
        path = os.path.join(OUT, filename)
        data = get(url_match.group(1))
        with open(path, "wb") as f:
            f.write(data)
        written.append((filename, len(data)))
        print("  %-32s %6d bytes" % (filename, len(data)))

print("\n%d files, %d bytes total" % (len(written), sum(n for _, n in written)))
