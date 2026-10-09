#!/usr/bin/env python3
"""Build the portable offline page using the Python standard library."""
from pathlib import Path
import base64

ROOT = Path(__file__).resolve().parent
def read(name):
    return (ROOT / name).read_text(encoding="utf-8")
def data(name):
    return "data:image/webp;base64," + base64.b64encode((ROOT / name).read_bytes()).decode("ascii")

app = read("src/app.js")
app = app.replace("__ICON_DATA__", data("assets/yy-blindfold-icon.webp"))
app = app.replace("__MASCOT_DATA__", data("assets/yy-blindfold-mascot.webp"))
html = read("src/shell.html")
for key, value in {
    "STYLE": read("src/style.css") + "\n" + read("src/interactions.css"),
    "DIALOGS": read("src/dialogs.html"),
    "ALLOCATION": read("src/allocation.js"),
    "APP": app,
}.items():
    html = html.replace("<!-- " + key + " -->", value)
(ROOT / "index.html").write_text(html, encoding="utf-8")
print("Built index.html:", len(html.encode("utf-8")), "bytes")
