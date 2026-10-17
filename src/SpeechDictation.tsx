import { useEffect, useRef, useState, type RefObject } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { pcm16FromChunks } from './speechAudio';
import './speechDictation.css';
export function appendDictation(current: string, spoken: string) {
  return `${current}${current && !/\s$/.test(current) ? ' ' : ''}${spoken.trim()}`.slice(0, 6000);
}
export default function SpeechDictation({
  inputRef,
  disabled,
  onText,
  onListeningChange,
}: {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  disabled: boolean;
  onText: (text: string) => void;
  onListeningChange: (value: boolean) => void;
}) {
  const [phase, setPhase] = useState<'idle' | 'starting' | 'recording' | 'processing'>('idle'),
    [language, setLanguage] = useState<'ar' | 'en'>('ar'),
    [seconds, setSeconds] = useState(0),
    [error, setError] = useState('');
  const capture = useRef<{
    stream: MediaStream;
    context: AudioContext;
    processor: ScriptProcessorNode;
    source: MediaStreamAudioSourceNode;
    mute: GainNode;
    chunks: Float32Array[];
    size: number;
  } | null>(null);
  const generation = useRef(0),
    timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined),
    mounted = useRef(true),
    latest = useRef({ onText, onListeningChange });
  latest.current = { onText, onListeningChange };
  const state = (next: typeof phase) => {
    if (mounted.current) setPhase(next);
    latest.current.onListeningChange(next !== 'idle');
  };
  const release = () => {
    clearInterval(timer.current);
    const old = capture.current;
    capture.current = null;
    if (old) {
      old.processor.onaudioprocess = null;
      old.source.disconnect();
      old.processor.disconnect();
      old.mute.disconnect();
      old.stream.getTracks().forEach((t) => t.stop());
      void old.context.close();
    }
    return old;
  };
  const abort = () => {
    generation.current++;
    release();
    state('idle');
  };
  const stop = async () => {
    const old = release();
    if (!old) return;
    const current = generation.current;
    state('processing');
    try {
      const bytes = pcm16FromChunks(old.chunks, old.context.sampleRate);
      if (bytes.length < 6400) throw Error('المقطع قصير جدًا. تحدث قليلًا ثم أوقف التسجيل.');
      let binary = '';
      for (let i = 0; i < bytes.length; i += 8192)
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      const result = await window.desktop!.transcribeSpeech(btoa(binary), language);
      if (!mounted.current || current !== generation.current) return;
      if (result.text.trim()) latest.current.onText(result.text);
      else setError('لم ألتقط كلامًا واضحًا. اقترب من الميكروفون وأعد المحاولة.');
    } catch (e) {
      if (mounted.current && current === generation.current) setError((e as Error).message);
    } finally {
      if (mounted.current && current === generation.current) {
        state('idle');
        inputRef.current?.focus();
      }
    }
  };
  useEffect(() => {
    mounted.current = true;
    const hide = () => {
      if (document.hidden) abort();
    };
    const other = (event: Event) => {
      if ((event as CustomEvent).detail !== inputRef) abort();
    };
    const playback = () => abort();
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('assistant-dictation-start', other);
    window.addEventListener('assistant-playback-start', playback);
    return () => {
      mounted.current = false;
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('assistant-dictation-start', other);
      window.removeEventListener('assistant-playback-start', playback);
      abort();
    };
  }, []);
  useEffect(() => {
    if (disabled) abort();
  }, [disabled]);
  const start = async () => {
    if (phase === 'recording') {
      await stop();
      return;
    }
    if (phase !== 'idle') {
      abort();
      return;
    }
    setError('');
    setSeconds(0);
    window.dispatchEvent(new CustomEvent('assistant-dictation-start', { detail: inputRef }));
    const current = ++generation.current;
    state('starting');
    let stream: MediaStream | undefined;
    try {
      if (!window.desktop?.transcribeSpeech) throw Error('الصوت المحلي متاح من تطبيق Windows.');
      const status = await window.desktop.speechStatus();
      if (!mounted.current || current !== generation.current) return;
      if (!status.ready) throw Error('ملفات الصوت المحلي غير مكتملة. أعد تثبيت التطبيق.');
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      if (!mounted.current || current !== generation.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const context = new AudioContext({ sampleRate: 16000 }),
        source = context.createMediaStreamSource(stream),
        processor = context.createScriptProcessor(4096, 1, 1),
        mute = context.createGain();
      mute.gain.value = 0;
      source.connect(processor);
      processor.connect(mute);
      mute.connect(context.destination);
      const record = {
        stream,
        context,
        processor,
        source,
        mute,
        chunks: [] as Float32Array[],
        size: 0,
      };
      capture.current = record;
      processor.onaudioprocess = (event) => {
        if (capture.current !== record) return;
        const samples = event.inputBuffer.getChannelData(0),
          room = Math.max(0, Math.floor(context.sampleRate * 30 - record.size));
        if (room) {
          const copy = new Float32Array(samples.subarray(0, room));
          record.chunks.push(copy);
          record.size += copy.length;
        }
        if (record.size >= context.sampleRate * 30) void stop();
      };
      await context.resume();
      if (!mounted.current || current !== generation.current || capture.current !== record) return;
      state('recording');
      const began = Date.now();
      timer.current = setInterval(() => {
        if (mounted.current) setSeconds(Math.floor((Date.now() - began) / 1000));
        if (Date.now() - began >= 30000) void stop();
      }, 250);
    } catch (e) {
      stream?.getTracks().forEach((t) => t.stop());
      if (current !== generation.current) return;
      release();
      state('idle');
      const name = (e as Error).name;
      setError(
        name === 'NotAllowedError'
          ? 'لم يُسمح بالميكروفون. تحقق من أذونات الميكروفون في Windows.'
          : name === 'NotFoundError'
            ? 'لم يُعثر على ميكروفون متاح.'
            : (e as Error).message,
      );
    }
  };
  return (
    <div className={`speech-dictation ${phase !== 'idle' ? 'is-listening' : ''}`}>
      <div className="speech-controls">
        <button
          type="button"
          className="composer-tool speech-mic"
          aria-label={
            phase === 'recording'
              ? 'إيقاف الإملاء الصوتي'
              : phase === 'starting' || phase === 'processing'
                ? 'إلغاء الإملاء الصوتي'
                : 'الإملاء الصوتي'
          }
          aria-pressed={phase !== 'idle'}
          disabled={disabled}
          onClick={() => void start()}
          title="إملاء محلي دون إنترنت، حتى 30 ثانية"
        >
          <span>
            {phase === 'recording' ? (
              <Square size={15} />
            ) : phase === 'processing' || phase === 'starting' ? (
              <Loader2 size={16} className="spin" />
            ) : (
              <Mic size={17} />
            )}
          </span>
          {phase === 'recording'
            ? 'إيقاف'
            : phase === 'processing' || phase === 'starting'
              ? 'إلغاء'
              : 'إملاء صوتي'}
        </button>
        <select
          aria-label="لغة الإملاء الصوتي"
          value={language}
          disabled={phase !== 'idle' || disabled}
          onChange={(e) => setLanguage(e.target.value as 'ar' | 'en')}
        >
          <option value="ar">العربية</option>
          <option value="en">English</option>
        </select>
        <small className="speech-local">محلي</small>
      </div>
      {phase !== 'idle' && (
        <div className="speech-status" role="status">
          <b>
            {phase === 'recording'
              ? `الميكروفون يعمل · ${seconds} / 30 ث`
              : phase === 'starting'
                ? 'جارٍ فتح الميكروفون…'
                : 'جارٍ تحويل الكلام محليًا…'}
          </b>
          <span>راجع النص قبل الإرسال. لا يغادر الصوت هذا الجهاز.</span>
        </div>
      )}
      {error && (
        <div className="speech-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
