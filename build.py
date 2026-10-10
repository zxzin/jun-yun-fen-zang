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
app = app.replace("__MASCOT_DATA__", data("assets/yy-round-v6.webp"))
app = app.replace("__BLIND_MASCOT_DATA__", data("assets/yy-blind-v6.webp"))
app = app.replace("__BOX_OPEN_DATA__", data("assets/yy-box-open-v8.webp"))
app = app.replace("__BOX_CLOSED_DATA__", data("assets/yy-box-closed-v8.webp"))
html = read("src/shell.html")
for key, value in {
    "STYLE": read("src/style.css") + "\n" + read("src/interactions.css") + "\n" + read("src/coins.css") + "\n" + read("src/scene.css") + "\n" + read("src/controls.css"),
    "DIALOGS": read("src/dialogs.html"),
    "ALLOCATION": read("src/allocation.js"),
    "APP": app,
}.items():
    html = html.replace("<!-- " + key + " -->", value)
(ROOT / "index.html").write_text(html, encoding="utf-8")
local = html.replace("mode='cloud'", "mode='local'")
(ROOT / "local.html").write_text(local, encoding="utf-8")
(ROOT / "play-5.4.html").write_text(local, encoding="utf-8")
print("Built index.html:", len(html.encode("utf-8")), "bytes")
