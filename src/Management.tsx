import { useEffect, useState } from 'react';
import {
  Plus,
  Upload,
  Download,
  Search,
  Copy,
  School,
  Sparkles,
  Wifi,
  Monitor,
  ShieldCheck,
  Activity,
  Loader2,
} from 'lucide-react';
import { api, download } from './api';
import { csvCell } from './csv';
import TeacherAccounts from './TeacherAccounts';
import type { Student, Exam, Settings as Config } from './types';
export function StudentsView({
  students,
  exams,
  notify,
  act,
  onStudentLogin,
}: {
  students: Student[];
  exams: Exam[];
  notify: (m: string) => void;
  act: (fn: () => Promise<any>, m?: string) => Promise<void>;
  onStudentLogin: (student: Student) => Promise<void>;
}) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ id: '', name: '', grade: '', section: '' });
  const [query, setQuery] = useState('');
  const [exemptExam, setExemptExam] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [enteringStudent, setEnteringStudent] = useState(false);
  const escape = csvCell;
  const csv =
    '\ufeff' +
    [
      ['رقم الطالب', 'الاسم', 'الصف', 'الشعبة', 'رمز الدخول'],
      ...students.map((s) => [s.id, s.name, s.grade, s.section, s.code]),
    ]
      .map((r) => r.map(escape).join(','))
      .join('\r\n');
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">مجتمع المدرسة</span>
          <h1>الطلاب والصفوف</h1>
          <p>أضف طلابك، ونظم صفوفك، ووزع رموز الدخول الخاصة بهم.</p>
        </div>
        <div className="button-row">
          <label className="secondary file-button">
            <Upload size={17} /> استيراد CSV
            <input
              type="file"
              accept=".csv"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file)
                  await act(async () => {
                    const result = await api('/api/students/import', 'POST', {
                      csv: await file.text(),
                    });
                    notify(`تم استيراد ${result.count} طالب`);
                  });
                e.target.value = '';
              }}
            />
          </label>
          <button className="primary" onClick={() => setShow(!show)}>
            <Plus size={17} /> إضافة طالب
          </button>
        </div>
      </div>
      {show && (
        <form
          className="card student-form"
          onSubmit={(e) => {
            e.preventDefault();
            void act(async () => {
              await api('/api/students', 'POST', form);
              setForm({ id: '', name: '', grade: '', section: '' });
              setShow(false);
            }, 'تمت إضافة الطالب');
          }}
        >
          {[
            ['id', 'رقم الطالب'],
            ['name', 'اسم الطالب'],
            ['grade', 'الصف'],
            ['section', 'الشعبة'],
          ].map(([key, label]) => (
            <label className="field" key={key}>
              {label}
              <input
                required
                value={(form as any)[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </label>
          ))}
          <button className="primary">حفظ الطالب</button>
        </form>
      )}
      {students.length > 0 && (
        <div className="toolbar card">
          <label className="field" style={{ flex: 1, margin: 0 }}>
            اختيار طالب لتجربة الدخول
            <select
              aria-label="اختيار طالب لتجربة الدخول"
              value={selectedStudent}
              onChange={(e) => setSelectedStudent(e.target.value)}
            >
              <option value="">اختر الطالب…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.id} · الصف {s.grade} / {s.section}
                </option>
              ))}
            </select>
          </label>
          <button
            className="primary"
            disabled={!selectedStudent || enteringStudent}
            onClick={() => {
              const student = students.find((s) => s.id === selectedStudent);
              if (student) {
                setEnteringStudent(true);
                void onStudentLogin(student)
                  .catch((e) => notify(e.message))
                  .finally(() => setEnteringStudent(false));
              }
            }}
          >
            {enteringStudent ? <Loader2 className="spin" size={17} /> : <Monitor size={17} />}دخول
            بصفة الطالب
          </button>
          <small className="muted">للمعلم: افتح لوحة الطالب للتجربة دون نسخ رمزه.</small>
        </div>
      )}
      <div className="toolbar card">
        <label className="search-box">
          <Search size={18} />
          <input
            placeholder="ابحث بالاسم أو الرقم أو الصف"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button
          className="secondary"
          onClick={() =>
            window.desktop ? void window.desktop.exportCSV(csv) : download('students.csv', csv)
          }
        >
          <Download size={17} /> تصدير الرموز
        </button>
        <button
          className="text-button"
          onClick={() =>
            download(
              'students-template.csv',
              '\ufeffرقم الطالب,الاسم,الصف,الشعبة\r\n1001,طالب تجريبي,السابع,أ',
            )
          }
        >
          نموذج الاستيراد
        </button>
      </div>
      <div className="info-note">
        طابق اسم الصف والشعبة مع الامتحان. رموز الدخول شخصية ولا تُشارك مع الآخرين.
      </div>
      {students.length ? (
        <div className="card table-card">
          <table>
            <thead>
              <tr>
                <th>الطالب</th>
                <th>الصف</th>
                <th>الشعبة</th>
                <th>رمز الدخول</th>
                <th>استثناء الكاميرا</th>
              </tr>
            </thead>
            <tbody>
              {students
                .filter((s) => `${s.name} ${s.id} ${s.grade}`.includes(query))
                .map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div className="table-person">
                        <span className="avatar small">{s.name[0]}</span>
                        <div>
                          <strong>{s.name}</strong>
                          <small>{s.id}</small>
                        </div>
                      </div>
                    </td>
                    <td>{s.grade}</td>
                    <td>{s.section}</td>
                    <td>
                      <span className="student-code" dir="ltr">
                        {s.code}
                      </span>
                      <button
                        className="copy-button"
                        title="نسخ رمز الطالب"
                        onClick={() => {
                          void navigator.clipboard.writeText(s.code);
                          notify('تم نسخ الرمز');
                        }}
                      >
                        <Copy size={15} />
                      </button>
                    </td>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => {
                          if (!exemptExam) return notify('اختر الامتحان من القائمة أدناه');
                          void act(
                            () =>
                              api('/api/camera/exempt', 'POST', {
                                examId: exemptExam,
                                studentId: s.id,
                              }),
                            'تم تسجيل الاستثناء',
                          );
                        }}
                      >
                        منح استثناء
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          <div className="table-bottom">
            <label className="field">
              الامتحان الخاص باستثناء الكاميرا
              <select value={exemptExam} onChange={(e) => setExemptExam(e.target.value)}>
                <option value="">اختر امتحانًا</option>
                {exams
                  .filter((e) => e.cameraRequired)
                  .map((e) => (
                    <option value={e.id} key={e.id}>
                      {e.title}
                    </option>
                  ))}
              </select>
            </label>
          </div>
        </div>
      ) : (
        <div className="empty card">
          <h3>طلابك ينتظرون دعوتك</h3>
          <p>ابدأ بإضافة طالب أو استيراد قائمة الصف من CSV.</p>
        </div>
      )}
    </>
  );
}
export function SettingsView({
  hostInfo,
  notify,
  onSchool,
  onRestore,
}: {
  hostInfo: any;
  notify: (m: string) => void;
  onSchool: (s: string) => void;
  onRestore: () => void;
}) {
  const [config, setConfig] = useState<Config>();
  const [ram, setRam] = useState(0);
  const [model, setModel] = useState<any>();
  const [busy, setBusy] = useState(false);
  const [benchmark, setBenchmark] = useState<any>();
  const [apiKey, setApiKey] = useState('');
  const load = async () => {
    try {
      const data = await api('/api/settings');
      const status = await api('/api/model');
      setConfig({ ...data, model: status.model });
      setRam(data.ramGB);
      setModel(status);
    } catch (e) {
      notify((e as Error).message);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const run = async (fn: () => Promise<any>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const saveConfig = async () => {
    const saved = await api('/api/settings', 'PUT', {
      ...config,
      ...(apiKey ? { geminiKey: apiKey } : {}),
    });
    setApiKey('');
    setConfig(saved);
    return saved;
  };
  if (!config)
    return (
      <div className="empty">
        <Loader2 className="spin" />
      </div>
    );
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">مدرستك، إعداداتك</span>
          <h1>الإعدادات والاتصال</h1>
          <p>اضبط المدرسة والنموذج المحلي واتصال أجهزة المختبر.</p>
        </div>
        <span className="pill blue">
          <Monitor size={16} /> ذاكرة الجهاز {ram} GB
        </span>
      </div>
      <div className="settings-grid">
        <TeacherAccounts notify={notify} />
        <section className="card">
          <div className="section-heading">
            <School size={23} />
            <h2>بيانات المدرسة</h2>
          </div>
          <label className="field">
            اسم المدرسة
            <input
              value={config.school}
              onChange={(e) => setConfig({ ...config, school: e.target.value })}
            />
          </label>
          <label className="field">
            حذف صور الطلاب بعد عدد أيام
            <input
              type="number"
              min={1}
              max={3650}
              value={config.retentionDays}
              onChange={(e) => setConfig({ ...config, retentionDays: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            مسار Python لبيئة التطوير
            <input
              dir="ltr"
              placeholder="python.exe — اختياري مع الأداة المضمنة"
              value={config.pythonPath}
              onChange={(e) => setConfig({ ...config, pythonPath: e.target.value })}
            />
          </label>
          <button
            className="primary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await saveConfig();
                onSchool(config.school);
                notify('حُفظت الإعدادات');
              })
            }
          >
            حفظ الإعدادات
          </button>
        </section>
        <section className="card">
          <div className="section-heading">
            <Sparkles size={24} />
            <h2>
              {config.aiProvider === 'gemini'
                ? 'الذكاء الاصطناعي — Gemini'
                : 'الذكاء الاصطناعي المحلي'}
            </h2>
            <span
              className={`pill ${(config.aiProvider === 'gemini' ? config.hasGeminiKey : model?.available && model.models.includes(config.model)) ? 'green' : 'amber'}`}
            >
              {config.aiProvider === 'gemini'
                ? config.hasGeminiKey
                  ? 'المفتاح محفوظ'
                  : 'أدخل مفتاح API'
                : model?.available
                  ? model.models.includes(config.model)
                    ? 'النموذج جاهز'
                    : 'النموذج غير مثبت'
                  : 'Ollama غير متصل'}
            </span>
          </div>
          <div className="segmented provider-toggle">
            <button
              disabled={busy}
              className={config.aiProvider !== 'gemini' ? 'selected' : ''}
              onClick={() => {
                setConfig({ ...config, aiProvider: 'ollama' });
                setBenchmark(undefined);
              }}
            >
              محلي — Ollama
            </button>
            <button
              disabled={busy}
              className={config.aiProvider === 'gemini' ? 'selected' : ''}
              onClick={() => {
                setConfig({ ...config, aiProvider: 'gemini' });
                setBenchmark(undefined);
              }}
            >
              API — Google Gemini
            </button>
          </div>
          {config.aiProvider === 'gemini' ? (
            <>
              <p className="muted">
                يحتاج جهاز المعلم إلى الإنترنت. يُرسل نص الصفحات الدراسية المحددة إلى Google؛ تبقى
                حسابات الطلاب وإجابات الامتحانات داخل LAN.
              </p>
              <label className="field">
                مفتاح Gemini API
                <input
                  type="password"
                  autoComplete="new-password"
                  dir="ltr"
                  value={apiKey}
                  placeholder={
                    config.hasGeminiKey
                      ? 'مفتاح محفوظ — اترك الحقل فارغًا للاحتفاظ به'
                      : 'أدخل مفتاحك هنا'
                  }
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </label>
              <label className="field">
                نموذج Gemini
                <input
                  dir="ltr"
                  value={config.geminiModel || 'gemini-3.8-flash'}
                  onChange={(e) => setConfig({ ...config, geminiModel: e.target.value })}
                />
              </label>
              <div className="button-row">
                <button
                  className="primary"
                  disabled={busy || (!apiKey && !config.hasGeminiKey)}
                  onClick={() =>
                    void run(async () => {
                      await saveConfig();
                      setBenchmark(await api('/api/model/benchmark', 'POST'));
                    })
                  }
                >
                  {busy ? <Loader2 className="spin" size={17} /> : <Activity size={17} />} اختبار
                  Gemini
                </button>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await saveConfig();
                      notify('حُفظ وضع Gemini وإعداداته');
                    })
                  }
                >
                  حفظ إعدادات الذكاء الاصطناعي
                </button>
                {config.hasGeminiKey && (
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const saved = await api('/api/settings', 'PUT', {
                          ...config,
                          clearGeminiKey: true,
                        });
                        setConfig(saved);
                        setApiKey('');
                        notify('حُذف مفتاح Gemini');
                      })
                    }
                  >
                    حذف المفتاح
                  </button>
                )}
              </div>
              <p className="tiny muted">
                المفتاح محمي على جهاز المعلم ولا يظهر لأجهزة الطلاب أو في النسخ الاحتياطية. أنشئه من
                Google AI Studio.
              </p>
            </>
          ) : (
            <>
              <p className="muted">
                ثبّت Ollama على جهاز المعلم، ثم نزّل النموذج مرة واحدة. التوليد اللاحق يعمل دون
                إنترنت.
              </p>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={config.localSpeed !== 'manual'}
                  onChange={(e) =>
                    setConfig({ ...config, localSpeed: e.target.checked ? 'fast' : 'manual' })
                  }
                />{' '}
                تفضيل النموذج الأسرع Qwen 1.7B عند توفره
              </label>
              <label className="field">
                النموذج
                <select
                  value={config.model}
                  disabled={busy}
                  onChange={(e) => {
                    setConfig({ ...config, model: e.target.value, localSpeed: 'manual' });
                    setBenchmark(undefined);
                  }}
                >
                  {[
                    ...new Set<string>([
                      ...(model?.models || []),
                      config.model,
                      'qwen3:1.7b',
                      'qwen3:4b',
                    ]),
                  ].map((name) => (
                    <option key={name} value={name}>
                      {name} — {model?.models?.includes(name) ? 'مثبت على جهازك' : 'يحتاج تنزيلًا'}
                    </option>
                  ))}
                </select>
              </label>
              <div className="button-row">
                {!model?.available && (
                  <button
                    className="secondary"
                    disabled={!window.desktop}
                    onClick={() => void run(() => window.desktop!.openOllama())}
                  >
                    <Download size={17} /> تنزيل برنامج Ollama
                  </button>
                )}
                <button
                  className="secondary"
                  disabled={busy || !window.desktop}
                  onClick={() =>
                    void run(async () => {
                      await saveConfig();
                      await window.desktop!.downloadModel(config.model);
                      notify('اكتمل تنزيل النموذج');
                      await load();
                    })
                  }
                >
                  <Download size={17} /> تنزيل النموذج
                </button>
                <button
                  className="primary"
                  disabled={busy || !model?.available || !model.models.includes(config.model)}
                  onClick={() =>
                    void run(async () => {
                      await saveConfig();
                      setBenchmark(await api('/api/model/benchmark', 'POST'));
                    })
                  }
                >
                  {busy ? <Loader2 className="spin" size={17} /> : <Activity size={17} />} اختبار
                  التوليد
                </button>
                <button className="text-button" disabled={busy} onClick={() => void load()}>
                  تحديث الحالة
                </button>
              </div>
              {model?.models?.length > 0 && (
                <p className="tiny muted">النماذج المتوفرة: {model.models.join('، ')}</p>
              )}
              {model?.available && !model.models.includes(config.model) && (
                <div className="info-note">
                  Ollama يعمل، لكن النموذج المحدد غير مثبت. اختر نموذجًا مثبتًا من القائمة أو اضغط
                  تنزيل النموذج.
                </div>
              )}
              {!model?.available && (
                <div className="info-note">{model?.error || 'جارٍ فحص Ollama…'}</div>
              )}
            </>
          )}
          {benchmark && (
            <div className="benchmark">
              <strong>استغرق التوليد {benchmark.seconds} ثانية</strong>
              <p>{benchmark.text}</p>
            </div>
          )}
          <div className="info-note">
            جودة العربية والأداء يعتمدان على الجهاز والمصدر. راجع الأسئلة دائمًا.
            {ram < 16 &&
              ' يُنصح بالنموذج 1.7B عند محدودية الذاكرة؛ النماذج الأكبر قد تستغرق وقتًا أطول.'}
          </div>
        </section>
        <section className="card">
          <div className="section-heading">
            <Wifi size={24} />
            <h2>ربط أجهزة الطلاب</h2>
          </div>
          {hostInfo ? (
            <>
              <div className="host-addresses">
                {hostInfo.addresses.map((address: string) => (
                  <div key={address}>
                    <small>عنوان الجهاز الرئيسي</small>
                    <strong dir="ltr">{address}</strong>
                  </div>
                ))}
              </div>
              <label className="field">
                رمز الاقتران لهذه الجلسة
                <input dir="ltr" readOnly value={hostInfo.pairCode} />
              </label>
              <label className="field">
                بصمة أمان الجهاز
                <textarea rows={3} dir="ltr" readOnly value={hostInfo.fingerprint} />
              </label>
              <button
                className="secondary"
                onClick={() => {
                  void navigator.clipboard.writeText(
                    `${hostInfo.addresses[0] || ''}\n${hostInfo.pairCode}\n${hostInfo.fingerprint}`,
                  );
                  notify('تم نسخ بيانات الربط');
                }}
              >
                <Copy size={16} /> نسخ بيانات الربط
              </button>
              <p className="tiny muted">
                اسمح بـ TCP 4310 وUDP 4311 على شبكة Windows الخاصة. اترك التطبيق مفتوحًا أثناء
                الامتحان.
              </p>
            </>
          ) : (
            <div className="info-note">
              معاينة المتصفح للتطوير. شغّل تطبيق سطح المكتب لربط المختبر باتصال مشفر.
            </div>
          )}
        </section>
        <section className="card">
          <div className="section-heading">
            <ShieldCheck size={24} />
            <h2>النسخ الاحتياطي</h2>
          </div>
          <p className="muted">
            تضم النسخة الطلاب والأسئلة والإجابات والصور والإعدادات وتجزئة كلمة مرور المعلم. احفظها
            في مكان خاص.
          </p>
          <div className="button-row">
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  if (window.desktop) {
                    if (await window.desktop.saveBackup()) notify('حُفظت النسخة');
                  } else download('school-backup.json', JSON.stringify(await api('/api/backup')));
                })
              }
            >
              <Download size={17} /> حفظ نسخة
            </button>
            <button
              className="secondary"
              disabled={busy || !window.desktop}
              onClick={() =>
                void run(async () => {
                  if (await window.desktop!.readBackup()) {
                    notify('اكتملت الاستعادة. سجل الدخول مجددًا');
                    onRestore();
                  }
                })
              }
            >
              <Upload size={17} /> استعادة نسخة
            </button>
          </div>
          <div className="info-note">
            الاستعادة تستبدل البيانات الحالية وتتطلب عدم وجود محاولات نشطة.
          </div>
        </section>
      </div>
    </>
  );
}
