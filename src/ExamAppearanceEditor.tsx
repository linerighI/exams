import { motion, LayoutGroup } from 'motion/react';
import { useId } from 'react';
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
  const patch = (p: Partial<ExamAppearance>) => onChange({ ...a, ...p });
  return (
    <details className="exam-personalization">
      <summary>
        <Palette size={19} />
        مظهر امتحان الطالب <span>ألوان وخط ورسالة ترحيب</span>
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
                onClick={() => patch({accent:p.accent,background:p.background})}
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
          layout
          className={`appearance-preview ${a.cardStyle}`}
          style={{ background: a.background, color: '#203650' }}
        >
          <span style={{ background: a.accent, color: 'white' }}>الامتحان · معاينة الطالب</span>
          <h3>مرحبًا، مستعد للبدء؟</h3>
          <p>{a.welcome}</p>
          <div style={{ fontSize: a.fontSize === 'large' ? 21 : 16 }}>
            <b>السؤال ١</b>
            <p>ما ناتج جمع ٢ و٣؟</p>
            {['٣', '٥', '٧'].map((n, i) => (
              <div
                key={n}
                className="preview-answer"
                style={{
                  borderColor: i === 1 ? a.accent : '#dce5eb',
                  color: i === 1 ? a.accent : '#203650',
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
