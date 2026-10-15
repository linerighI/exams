import sys
from pathlib import Path
from PyInstaller.utils.hooks import collect_all
sys.setrecursionlimit(10000)
root = Path(SPECPATH).parent
datas, binaries, hiddenimports = [], [], []
for package in ['paddleocr', 'paddle', 'pyclipper']:
    d, b, h = collect_all(package, filter_submodules=lambda name: not name.startswith('paddle.jit.sot'))
    datas += d
    binaries += b
    hiddenimports += h
a = Analysis([str(root / 'worker' / 'pdf_worker.py')], pathex=[str(root / 'worker')], binaries=binaries, datas=datas, hiddenimports=hiddenimports, excludes=['paddle.jit.sot', 'torch', 'tensorflow', 'matplotlib'], noarchive=False)
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, [], exclude_binaries=True, name='pdf-worker', debug=False, bootloader_ignore_signals=False, strip=False, upx=False, console=True)
coll = COLLECT(exe, a.binaries, a.datas, strip=False, upx=False, name='pdf-worker')
