import { useEffect, useRef, useState } from 'react';
import { Volume2, Square, Loader2 } from 'lucide-react';
import { speechChunks } from './speechAudio';
import './speechDictation.css';

export default function SpeechReadButton({ text }: { text: string }) {
  const [state, setState] = useState<'idle' | 'loading' | 'playing'>('idle'),
    [error, setError] = useState('');
  const generation = useRef(0),
    audio = useRef<HTMLAudioElement | null>(null),
    mounted = useRef(true),
    identity = useRef({});
  const stop = () => {
    generation.current++;
    if (audio.current) {
      audio.current.pause();
      audio.current.src = '';
      audio.current = null;
    }
    if (mounted.current) setState('idle');
  };
  useEffect(() => {
    mounted.current = true;
    const other = (event: Event) => {
      if ((event as CustomEvent).detail !== identity.current) stop();
    };
    const dictate = () => stop(),
      hide = () => {
        if (document.hidden) stop();
      };
    window.addEventListener('assistant-playback-start', other);
    window.addEventListener('assistant-dictation-start', dictate);
    document.addEventListener('visibilitychange', hide);
    return () => {
      mounted.current = false;
      window.removeEventListener('assistant-playback-start', other);
      window.removeEventListener('assistant-dictation-start', dictate);
      document.removeEventListener('visibilitychange', hide);
      stop();
    };
  }, []);
  const play = async () => {
    if (state !== 'idle') {
      stop();
      return;
    }
    setError('');
    window.dispatchEvent(new CustomEvent('assistant-playback-start', { detail: identity.current }));
    const current = ++generation.current;
    try {
      if (!window.desktop?.synthesizeSpeech) throw Error('الصوت المحلي متاح في تطبيق Windows.');
      for (const chunk of speechChunks(text)) {
        if (!mounted.current || generation.current !== current) return;
        setState('loading');
        const result = await window.desktop.synthesizeSpeech(
          chunk,
          /[\u0600-\u06ff]/.test(chunk) ? 'ar' : 'en',
        );
        if (!mounted.current || generation.current !== current) return;
        const player = new Audio(result.audio);
        audio.current = player;
        await new Promise<void>((resolve, reject) => {
          player.onended = () => resolve();
          player.onerror = () => reject(Error('تعذر تشغيل الصوت'));
          player.onemptied = () => resolve();
          player
            .play()
            .then(() => {
              if (mounted.current && generation.current === current) setState('playing');
            })
            .catch(reject);
        });
        player.src = '';
        if (audio.current === player) audio.current = null;
      }
    } catch (e) {
      if (mounted.current && generation.current === current) setError((e as Error).message);
    } finally {
      if (generation.current === current) {
        if (audio.current) {
          audio.current.pause();
          audio.current.src = '';
          audio.current = null;
        }
        if (mounted.current) setState('idle');
      }
    }
  };
  return (
    <span className="reply-speech">
      <button
        type="button"
        className={`reply-speech-button ${state !== 'idle' ? 'is-active' : ''}`}
        aria-label={state === 'idle' ? 'قراءة الرد بصوت محلي' : 'إيقاف قراءة الرد'}
        onClick={() => void play()}
      >
        {state === 'idle' ? (
          <Volume2 size={14} />
        ) : state === 'loading' ? (
          <Loader2 size={14} className="spin" />
        ) : (
          <Square size={13} />
        )}
        <span>
          {state === 'idle' ? 'قراءة الرد' : state === 'loading' ? 'جارٍ تجهيز الصوت…' : 'إيقاف'}
        </span>
      </button>
      {error && <small role="alert">{error}</small>}
    </span>
  );
}
