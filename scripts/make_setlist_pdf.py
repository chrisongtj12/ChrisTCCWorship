#!/usr/bin/env python3
import re, subprocess, html, os, sys, json

SONGS_DIR = os.path.join(os.path.dirname(__file__), "..", "songs")
OUT_PDF  = "/Users/chrisong/Cowork Mac Mini/TCC Worship/9 Aug 2026 Setlist Chords.pdf"
HTML_MEASURE = "/tmp/tcc_9aug_measure.html"
HTML_PRINT   = "/tmp/tcc_9aug_print.html"

# Letter @96dpi minus 13mm/14mm margins -> printable content box, in CSS px
PAGE_W = 710
PAGE_H = 956

# service order: (file, role, playing key, transpose semitones, columns)
SET = [
    ("All Sufficient Merit.cho",              "Opening Song", "G", -5, 2),
    ("My Hope Is Built On Nothing Less.cho",  "Song 2",       "D",  0, 1),
    ("Amazing Grace.cho",                     "Pre-Sermon",   "C",  5, 2),
    ("O Great God.cho",                       "Response",     "C",  0, 2),
    ("Jesus When You Died.cho",               "Kids' Song",   "G",  0, 2),
]

SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
NOTE = {'C':0,'C#':1,'DB':1,'D':2,'D#':3,'EB':3,'E':4,'FB':4,'F':5,'E#':5,
        'F#':6,'GB':6,'G':7,'G#':8,'AB':8,'A':9,'A#':10,'BB':10,'B':11,'CB':11,'B#':0}

def tp_token(tok, semi):
    m = re.match(r'^([A-G][b#]?)(.*)$', tok)
    if not m: return tok
    return SHARP[(NOTE[m.group(1).upper()] + semi) % 12] + m.group(2)

def tp_chord(ch, semi):
    if semi == 0 or ch is None: return ch
    ch = ch.strip()
    if not re.match(r'^[A-G]', ch): return ch
    if '/' in ch:
        a, b = ch.split('/', 1); return tp_token(a, semi) + '/' + tp_token(b, semi)
    return tp_token(ch, semi)

def parse_line(line, semi):
    segs, cur = [], None
    for p in re.split(r'(\[[^\]]*\])', line):
        if p == '': continue
        if p.startswith('[') and p.endswith(']'):
            if cur is not None: segs.append((cur, ''))
            cur = p[1:-1]
        else:
            segs.append((cur, p)); cur = None
    if cur is not None: segs.append((cur, ''))
    return [(tp_chord(c, semi), t) for c, t in segs]

def render_song(idx, path, role, key, semi, scale, ncols):
    raw = open(path, encoding="utf-8").read()
    meta, sections, cur = {}, [], None
    for line in raw.splitlines():
        s = line.rstrip()
        if s.startswith("CCLI Song #"): break
        mc = re.match(r'^\{comment:\s*([^}]*)\}', s)   # section header (may have trailing directives)
        if mc:
            cur = {"label": mc.group(1).strip(), "lines": []}; sections.append(cur); continue
        m = re.match(r'^\{(\w+):\s*(.*?)\}\s*$', s)
        if m:
            k, v = m.group(1), m.group(2)
            if k == "comment":
                cur = {"label": v, "lines": []}; sections.append(cur)
            else:
                meta.setdefault(k, v)
            continue
        s = re.sub(r'\{[^}]*\}', '', s)
        if s.strip() == '':
            if cur: cur["lines"].append(None)
            continue
        if cur is None:
            cur = {"label": "", "lines": []}; sections.append(cur)
        cur["lines"].append(parse_line(s, semi))

    title = meta.get("title", os.path.basename(path))
    bits = [f"Key of {key}"]
    if meta.get("time"): bits.append(meta["time"].strip())
    if meta.get("tempo"): bits.append("&#9833;=" + meta["tempo"].strip())
    if meta.get("ccli"): bits.append("CCLI " + meta["ccli"].strip())
    sub = meta.get("subtitle", "")

    h = [f'<section class="song">']
    h.append(f'<div class="role">{html.escape(role)}</div>')
    h.append(f'<h1>{html.escape(title)}</h1>')
    if sub: h.append(f'<div class="sub">{html.escape(sub)}</div>')
    h.append(f'<div class="meta">{" &nbsp;&middot;&nbsp; ".join(bits)}</div>')
    h.append(f'<div class="inner" style="transform:scale({scale});column-count:{ncols}">')
    for sec in sections:
        h.append('<div class="sec">')
        if sec["label"]:
            h.append(f'<div class="section">{html.escape(sec["label"])}</div>')
        for ln in sec["lines"]:
            if ln is None:
                h.append('<div class="gap"></div>'); continue
            row = ['<div class="line">']
            for ch, txt in ln:
                cls = "seg hc" if ch else "seg"
                chd = html.escape(ch) if ch else ""
                lyr = html.escape(txt) if txt != "" else "&nbsp;&nbsp;"
                row.append(f'<span class="{cls}"><span class="ch">{chd}</span>'
                           f'<span class="ly">{lyr}</span></span>')
            row.append('</div>'); h.append("".join(row))
        h.append('</div>')
    h.append('</div></section>')
    return "\n".join(h)

