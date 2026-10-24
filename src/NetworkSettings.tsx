import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Check, RefreshCw, Network, Wifi, ChevronDown } from 'lucide-react';
import type { NetworkState } from './types';
const NetworkGuide = lazy(() => import('./NetworkGuide'));
export default function NetworkSettings() {
  const [state, setState] = useState<NetworkState>(),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false),
    [guide, setGuide] = useState(false);
  const live = useRef(true);
  const [quiet, setQuiet] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)'),
      change = () => setQuiet(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  const load = async () => {
    setBusy(true);
    setError('');
    try {
      if (!window.desktop?.networkState)
        throw Error('إعدادات الشبكة متاحة في تطبيق Windows المحدّث.');
      const info = await window.desktop.networkState();
      if (live.current) setState(info);
    } catch (e) {
      if (live.current) setError((e as Error).message);
    } finally {
      if (live.current) setBusy(false);
    }
  };
  useEffect(() => {
    live.current = true;
    void load();
    return () => {
      live.current = false;
    };
  }, []);
  const save = async (value: string) => {
    setBusy(true);
    setSaved(false);
    setError('');
    try {
      const info = await window.desktop!.networkPreferences(value);
      if (live.current) {
        setState(info);
        setSaved(true);
      }
    } catch (e) {
      if (live.current) setError((e as Error).message);
    } finally {
      if (live.current) setBusy(false);
    }
  };
  return (
    <section className="network-panel" aria-label="إعدادات شبكة المدرسة">
      <div className="network-heading">
        <span>
          <Network size={21} />
          <strong>شبكة واحدة، بأي اتصال</strong>
        </span>
        <button className="connect-text" onClick={() => void load()} disabled={busy}>
          <RefreshCw size={14} />
          تحديث
        </button>
      </div>
      <p>
        استخدم كابل Ethernet أو Wi-Fi أو نقطة اتصال. يبحث التطبيق عبر الشبكات المتصلة معًا ويحافظ
        على الاتصال الذي يعمل.
      </p>
      <div className="network-auto">
        <Check size={17} />
        <div>
          <strong>
            <bdi>Ethernet</bdi> و<bdi>Wi-Fi</bdi> يعملان معًا
          </strong>
          <small>لا تحتاج إلى إيقاف الكابل عند إضافة أجهزة لاسلكية. لا يلزم اتصال بالإنترنت.</small>
        </div>
      </div>
      {state && (
        <>
          <label className="field">
            أولوية البحث
            <select
              aria-label="أولوية البحث في الشبكات"
              disabled={busy}
              value={
                state.adapters.some((a) => a.address === state.preferredAddress)
                  ? state.preferredAddress
                  : ''
              }
              onChange={(e) => void save(e.target.value)}
            >
              <option value="">تلقائي · كل الشبكات (موصى به)</option>
              {state.adapters.map((a) => (
                <option key={a.address} value={a.address}>
                  {a.name} · {a.address}
                </option>
              ))}
            </select>
          </label>
          <small className="network-hint">
            الأولوية للبحث فقط؛ تبقى بقية الشبكات متاحة ولا يتغير اتصالك الحالي.
          </small>
          {state.preferredAddress &&
            !state.adapters.some((a) => a.address === state.preferredAddress) && (
              <p className="network-hint">الشبكة المفضلة غير متصلة؛ البحث التلقائي مستمر.</p>
            )}
          {state.hosting && state.pairingCode && (
            <div className="network-pair-code">
              <span>رمز ربط أجهزة الطلاب</span>
              <bdi>{state.pairingCode}</bdi>
              <small>أدخل هذا الرمز على جهاز الطالب بعد اختيار جهاز المعلم.</small>
            </div>
          )}
          <h3>{state.hosting ? 'عناوين هذا الجهاز الرئيسي' : 'عناوين هذا الكمبيوتر'}</h3>
          {state.adapters.length ? (
            <ul className="network-adapters">
              {state.adapters.map((a) => (
                <li key={a.address}>
                  <span>{a.name}</span>
                  <bdi>{a.address}</bdi>
                </li>
              ))}
            </ul>
          ) : (
            <p>لا توجد شبكة IPv4 متصلة. اتصل بشبكة المدرسة ثم حدّث القائمة.</p>
          )}
          {state.host && (
            <div className="network-current">
              {state.hosting ? 'الخادم المحلي' : 'عنوان جهاز المعلم المحفوظ'}{' '}
              <bdi>{state.host}</bdi>
            </div>
          )}
          {state.hosting && (
            <small className="network-hint">
              يمكن للطلاب إدخال أحد العناوين أعلاه يدويًا إذا لم يظهر الجهاز في البحث.
            </small>
          )}
        </>
      )}
      {saved && (
        <p className="network-saved" role="status">
          <Check size={14} />
          تم حفظ أولوية البحث على هذا الجهاز.
        </p>
      )}
      {error && (
        <p className="connect-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="network-guide-toggle"
        aria-expanded={guide}
        onClick={() => setGuide(!guide)}
      >
        <Wifi size={17} />
        كيفية الاتصال بـ Wi-Fi أو Hotspot <ChevronDown size={15} />
      </button>
      {guide && (
        <div className="network-guide">
          <Suspense fallback={<div style={{ height: 130 }} />}>
            <NetworkGuide quiet={quiet} />
          </Suspense>
          <ol>
            <li>
              صل أجهزة المعلم والطلاب بالشبكة نفسها. يمكن أن يكون المعلم على الكابل والطلاب على
              Wi-Fi متصل بالموجّه نفسه.
            </li>
            <li>
              لـ Hotspot: فعّل نقطة الاتصال من إعدادات Windows على أحد الأجهزة، ثم صل بقية الأجهزة
              بها. يجب أن يكون جهاز المعلم قابلًا للوصول من الجميع.
            </li>
            <li>
              شغّل الجهاز الرئيسي على كمبيوتر المعلم فقط. افتح كرة الاتصال على جهاز الطالب، اختر
              المعلم وأدخل رمز الاتصال.
            </li>
          </ol>
          <p>
            لم يظهر المعلم؟ أدخل عنوانه من لوحة الاتصال. على شبكة مدرسة موثوقة، اجعل ملف الشبكة في
            Windows «خاص / Private» للسماح بقواعد التطبيق. قد تمنع شبكة الضيوف أو عزل الأجهزة
            الاتصال حتى لو كان الإنترنت يعمل.
          </p>
          <p>
            الانتقال لشبكة أخرى يعيد البحث عن جهاز المعلم نفسه ببصمته المحفوظة. أثناء الانقطاع تبقى
            إجاباتك محفوظة محليًا وتُزامن عند عودة الاتصال.
          </p>
        </div>
      )}
    </section>
  );
}
