import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { geometryCommands } from './geometry';
import MathText, { FormulaEditor } from './MathText';
import FocusWindow from './FocusWindow';
import { Sparkles, PencilLine, ImagePlus } from 'lucide-react';
import './geometryEditor.css';
export default function GeometryEditor({
  onSave,
  onClose,
  notify,
  geometryId,
  initialPrompt,
}: {
  onSave: (image: string, id: string) => void;
  geometryId?: string;
  initialPrompt?: string;
  onClose: () => void;
  notify: (s: string) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false),
    [prompt, setPrompt] = useState(
      initialPrompt || 'ارسم دائرة مركزها O ونصف قطرها 3 ونقطة A على المحيط',
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [editing, setEditing] = useState(false),
    [status, setStatus] = useState('');
  const construction = useRef<any>(undefined);
  const generatedLocally=useRef(false);
  // Opening a drawing must not silently send the question to an AI provider.
  useEffect(() => {
    const receive = async (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      if (e.data?.type === 'geometry-ready') {
        setReady(true);
        if (geometryId)
          try {
            const asset = await api(`/api/geometry/${geometryId}`);
            construction.current = asset.construction;
            frame.current?.contentWindow?.postMessage(
              { type: 'geometry-load', ggb: asset.ggb },
              location.origin,
            );
          } catch (error) {
            notify((error as Error).message);
          }
      }
      if (e.data?.type === 'geometry-error') {
        setBusy(false);
        setError(e.data.message || 'تعذر إنشاء الرسم');
      }
      if (e.data?.type === 'geometry-built') {
        setBusy(false);
        setStatus(generatedLocally.current ? 'الرسم جاهز · استُخدم تحليل المعادلات المحلي' : 'الرسم جاهز للمراجعة');
      }
      if (e.data?.type === 'geometry-exported') {
        try {
          const saved = await api('/api/geometry', 'POST', {
            construction: construction.current,
            image: e.data.image,
            ggb: e.data.ggb,
          });
          onSave(e.data.image, saved.id);
          onClose();
        } catch (error) {
          setBusy(false);
          notify((error as Error).message);
        }
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, []);
  async function build() {
    setBusy(true);
    setError('');
    setStatus('');
    try {
      const result = await api('/api/geometry/generate', 'POST', { prompt });
      generatedLocally.current=result.origin==='local';
      const commands = geometryCommands(result);
      construction.current = result;
      frame.current?.contentWindow?.postMessage(
        { type: 'geometry-build', commands },
        location.origin,
      );
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!busy) return;
    const timeout = setTimeout(() => {
      setBusy(false);
      setError('انتهت مهلة الرسم. يمكنك الرسم يدويًا أو إعادة المحاولة.');
    }, 100000);
    return () => clearTimeout(timeout);
  }, [busy]);
  return (
    <FocusWindow title="مساحة الرسم · GeoGebra" onClose={onClose} wide>
      <section className="geometry-workspace">
        <div className="geometry-question">
          <div className="geometry-question-heading">
            <small>السؤال</small>
            <button className="text-button" onClick={() => setEditing(!editing)}>
              <PencilLine size={14} />
              {editing ? 'عرض السؤال' : 'تعديل النص'}
            </button>
          </div>
          {editing ? (
            <FormulaEditor value={prompt} onChange={setPrompt} tools={false} />
          ) : (
            <MathText text={prompt} />
          )}
        </div>
        <div className="geometry-actions">
          <button
            className="secondary"
            disabled={!ready || busy || !prompt.trim()}
            onClick={() => void build()}
          >
            <Sparkles size={16} />
            {busy ? 'جارٍ تجهيز الرسم…' : 'اقتراح رسم للسؤال'}
          </button>
          <small>ارسم يدويًا، أو اقترح رسمًا ثم راجعه قبل إرفاقه.</small>
        </div>
        {error && (
          <div className="geometry-error" role="alert">
            <strong>لم يكتمل اقتراح الرسم</strong>
            <p>{error}</p>
            <small>
              الرسم اليدوي متاح. راجع اتصال مزود الذكاء الاصطناعي في الإعدادات إذا احتاج السؤال إلى
              تحليل.
            </small>
          </div>
        )}
        {status && (
          <p className="geometry-status" role="status">
            {status}
          </p>
        )}
        <iframe
          title="GeoGebra"
          ref={frame}
          src="geometry.html"
          sandbox="allow-scripts allow-same-origin"
          className="geometry-editor-frame"
        />
        {!ready && <p role="status">جارٍ تحميل GeoGebra المحلي…</p>}
        <footer className="geometry-footer">
          <small>
            GeoGebra ·{' '}
            <a href="https://www.geogebra.org/license" target="_blank" rel="noreferrer">
              الترخيص التعليمي
            </a>
          </small>
          <button
            className="primary"
            disabled={!ready || busy}
            onClick={() => {
              setBusy(true);
              setError('');
              frame.current?.contentWindow?.postMessage(
                { type: 'geometry-export' },
                location.origin,
              );
            }}
          >
            <ImagePlus size={16} /> إرفاق الرسم بالسؤال
          </button>
        </footer>
      </section>
    </FocusWindow>
  );
}