def css(measure):
    box = ("" if measure else
           f".song{{height:{PAGE_H}px;overflow:hidden;}}")
    return f"""
@page {{ size: Letter portrait; margin: 13mm 14mm; }}
* {{ box-sizing: border-box; }}
body {{ font-family:-apple-system,"Helvetica Neue",Arial,sans-serif; color:#111; margin:0; width:{PAGE_W}px; }}
.song {{ width:{PAGE_W}px; page-break-after:always; }}
.song:last-child {{ page-break-after:auto; }}
{box}
.inner {{ transform-origin: top left; width:{PAGE_W}px; column-gap:26px; }}
.sec {{ break-inside: avoid; padding-bottom:2px; }}
.role {{ font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:#6b7280; font-weight:700; }}
h1 {{ font-size:26px; margin:2px 0; line-height:1.05; }}
.sub {{ font-size:12px; color:#6b7280; margin-bottom:2px; }}
.meta {{ font-size:12px; color:#374151; border-bottom:1.5px solid #e5e7eb; padding-bottom:8px; margin-bottom:10px; }}
.section {{ font-weight:700; font-size:12.5px; color:#be185d; text-transform:uppercase; letter-spacing:.04em; margin:11px 0 3px; }}
.line {{ line-height:1.15; margin:1px 0; }}
.seg {{ display:inline-block; vertical-align:bottom; white-space:pre; }}
.seg .ch {{ display:block; font:700 12.5px/1.1 "SFMono-Regular","Menlo",monospace; color:#1d4ed8; height:15px; }}
.seg.hc .ch {{ padding-right:7px; }}
.seg .ly {{ display:block; font:400 15.5px/1.25 -apple-system,"Helvetica Neue",Arial,sans-serif; }}
.gap {{ height:9px; }}
"""

def build(scales, measure):
    body = "\n".join(render_song(i, os.path.join(SONGS_DIR, f), r, k, s, scales[i], cols)
                     for i, (f, r, k, s, cols) in enumerate(SET))
    return (f'<!doctype html><html><head><meta charset="utf-8">'
            f'<style>{css(measure)}</style></head><body>{body}</body></html>')

if __name__ == "__main__":
    jsonarg = next((a for a in sys.argv[1:] if a.startswith("[")), None)
    scales = json.loads(jsonarg) if jsonarg else [1.0]*len(SET)
    if "--measure" in sys.argv:
        open(HTML_MEASURE, "w").write(build([1.0]*len(SET), measure=True))
        print(HTML_MEASURE)
    else:
        open(HTML_PRINT, "w").write(build(scales, measure=False))
        os.makedirs(os.path.dirname(OUT_PDF), exist_ok=True)
        CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
                        f"--print-to-pdf={OUT_PDF}", "file://" + HTML_PRINT],
                       check=True, capture_output=True)
        print("Wrote", OUT_PDF)
