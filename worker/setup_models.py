import os, sys
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')
from paddleocr import PaddleOCR
import shutil
from offline_models import ascii_models
root = os.path.join(os.path.dirname(__file__), 'runtime', 'models')
os.makedirs(root, exist_ok=True)
cache = ascii_models(root)
PaddleOCR(lang='ar', det_model_dir=os.path.join(cache,'det'), rec_model_dir=os.path.join(cache,'ar'), cls_model_dir=os.path.join(cache,'cls'), use_angle_cls=False, use_gpu=False, show_log=False)
if cache != root:
    shutil.copytree(cache, root, dirs_exist_ok=True)
print('نماذج قراءة العربية جاهزة')
