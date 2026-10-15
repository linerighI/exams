import json, os, sys
import fitz
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'worker'))
from arabic_text import reading_order
path = sys.argv[1]
os.makedirs('.data', exist_ok=True)
with fitz.open(path) as doc:
    pages = [{'page': i+1, 'text': reading_order([tuple(w[:5]) for w in p.get_text('words')]), 'images': []} for i,p in enumerate(doc)]
    print('Pages:', len(pages), 'Text characters:', sum(len(p['text']) for p in pages))
    for n in [8, 9, 10, 12, 20]:
        print('PAGE', n, 'CHARS', len(pages[n-1]['text']), '\n', pages[n-1]['text'][:1800])
    doc[7].get_pixmap(matrix=fitz.Matrix(1,1)).save('.data/math-page-8.png')
with open('.data/math-text-source.json', 'w', encoding='utf-8') as f:
    json.dump({'id':'math-source', 'name':os.path.basename(path), 'pages':pages}, f, ensure_ascii=False)
