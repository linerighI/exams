import { useEffect, useRef, useState } from 'react';
import {
  Clock3,
  CheckCircle2,
  WifiOff,
  Cloud,
  ArrowLeft,
  ArrowRight,
  Camera,
  Send,
} from 'lucide-react';
import { api, setToken } from './api';
import { saveSnapshot, type Snapshot } from './offline';
export async function cameraProbe() {
  if (!navigator.mediaDevices?.getUserMedia) return false;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch {
    return false;
  }
}
async function capture() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480 },
    audio: false,
  });
  try {
    const video = document.createElement('video');
    video.srcObject = stream;
    await video.play();
    await new Promise((r) => setTimeout(r, 400));
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    canvas.getContext('2d')!.drawImage(video, 0, 0, 640, 480);
    return canvas.toDataURL('image/jpeg', 0.75);
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
}
export default function StudentExam({
  snapshot,
  onExit,
  notify,
}: {
  snapshot: Snapshot;
  onExit: () => void;
  notify: (message: string) => void;
}) {
  const current = useRef(snapshot);
  const diskQueue = useRef(Promise.resolve());
  const [view, setView] = useState(snapshot);
  const [index, setIndex] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [online, setOnline] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const [cameraRequest, setCameraRequest] = useState<any>();
  const [cameraBusy, setCameraBusy] = useState(false);
  const syncBusy = useRef(false);
  const cameraSeen = useRef(new Set<string>());
  const [finished, setFinished] = useState(
    !!snapshot.attempt.submittedAt && !Object.keys(snapshot.pending).length,
  );
  const [loginCode, setLoginCode] = useState('');
  const [authNeeded, setAuthNeeded] = useState(false);
  const remaining = Math.max(0, Math.ceil((view.attempt.deadline - (now + view.offset)) / 1000));
  const frozen = remaining === 0 || view.submitPending || !!view.attempt.submittedAt;
  const q = view.questions[index];
  const answered = Object.keys(view.answers).length;
  const persist = async (next: Snapshot) => {
    current.current = next;
    setView({ ...next });
    const durable = structuredClone(next);
    diskQueue.current = diskQueue.current.catch(() => {}).then(() => saveSnapshot(durable));
    await diskQueue.current;
  };
  const sync = async () => {
    if (
      syncBusy.current ||
      (current.current.attempt.submittedAt && !Object.keys(current.current.pending).length)
    )
      return;
    syncBusy.current = true;
    try {
      await diskQueue.current;
      const data = current.current;
      const pending = Object.values(data.pending);
      if (pending.length) {
        const result = await api(`/api/attempts/${data.attempt.id}/answers`, 'PUT', {
          answers: pending,
        });
        const next = { ...current.current, pending: { ...current.current.pending } };
        for (const item of pending)
          if (
            next.pending[item.questionId]?.revision === item.revision &&
            result.acknowledged[item.questionId] >= item.revision
          )
            delete next.pending[item.questionId];
        next.offset = result.serverNow - Date.now();
        await persist(next);
        if (result.late) notify('وصلت إجابات متأخرة إلى المعلم للمراجعة');
      }
      if (current.current.submitPending && !Object.keys(current.current.pending).length) {
        const result = await api(`/api/attempts/${data.attempt.id}/submit`, 'POST');
        await persist({ ...current.current, attempt: result, submitPending: false });
        setFinished(true);
        return;
      }
      setOnline(true);
      setAuthNeeded(false);
      const requests = await api(`/api/attempts/${data.attempt.id}/camera`);
      const request = requests.find(
        (r: any) => r.state === 'pending' && !cameraSeen.current.has(r.id),
      );
      if (request) {
        cameraSeen.current.add(request.id);
        setCameraRequest(request);
      }
    } catch (e) {
      setOnline(false);
      if ((e as Error).message.includes('صلاحية')) setAuthNeeded(true);
    } finally {
      syncBusy.current = false;
    }
  };
  useEffect(() => {
    void saveSnapshot(current.current);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const timer = setInterval(() => void sync(), 3000);
    void sync();
    return () => {
      clearInterval(tick);
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (remaining === 0 && !current.current.submitPending && !current.current.attempt.submittedAt) {
      void persist({ ...current.current, submitPending: true }).then(() => sync());
    }
  }, [remaining]);
  const choose = async (choice: number) => {
    if (frozen) return;
    const data = current.current;
    const revision = (data.revisions[q.id] || 0) + 1;
    try {
      await persist({
        ...data,
        answers: { ...data.answers, [q.id]: choice },
        revisions: { ...data.revisions, [q.id]: revision },
        pending: { ...data.pending, [q.id]: { questionId: q.id, choice, revision } },
      });
      void sync();
    } catch {
      notify('تعذر الحفظ على هذا الجهاز. أبلغ المعلم قبل المتابعة');
    }
  };
  const submit = async () => {
    setConfirm(false);
    await persist({ ...current.current, submitPending: true });
    void sync();
  };
  const respondCamera = async (accept: boolean) => {
    if (!cameraRequest) return;
    setCameraBusy(true);
    try {
      let body: any = { error: 'رفض الطالب إذن التصوير' };
      if (accept) {
        try {
          body = { image: await capture() };
        } catch {
          body = { error: 'الكاميرا غير متاحة أو لم يُمنح الإذن' };
        }
      }
      await api(`/api/attempts/${view.attempt.id}/camera/${cameraRequest.id}`, 'POST', body);
      setCameraRequest(undefined);
      notify(body.image ? 'تم إرسال الصورة إلى المعلم' : 'تم إبلاغ المعلم بحالة الكاميرا');
    } catch (e) {
      notify((e as Error).message);
      cameraSeen.current.delete(cameraRequest.id);
      setCameraRequest(undefined);
    } finally {
      setCameraBusy(false);
    }
  };
  if (finished)
    return (
      <div className="submitted card">
        <div className="success-orbit">
          <CheckCircle2 size={64} />
        </div>
        <span className="eyebrow">أحسنت، أنهيت امتحانك</span>
        <h1>تم تسليم إجاباتك بنجاح</h1>
        <p>وصلت المحاولة إلى جهاز المعلم. ستظهر الدرجة بعد نشر النتائج.</p>
        <button className="primary" onClick={onExit}>
          العودة إلى لوحة الطالب
        </button>
      </div>
    );
  return (
    <>
      <div className="exam-top">
        <div>
          <span className="eyebrow">بالتوفيق، أنت مستعد ✦</span>
          <h1>{view.exam.title}</h1>
          <p>اقرأ السؤال جيدًا واختر إجابة واحدة.</p>
        </div>
        <div className={`timer ${remaining < 300 ? 'urgent' : ''}`}>
          <Clock3 size={24} />
          <div>
            <small>الوقت المتبقي</small>
            <strong dir="ltr">
              {String(Math.floor(remaining / 60)).padStart(2, '0')}:
              {String(remaining % 60).padStart(2, '0')}
            </strong>
          </div>
        </div>
      </div>
      {authNeeded && (
        <form
          className="card reconnect-form"
          onSubmit={(e) => {
            e.preventDefault();
            void (async () => {
              try {
                const login = await api('/api/login', 'POST', { role: 'student', code: loginCode });
                if (login.student.id !== view.studentId)
                  throw Error('استخدم رمز صاحب هذه المحاولة');
                setToken(login.token);
                setAuthNeeded(false);
                notify('تم تجديد الاتصال');
                void sync();
              } catch (error) {
                notify((error as Error).message);
              }
            })();
          }}
        >
          <span>أُعيد تشغيل الخادم. أدخل رمزك لتجديد الاتصال وإرسال الإجابات.</span>
          <input
            dir="ltr"
            required
            value={loginCode}
            onChange={(e) => setLoginCode(e.target.value)}
            placeholder="رمز الطالب"
          />
          <button className="primary">إعادة الاتصال</button>
        </form>
      )}
      <div className="exam-layout">
        <section className="card exam-question">
          <div className="question-heading">
            <span className="pill blue">
              السؤال {index + 1} من {view.questions.length}
            </span>
            <span className="muted">اختر الإجابة الصحيحة</span>
          </div>
          <h2><MathText text={q.text}/></h2>
          {q.image && <img className="exam-image" src={q.image} alt="صورة السؤال" />}
          <div className="student-options">
            {q.options.map((option: string, i: number) => (
              <button
                disabled={frozen}
                key={i}
                onClick={() => void choose(i)}
                className={view.answers[q.id] === i ? 'selected' : ''}
              >
                <span className="radio-circle">{view.answers[q.id] === i && <span />}</span>
                <span className="option-letter">{['أ', 'ب', 'ج', 'د'][i]}</span>
                <span><MathText text={option}/></span>
                {view.answers[q.id] === i && <CheckCircle2 className="option-check" size={21} />}
              </button>
            ))}
          </div>
          <div className="question-controls">
            <button
              className="secondary"
              disabled={index === 0}
              onClick={() => setIndex(index - 1)}
            >
              <ArrowRight size={17} /> السابق
            </button>
            <span>
              {index + 1} / {view.questions.length}
            </span>
            <button
              className="primary"
              disabled={index === view.questions.length - 1}
              onClick={() => setIndex(index + 1)}
            >
              التالي <ArrowLeft size={17} />
            </button>
          </div>
          {frozen && (
            <div className="info-note">
              {online
                ? 'انتهى وقت الإجابة أو بدأ التسليم.'
                : 'الإجابات محفوظة على الجهاز، وسيكتمل التسليم عند عودة الاتصال.'}
            </div>
          )}
        </section>
        <aside className="card exam-navigation">
          <h3>خريطة الأسئلة</h3>
          <p>
            {answered} من {view.questions.length} تمت الإجابة عنها
          </p>
          <div className="progress-track">
            <div style={{ width: `${(answered / view.questions.length) * 100}%` }} />
          </div>
          <div className="question-map">
            {view.questions.map((item: any, i: number) => (
              <button
                key={item.id}
                className={`${item.id in view.answers ? 'answered' : ''} ${i === index ? 'current' : ''}`}
                onClick={() => setIndex(i)}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <div className={`save-status ${online ? '' : 'offline'}`}>
            {online ? <Cloud size={20} /> : <WifiOff size={20} />}
            <div>
              <strong>
                {Object.keys(view.pending).length
                  ? 'محفوظة على الجهاز'
                  : online
                    ? 'تم الحفظ على جهاز المعلم'
                    : 'الاتصال منقطع'}
              </strong>
              <small>
                {Object.keys(view.pending).length
                  ? `${Object.keys(view.pending).length} إجابة بانتظار الإرسال`
                  : 'نحفظ تقدمك أثناء الإجابة'}
              </small>
            </div>
          </div>
          <button className="primary wide" disabled={frozen} onClick={() => setConfirm(true)}>
            <Send size={17} /> تسليم الامتحان
          </button>
        </aside>
      </div>
      {confirm && (
        <div className="modal-backdrop">
          <div className="modal card">
            <h2>هل تريد تسليم الامتحان؟</h2>
            <p>
              أجبت عن {answered} من {view.questions.length} سؤالًا. بعد التسليم تتوقف التعديلات.
            </p>
            <div className="button-row">
              <button className="primary" onClick={() => void submit()}>
                تأكيد التسليم
              </button>
              <button className="secondary" onClick={() => setConfirm(false)}>
                متابعة الإجابة
              </button>
            </div>
          </div>
        </div>
      )}
      {cameraRequest && (
        <div className="modal-backdrop">
          <div className="modal card">
            <div className="summary-icon">
              <Camera size={30} />
            </div>
            <h2>المعلم يطلب صورة الآن</h2>
            <p>ستُلتقط صورة واحدة بالكاميرا وتُرسل إلى جهاز المعلم مع هذه المحاولة.</p>
            <div className="button-row">
              <button
                disabled={cameraBusy || frozen}
                className="primary"
                onClick={() => void respondCamera(true)}
              >
                التقاط وإرسال الصورة
              </button>
              <button
                disabled={cameraBusy}
                className="secondary"
                onClick={() => void respondCamera(false)}
              >
                رفض التصوير
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
import MathText from './MathText';
