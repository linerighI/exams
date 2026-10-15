import fitz, subprocess, sys, json, os
from pathlib import Path
root = Path(__file__).resolve().parent.parent
out = root / 'test-results'
out.mkdir(exist_ok=True)
text = 'الماء أساس الحياة. تدور الأرض حول الشمس. عدد أيام الأسبوع سبعة أيام.'
doc = fitz.open()
page = doc.new_page(width=700, height=400)
page.insert_htmlbox(fitz.Rect(40, 40, 660, 340), '<div dir="rtl" style="font-family:Arabic; font-size:30px">' + text + '</div>', css='@font-face {font-family:Arabic; src:url(tahoma.ttf)}', archive=fitz.Archive('C:/Windows/Fonts'))
path = out / 'arabic-text.pdf'
doc.save(path)
png = page.get_pixmap(matrix=fitz.Matrix(2,2)).tobytes('png')
scanned = fitz.open()
scanned.new_page(width=700,height=400).insert_image(fitz.Rect(0,0,700,400),stream=png)
scanned_path = out / 'arabic-scan.pdf'
scanned.save(scanned_path)
mixed = fitz.open()
mixed.insert_pdf(doc)
mixed.insert_pdf(scanned)
mixed.save(out / 'arabic-mixed.pdf')
doc.save(out / 'encrypted.pdf',encryption=fitz.PDF_ENCRYPT_AES_256,owner_pw='owner',user_pw='secret')
command = [str(root / 'worker' / 'runtime' / 'pdf-worker.exe')] if '--bundled' in sys.argv else [sys.executable, str(root / 'worker' / 'pdf_worker.py')]
env = {**os.environ, 'PYTHONIOENCODING':'utf-8', 'PYTHONUTF8':'1'}
for name in ['arabic-text.pdf','arabic-scan.pdf','arabic-mixed.pdf']:
    result = subprocess.run(command+[str(out/name)],capture_output=True,text=True,encoding='utf-8',env=env,timeout=180)
    assert result.returncode == 0, result.stderr
    pages = json.loads(result.stdout)
    assert all(p['text'].strip() for p in pages), pages
    assert 'الماء' in pages[0]['text'], pages
    assert 'سبعة' in pages[-1]['text'], pages
    assert len(pages)==(2 if 'mixed' in name else 1)
    print(name, 'passed:', pages[0]['text'][:120])
protected = subprocess.run(command+[str(out/'encrypted.pdf')],capture_output=True,text=True,encoding='utf-8',env=env,timeout=30)
assert protected.returncode != 0
print('Encrypted PDF rejected. Arabic text, scanned and mixed extraction passed.')
