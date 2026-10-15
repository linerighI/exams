"""Offline PDF text/image extraction. stdout is strictly JSON; diagnostics on stderr."""
import sys, json, base64, contextlib, os
os.environ['NO_ALBUMENTATIONS_UPDATE'] = '1'
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')
import fitz
from offline_models import ascii_models
from arabic_text import reading_order
from math_text import math_lines

def extract(path):
    pages = []
    ocr = None
    with fitz.open(path) as doc:
        if doc.is_encrypted:
            raise ValueError('الملف محمي بكلمة مرور')
        if len(doc) > 500:
            raise ValueError('الحد الأقصى 500 صفحة')
        for number, page in enumerate(doc, 1):
            text = reading_order([tuple(word[:5]) for word in page.get_text('words')])
            formulas = math_lines(page)
            if formulas:
                text += '\nالمعادلات المستخرجة من الصفحة (الأسس بصيغة ^):\n' + '\n'.join(formulas)
            images = []
            for item in page.get_images(full=True)[:8]:
                pix = fitz.Pixmap(doc, item[0])
                if pix.width < 80 or pix.height < 80:
                    continue
                if pix.n > 3:
                    pix = fitz.Pixmap(fitz.csRGB, pix)
                scale = min(1, 1200 / max(pix.width, pix.height))
                if scale < 1:
                    pix = fitz.Pixmap(pix, int(pix.width * scale), int(pix.height * scale))
                data = pix.tobytes('png')
                if len(data) < 1500000:
                    images.append('data:image/png;base64,' + base64.b64encode(data).decode())
            if len(text) < 30:
                with contextlib.redirect_stdout(sys.stderr):
                    from paddleocr import PaddleOCR
                    import numpy as np
                    if ocr is None:
                        root = os.path.join(os.path.dirname(sys.executable), 'models') if getattr(sys, 'frozen', False) else os.path.join(os.path.dirname(__file__), 'runtime', 'models')
                        root = ascii_models(root)
                        det = os.path.join(root, 'det')
                        rec = os.path.join(root, 'ar')
                        cls = os.path.join(root, 'cls')
                        if any(not os.path.isfile(os.path.join(directory,'inference.pdmodel')) for directory in [det, rec, cls]):
                            raise ValueError('نماذج OCR غير موجودة. شغّل إعداد أدوات القراءة أولًا')
                        ocr = PaddleOCR(lang='ar', det_model_dir=det, rec_model_dir=rec, cls_model_dir=cls, use_angle_cls=False, use_gpu=False, show_log=False)
                        # The Arabic model emits logical characters; the v2 decoder's
                        # extra visual reversal breaks Arabic when shown in an RTL UI.
                        ocr.text_recognizer.postprocess_op.reverse = False
                    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
                    result = ocr.ocr(np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n), cls=False)
                    boxes = []
                    for group in result:
                        if group:
                            for box, prediction in group:
                                boxes.append((min(p[0] for p in box), min(p[1] for p in box), max(p[0] for p in box), max(p[1] for p in box), prediction[0]))
                    text = reading_order(boxes, join_glyphs=False)
            pages.append({'page': number, 'text': text, 'images': images})
    return pages

if __name__ == '__main__':
    try:
        if len(sys.argv) > 2 and sys.argv[2] == 'visual':
            with fitz.open(sys.argv[1]) as doc:
                start = int(sys.argv[3])
                end = min(int(sys.argv[4]), len(doc))
                output = []
                for index in range(start - 1, end):
                    page = doc[index]
                    rect = page.rect
                    if len(sys.argv) > 5:
                        box = json.loads(sys.argv[5])
                        rect = fitz.Rect(box[0]*rect.width, box[1]*rect.height, box[2]*rect.width, box[3]*rect.height)
                    pix = page.get_pixmap(matrix=fitz.Matrix(1.6,1.6), clip=rect, alpha=False)
                    output.append({'page':index+1,'image':base64.b64encode(pix.tobytes('png')).decode(),'text':page.get_text()})
                print(json.dumps({'count':len(doc),'pages':output}, ensure_ascii=False))
        else:
            print(json.dumps(extract(sys.argv[1]), ensure_ascii=False))
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
