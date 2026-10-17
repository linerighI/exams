import { useEffect, useState } from 'react';
import { Activity, AlertCircle, ArrowRight, Camera, Monitor, Search, VideoOff } from 'lucide-react';
import BlueOrb from './BlueOrb';
import FocusWindow from './FocusWindow';
import { api } from './api';
import type { Attempt } from './types';
import './liveLab.css';
type Device = {
  id: string;
  name: string;
  studentId: string;
  grade: string;
  section: string;
  platform: string;
  page: string;
  online: boolean;
  lastSeen: number;
  camera: string;
  cameraAllowed: boolean;
  cameraRequested: boolean;
  frameAt: number;
  attemptId?: string;
  examTitle?: string;
  answered: number;
  total: number;
  deadline?: number;
  status?: string;
};
type Frame = { id: string; image: string; at: number };
export const openLiveLab = (detail?: { attemptId?: string; cameras?: boolean }) =>
  window.dispatchEvent(new CustomEvent('school-open-live-lab', { detail }));
export default function LiveLab({ attempts }: { attempts: Attempt[] }) {
  const [open, setOpen] = useState(false),
    [tab, setTab] = useState('devices'),
    [devices, setDevices] = useState<Device[]>([]),
    [frames, setFrames] = useState<Frame[]>([]),
    [query, setQuery] = useState(''),
    [selected, setSelected] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [cameraFilter, setCameraFilter] = useState('');
  const refresh = async () => {
    const result = await api('/api/lab');
    setDevices(result.devices);
    setError('');
  };
  useEffect(() => {
    let disposed = false;
    const update = async () => {
      try {
        const result = await api('/api/lab');
        if (!disposed) setDevices(result.devices);
      } catch {
        if (!disposed) setDevices((list) => list.map((device) => ({ ...device, online: false })));
      }
    };
    void update();
    const timer = setInterval(() => void update(), 5000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    const show = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      setCameraFilter(detail?.attemptId || '');
      setTab(detail?.cameras ? 'cameras' : 'devices');
      setSelected('');
      setOpen(true);
    };
    window.addEventListener('school-open-live-lab', show);
    return () => window.removeEventListener('school-open-live-lab', show);
  }, []);
  useEffect(() => {
    if (!open) return;
    let disposed = false,
      working = false;
    const update = async () => {
      if (working) return;
      working = true;
      try {
        await api('/api/lab/watch', 'POST', { active: true });
        const result = await api('/api/lab');
        const pictures = await api('/api/lab/frames');
        if (!disposed) {
          setDevices(result.devices);
          setFrames(pictures.frames);
          setError('');
        }
      } catch (error) {
        if (!disposed) {
          setError((error as Error).message);
          setFrames([]);
        }
      } finally {
        working = false;
      }
    };
    void update();
    const timer = setInterval(() => void update(), 1500);
    return () => {
      disposed = true;
      clearInterval(timer);
      setFrames([]);
      void api('/api/lab/watch', 'POST', { active: false }).catch(() => {});
    };
  }, [open]);
  const request = async (start: boolean, deviceIds?: string[]) => {
    setBusy(true);
    try {
      await api('/api/lab/watch', 'POST', { active: true });
      await api('/api/lab/cameras', 'POST', { start, deviceIds });
      await refresh();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const online = devices.filter((device) => device.online),
    active = attempts.filter((attempt) => !attempt.submittedAt),
    focused = devices.find((device) => device.id === selected);
  const visible = devices.filter(
    (device) =>
      `${device.name} ${device.studentId} ${device.examTitle}`.includes(query) &&
      (!cameraFilter || device.attemptId === cameraFilter),
  );
  const alerts = devices.filter(
    (device) =>
      !device.online ||
      ['denied', 'error', 'paused'].includes(device.camera) ||
      device.page === 'background',
  );
  const cameraText = (device: Device) =>
    !device.online
      ? 'الجهاز غير متصل'
      : !device.attemptId
        ? 'لا توجد محاولة جارية'
        : !device.cameraAllowed
          ? 'الكاميرا مستثناة'
          : device.camera === 'denied'
            ? 'لم يُسمح بالكاميرا'
            : device.camera === 'error'
              ? 'تعذر البث'
              : device.cameraRequested
                ? 'بانتظار البث أو موافقة الطالب'
                : 'البث متوقف';
  return (
    <>
      {(active.length > 0 || online.length > 0) && !open && (
        <button
          className="live-lab-launcher"
          onClick={() => openLiveLab()}
          aria-label="فتح المراقبة المباشرة"
        >
          <span className="live-notice-orb" aria-hidden="true">
            <BlueOrb size={0.8} animationSpeedBase={0.2} />
          </span>
          <span>
            <strong>غرفة الامتحان مباشرة</strong>
            <small>
              {online.length} أجهزة متصلة · {active.length} محاولات جارية
            </small>
          </span>
          <Activity size={19} />
        </button>
      )}
      {open && (
        <FocusWindow title="غرفة المتابعة المباشرة" wide onClose={() => setOpen(false)}>
          <div className="live-lab">
            <nav className="lab-navigation" aria-label="أقسام المراقبة المباشرة">
              {[
                ['devices', 'الأجهزة', Monitor],
                ['answers', 'الإجابات', Activity],
                ['cameras', 'الكاميرات', Camera],
                ['alerts', 'التنبيهات', AlertCircle],
              ].map(([id, label, Icon]: any) => (
                <button
                  key={id}
                  aria-pressed={tab === id}
                  onClick={() => {
                    setTab(id);
                    setSelected('');
                  }}
                >
                  <Icon size={21} />
                  <span>{label}</span>
                </button>
              ))}
            </nav>
            <div className="lab-content">
              <header className="lab-summary">
                <span>
                  <i />
                  {online.length} متصل
                </span>
                <span>
                  {devices.filter((device) => device.attemptId && device.online).length} في الامتحان
                </span>
                <span>{frames.length} كاميرات تبث</span>
              </header>
              {error && (
                <p className="error-note" role="alert">
                  {error}
                </p>
              )}
              <div className="lab-toolbar">
                <label>
                  <Search size={17} />
                  <input
                    aria-label="البحث في أجهزة الطلاب"
                    placeholder="اسم الطالب أو الامتحان…"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
                {cameraFilter && <button onClick={() => setCameraFilter('')}>كل الامتحانات</button>}
                {tab === 'cameras' && (
                  <>
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() =>
                        void request(
                          true,
                          visible
                            .filter((device) => device.cameraAllowed && device.online)
                            .map((device) => device.id),
                        )
                      }
                    >
                      طلب بث الكاميرات
                    </button>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => void request(false)}
                    >
                      إيقاف البث للجميع
                    </button>
                  </>
                )}
              </div>
              {focused ? (
                <section className="lab-device-detail">
                  <button className="text-button" onClick={() => setSelected('')}>
                    <ArrowRight size={17} />
                    كل الأجهزة
                  </button>
                  <h2>{focused.name}</h2>
                  <p>
                    الجهاز {focused.id.slice(-6)} · {focused.platform} · الصف {focused.grade} /{' '}
                    {focused.section}
                  </p>
                  <div className="lab-device-stats">
                    <div>
                      <span>الامتحان</span>
                      <strong>{focused.examTitle || 'مساحة الطالب'}</strong>
                    </div>
                    <div>
                      <span>الإجابات المستلمة</span>
                      <strong>
                        {focused.answered} / {focused.total}
                      </strong>
                    </div>
                    <div>
                      <span>آخر اتصال</span>
                      <strong>{new Date(focused.lastSeen).toLocaleTimeString('ar-JO')}</strong>
                    </div>
                    <div>
                      <span>حالة الجهاز</span>
                      <strong>{focused.online ? 'متصل' : 'غير متصل'}</strong>
                    </div>
                  </div>
                  {frames.find((frame) => frame.id === focused.id) && (
                    <img
                      className="lab-focused-camera"
                      alt={`بث ${focused.name}`}
                      src={frames.find((frame) => frame.id === focused.id)!.image}
                    />
                  )}
                  {focused.cameraAllowed && (
                    <button
                      className="primary"
                      onClick={() => {
                        setTab('cameras');
                        setCameraFilter(focused.attemptId || '');
                        setSelected('');
                      }}
                    >
                      عرض الكاميرا
                    </button>
                  )}
                </section>
              ) : tab === 'devices' ? (
                <div className="lab-device-grid">
                  {visible.map((device) => (
                    <button
                      key={device.id}
                      className={`lab-device ${device.online ? '' : 'is-offline'}`}
                      onClick={() => setSelected(device.id)}
                    >
                      <Monitor size={42} />
                      <span className={`lab-status ${device.online ? 'online' : ''}`}>
                        {device.online ? 'متصل' : 'غير متصل'}
                      </span>
                      <strong>{device.name}</strong>
                      <small>{device.examTitle || 'مساحة الطالب'}</small>
                      <span>
                        {device.answered} / {device.total} إجابات
                      </span>
                    </button>
                  ))}
                </div>
              ) : tab === 'answers' ? (
                <div className="lab-answer-list">
                  {visible.map((device) => (
                    <button key={device.id} onClick={() => setSelected(device.id)}>
                      <div>
                        <strong>{device.name}</strong>
                        <small>{device.examTitle || 'خارج الامتحان'}</small>
                      </div>
                      <progress
                        aria-label={`تقدم ${device.name}`}
                        value={device.answered}
                        max={Math.max(1, device.total)}
                      />
                      <span>
                        {device.answered} / {device.total}
                      </span>
                      <small>{device.online ? 'متصل' : 'غير متصل'}</small>
                    </button>
                  ))}
                </div>
              ) : tab === 'cameras' ? (
                <>
                  <p className="lab-camera-note">
                    بث مباشر منخفض الإطارات · دون صوت أو تسجيل. يظهر إذن البث ومؤشره على جهاز
                    الطالب.
                  </p>
                  <div className="lab-camera-grid">
                    {visible.map((device) => {
                      const frame = frames.find((frame) => frame.id === device.id);
                      return (
                        <article key={device.id}>
                          <button
                            className="lab-camera-view"
                            onClick={() => setSelected(device.id)}
                          >
                            {frame ? (
                              <img src={frame.image} alt={`بث ${device.name}`} />
                            ) : (
                              <span>
                                <VideoOff size={31} />
                                {cameraText(device)}
                              </span>
                            )}
                            <b className={frame ? 'is-live' : ''}>{frame ? 'مباشر' : 'متوقف'}</b>
                          </button>
                          <footer>
                            <strong>{device.name}</strong>
                            {device.cameraAllowed && device.online && (
                              <button
                                disabled={busy}
                                onClick={() => void request(!device.cameraRequested, [device.id])}
                              >
                                {device.cameraRequested ? 'إيقاف' : 'طلب البث'}
                              </button>
                            )}
                          </footer>
                        </article>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="lab-alert-list">
                  {alerts.map((device) => (
                    <button key={device.id} onClick={() => setSelected(device.id)}>
                      <AlertCircle size={20} />
                      <span>
                        <strong>{device.name}</strong>
                        <small>
                          {!device.online
                            ? 'انقطع اتصال الجهاز'
                            : device.page === 'background'
                              ? 'التطبيق في الخلفية'
                              : cameraText(device)}
                        </small>
                      </span>
                    </button>
                  ))}
                  {attempts
                    .filter((attempt) => attempt.status === 'review')
                    .map((attempt) => (
                      <div key={attempt.id}>
                        <AlertCircle size={20} />
                        <span>{attempt.studentName} · إجابات متأخرة تحتاج المراجعة</span>
                      </div>
                    ))}
                  {!alerts.length && !attempts.some((attempt) => attempt.status === 'review') && (
                    <p>لا توجد تنبيهات حالية.</p>
                  )}
                </div>
              )}
              {!visible.length && tab !== 'alerts' && (
                <div className="lab-empty">
                  <Monitor size={40} />
                  <h3>لا توجد أجهزة ضمن هذا العرض</h3>
                  <p>تظهر أجهزة الطلاب بعد تسجيل الدخول والاتصال بالمعلم.</p>
                </div>
              )}
            </div>
          </div>
        </FocusWindow>
      )}
    </>
  );
}
