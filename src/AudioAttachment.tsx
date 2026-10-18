import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Upload, Trash2 } from 'lucide-react';
import { fileBase64 } from './api';
import AudioPlayer from './AudioPlayer';
export type ExamAudio = { name: string; data?: string; id?: string };
export default function AudioAttachment({
  value,
  onChange,
  label = 'مقطع صوتي اختياري',
}: {
  value?: ExamAudio;
  onChange: (value: ExamAudio | undefined) => void;
  label?: string;
}) {
  const [recording, setRecording] = useState(false),
    [error, setError] = useState(''),
    [starting, setStarting] = useState(false);
  const recorder = useRef<MediaRecorder | undefined>(undefined),
    stream = useRef<MediaStream | undefined>(undefined),
    timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    alive = useRef(true);
  const stop = () => {
    if (recorder.current?.state === 'recording') recorder.current.stop();
    stream.current?.getTracks().forEach((t) => t.stop());
    clearTimeout(timeout.current);
    setRecording(false);
  };
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (recorder.current) recorder.current.onstop = null;
      stop();
    };
  }, []);
  const accept = async (file: File) => {
    setError('');
    if (!/\.(mp3|wav|ogg|webm)$/i.test(file.name) || file.size > 2 * 1024 * 1024) {
      setError('اختر MP3 أو WAV أو OGG أو WebM حتى 2 ميغابايت.');
      return;
    }
    const data = await fileBase64(file);
    const mime = /\.mp3$/i.test(file.name)
      ? 'mpeg'
      : /\.wav$/i.test(file.name)
        ? 'wav'
        : /\.ogg$/i.test(file.name)
          ? 'ogg'
          : 'webm';
    onChange({
      name: file.name.slice(0, 150),
      data: data.replace(/^data:[^,]*;base64,/, `data:audio/${mime};base64,`),
    });
  };
  const record = async () => {
    if (starting || recording) return;
    setStarting(true);
    setError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw Error('التسجيل غير متاح على هذا الجهاز؛ يمكنك رفع ملف صوتي.');
      const media = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      if (!alive.current) {
        media.getTracks().forEach((t) => t.stop());
        return;
      }
      stream.current = media;
      const mime = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus'].find((t) =>
        MediaRecorder.isTypeSupported(t),
      );
      if (!mime) throw Error('ارفع ملفًا صوتيًا؛ التسجيل غير مدعوم بهذا المتصفح.');
      const r = new MediaRecorder(media, { mimeType: mime, audioBitsPerSecond: 48000 }),
        chunks: Blob[] = [];
      let size = 0;
      recorder.current = r;
      r.ondataavailable = (e) => {
        size += e.data.size;
        chunks.push(e.data);
        if (size > 1900000) stop();
      };
      r.onstop = () => {
        media.getTracks().forEach((t) => t.stop());
        clearTimeout(timeout.current);
        if (!alive.current) return;
        setRecording(false);
        void accept(
          new File(
            chunks,
            mime.startsWith('audio/ogg') ? 'تسجيل المعلم.ogg' : 'تسجيل المعلم.webm',
            { type: mime.split(';')[0] },
          ),
        ).catch((e) => setError(e.message));
      };
      r.start(1000);
      setRecording(true);
      timeout.current = setTimeout(stop, 120000);
    } catch (e) {
      stop();
      setError(
        (e as Error).name === 'NotAllowedError'
          ? 'اسمح باستخدام الميكروفون أو ارفع ملفًا جاهزًا.'
          : (e as Error).message,
      );
    } finally {
      if (alive.current) setStarting(false);
    }
  };
  return (
    <div className="audio-attachment">
      <strong>{label}</strong>
      <p>تسجيل حتى دقيقتين أو ملف حتى 2 ميغابايت. يستمع الطالب عند الضغط على تشغيل.</p>
      {value && (
        <>
          <AudioPlayer audio={value} />
          <small>{value.name}</small>
        </>
      )}
      <div className="button-row">
        <label className="secondary file-button">
          <Upload size={16} />
          رفع صوت
          <input
            type="file"
            accept=".mp3,.wav,.ogg,.webm"
            disabled={recording || starting}
            onChange={(e) => {
              if (e.target.files?.[0])
                void accept(e.target.files[0]).catch((e) => setError(e.message));
              e.target.value = '';
            }}
          />
        </label>
        <button
          type="button"
          className="secondary"
          disabled={starting}
          onClick={() => (recording ? stop() : void record())}
        >
          {recording ? <Square size={16} /> : <Mic size={16} />}{' '}
          {recording ? 'إيقاف وحفظ التسجيل' : 'تسجيل بصوتك'}
        </button>
        {value && (
          <button
            type="button"
            className="text-button danger"
            disabled={recording || starting}
            onClick={() => onChange(undefined)}
          >
            <Trash2 size={16} />
            إزالة الصوت
          </button>
        )}
      </div>
      {error && (
        <p className="error-note" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
