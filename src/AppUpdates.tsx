import { RefreshCw, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { UpdateState } from '../desktop/appUpdater';
import UpdateDialog from './UpdateDialog';
import SchoolUpdatePanel from './SchoolUpdatePanel';
import { gsap } from './animato';
import { useQuietMotion } from './appMotion';
import './updates.css';
import './teacherEasy.css';

export default function AppUpdates({
  embedded = false,
  background = false,
  notify,
  student = false,
  manageStudents = false,
}: {
  embedded?: boolean;
  background?: boolean;
  notify?: (message: string) => void;
  student?: boolean;
  manageStudents?: boolean;
}) {
  const [state, setState] = useState<UpdateState>({ status: 'idle', current: '' });
  const [open, setOpen] = useState(false),
    [previews, setPreviews] = useState(false),
    [confirm, setConfirm] = useState(false);
  const checking = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null),
    meter = useRef<HTMLSpanElement>(null);
  const quiet = useQuietMotion();
  const [now, setNow] = useState(Date.now());
  const progress = Math.min(100, Math.floor((100 * (state.received || 0)) / (state.size || 1)));
  useEffect(() => {
    if (meter.current) {
      const tween = gsap.to(meter.current, {
        scaleX: progress / 100,
        duration: quiet ? 0 : 0.45,
        ease: 'power2.out',
      });
      return () => {
        tween.kill();
      };
    }
  }, [progress, state.status, quiet]);
  useEffect(() => {
    if (!state.installAt) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [state.installAt]);
  useEffect(() => {
    if (student && state.waiting) setOpen(false);
    else if (student && state.source === 'school' && state.status === 'ready' && state.installAt)
      setOpen(true);
  }, [student, state.source, state.status, state.installAt, state.waiting]);
  const check = async (includePreviews = previews, forStudents = false) => {
    if (!window.desktop?.checkUpdates || checking.current) return;
    checking.current = true;
    try {
      setState(await window.desktop.checkUpdates(includePreviews, forStudents));
    } catch (e) {
      setState((old) => ({ ...old, status: 'error', error: (e as Error).message }));
    } finally {
      checking.current = false;
    }
  };
  useEffect(() => {
    if (!window.desktop?.checkUpdates) return;
    let live = true;
    void window.desktop
      .updateState()
      .then((s) => {
        if (live) setState(s);
      })
      .catch(() => {});
    const online = () => {
      if (!student && navigator.onLine) void check(false);
    };
    const first = embedded ? undefined : setTimeout(online, 1500),
      timer = embedded ? undefined : setInterval(online, 6 * 3600000);
    const unsubscribe = window.desktop.onEvent((event) => {
      if (live && event.type === 'app-update') setState(event.state);
    });
    window.addEventListener('online', online);
    return () => {
      live = false;
      clearTimeout(first);
      clearInterval(timer);
      unsubscribe();
      window.removeEventListener('online', online);
    };
  }, []);
  const announced = useRef('');
  useEffect(() => {
    if (
      background &&
      state.status === 'available' &&
      state.version &&
      announced.current !== state.version
    ) {
      announced.current = state.version;
      notify?.(
        state.source === 'school'
          ? 'أرسل المعلم تحديثًا لجهازك. يُنزّل في الخلفية ويُثبّت بعد الامتحان.'
          : 'يتوفر تحديث جديد. افتح الإعدادات ← تحديث التطبيق لتنزيله.',
      );
    }
  }, [state.status, state.version]);
  if (!window.desktop?.checkUpdates)
    return embedded ? (
      <section className="settings-update-card">
        <h2>تحديث تطبيق Windows</h2>
        <p>افتح نسخة Windows للبحث عن التحديثات وتنزيلها وتثبيتها من داخل التطبيق.</p>
      </section>
    ) : null;
  const downloading = state.status === 'downloading',
    ready = state.status === 'ready';
  const managed = state.source === 'school';
  const available = ['available', 'downloading', 'ready', 'installing'].includes(state.status);
  const run = async (task: () => Promise<UpdateState>) => {
    try {
      setState(await task());
    } catch (e) {
      setState((old) => ({ ...old, error: (e as Error).message }));
    }
  };
  const content = (
    <div className="app-update-panel">
      <p>الإصدار الحالي: {state.current || '—'}</p>
      <p className="info-note">
        {managed
          ? 'أرسل المعلم تحديثًا موثّقًا عبر شبكة المدرسة. يمكنك متابعة عملك أثناء التنزيل.'
          : 'يمكنك متابعة عملك أثناء التنزيل؛ يغلق التطبيق فقط عند بدء التثبيت.'}
      </p>
      <p className="update-source">
        {managed ? 'من جهاز المعلم · عبر شبكة المدرسة' : 'GitHub Releases · linerighI/exams'}
      </p>
      {!managed && !student && (
        <>
          <label className="check-label">
            <input
              type="checkbox"
              checked={previews}
              disabled={downloading || ready}
              onChange={(e) => setPreviews(e.target.checked)}
            />
            إظهار الإصدارات التجريبية أيضًا
          </label>
          <button
            className="secondary"
            disabled={
              downloading || ready || state.status === 'checking' || state.status === 'installing'
            }
            onClick={() => void check()}
          >
            {state.status === 'checking' ? 'جارٍ البحث…' : 'البحث عن تحديث'}
          </button>
        </>
      )}
      {state.status === 'current' && <p role="status">أنت على أحدث إصدار متاح لهذه القناة.</p>}
      {available && (
        <>
          <h3>الإصدار {state.version}</h3>
          <p>حجم التنزيل: {Math.ceil((state.size || 0) / 1048576)} MiB</p>
          <pre className="update-notes">{state.notes || 'لا توجد ملاحظات إضافية.'}</pre>
        </>
      )}
      {downloading && (
        <div role="status">
          <div
            className="update-download-meter"
            role="progressbar"
            aria-label="تقدم تنزيل التحديث"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <span ref={meter} />
          </div>
          <p>
            {Math.floor((100 * (state.received || 0)) / (state.size || 1))}% — يبقى التطبيق مفتوحًا
            أثناء التنزيل.
          </p>
          {!managed && (
            <button
              className="secondary"
              onClick={() => void run(() => window.desktop!.cancelUpdate())}
            >
              إيقاف التنزيل مؤقتًا
            </button>
          )}
        </div>
      )}
      {!managed &&
        !student &&
        (state.status === 'available' || (state.status === 'error' && state.version)) && (
          <button
            className="primary"
            onClick={() => void run(() => window.desktop!.downloadUpdate())}
          >
            تنزيل التحديث داخل التطبيق
          </button>
        )}
      {ready && managed && (
        <div className="school-update-countdown" role="status">
          <ShieldCheck size={24} />
          <div>
            <strong>
              {state.waiting
                ? 'التحديث جاهز، وسيُؤجّل التثبيت حتى انتهاء الامتحان'
                : `يبدأ تحديث جهازك خلال ${Math.max(0, Math.ceil(((state.installAt || now) - now) / 1000))} ثانية`}
            </strong>
            <p>حُفظت إجاباتك على جهاز المعلم. سيُعاد فتح التطبيق بعد التثبيت.</p>
          </div>
        </div>
      )}
      {ready && !managed && !student && (
        <>
          <p>اكتمل التنزيل والتحقق. احفظ عملك وأكمل امتحانات الطلاب قبل التثبيت.</p>
          <label className="check-label">
            <input
              type="checkbox"
              checked={confirm}
              onChange={(e) => setConfirm(e.target.checked)}
            />
            حفظت عملي وأوافق على إغلاق التطبيق للتثبيت ثم إعادة فتحه.
          </label>
          <button
            className="primary"
            disabled={!confirm}
            onClick={() => void run(() => window.desktop!.installUpdate())}
          >
            تثبيت وإعادة تشغيل التطبيق
          </button>
        </>
      )}
      {state.status === 'installing' && (
        <p role="status">سيُغلق التطبيق بأمان، ثم يبدأ التثبيت. قد يطلب Windows إذن المسؤول.</p>
      )}
      {state.error && (
        <p role="alert" className="error-note">
          {state.error}
        </p>
      )}
    </div>
  );
  if (background && !open) return null;
  if (embedded)
    return (
      <section className="settings-update-card">
        <header>
          <RefreshCw size={32} />
          <div>
            <h2>التطبيق يبقى معك، ويتحسن</h2>
            <p>تحقق من أحدث إصدار، نزّله هنا، وثبّته عندما تكون جاهزًا.</p>
          </div>
        </header>
        {content}
        {manageStudents && (
          <SchoolUpdatePanel state={state} prepare={() => void check(previews, true)} />
        )}
        <p className="info-note">
          <ShieldCheck size={16} /> يُتحقق من الملف قبل التثبيت. لن يُغلق التطبيق دون موافقتك،
          وتُمنع إعادة التشغيل أثناء محاولات الطلاب.
        </p>
      </section>
    );
  return (
    <>
      {!background && (
        <button
          ref={trigger}
          className={available ? 'primary small' : 'secondary small'}
          onClick={() => setOpen(true)}
        >
          {ready
            ? 'التحديث جاهز للتثبيت'
            : available
              ? `تحديث جديد ${state.version}`
              : 'تحديث التطبيق'}
        </button>
      )}
      {open && (
        <UpdateDialog
          origin={trigger}
          locked={state.status === 'installing'}
          onClose={() => {
            if (state.status !== 'installing') setOpen(false);
          }}
        >
          {content}
        </UpdateDialog>
      )}
    </>
  );
}
