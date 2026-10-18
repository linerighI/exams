import { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import FocusWindow from './FocusWindow';
import { openCamera, cameraError } from './cameraAccess';
import './comfort.css';
export default function CameraCheck({
  onContinue,
  onClose,
}: {
  onContinue: (available: boolean) => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [ready, setReady] = useState(false);
  const stream = useRef<MediaStream | undefined>(undefined),
    video = useRef<HTMLVideoElement>(null),
    generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  const check = async () => {
    const attempt = ++generation.current;
    setBusy(true);
    setError('');
    setReady(false);
    stream.current?.getTracks().forEach((t) => t.stop());
    try {
      const media = await openCamera();
      if (attempt !== generation.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      video.current!.srcObject = media;
      await video.current!.play();
      setReady(true);
    } catch (e) {
      if (attempt === generation.current) {
        stream.current?.getTracks().forEach((t) => t.stop());
        setError(cameraError(e));
      }
    } finally {
      if (attempt === generation.current) setBusy(false);
    }
  };
  return (
    <FocusWindow title="فحص الكاميرا قبل الامتحان" onClose={onClose}>
      <div className="camera-check">
        <Camera size={32} />
        <h3>لنتأكد أن الكاميرا تعمل</h3>
        <p>هذه معاينة على جهازك فقط. لا يبدأ البث للمعلم إلا بعد موافقتك على طلب المتابعة.</p>
        <video
          ref={video}
          autoPlay
          muted
          playsInline
          className={ready ? 'ready' : ''}
          aria-label="معاينة الكاميرا"
        />
        {error && (
          <p className="error-note" role="alert">
            {error}
          </p>
        )}
        {ready && (
          <p className="camera-ready">
            <CheckCircle2 size={18} />
            الكاميرا جاهزة
          </p>
        )}
        <div className="button-row">
          <button
            className={ready ? 'secondary' : 'primary'}
            disabled={busy}
            onClick={() => void check()}
          >
            {busy ? (
              <Loader2 className="spin" size={17} />
            ) : ready || error ? (
              <RefreshCw size={17} />
            ) : (
              <Camera size={17} />
            )}{' '}
            {busy
              ? 'جارٍ تشغيل الكاميرا…'
              : ready || error
                ? 'إعادة الفحص'
                : 'السماح وفحص الكاميرا'}
          </button>
          {ready && (
            <button className="primary" onClick={() => onContinue(true)}>
              متابعة إلى الامتحان
            </button>
          )}
        </div>
        {!ready && !busy && (
          <button className="text-button" onClick={() => onContinue(false)}>
            المتابعة دون كاميرا إن سمح المعلم
          </button>
        )}
        <small>إذا كانت الكاميرا مطلوبة، يستطيع المعلم إعطاء استثناء من صفحة الطلاب.</small>
      </div>
    </FocusWindow>
  );
}
