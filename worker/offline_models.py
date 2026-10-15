import os, tempfile, shutil, hashlib

def ascii_models(root):
    """Paddle's Windows native loader needs an ASCII model pathname."""
    if root.isascii():
        return root
    base = tempfile.gettempdir()
    if not base.isascii() and os.name == 'nt':
        import ctypes
        buffer = ctypes.create_unicode_buffer(32768)
        if ctypes.windll.kernel32.GetShortPathNameW(base, buffer, len(buffer)):
            base = buffer.value
    if not base.isascii():
        raise ValueError('تعذر فتح نماذج OCR. ثبّت التطبيق في مسار إنجليزي مثل C:\\Program Files\\Alshereqi Exams')
    cache = os.path.join(base, 'alshereqi-ocr-' + hashlib.sha256(root.encode()).hexdigest()[:12])
    os.makedirs(cache, exist_ok=True)
    if os.path.isdir(root):
        shutil.copytree(root, cache, dirs_exist_ok=True)
    return cache
