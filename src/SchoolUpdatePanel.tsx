import { useEffect, useState } from 'react';
import { MonitorUp, Send, RefreshCw } from 'lucide-react';
import { api } from './api';
import type { UpdateState } from '../desktop/appUpdater';
const labels: Record<string, string> = {
  queued: 'في الانتظار',
  downloading: 'جارٍ التنزيل',
  waiting: 'بعد تسليم الامتحان',
  ready: 'جاهز لإعادة التشغيل',
  installing: 'جارٍ التثبيت',
  current: 'محدّث',
  error: 'تحتاج مراجعة',
};
export default function SchoolUpdatePanel({
  state,
  prepare,
}: {
  state: UpdateState;
  prepare: () => void;
}) {
  const [data, setData] = useState<any>(),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const refresh = async () => {
    try {
      setData(await api('/api/school-updates'));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    return () => clearInterval(timer);
  }, []);
  const action = async (path: string, method: string) => {
    setBusy(true);
    setError('');
    try {
      await api(path, method);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="school-update-card">
      <header>
        <span className="school-update-icon">
          <MonitorUp size={26} />
        </span>
        <div>
          <h3>تحديث أجهزة الطلاب من مكانك</h3>
          <p>نزّل نسخة موثّقة مرة واحدة، ثم أرسلها عبر شبكة المدرسة.</p>
        </div>
      </header>
      <p className="info-note">
        تُنزل أجهزة الطلاب المتصلة التحديث تلقائيًا، وتؤجّل التثبيت حتى تسليم الامتحان. أبقِ الجهاز
        الرئيسي مفتوحًا حتى اكتمال التنزيل.
      </p>
      <div className="button-row">
        <button
          className="secondary"
          disabled={
            busy || ['checking', 'downloading', 'ready', 'installing'].includes(state.status)
          }
          onClick={prepare}
        >
          <RefreshCw size={16} />
          تجهيز أحدث نسخة للطلاب
        </button>
        <button
          className="primary"
          disabled={
            busy || !data?.supported || state.status !== 'ready' || state.source !== 'github'
          }
          onClick={() => void action('/api/school-updates/publish', 'POST')}
        >
          <Send size={16} />
          إرسال التحديث للطلاب
        </button>
        {data?.campaign && (
          <button
            className="text-button"
            disabled={busy}
            onClick={() => void action('/api/school-updates', 'DELETE')}
          >
            إيقاف الإرسال
          </button>
        )}
      </div>
      <small>
        يشمل الأجهزة التي تدعم تحديث المدرسة. قد يطلب Windows إذن المسؤول. إذا كانت نسختك هي الأحدث،
        يمكنك تجهيزها أيضًا للأجهزة الأقدم.
      </small>
      {data?.campaign && (
        <div className="school-update-status">
          <strong>
            الإصدار <bdi>{data.campaign.version}</bdi> متاح لطلابك
          </strong>
          <span>{data.devices.length} جهاز أبلغ عن حالته</span>
        </div>
      )}
      {data?.devices?.length > 0 && (
        <div className="school-update-devices">
          <table>
            <thead>
              <tr>
                <th>الطالب</th>
                <th>الإصدار الحالي</th>
                <th>حالة الجهاز</th>
              </tr>
            </thead>
            <tbody>
              {data.devices.map((device: any) => (
                <tr key={`${device.studentId}:${device.clientId}`}>
                  <td>{device.name}</td>
                  <td>
                    <bdi>{device.current}</bdi>
                  </td>
                  <td>
                    {labels[device.status] || device.status}
                    {device.status === 'downloading' ? ` · ${Math.floor(device.progress)}%` : ''}
                    {device.error && <small className="error-note">{device.error}</small>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {error && (
        <p role="alert" className="error-note">
          {error}
        </p>
      )}
    </section>
  );
}
