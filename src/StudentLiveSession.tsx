import { useEffect, useRef, useState } from 'react';
import { Camera, VideoOff } from 'lucide-react';
import { api } from './api';
import FocusWindow from './FocusWindow';
import './liveLab.css';

export default function StudentLiveSession({
  token,
  attemptId,
  page,
}: {
  token: string;
  attemptId?: string;
  page: string;
}) {
  const [requested, setRequested] = useState(false),
    [live, setLive] = useState(false),
    [error, setError] = useState(''),
    [starting, setStarting] = useState(false);
  const [clientId] = useState(() => {
    const key = 'school-live-client';
    let value = sessionStorage.getItem(key);
    if (!value) {
      value = crypto.randomUUID();
      sessionStorage.setItem(key, value);
    }
    return value;
  });
  const stream = useRef<MediaStream | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    version = useRef(0),
    cameraState = useRef('idle'),
    requestVersion = useRef(-1),
    startingRef = useRef(false);
  const location = useRef(page);
  location.current = page;
  const stop = (state = 'idle') => {
    version.current++;
    clearTimeout(timer.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    cameraState.current = state;
    setLive(false);
  };
  useEffect(() => {
    let disposed = false,
      working = false;
    const heartbeat = async () => {
      if (working) return;
      working = true;
      try {
        const result = await api('/api/lab/heartbeat', 'POST', {
          clientId,
          platform: navigator.platform.slice(0, 100),
          page: document.hidden ? 'background' : location.current,
          attemptId,
          camera: cameraState.current,
        });
        if (disposed) return;
        if (!result.cameraRequested || !result.cameraAllowed) {
          setRequested(false);
          if (stream.current || startingRef.current) stop();
        } else if (result.requestVersion !== requestVersion.current && !stream.current) {
          cameraState.current = 'idle';
          setError('');
          setRequested(true);
        }
        requestVersion.current = result.requestVersion;
      } catch {
        if (!disposed) {
          setRequested(false);
          if (stream.current || startingRef.current) stop('error');
        }
      } finally {
        working = false;
      }
    };
    cameraState.current = 'idle';
    void heartbeat();
    const tick = setInterval(() => void heartbeat(), 4000);
    return () => {
      disposed = true;
      clearInterval(tick);
      stop();
    };
  }, [token, attemptId, clientId]);
  const pause = async () => {
    stop('paused');
    setRequested(false);
    await api(`/api/lab/devices/${clientId}/pause`, 'POST').catch(() => {});
  };
  const start = async () => {
    setStarting(true);
    startingRef.current = true;
    setError('');
    const generation = ++version.current;
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { width: { ideal: 480 }, height: { ideal: 270 }, frameRate: { ideal: 2, max: 5 } },
      });
      if (generation !== version.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      const video = document.createElement('video');
      video.muted = true;
      video.srcObject = media;
      await video.play();
      const canvas = document.createElement('canvas');
      canvas.width = 480;
      canvas.height = 270;
      cameraState.current = 'live';
      setLive(true);
      setRequested(false);
      media.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (generation === version.current) {
          stop('error');
          setError('توقف وصول الكاميرا');
        }
      });
      const send = async () => {
        if (generation !== version.current || !stream.current) return;
        try {
          canvas.getContext('2d')!.drawImage(video, 0, 0, 480, 270);
          await api(`/api/lab/devices/${clientId}/frame`, 'POST', {
            image: canvas.toDataURL('image/jpeg', 0.48),
          });
        } catch {
          if (generation === version.current) {
            stop('error');
            setError('توقف البث. تحقق من الاتصال أو أبلغ المعلم.');
          }
          return;
        }
        if (generation === version.current) timer.current = setTimeout(() => void send(), 1000);
      };
      void send();
    } catch (error) {
      stop('denied');
      setError(
        (error as Error).name === 'NotAllowedError'
          ? 'لم يُسمح بالوصول إلى الكاميرا. تحقق من أذونات Windows.'
          : 'تعذر تشغيل الكاميرا. أبلغ المعلم.',
      );
    } finally {
      setStarting(false);
      startingRef.current = false;
    }
  };
  return (
    <>
      {live && (
        <div className="student-live-banner" role="status">
          <Camera size={17} />
          <span>الكاميرا تبث مباشرة إلى المعلم · دون صوت</span>
          <button onClick={() => void pause()}>إيقاف البث</button>
        </div>
      )}
      {requested && (
        <FocusWindow title="طلب بث الكاميرا" onClose={() => void pause()}>
          <div className="student-live-consent">
            <Camera size={32} />
            <h3>المعلم يطلب متابعة الكاميرا أثناء الامتحان</h3>
            <p>
              يُرسل بث منخفض الإطارات داخل شبكة المدرسة، دون صوت. يظهر مؤشر واضح أثناء البث، ويتوقف
              عند انتهاء الامتحان أو إغلاق المعلم للمتابعة. لا تُحفظ الإطارات في قاعدة البيانات.
            </p>
            {error && (
              <p className="error-note" role="alert">
                {error}
              </p>
            )}
            <div className="button-row">
              <button className="primary" disabled={starting} onClick={() => void start()}>
                {starting ? 'جارٍ تشغيل الكاميرا…' : 'السماح وبدء البث'}
              </button>
              <button className="secondary" disabled={starting} onClick={() => void pause()}>
                <VideoOff size={16} />
                ليس الآن
              </button>
            </div>
          </div>
        </FocusWindow>
      )}
      {error && !requested && !live && (
        <div className="student-camera-error" role="status">
          {error}
          <button onClick={() => setError('')}>إغلاق</button>
        </div>
      )}
    </>
  );
}
