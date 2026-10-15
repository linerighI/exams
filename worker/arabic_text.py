import re, unicodedata

def is_arabic(text):
    return len(re.findall(r'[\u0600-\u06ff]', text)) > len(re.findall(r'[A-Za-z]', text))

def reading_order(words, join_glyphs=True):
    """Group geometric word boxes into lines, then respect each line's direction."""
    rows = []
    for x0, y0, x1, y1, text in sorted(words, key=lambda w: (w[1], w[0])):
        text = unicodedata.normalize('NFKC', text).strip()
        if not text:
            continue
        center = (y0+y1)/2
        height = max(1,y1-y0)
        row = next((r for r in rows if abs(r['y']-center) < min(r['height'],height)*0.5), None)
        if row is None:
            row = {'y':center,'height':height,'words':[]}
            rows.append(row)
        row['words'].append((x0,x1,text))
    lines = []
    for row in sorted(rows,key=lambda r:r['y']):
        rtl = is_arabic(' '.join(w[2] for w in row['words']))
        ordered = sorted(row['words'],key=lambda w:w[0],reverse=rtl)
        pieces = []
        previous = None
        for x0,x1,text in ordered:
            # PDF encoders sometimes split a disconnected Arabic glyph from its
            # word. Join only boxes with virtually no gap, not ordinary spaces.
            gap = previous[0]-x1 if rtl and previous else x0-previous[1] if previous else 999
            if join_glyphs and pieces and rtl and 0 <= gap < row['height']*0.12 and is_arabic(text) and is_arabic(pieces[-1]):
                pieces[-1] += text
            else:
                pieces.append(text)
            previous = (x0,x1)
        lines.append(' '.join(pieces))
    return '\n'.join(lines)
