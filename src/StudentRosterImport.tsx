import { useRef, useState } from 'react';
import { UploadCloud, CheckCircle2, Loader2, FileSpreadsheet } from 'lucide-react';
import { api, fileBase64 } from './api';
import FocusWindow from './FocusWindow';
import BlueOrb from './BlueOrb';
import { studentRosterPrompt } from './studentRosterExchange';
import './workflow.css';
export default function StudentRosterImport({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: () => Promise<void>;
}) {
  const [file, setFile] = useState<File>(),
    [encoded, setEncoded] = useState(''),
    [preview, setPreview] = useState<any>(),
    [ai, setAi] = useState(false),
    [source, setSource] = useState<'file' | 'gemini' | 'json'>('gemini'),
    [json, setJson] = useState(''),
    [copied, setCopied] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [grade, setGrade] = useState(''),
    [section, setSection] = useState(''),
    [mode, setMode] = useState('skip'),
    [sheet, setSheet] = useState(''),
    [columns, setColumns] = useState<Record<string, number>>(),
    [headerRow, setHeaderRow] = useState(1),
    [done, setDone] = useState<any>();
  const generation = useRef(0);
  const choose = async (f?: File) => {
    const current = ++generation.current;
    setError('');
    setPreview(undefined);
    setDone(undefined);
    setSheet('');
    setColumns(undefined);
    setHeaderRow(1);
    setFile(f);
    setEncoded('');
    if (!f) return;
    if (source === 'json') setJson('');
    if (
      !(source === 'json' ? /\.json$/i : /\.(xlsx|csv)$/i).test(f.name) ||
      f.size > (source === 'json' ? 4_000_000 : 8 * 1024 * 1024)
    ) {
      setError(
        source === 'json'
          ? 'اختر ملف JSON بحجم لا يتجاوز 4 ميغابايت.'
          : 'اختر ملف Excel بصيغة XLSX أو CSV بحجم لا يتجاوز 8 ميغابايت.',
      );
      return;
    }
    try {
      if (source === 'json') {
        const text = await f.text();
        if (current === generation.current) setJson(text);
        return;
      }
      const data = await fileBase64(f);
      if (current === generation.current) setEncoded(data);
    } catch {
      setError('تعذر قراءة الملف');
    }
  };
  const review = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await api('/api/students/roster/preview', 'POST', {
        filename: file?.name,
        source,
        ...(source === 'json' ? { json } : {}),
        ai,
        file: encoded,
        grade,
        section,
        mode,
        ...(sheet ? { sheet } : {}),
        ...(columns ? { columns, headerRow } : {}),
      });
      setPreview(result);
      setColumns(source === 'file' ? result.columns : undefined);
      setSheet(result.sheet);
      setHeaderRow(result.headerRow);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const changed = () => {
    setPreview((old: any) => (old ? { ...old, token: '', requiresReview: true } : undefined));
    setDone(undefined);
  };
  return (
    <FocusWindow
      title="استيراد قائمة المدرسة"
      onClose={() => {
        if (!busy) onClose();
      }}
      wide
    >
      <div className="roster-intro">
        <span className="roster-orb">
          <BlueOrb size={0.7} />
        </span>
        <div>
          <h3>من ملف المدرسة إلى صفوفك</h3>
          <p>
            ارفع الملف، راجع الأعمدة، ثم اعتمد القائمة. الدخول بالرقم الوطني إن وُجد، وإلا يُنشأ رمز
            طالب تلقائيًا.
          </p>
        </div>
      </div>
      {!done ? (
        <>
          <label className="field">
            طريقة إضافة الطلاب
            <select
              aria-label="طريقة استيراد الطلاب"
              value={source}
              disabled={busy}
              onChange={(e) => {
                ++generation.current;
                setSource(e.target.value as typeof source);
                setPreview(undefined);
                setColumns(undefined);
                setFile(undefined);
                setEncoded('');
                setError('');
              }}
            >
              <option value="gemini">1. قراءة الملف كاملًا باستخدام Gemini</option>
              <option value="json">2. طلب للمساعد أو استيراد JSON</option>
              <option value="file">قراءة Excel محليًا وربط الأعمدة</option>
            </select>
          </label>
          {source === 'gemini' && (
            <p className="info-note">
              يقرأ Gemini بيانات جميع أوراق الملف، بما فيها أسماء الطلاب وأرقامهم، عبر الإنترنت
              باستخدام مفتاح Gemini في الإعدادات. اضغط «معاينة القائمة» لإرسالها، ثم راجع النتائج
              قبل الحفظ.
            </p>
          )}
          {source === 'json' && (
            <div className="roster-mapping">
              <p>
                انسخ الطلب إلى Gemini أو مساعدك وأرفق ملف Excel، ثم الصق النتيجة أو ارفع ملف JSON.
              </p>
              <label className="field">
                طلب استخراج الطلاب
                <textarea
                  aria-label="طلب استخراج الطلاب"
                  readOnly
                  rows={7}
                  value={studentRosterPrompt}
                />
              </label>
              <button
                className="secondary"
                disabled={busy}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(studentRosterPrompt);
                    setCopied(true);
                  } catch {
                    setError('حدد نص الطلب وانسخه يدويًا.');
                  }
                }}
              >
                {copied ? 'تم نسخ الطلب' : 'نسخ الطلب'}
              </button>
              <label className="field">
                بيانات الطلاب JSON
                <textarea
                  aria-label="بيانات الطلاب JSON"
                  dir="ltr"
                  rows={8}
                  disabled={busy}
                  value={json}
                  placeholder={'{"students":[{"name":"أحمد علي"}]}'}
                  onChange={(e) => {
                    setJson(e.target.value);
                    changed();
                  }}
                />
              </label>
            </div>
          )}
          <label
            className={`roster-drop ${busy ? 'is-busy' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (!busy) void choose(e.dataTransfer.files[0]);
            }}
          >
            <UploadCloud size={28} />
            <strong>
              {file?.name ||
                (source === 'json'
                  ? 'اختر ملف JSON أو الصق البيانات أعلاه'
                  : 'اسحب ملف Excel هنا أو اختره')}
            </strong>
            <span>{source === 'json' ? 'JSON' : 'Excel (.xlsx) / CSV'} · حتى 3000 طالب</span>
            <input
              aria-label="ملف قائمة الطلاب"
              type="file"
              accept={source === 'json' ? '.json' : '.xlsx,.csv'}
              disabled={busy}
              onChange={(e) => void choose(e.target.files?.[0])}
            />
          </label>
          {source === 'file' && (
            <label className="field">
              <span>
                <input
                  type="checkbox"
                  checked={ai}
                  disabled={busy}
                  onChange={(e) => {
                    setAi(e.target.checked);
                    setColumns(undefined);
                    changed();
                  }}
                />{' '}
                مساعد ذكي للتعرّف على الأعمدة
              </span>
              <small>
                اختياري: يرسل عناوين الأعمدة وإحصاءات أنواع الخلايا فقط إلى مزوّدك المحدد، دون إرسال
                سجلات الطلاب. راجع ربط الأعمدة ثم اعتمد القائمة.
              </small>
            </label>
          )}
          <p>
            اسم الطالب يكفي للإضافة. يمكنك إكمال الصف والشعبة لاحقًا، ويُنشأ رمز دخول تلقائيًا عند
            غياب الرقم الوطني. لحساب المعلم ذي الصفوف المحددة، اختر صفًا مسندًا إليه.
          </p>
          <div className="roster-options">
            <label className="field">
              الصف عند غيابه من الملف
              <input
                aria-label="صف القائمة الافتراضي"
                value={grade}
                disabled={busy}
                onChange={(e) => {
                  setGrade(e.target.value);
                  changed();
                }}
                placeholder="مثال: العاشر"
              />
            </label>
            <label className="field">
              الشعبة الافتراضية
              <input
                aria-label="شعبة القائمة الافتراضية"
                value={section}
                disabled={busy}
                onChange={(e) => {
                  setSection(e.target.value);
                  changed();
                }}
              />
            </label>
            <label className="field">
              الطلاب الموجودون
              <select
                aria-label="معالجة الطلاب الموجودين"
                value={mode}
                disabled={busy}
                onChange={(e) => {
                  setMode(e.target.value);
                  changed();
                }}
              >
                <option value="skip">تخطي دون تغيير</option>
                <option value="update">تحديث البيانات وكلمة الدخول</option>
              </select>
            </label>
          </div>
          {columns && !/\.json$/i.test(file?.name || '') && (
            <details className="roster-mapping">
              <summary>ورقة العمل وربط الأعمدة</summary>
              <div className="roster-options">
                {preview?.sheets?.length > 1 && (
                  <label className="field">
                    ورقة العمل
                    <select
                      aria-label="ورقة قائمة الطلاب"
                      disabled={busy}
                      value={sheet}
                      onChange={(e) => {
                        setSheet(e.target.value);
                        setColumns(undefined);
                        changed();
                      }}
                    >
                      {preview.sheets.map((s: string) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="field">
                  صف العناوين
                  <input
                    type="number"
                    min={1}
                    max={20}
                    disabled={busy}
                    value={headerRow}
                    onChange={(e) => {
                      setHeaderRow(+e.target.value);
                      changed();
                    }}
                  />
                </label>
                {Object.entries({
                  name: 'اسم الطالب',
                  national: 'الرقم الوطني',
                  id: 'رقم الطالب (اختياري)',
                  grade: 'الصف',
                  section: 'الشعبة',
                }).map(([key, label]) => (
                  <label className="field" key={key}>
                    {label}
                    <select
                      aria-label={`عمود ${label}`}
                      disabled={busy}
                      value={columns[key] ?? -1}
                      onChange={(e) => {
                        setColumns({ ...columns, [key]: +e.target.value });
                        changed();
                      }}
                    >
                      <option value={-1}>غير موجود</option>
                      {(preview?.labels || []).map((l: string, i: number) => (
                        <option key={i} value={i}>
                          {l || `عمود ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </details>
          )}
          <div className="button-row">
            <button
              className="secondary"
              disabled={(source === 'json' ? !json.trim() : !encoded) || busy}
              onClick={() => void review()}
            >
              {busy ? <Loader2 size={17} className="spin" /> : <FileSpreadsheet size={17} />}معاينة
              القائمة
            </button>
            <small>
              راجع الأسماء والبيانات المتاحة قبل اعتماد القائمة؛ لا تُحفظ بيانات أثناء المعاينة.
            </small>
          </div>
          {preview && (
            <div className="roster-review">
              {preview.aiMapped && (
                <p className="info-note" role="status">
                  اقترح المساعد ربط الأعمدة. راجع الربط والأسماء أدناه قبل الاعتماد.
                </p>
              )}
              {preview.requiresReview && (
                <p role="status">تغيرت خيارات الاستيراد؛ اضغط «معاينة القائمة» قبل الاعتماد.</p>
              )}
              <div className="roster-totals">
                <b>{preview.added} طالب جديد</b>
                <span>{preview.existing} طالب موجود</span>
                <span>{preview.issues.length} ملاحظة</span>
              </div>
              {preview.warnings?.length > 0 && (
                <div className="info-note" role="status">
                  {preview.warnings.slice(0, 15).map((warning: any) => (
                    <p key={`${warning.row}-${warning.message}`}>
                      الصف {warning.row}: {warning.message}
                    </p>
                  ))}
                  <small>يمكن اعتماد الطلاب بالبيانات المتاحة.</small>
                </div>
              )}
              {preview.issues.length > 0 ? (
                <div role="alert" className="form-error">
                  {preview.issues.slice(0, 15).map((i: any) => (
                    <p key={`${i.row}-${i.message}`}>
                      الصف {i.row}: {i.message}
                    </p>
                  ))}
                  <small>صحح الملف ثم أعد رفعه؛ لم تُحفظ أي تغييرات.</small>
                </div>
              ) : null}
              <div className="roster-table">
                <table>
                  <thead>
                    <tr>
                      <th>الطالب</th>
                      <th>الصف</th>
                      <th>الشعبة</th>
                      <th>الرقم الوطني</th>
                      <th>الإجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 100).map((s: any) => (
                      <tr key={s.id}>
                        <td>{s.name}</td>
                        <td>{s.grade || 'غير محدد'}</td>
                        <td>{s.section || 'غير محددة'}</td>
                        <td dir="ltr">{s.national}</td>
                        <td>{s.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.rows.length > 100 && <small>معاينة أول 100 من {preview.count} طالب.</small>}
              <button
                className="primary"
                disabled={busy || !preview.token || preview.issues.length > 0 || !preview.count}
                onClick={async () => {
                  setBusy(true);
                  setError('');
                  try {
                    const result = await api('/api/students/roster/commit', 'POST', {
                      token: preview.token,
                    });
                    setDone(result);
                    setPreview(undefined);
                    setEncoded('');
                    setFile(undefined);
                    await onImported();
                  } catch (e) {
                    setError((e as Error).message);
                    setPreview(undefined);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? <Loader2 size={17} className="spin" /> : <CheckCircle2 size={17} />}اعتماد
                القائمة
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="roster-complete">
          <CheckCircle2 size={42} />
          <h3>قائمتك جاهزة</h3>
          <p>
            حُفظ {done.count} طالب · تم تخطي {done.skipped}. تستخدم الحسابات المضافة أو المحدثة
            الرقم الوطني إن وُجد أو رمز الطالب من قائمة الطلاب؛ الحسابات المتخطاة لم تتغير.
          </p>
          <button className="primary" onClick={onClose}>
            عرض الطلاب والصفوف
          </button>
        </div>
      )}
      {busy && (
        <p role="status">
          {source === 'gemini'
            ? 'جارٍ قراءة جميع أوراق الملف عبر Gemini… قد تستغرق القوائم الكبيرة عدة دقائق.'
            : 'جارٍ التحضير…'}
        </p>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </FocusWindow>
  );
}
