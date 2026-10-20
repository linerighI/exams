import { useEffect, useRef, useState } from 'react';
import { Camera, ImageUp, QrCode, Download, ShieldCheck } from 'lucide-react';
import { api } from './api';
import { openCamera, cameraError } from './cameraAccess';
import FocusWindow from './FocusWindow';
import './teacherAccess.css';
export function TeacherQrCard({ notify }: { notify: (s: string) => void }) {
  const [status, setStatus] = useState<any>(),
    [password, setPassword] = useState(''),
    [image, setImage] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    void api('/api/account/qr')
      .then(setStatus)
      .catch((e) => notify(e.message));
  }, []);
  const run = async (revoke = false) => {
    setBusy(true);
    try {
      if (revoke) {
        await api('/api/account/qr', 'DELETE', { password });
        setImage('');
        setStatus({ enabled: false });
        notify('أُلغي رمز الدخول السابق');
      } else {
        const value = await api('/api/account/qr', 'POST', { password });
        const qr = await import('qrcode');
        setImage(
          await qr.toDataURL(value.token, {
            width: 320,
            margin: 3,
            color: { dark: '#294c7a', light: '#ffffff' },
          }),
        );
        setStatus({ enabled: true, expiresAt: value.expiresAt });
        notify('أُنشئ رمز دخول جديد؛ أُلغي أي رمز سابق');
      }
      setPassword('');
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="teacher-access-card">
      <div className="section-heading">
        <QrCode />
        <div>
          <h2>دخول المعلم بالرمز</h2>
          <p>احفظ صورة الرمز على هاتفك، ثم امسحها بكاميرا الكمبيوتر أو ارفع صورتها عند الدخول.</p>
        </div>
      </div>
      <p className="access-private-note">
        <ShieldCheck size={16} />
        الرمز مفتاح خاص لحسابك. لا تشاركه. ينتهي بعد 30 يومًا ويمكنك إلغاؤه هنا.
      </p>
      {status?.enabled && (
        <p>الرمز مفعل حتى {new Date(status.expiresAt).toLocaleDateString('ar-JO')}</p>
      )}
      <label className="field">
        كلمة المرور الحالية
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <div className="button-row">
        <button className="primary" disabled={busy || !password} onClick={() => void run()}>
          <QrCode size={17} />
          {status?.enabled ? 'إنشاء رمز بديل' : 'إنشاء رمز دخولي'}
        </button>
        {status?.enabled && (
          <button className="secondary" disabled={busy || !password} onClick={() => void run(true)}>
            إلغاء الرمز
          </button>
        )}
      </div>
      {image && (
        <div className="teacher-qr-download">
          <img src={image} alt="رمز الدخول الخاص بالمعلم" />
          <a className="secondary" href={image} download="teacher-login-qr.png">
            <Download size={16} />
            حفظ صورة الرمز
          </a>
        </div>
      )}
    </section>
  );
}
export function TeacherQrScanner({
  onToken,
  onClose,
}: {
  onToken: (token: string) => void;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null),
    media = useRef<MediaStream | null>(null),
    closed = useRef(false),
    [camera, setCamera] = useState(false),
    [error, setError] = useState('');
  const decode = async (data: ImageData) => {
    const { default: jsQR } = await import('jsqr');
    return jsQR(data.data, data.width, data.height, { inversionAttempts: 'dontInvert' })?.data;
  };
  const accept = (token?: string) => {
    if (!token || !/^alshereqi-teacher:v1:(master|[a-f0-9]{32}):[A-Za-z0-9_-]{43}$/.test(token)) {
      setError('لم نجد رمز دخول معلم صالحًا. استخدم صورة الرمز من الإعدادات.');
      return;
    }
    if (!closed.current) {
      closed.current = true;
      media.current?.getTracks().forEach((t) => t.stop());
      onToken(token);
    }
  };
  useEffect(() => {
    closed.current = false;
    return () => {
      closed.current = true;
      media.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  useEffect(() => {
    if (!camera) return;
    let disposed = false,
      working = false;
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 270;
    const timer = setInterval(() => {
      if (working || !video.current || video.current.readyState < 2) return;
      working = true;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(video.current, 0, 0, 480, 270);
      void decode(ctx.getImageData(0, 0, 480, 270))
        .then((token) => {
          if (token && !disposed) accept(token);
        })
        .catch(() => { if (!disposed) setError('تعذرت قراءة الرمز؛ جرّب اختيار صورته.'); })
        .finally(() => {
          working = false;
        });
    }, 400);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [camera]);
  const startCamera = async () => {
    setError('');
    try {
      const stream = await openCamera();
      if (closed.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      media.current = stream;
      setCamera(true);
      if (video.current) {
        video.current.srcObject = stream;
        await video.current.play();
      }
    } catch (e) {
      media.current?.getTracks().forEach((t) => t.stop());
      setCamera(false);
      setError(cameraError(e));
    }
  };
  return (
    <FocusWindow title="دخول المعلم بالرمز" onClose={onClose}>
      <div className="teacher-qr-scanner">
        <QrCode size={36} />
        <p>اعرض رمزك على كاميرا الكمبيوتر، أو اختر الصورة المحفوظة.</p>
        <video
          ref={video}
          autoPlay
          muted
          playsInline
          className={camera ? '' : 'is-hidden'}
          aria-label="معاينة مسح رمز الدخول"
        />
        <div className="button-row">
          <button
            type="button"
            className="primary"
            disabled={camera}
            onClick={() => void startCamera()}
          >
            <Camera size={17} />
            فتح الكاميرا
          </button>
          <label className="secondary qr-file">
            <ImageUp size={17} />
            اختيار صورة الرمز
            <input
              type="file"
              accept="image/*"
              aria-label="صورة رمز دخول المعلم"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void (async () => {
                  try {
                    const image = await createImageBitmap(file);
                    const scale = Math.min(1, 1024 / Math.max(image.width, image.height)),
                      canvas = document.createElement('canvas');
                    canvas.width = Math.round(image.width * scale);
                    canvas.height = Math.round(image.height * scale);
                    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
                    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
                    image.close();
                    accept(await decode(ctx.getImageData(0, 0, canvas.width, canvas.height)));
                  } catch {
                    setError('تعذرت قراءة الصورة؛ اختر صورة PNG أو JPG واضحة.');
                  }
                })();
              }}
            />
          </label>
        </div>
        {error && (
          <p role="alert" className="error-note">
            {error}
          </p>
        )}
      </div>
    </FocusWindow>
  );
}
