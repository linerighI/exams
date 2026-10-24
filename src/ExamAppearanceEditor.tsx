import { gsap } from './animato';
import { useQuietMotion } from './appMotion';
import { motion, LayoutGroup } from 'motion/react';
import { useId, useRef, useLayoutEffect, useState } from 'react';
import { fileBase64 } from './api';
import ExamImage from './ExamImage';
import { Palette } from 'lucide-react';
import {
  defaultAppearance,
  examPalettes,
  appearanceReadable,
  type ExamAppearance,
} from './examAppearance';
import './personalization.css';
export default function ExamAppearanceEditor({
  value,
  onChange,
}: {
  value?: ExamAppearance;
  onChange: (value: ExamAppearance) => void;
}) {
  const a = { ...defaultAppearance, ...value },
    id = useId();
  const quiet = useQuietMotion();
  const [imageError, setImageError] = useState('');
  const preview = useRef<HTMLDivElement>(null),
    first = useRef(true);
  useLayoutEffect(() => {
    const root = preview.current;
    if (!root) return;
    const time = first.current || quiet ? 0 : 0.38;
    first.current = false;
    const header = root.querySelector('[data-preview-accent]'),
      question = root.querySelector('.appearance-question'),
      selected = root.querySelector('[data-preview-selected="true"]');
    gsap.to(root, {
      backgroundColor: a.background,
      duration: time,
      ease: 'power2.out',
      overwrite: true,
    });
    if (header) gsap.to(header, { backgroundColor: a.accent, duration: time, overwrite: true });
    if (selected)
      gsap.to(selected, {
        borderColor: a.accent,
        color: a.accent,
        duration: time,
        overwrite: true,
      });
    if (question)
      gsap.to(question, {
        fontSize: a.fontSize === 'large' ? 21 : 16,
        duration: time,
        ease: 'power2.out',
        overwrite: true,
      });
    return () => {
      gsap.killTweensOf([root, header, question, selected].filter(Boolean));
    };
  }, [a.accent, a.background, a.fontSize, quiet]);
  const patch = (p: Partial<ExamAppearance>) => onChange({ ...a, ...p });
  return (
    <details className="exam-personalization">
      <summary>
        <Palette size={19} />
        مظهر امتحان الطالب <span>ألوان وخط وصورة مرجعية</span>
      </summary>
      <div className="appearance-editor">
        <div>
          <h3>مريح وواضح لطلابك</h3>
          <LayoutGroup id={id}>
            <div className="appearance-palettes">
              {examPalettes.map((p) => (
                <button
                  type="button"
                  key={p.name}
                  aria-pressed={a.accent === p.accent && a.background === p.background}
                  onClick={() => patch({ accent: p.accent, background: p.background })}
                  style={{ color: p.accent, background: p.background }}
                >
                  {a.accent === p.accent && a.background === p.background && (
                    <motion.span
                      className="palette-selection"
                      layoutId="selected-palette"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </LayoutGroup>
          <div className="appearance-colors">
            <label>
              لون الهوية
              <input
                aria-label="لون هوية الامتحان"
                type="color"
                value={a.accent}
                onChange={(e) => patch({ accent: e.target.value })}
              />
            </label>
            <label>
              خلفية مريحة
              <input
                aria-label="خلفية الامتحان"
                type="color"
                value={a.background}
                onChange={(e) => patch({ background: e.target.value })}
              />
            </label>
            <label>
              حجم الخط
              <select
                value={a.fontSize}
                onChange={(e) => patch({ fontSize: e.target.value as ExamAppearance['fontSize'] })}
              >
                <option value="normal">عادي</option>
                <option value="large">كبير وواضح</option>
              </select>
            </label>
            <label>
              شكل البطاقات
              <select
                value={a.cardStyle}
                onChange={(e) =>
                  patch({ cardStyle: e.target.value as ExamAppearance['cardStyle'] })
                }
              >
                <option value="soft">ناعم</option>
                <option value="outlined">بحدود واضحة</option>
              </select>
            </label>
          </div>
          <label>
            رسالة ترحيب قصيرة
            <input
              maxLength={220}
              value={a.welcome}
              onChange={(e) => patch({ welcome: e.target.value })}
            />
          </label>
          <section className="exam-image-upload">
            <label>
              صورة مرجعية للامتحان كله
              <input
                aria-label="إرفاق صورة للامتحان"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  setImageError('');
                  if (
                    !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
                    file.size > 2 * 1024 * 1024
                  ) {
                    setImageError('اختر PNG أو JPG أو WebP حتى 2 ميغابايت.');
                    return;
                  }
                  try {
                    const data = await fileBase64(file);
                    await new Promise<void>((resolve, reject) => {
                      const image = new Image();
                      image.onload = () =>
                        image.width * image.height <= 24000000
                          ? resolve()
                          : reject(Error('اختر صورة أصغر من 24 مليون بكسل.'));
                      image.onerror = () => reject(Error('تعذر قراءة الصورة.'));
                      image.src = data;
                    });
                    patch({ referenceImage: data });
                  } catch (error) {
                    setImageError((error as Error).message);
                  }
                }}
              />
            </label>
            <small>
              تظهر لجميع الطلاب طوال الامتحان، ويمكنهم فتحها وتكبيرها دون مغادرة الامتحان.
            </small>
            {imageError && (
              <p role="alert" className="error-note">
                {imageError}
              </p>
            )}
            {a.referenceImage && (
              <>
                <ExamImage
                  src={a.referenceImage}
                  label={a.imageCaption || 'الصورة المرجعية للامتحان'}
                />
                <label>
                  عنوان الصورة
                  <input
                    maxLength={120}
                    value={a.imageCaption || ''}
                    onChange={(e) => patch({ imageCaption: e.target.value })}
                  />
                </label>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => patch({ referenceImage: undefined, imageCaption: undefined })}
                >
                  إزالة الصورة
                </button>
              </>
            )}
          </section>
          {!appearanceReadable(a) && (
            <p className="error-note" role="alert">
              الألوان منخفضة التباين. اختر هوية أغمق وخلفية أفتح أو استخدم إحدى اللوحات الجاهزة.
            </p>
          )}
          <button type="button" className="text-button" onClick={() => onChange(defaultAppearance)}>
            إعادة المظهر الافتراضي
          </button>
        </div>
        <motion.div
          ref={preview}
          layout
          className={`appearance-preview ${a.cardStyle}`}
          style={{ color: '#203650' }}
        >
          <span data-preview-accent style={{ color: 'white' }}>
            الامتحان · معاينة الطالب
          </span>
          <h3>مرحبًا، مستعد للبدء؟</h3>
          <p>{a.welcome}</p>
          <div className="appearance-question">
            <b>السؤال ١</b>
            <p>ما ناتج جمع ٢ و٣؟</p>
            {['٣', '٥', '٧'].map((n, i) => (
              <div
                key={n}
                className="preview-answer"
                data-preview-selected={i === 1}
                style={{
                  ...(i === 1 ? {} : { borderColor: '#dce5eb', color: '#203650' }),
                }}
              >
                {n}
              </div>
            ))}
          </div>
          <small>الوقت والحفظ وأدوات المراجعة تبقى واضحة دائمًا.</small>
        </motion.div>
      </div>
    </details>
  );
}
