import {TeacherQrCard} from './TeacherQr';
import SnapshotBackupSettings from './SnapshotBackupSettings';
import ServicesPanel from './ServicesPanel';
import { useEffect, useState } from 'react';
import {
  Activity,
  Copy,
  Download,
  Loader2,
  Monitor,
  School,
  ShieldCheck,
  Sparkles,
  Upload,
  Wifi,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import AppUpdates from './AppUpdates';
import RecycleBin from './RecycleBin';
import {motion,LayoutGroup} from 'motion/react';
import './personalization.css';
import { api, download } from './api';
import TeacherAccounts from './TeacherAccounts';
import PDFExport from './PDFExport';
import {exportSpreadsheet} from './spreadsheetExport';
import { providers } from './ProviderSwitch';
import type { Settings as Config } from './types';
type Props = {
  hostInfo: any;
  notify: (s: string) => void;
  onSchool: (s: string) => void;
  onRestore: () => void;
};
export default function Settings({ hostInfo, notify, onSchool, onRestore }: Props) {
  const [config, setConfig] = useState<Config>();
  const [tab, setTab] = useState('school');
  const [model, setModel] = useState<any>();
  const [ram, setRam] = useState(0);
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState('');
  const [benchmark, setBenchmark] = useState<any>();
  const [adminBackup,setAdminBackup]=useState(false);
  useEffect(() => {
    void Promise.all([api('/api/settings'), api('/api/model').catch(() => undefined),api('/api/account').catch(()=>undefined)])
      .then(([data, status,account]) => {
        setAdminBackup(!!account?.isAdmin);
        setConfig({ ...data, model: status?.model || data.model });
        setRam(data.ramGB);
        setModel(status);
      })
      .catch((e) => notify(e.message));
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
  if (!config)
    return (
      <div className="empty">
        <Loader2 className="spin" />
      </div>
    );
  const cloud = config.aiProvider === 'openai' || config.aiProvider === 'gemini';
  const openai = config.aiProvider === 'openai';
  const hasKey = openai ? config.hasOpenaiKey : config.hasGeminiKey;
  const save = async (extra = {}) => {
    const saved = await api('/api/settings', 'PUT', {
      ...config,
      ...(key ? { [openai ? 'openaiKey' : 'geminiKey']: key } : {}),
      ...extra,
    });
    setKey('');
    setConfig(saved);
    onSchool(saved.school);
    return saved;
  };
  const tabs = [
    ['school', 'المدرسة', School],
    ['ai', 'الذكاء الاصطناعي', Sparkles],
    ['services', 'الخدمات', Activity],
    ['connection', 'اتصال الطلاب', Wifi],
    ['accounts', 'حسابات المعلمين', ShieldCheck],
    ['backup', 'النسخ الاحتياطي', Download],
    ['updates','تحديث التطبيق',RefreshCw],
    ['trash','المحذوفات',Trash2],
  ] as const;
  return (
    <div className="school-settings">
      <div className="page-title">
        <div>
          <h1>الإعدادات والاتصال</h1>
          <p>احفظ تغييراتك قبل الانتقال إلى قسم آخر.</p>
        </div>
        <span className="pill blue">
          <Monitor size={16} />
          {ram} GB
        </span>
      </div>
      <LayoutGroup id="school-settings-tabs"><nav className="settings-tabs" aria-label="أقسام الإعدادات">
        {tabs.map(([id, label, Icon]) => (
          <button
            key={id}
            className={tab === id ? 'active' : ''}
            aria-current={tab === id ? 'page' : undefined}
            onClick={() => setTab(id)}
          >
            <Icon size={18} />
            {tab===id && <motion.span className="settings-tab-morph" layoutId="settings-selected-tab" transition={{type:'spring',stiffness:420,damping:34}}/>}
            {label}
          </button>
        ))}
      </nav></LayoutGroup>
      <div className="settings-content" key={tab}>
        {tab === 'school' && (
          <section className="card settings-card">
            <div className="section-heading">
              <School />
              <div>
                <h2>هوية المدرسة</h2>
                <p>الاسم الظاهر للمعلمين والطلاب وسياسة الاحتفاظ بالصور.</p>
              </div>
            </div>
            <div className="form-grid">
              <label className="field">
                اسم المدرسة
                <input
                  value={config.school}
                  onChange={(e) => setConfig({ ...config, school: e.target.value })}
                />
              </label>
              <label className="field">
                مدة الاحتفاظ بالصور (أيام)
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={config.retentionDays}
                  onChange={(e) => setConfig({ ...config, retentionDays: +e.target.value })}
                />
              </label>
            </div>
            <details className="settings-advanced">
              <summary>إعدادات التطوير المتقدمة</summary>
              <label className="field">
                مسار Python
                <input
                  dir="ltr"
                  value={config.pythonPath}
                  onChange={(e) => setConfig({ ...config, pythonPath: e.target.value })}
                  placeholder="اختياري؛ الأداة مثبتة مع التطبيق"
                />
              </label>
            </details>
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await save();
                  notify('حُفظت إعدادات المدرسة');
                })
              }
            >
              حفظ إعدادات المدرسة
            </button>
          </section>
        )}
        {tab === 'ai' && (
          <section className="card settings-card">
            <div className="section-heading">
              <Sparkles />
              <div>
                <h2>اختر مساعدك</h2>
                <p>المحادثة والأسئلة والرسوم تستخدم المزود المختار.</p>
              </div>
            </div>
            <div className="provider-cards">
              {providers.map((p) => (
                <button
                  disabled={busy}
                  key={p.id}
                  className={config.aiProvider === p.id ? 'selected' : ''}
                  onClick={() => {
                    setConfig({ ...config, aiProvider: p.id });
                    setKey('');
                    setBenchmark(undefined);
                  }}
                >
                  <strong>{p.label}</strong>
                  <small>
                    {p.id === 'ollama'
                      ? 'محلي · دون إنترنت بعد التثبيت'
                      : 'API · يتطلب الإنترنت ومفتاحك الخاص'}
                  </small>
                </button>
              ))}
            </div>
            {cloud ? (
              <>
                <div className="info-note">
                  يُرسل محتوى الطلب التعليمي إلى {openai ? 'OpenAI' : 'Google'}. تبقى مفاتيح API
                  محمية على جهاز المعلم ولا تظهر للطلاب.{' '}
                  {openai ? 'استخدم مفتاح OpenAI API؛ اشتراك ChatGPT وحده ليس مفتاح API.' : ''}
                </div>
                <div className="form-grid">
                  <label className="field">
                    مفتاح {openai ? 'OpenAI' : 'Gemini'} API
                    <input
                      type="password"
                      autoComplete="new-password"
                      dir="ltr"
                      value={key}
                      onChange={(e) => setKey(e.target.value)}
                      placeholder={hasKey ? 'محفوظ — اتركه فارغًا للاحتفاظ به' : 'أدخل المفتاح'}
                    />
                  </label>
                  <label className="field">
                    اسم النموذج
                    <input
                      dir="ltr"
                      value={
                        openai
                          ? config.openaiModel || 'gpt-4.1-mini'
                          : config.geminiModel || 'gemini-3.8-flash'
                      }
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          [openai ? 'openaiModel' : 'geminiModel']: e.target.value,
                        })
                      }
                    />
                  </label>
                </div>
                <p className="muted">
                  {hasKey ? 'مفتاح محفوظ بأمان' : 'لم يُحفظ مفتاح لهذا المزود بعد'}
                </p>
              </>
            ) : (
              <>
                <p className="muted">
                  ثبّت Ollama واختر نموذجًا مثبتًا. قراءة صور الكتب محليًا تتطلب نموذجًا يدعم
                  الرؤية؛ النماذج النصية لا تدعم الصور.
                </p>
                <label className="field">
                  النموذج المحلي
                  <select
                    aria-label="النموذج المحلي"
                    value={config.model}
                    onChange={(e) =>
                      setConfig({ ...config, model: e.target.value, localSpeed: 'manual' })
                    }
                  >
                    {[
                      ...new Set<string>([
                        ...(model?.models || []),
                        config.model,
                        'qwen3:1.7b',
                        'qwen3:4b',
                      ]),
                    ].map((name) => (
                      <option key={name}>{name}</option>
                    ))}
                  </select>
                </label>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={config.localSpeed !== 'manual'}
                    onChange={(e) =>
                      setConfig({ ...config, localSpeed: e.target.checked ? 'fast' : 'manual' })
                    }
                  />
                  تفضيل النموذج الأسرع للمحادثة عند توفره
                </label>
                <span
                  className={`pill ${model?.models?.includes(config.model) ? 'green' : 'amber'}`}
                >
                  {model?.available
                    ? model.models.includes(config.model)
                      ? 'النموذج جاهز'
                      : 'النموذج غير مثبت'
                    : 'Ollama غير متصل'}
                </span>
                <div className="button-row">
                  <button
                    className="secondary"
                    disabled={!window.desktop || busy}
                    onClick={() => void run(() => window.desktop!.openOllama())}
                  >
                    تنزيل Ollama
                  </button>
                  <button
                    className="secondary"
                    disabled={!window.desktop || busy}
                    onClick={() =>
                      void run(async () => {
                        await window.desktop!.downloadModel(config.model);
                        setModel(await api('/api/model'));
                        notify('اكتمل تنزيل النموذج');
                      })
                    }
                  >
                    تنزيل النموذج المختار
                  </button>
                </div>
              </>
            )}
            <div className="settings-save-row">
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await save();
                    notify('حُفظ المزود وإعداداته');
                  })
                }
              >
                حفظ إعدادات الذكاء الاصطناعي
              </button>
              <button
                className="secondary"
                disabled={
                  busy || (cloud ? !key && !hasKey : !model?.models?.includes(config.model))
                }
                onClick={() =>
                  void run(async () => {
                    await save();
                    setBenchmark(await api('/api/model/benchmark', 'POST'));
                  })
                }
              >
                <Activity size={16} />
                اختبار الاتصال والتوليد
              </button>
              {cloud && hasKey && (
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      setKey('');
                      await save({ [openai ? 'clearOpenaiKey' : 'clearGeminiKey']: true });
                      notify('حُذف المفتاح');
                    })
                  }
                >
                  حذف المفتاح
                </button>
              )}
            </div>
            {benchmark && (
              <div className="benchmark">
                <strong>
                  {benchmark.model} · {benchmark.seconds} ثانية
                </strong>
                <p>{benchmark.text}</p>
              </div>
            )}
          </section>
        )}
        {tab === 'connection' && (
          <section className="card settings-card">
            <div className="section-heading">
              <Wifi />
              <div>
                <h2>ربط أجهزة الطلاب</h2>
                <p>رمز واحد للاتصال، ثم يدخل كل طالب برمزه الشخصي.</p>
              </div>
            </div>
            {hostInfo ? (
              <>
                <div className="teacher-connect-card">
                  <span>رمز اتصال الطلاب</span>
                  <strong dir="ltr">{hostInfo.pairCode}</strong>
                  <p>
                    على جهاز الطالب: اضغط الكرة في شاشة الدخول، اختر جهاز المعلم، ثم أدخل هذا الرمز
                    مرة واحدة.
                  </p>
                  <button
                    className="secondary"
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(hostInfo.pairCode)
                        .then(() => notify('تم نسخ الرمز'))
                        .catch(() => notify('تعذر النسخ'))
                    }
                  >
                    <Copy size={16} />
                    نسخ الرمز
                  </button>
                </div>
                <details className="settings-advanced">
                  <summary>عناوين الشبكة وتفاصيل الأمان</summary>
                  <p dir="ltr">
                    {hostInfo.addresses.join(' · ')} · port {hostInfo.port}
                  </p>
                  <code className="fingerprint" dir="ltr">
                    {hostInfo.fingerprint}
                  </code>
                </details>
              </>
            ) : (
              <p>شغّل الجهاز الرئيسي من شاشة الدخول لعرض رمز الاتصال.</p>
            )}
          </section>
        )}
        {tab === 'accounts' && <><TeacherQrCard notify={notify}/><TeacherAccounts notify={notify} /></>}
        {tab === 'updates' && <AppUpdates embedded manageStudents/>}
          {tab === 'services' && <ServicesPanel/>}
        {tab === 'trash' && <RecycleBin notify={notify}/>}
        {tab === 'backup' && (
          <section className="card settings-card">
            <SnapshotBackupSettings notify={notify} admin={adminBackup}/>
            <div className="database-backup-card"><h2>كل قواعد بيانات المدرسة في ملف Excel واحد</h2><p>يشمل جميع حسابات المعلمين وطلابهم وبنوكهم وامتحاناتهم وإجاباتهم وإعداداتهم والتسجيلات والرسوم. تُحفظ ملفات SQLite الأصلية كاملة داخل المصنف مع تحقق من سلامتها.</p><p className="muted">خاص بمدير الحسابات. يحتوي بيانات دخول خاصة، ولا يشمل ملفات تثبيت التطبيق أو نماذج الذكاء الاصطناعي. أكمل امتحانات الطلاب قبل إنشاء النسخة.</p><button className="primary" disabled={busy||!adminBackup} onClick={()=>void run(async()=>{if(await exportSpreadsheet('database'))notify('حُفظت نسخة كل قواعد البيانات في Excel');})}><Download size={17}/>نسخ كل قواعد البيانات إلى Excel</button>{!adminBackup && <small>اطلب من مدير حسابات المدرسة إنشاء النسخة الشاملة. نسخة بيانات حسابك متاحة أدناه.</small>}</div>
            <div className="section-heading">
              <ShieldCheck />
              <div>
                <h2>نسخة JSON لبيانات حسابك</h2>
                <p>
                  الطلاب وبنوك الأسئلة والامتحانات والمحاولات، بما فيها النماذج المسندة لكل طالب.
                </p>
              </div>
            </div>
            <div className="info-note">
              لا تتضمن نسخة JSON مفاتيح API. احفظها في مكان خاص؛ تتضمن بيانات الطلاب وتجزئة كلمة مرور
              المعلم.
            </div>
            <div className="settings-save-row">
              <PDFExport notify={notify}/>
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
                <Download size={17} />
                حفظ نسخة احتياطية
              </button>
              <button
                className="secondary"
                disabled={busy || !window.desktop}
                onClick={() =>
                  void run(async () => {
                    if (await window.desktop!.readBackup()) {
                      notify('اكتملت الاستعادة. سجّل الدخول مجددًا');
                      onRestore();
                    }
                  })
                }
              >
                <Upload size={17} />
                استعادة نسخة
              </button>
            </div>
            <p className="muted">
              الاستعادة تستبدل البيانات الحالية وتتطلب عدم وجود محاولات نشطة، ثم تطلب تأكيدًا.
            </p>
          </section>
        )}
      </div>
      {busy && (
        <div className="settings-saving" role="status">
          <Loader2 size={17} className="spin" />
          جارٍ تنفيذ الطلب…
        </div>
      )}
    </div>
  );
}
