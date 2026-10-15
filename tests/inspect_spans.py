import fitz,sys,json
with fitz.open(sys.argv[1]) as doc:
    for block in doc[7].get_text('dict')['blocks']:
        for line in block.get('lines',[]):
            spans = line['spans']
            if any('x' in s['text'] for s in spans):
                print(json.dumps([{ 't':s['text'],'flags':s['flags'],'size':s['size'],'bbox':s['bbox']} for s in spans],ensure_ascii=False))
