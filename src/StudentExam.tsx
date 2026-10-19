import { useSceneMotion } from './appMotion';
import AudioPlayer from './AudioPlayer';
import { memo, useEffect, useRef, useState } from 'react';
import {
  Clock3,
  CheckCircle2,
  WifiOff,
  Cloud,
  ArrowLeft,
  ArrowRight,
  Camera,
  Flag,
} from 'lucide-react';
import { api, setToken, ApiError, isConnectionError } from './api';
import QuestionResponse from './QuestionResponse';
import { hasAnswer, type Answer } from './questionFormats';
import { saveSnapshot, type Snapshot } from './offline';
import StudentTools from './StudentTools';
import BlueOrb from './BlueOrb';
const ExamStatusOrb = memo(BlueOrb);
import './studentExam.css';
import { defaultAppearance } from './examAppearance';
import './personalization.css';
export default function StudentExam({
  snapshot,
  onExit,
  notify,
}: {
  snapshot: Snapshot;
  onExit: () => void;
  notify: (message: string) => void;
}) {
  const scene = useRef<HTMLDivElement>(null);
  useSceneMotion(
    scene,
    '.student-exam-heading > div > .eyebrow, .student-exam-heading h1, .student-exam-heading p',
  );
  const current = useRef(snapshot);
  const diskQueue = useRef(Promise.resolve());
  const [view, setView] = useState(snapshot);
  const [localSaveState, setLocalSaveState] = useState<'saving' | 'saved' | 'error'>('saved');
  const [index, setIndex] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [online, setOnline] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const [finishRequested, setFinishRequested] = useState(false);
  const syncBusy = useRef(false);
  const syncTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const syncError = useRef('');
  const [finished, setFinished] = useState(
    !!snapshot.attempt.submittedAt && !Object.keys(snapshot.pending).length,
  );
  const [loginCode, setLoginCode] = useState('');
  const [authNeeded, setAuthNeeded] = useState(false);
  const remaining = Math.max(0, Math.ceil((view.attempt.deadline - (now + view.offset)) / 1000));
  const frozen = remaining === 0 || view.submitPending || !!view.attempt.submittedAt;
  const q = view.questions[index];
  const appearance = { ...defaultAppearance, ...view.exam.appearance };
  const answered = view.questions.filter((item) => hasAnswer(item, view.answers[item.id])).length;
  const missing = view.questions.filter((item) => !hasAnswer(item, view.answers[item.id]));
  const reviewFlags = (view.reviewFlags || []).filter((id) =>
    view.questions.some((item) => item.id === id),
  );
  const requestSubmit = () => {
    if (frozen) return;
    if (missing.length) {
      setFinishRequested(true);
      notify(`بقي ${missing.length} سؤالًا دون إجابة. راجع الأسئلة المميزة قبل التسليم.`);
      return;
    }
    setConfirm(true);
  };
  useEffect(() => {
    if (finishRequested && answered === view.questions.length && localSaveState !== 'error')
      notify('');
  }, [finishRequested, answered, view.questions.length, localSaveState]);
  const persist = async (next: Snapshot) => {
    current.current = next;
    setView({ ...next });
    const durable = structuredClone(next);
    diskQueue.current = diskQueue.current.catch(() => {}).then(() => saveSnapshot(durable));
    const write = diskQueue.current;
    setLocalSaveState('saving');
    try {
      await write;
      if (diskQueue.current === write) setLocalSaveState('saved');
    } catch (error) {
      if (diskQueue.current === write) setLocalSaveState('error');
      throw error;
    }
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
      if (!pending.length && !data.submitPending) {
        const remote = await api(`/api/attempts/${data.attempt.id}/status`);
        if (remote.attempt.examId !== data.attempt.examId)
          throw Error('تعذر مطابقة الامتحان. أبلغ المعلم.');
        if (remote.attempt.submittedAt) {
          await persist({
            ...current.current,
            attempt: { ...current.current.attempt, ...remote.attempt },
          });
          setFinished(true);
        }
      }
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
      syncError.current = '';
    } catch (e) {
      if (isConnectionError(e)) setOnline(false);
      else if (
        (e instanceof ApiError && [401, 403].includes(e.status)) ||
        /صلاحية|تسجيل الدخول|الجلسة|جلسة|Unauthorized/i.test((e as Error).message)
      ) {
        setAuthNeeded(true);
      } else if (syncError.current !== (e as Error).message) {
        syncError.current = (e as Error).message;
        notify((e as Error).message);
      }
    } finally {
      syncBusy.current = false;
    }
  };
  useEffect(() => {
    void saveSnapshot(current.current).catch(() => setLocalSaveState('error'));
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const timer = setInterval(() => void sync(), 3000);
    void sync();
    return () => {
      clearInterval(tick);
      clearInterval(timer);
      clearTimeout(syncTimer.current);
    };
  }, []);
  useEffect(() => {
    if (remaining === 0 && !current.current.submitPending && !current.current.attempt.submittedAt) {
      void persist({ ...current.current, submitPending: true })
        .then(() => sync())
        .catch(() => notify('تعذر حفظ طلب التسليم. أبقِ التطبيق مفتوحًا وأبلغ المعلم.'));
    }
  }, [remaining]);
  const choose = async (choice: Answer) => {
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
      clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(() => void sync(), 400);
    } catch {
      notify('تعذر الحفظ على هذا الجهاز. أبلغ المعلم قبل المتابعة');
    }
  };
  const submit = async () => {
    setConfirm(false);
    try {
      await persist({ ...current.current, submitPending: true });
      void sync();
    } catch {
      current.current = { ...current.current, submitPending: false };
      setView({ ...current.current });
      notify('تعذر حفظ طلب التسليم. أبقِ التطبيق مفتوحًا وأبلغ المعلم قبل المحاولة مجددًا.');
    }
  };
  const toggleReview = async () => {
    if (frozen) return;
    try {
      await persist({
        ...current.current,
        reviewFlags: reviewFlags.includes(q.id)
          ? reviewFlags.filter((id) => id !== q.id)
          : [...reviewFlags, q.id],
      });
    } catch {
      notify('تعذر حفظ علامة المراجعة على هذا الجهاز');
    }
  };
  const indicatorTone =
    !online || authNeeded || localSaveState === 'error'
      ? 'red'
      : answered === view.questions.length
        ? 'green'
        : missing.length && (finishRequested || index === view.questions.length - 1)
          ? 'red'
          : 'blue';
  const indicatorText = authNeeded
    ? 'أعد تسجيل الدخول للمزامنة'
    : localSaveState === 'error'
      ? 'أبلغ المعلم: تعذّر الحفظ'
      : !online
        ? 'الاتصال منقطع'
        : indicatorTone === 'green'
          ? 'كل الأسئلة مجابة'
          : indicatorTone === 'red'
            ? `${missing.length} أسئلة غير مجابة`
            : 'الامتحان جارٍ';
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
      <div
        ref={scene}
        className={`student-exam-theme ${appearance.cardStyle} ${appearance.fontSize}`}
        style={
          {
            '--exam-bg': appearance.background,
            '--exam-accent': appearance.accent,
          } as React.CSSProperties
        }
      >
        <div className="exam-top student-exam-heading">
          <div>
            <span className="eyebrow">مساحتك للتركيز · خطوة واحدة في كل مرة</span>
            <h1>{view.exam.title}</h1>
            <p>{appearance.welcome}</p>
            {view.exam.audio && (
              <div className="student-audio">
                <strong>تعليمات المعلم الصوتية</strong>
                <AudioPlayer audio={view.exam.audio} label="تعليمات المعلم الصوتية" />
              </div>
            )}
          </div>
        </div>
        {authNeeded && (
          <form
            className="card reconnect-form"
            onSubmit={(e) => {
              e.preventDefault();
              void (async () => {
                try {
                  const login = await api('/api/login', 'POST', {
                    role: 'student',
                    code: loginCode,
                  });
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
        <div className="exam-layout student-exam-workspace">
          <section className="card exam-question">
            {!frozen && (
              <StudentTools
                calculatorAllowed={view.exam.calculatorAllowed}
                geogebraAllowed={view.exam.geogebraAllowed}
              />
            )}
            <div className="question-heading">
              <span className="pill blue">
                السؤال {index + 1} من {view.questions.length}
              </span>
              <button
                className="student-review-toggle"
                aria-label="تعليم السؤال الحالي للمراجعة"
                aria-pressed={reviewFlags.includes(q.id)}
                disabled={frozen}
                onClick={() => void toggleReview()}
              >
                <Flag size={14} />
                {reviewFlags.includes(q.id) ? 'معلّم للمراجعة' : 'أراجعه لاحقًا'}
              </button>
              <span className="muted">
                {hasAnswer(q, view.answers[q.id])
                  ? 'إجابتك محفوظة · يمكنك تعديلها'
                  : 'فكّر، ثم اختر إجابتك'}
              </span>
            </div>
            <h2>
              <MathText text={q.text} />
            </h2>
            {q.image && <img className="exam-image" src={q.image} alt="صورة السؤال" />}
            {q.audio && (
              <div className="student-audio" key={q.id}>
                <strong>استمع إلى السؤال</strong>
                <AudioPlayer audio={q.audio} />
              </div>
            )}
            <QuestionResponse
              key={q.id}
              question={q}
              value={view.answers[q.id]}
              onChange={(answer) => void choose(answer)}
              disabled={frozen}
            />
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
            <div className="exam-fixed-status">
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
              <div
                className={`exam-status-indicator is-${indicatorTone}`}
                role="img"
                aria-label={`حالة الامتحان: ${indicatorText}`}
              >
                <div className="exam-indicator-orb" aria-hidden="true">
                  <ExamStatusOrb size={1.45} tone={indicatorTone} animationSpeedBase={0.2} />
                </div>
                <strong>{indicatorText}</strong>
                <span>
                  {answered} / {view.questions.length} إجابات
                </span>
              </div>
              <button
                className="primary exam-submit-button"
                aria-label="تسليم الامتحان"
                disabled={frozen}
                onClick={requestSubmit}
              >
                مراجعة وتسليم
              </button>
            </div>

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
                  aria-label={`السؤال ${i + 1}${hasAnswer(item, view.answers[item.id]) ? ' مجاب' : ' غير مجاب'}${reviewFlags.includes(item.id) ? ' معلّم للمراجعة' : ''}`}
                  className={`${reviewFlags.includes(item.id) ? 'flagged' : ''} ${hasAnswer(item, view.answers[item.id]) ? 'answered' : finishRequested || index === view.questions.length - 1 ? 'missing' : ''} ${i === index ? 'current' : ''}`}
                  onClick={() => setIndex(i)}
                >
                  {i + 1}
                  {reviewFlags.includes(item.id) && (
                    <Flag className="student-review-flag" size={9} aria-hidden="true" />
                  )}
                </button>
              ))}
            </div>
            <div className={`save-status ${online && localSaveState !== 'error' ? '' : 'offline'}`}>
              {online ? <Cloud size={20} /> : <WifiOff size={20} />}
              <div>
                <strong>
                  {localSaveState === 'error'
                    ? 'تعذر الحفظ على هذا الجهاز'
                    : localSaveState === 'saving'
                      ? 'جارٍ الحفظ على الجهاز'
                      : Object.keys(view.pending).length
                        ? 'محفوظة على الجهاز'
                        : online
                          ? 'تم الحفظ على جهاز المعلم'
                          : 'الاتصال منقطع'}
                </strong>
                <small>
                  {localSaveState === 'error'
                    ? 'أبقِ التطبيق مفتوحًا وأبلغ المعلم'
                    : Object.keys(view.pending).length
                      ? `${Object.keys(view.pending).length} إجابة بانتظار الإرسال`
                      : 'نحفظ تقدمك أثناء الإجابة'}
                </small>
              </div>
            </div>
            {missing.length > 0 && (finishRequested || index === view.questions.length - 1) && (
              <button
                className="text-button review-missing"
                onClick={() =>
                  setIndex(
                    view.questions.findIndex((item) => !hasAnswer(item, view.answers[item.id])),
                  )
                }
              >
                انتقل لأول سؤال غير مجاب <ArrowLeft size={15} />
              </button>
            )}
          </aside>
        </div>
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
    </>
  );
}
import MathText from './MathText';
