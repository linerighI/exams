import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { geometryCommands } from './geometry';
export default function GeometryEditor({
  onSave,
  onClose,
  notify,
  geometryId,
}: {
  onSave: (image: string, id:string) => void;
  geometryId?:string;
  onClose: () => void;
  notify: (s: string) => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false),
    [prompt, setPrompt] = useState('ارسم دائرة مركزها O ونصف قطرها 3 ونقطة A على المحيط'),
    [busy, setBusy] = useState(false);
  const construction = useRef<any>(undefined);
  useEffect(() => {
    const receive = async (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      if (e.data?.type === 'geometry-ready') {
        setReady(true);
        if(geometryId)try{const asset=await api(`/api/geometry/${geometryId}`);construction.current=asset.construction;frame.current?.contentWindow?.postMessage({type:'geometry-load',ggb:asset.ggb},'*');}catch(error){notify((error as Error).message);}
      }
      if (e.data?.type === 'geometry-error') notify(e.data.message);
      if (e.data?.type === 'geometry-exported') {
        try {
          const saved=await api('/api/geometry', 'POST', {
            construction: construction.current,
            image: e.data.image,
            ggb: e.data.ggb,
          });
          onSave(e.data.image,saved.id);
          onClose();
        } catch (error) {
          notify((error as Error).message);
        }
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, []);
  async function build() {
    setBusy(true);
    try {
      const result = await api('/api/geometry/generate', 'POST', { prompt });
      const commands = geometryCommands(result);
      construction.current = result;
      frame.current?.contentWindow?.postMessage({ type: 'geometry-build', commands }, '*');
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="workspace-modal">
      <section className="card question-review">
        <button onClick={onClose}>إغلاق</button>
        <h2>محرر الرسومات الهندسية</h2>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        <button disabled={!ready || busy} onClick={() => void build()}>
          إنشاء الرسم باستخدام Gemini
        </button>
        <iframe
          title="GeoGebra"
          ref={frame}
          src="geometry.html"
          sandbox="allow-scripts allow-same-origin"
          style={{ width: '100%', height: 480, border: 0 }}
        />
        <button
          className="primary"
          disabled={!ready}
          onClick={() =>
            frame.current?.contentWindow?.postMessage({ type: 'geometry-export' }, '*')
          }
        >
          إرفاق صورة الرسم
        </button>
        <p>
          GeoGebra © · للاستخدام التعليمي غير التجاري ·{' '}
          <a href="https://www.geogebra.org/license" target="_blank" rel="noreferrer">
            الترخيص
          </a>
        </p>
      </section>
    </div>
  );
}
