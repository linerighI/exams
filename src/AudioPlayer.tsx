import { useEffect, useState } from 'react';
import { api } from './api';
import type { ExamAudio } from './AudioAttachment';
export default function AudioPlayer({ audio, label }: { audio: ExamAudio; label?: string }) {
  const [data, setData] = useState(audio.data),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setData(audio.data);
    setError('');
    if (!audio.data && audio.id)
      void api(`/api/exam-audio/${audio.id}`)
        .then((value) => {
          if (active) setData(value.data);
        })
        .catch(() => {
          if (active) setError('تعذر تحميل الصوت. تحقق من الاتصال وحاول إعادة فتح السؤال.');
        });
    return () => {
      active = false;
    };
  }, [audio.id, audio.data]);
  return error ? (
    <p role="alert">{error}</p>
  ) : data ? (
    <audio controls src={data} preload="metadata" onError={()=>setError('تعذر تشغيل هذا الترميز الصوتي. جرّب ملف MP3 أو WAV آخر.')} aria-label={label || audio.name} />
  ) : (
    <small role="status">جارٍ تحميل الصوت…</small>
  );
}
