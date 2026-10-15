"""Recover horizontal math spans without reversing them with Arabic captions."""
import re, unicodedata

def math_lines(page):
    rows = []
    for block in page.get_text('dict')['blocks']:
        for line in block.get('lines', []):
            for span in line['spans']:
                text = unicodedata.normalize('NFKC', span['text']).strip('\t')
                if not text.strip() or re.search(r'[\u0600-\u06ff]', text):
                    continue
                x0,y0,x1,y1 = span['bbox']
                row = next((r for r in rows if abs(r['y']-y0) < 4), None)
                if row is None:
                    row = {'y':y0, 'spans':[]}
                    rows.append(row)
                row['spans'].append((x0,x1,y1,span['size'],text))
    result = []
    for row in sorted(rows,key=lambda r:r['y']):
        spans=sorted(row['spans'],key=lambda s:s[0])
        size=max(s[3] for s in spans)
        bottom=max(s[2] for s in spans)
        parts=[]
        previous=None
        for x0,x1,y1,font,text in spans:
            if previous is not None and x0-previous > size*1.5:
                parts.append(' ; ')
            is_power=bool(re.fullmatch(r'[0-9+-]+',text.strip()) and font < size*.8 and y1 < bottom-2 and parts)
            parts.append(('^' if is_power else '')+text)
            previous=x1
        text=''.join(parts).strip()
        text=re.sub(r'^\d+\s+(?=[a-zA-Z])','',text)
        if re.search(r'[a-zA-Z]',text) and re.search(r'[=+×÷√∛]',text) and text not in result:
            result.append(text)
    return result
