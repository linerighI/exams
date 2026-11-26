/**
 * Floating Apple Liquid Glass SAR Studio panel inside SARE 3D Editor:
 * provides live SAR compilation diagnostics, template presets, bidirectional sync
 * from the 3D scene, instant Apply-to-3D (Undo-safe), copy, and .sar file export.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, CheckCircle2, Code2, Copy, Download, Play, RefreshCw, X } from 'lucide-react';
import type { Language } from '../../i18n';
import type { CampusLayout } from '../../types';
import { gsapPop, useGsapEntrance } from '../editor/editorMotion';
import { compileSarToLayout } from './sarCompiler';
import { serializeLayoutToSar } from './sarSerializer';
import { SAR_TEMPLATES } from './sarTemplates';

interface SarCodeWindowProps {
  draft: CampusLayout;
  lang: Language;
  onApplyLayout: (layout: CampusLayout) => void;
  onClose: () => void;
}

/** Interactive SAR architecture language workbench floating beside the 3D canvas. */
export function SarCodeWindow({ draft, lang, onApplyLayout, onClose }: SarCodeWindowProps) {
  const winRef = useRef<HTMLElement>(null);
  const [source, setSource] = useState<string>(() =>
    draft.rooms.length > 0 ? serializeLayoutToSar(draft) : SAR_TEMPLATES[0].source,
  );
  const [copied, setCopied] = useState(false);
  const [applied, setApplied] = useState(false);

  useGsapEntrance(
    winRef,
    { opacity: 0, x: -18, scale: 0.97 },
    { opacity: 1, x: 0, scale: 1, duration: 0.36, ease: 'power4.out' },
    [],
  );

  useEffect(() => {
    if (!applied) return;
    const t = setTimeout(() => setApplied(false), 1600);
    return () => clearTimeout(t);
  }, [applied]);

  const compiled = useMemo(() => compileSarToLayout(source, lang), [source, lang]);
  const errorCount = compiled.diagnostics.filter((d) => d.severity === 'error').length;
  const warnCount = compiled.diagnostics.filter((d) => d.severity === 'warning').length;

  const handleApply = (el: HTMLElement | null) => {
    gsapPop(el);
    onApplyLayout(compiled.layout);
    setApplied(true);
  };

  const handleSyncFrom3D = (el: HTMLElement | null) => {
    gsapPop(el);
    setSource(serializeLayoutToSar(draft));
  };

  const handleCopy = (el: HTMLElement | null) => {
    gsapPop(el);
    void navigator.clipboard?.writeText(source);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownload = (el: HTMLElement | null) => {
    gsapPop(el);
    const blob = new Blob([source], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'campus-blueprint.sar';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section
      ref={winRef}
      data-window-id="sar-studio"
      className="sp-sar-window"
      aria-label="SAR Architecture Language Studio"
    >
      <header className="sp-sar-header">
        <div className="sp-sar-title-wrap">
          <span className="sp-sar-badge">
            <Code2 size={13} />
            <span>SAR</span>
          </span>
          <div>
            <h4>{lang === 'ar' ? 'لغة SAR الهندسية' : 'SAR Architecture Studio'}</h4>
            <small>
              {lang === 'ar'
                ? 'تصميم المدرسة بسطور برمجية ومحاذاة تلقائية فورية'
                : 'Declarative 3D school layout, flush snapping & merges'}
            </small>
          </div>
        </div>
        <button type="button" className="sp-win-close" onClick={onClose} aria-label="Close SAR Studio">
          <X size={15} />
        </button>
      </header>

      <div className="sp-sar-templates">
        {SAR_TEMPLATES.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            data-sar-tpl={tpl.id}
            className="sp-sar-tpl-chip"
            title={lang === 'ar' ? tpl.descAr : tpl.descEn}
            onClick={(e) => {
              gsapPop(e.currentTarget);
              setSource(tpl.source);
            }}
          >
            {lang === 'ar' ? tpl.labelAr : tpl.labelEn}
          </button>
        ))}
      </div>

      <textarea
        className="sp-sar-code"
        data-sar-editor="true"
        dir="ltr"
        spellCheck={false}
        value={source}
        onChange={(e) => setSource(e.target.value)}
        aria-label="SAR Source Code"
      />

      <div className={`sp-sar-status ${errorCount > 0 ? 'is-err' : warnCount > 0 ? 'is-warn' : 'is-ok'}`}>
        {errorCount > 0 ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
        <span>
          {errorCount > 0
            ? `${errorCount} ${lang === 'ar' ? 'خطأ' : 'error(s)'}`
            : warnCount > 0
              ? `${warnCount} ${lang === 'ar' ? 'تنبيه' : 'warning(s)'}`
              : lang === 'ar' ? 'جاهز للبناء' : 'Valid'}
          {' · '}
          {compiled.stats.floors} {lang === 'ar' ? 'طابق' : 'fl'}
          {' · '}
          {compiled.stats.rooms} {lang === 'ar' ? 'غرفة' : 'rooms'}
          {' · '}
          {compiled.stats.props} {lang === 'ar' ? 'أثاث' : 'props'}
        </span>
      </div>

      {compiled.diagnostics.length > 0 && (
        <div className="sp-sar-diag-list">
          {compiled.diagnostics.slice(0, 3).map((d, idx) => (
            <div key={idx} className={`sp-sar-diag is-${d.severity}`}>
              <b>L{d.line}</b>
              <span>{d.message}</span>
            </div>
          ))}
        </div>
      )}

      <footer className="sp-sar-footer">
        <button
          type="button"
          data-action="sar-apply"
          className="sp-btn-primary sp-sar-apply-btn"
          disabled={errorCount > 0 || compiled.stats.rooms === 0}
          onClick={(e) => handleApply(e.currentTarget)}
        >
          {applied ? <Check size={14} /> : <Play size={14} />}
          <span>
            {applied
              ? (lang === 'ar' ? 'تم البناء في 3D!' : 'Applied to 3D!')
              : (lang === 'ar' ? 'تطبيق على المجسم 3D' : 'Build in 3D')}
          </span>
        </button>

        <div className="sp-sar-tools">
          <button
            type="button"
            data-action="sar-sync"
            className="sp-icon-btn"
            title={lang === 'ar' ? 'سحب التصميم الحالي إلى الكود' : 'Sync code from current 3D scene'}
            onClick={(e) => handleSyncFrom3D(e.currentTarget)}
          >
            <RefreshCw size={14} />
          </button>
          <button
            type="button"
            className="sp-icon-btn"
            title={lang === 'ar' ? 'نسخ الكود' : 'Copy SAR code'}
            onClick={(e) => handleCopy(e.currentTarget)}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
          <button
            type="button"
            className="sp-icon-btn"
            title={lang === 'ar' ? 'تصدير ملف .sar' : 'Download .sar blueprint'}
            onClick={(e) => handleDownload(e.currentTarget)}
          >
            <Download size={14} />
          </button>
        </div>
      </footer>
    </section>
  );
}
