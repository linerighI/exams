/**
 * Admin Database Export & JSON Injector (`تصدير وحقن قاعدة البيانات`).
 * Lets principals/assistants download portable JSON snapshots or templates and
 * inject full school datasets (classes, subjects, teachers, students, schedules) atomically.
 */
import { useMemo, useState } from 'react';
import { Download, FileJson, FileUp, ShieldAlert, Upload } from 'lucide-react';
import type { Language } from '../i18n';
import { apiUrl, authHeaders, isCapacitorNative } from '../api';
import { WinButton, WinInfoBar } from '../schoolsync-ui';
import type { State } from '../types';

export function DatabaseInjectorPanel({
  data,
  lang,
  busy,
  mutate,
}: {
  data: State;
  lang: Language;
  busy: boolean;
  mutate: (url: string, body: unknown, success?: string) => Promise<boolean>;
}) {
  const ar = lang === 'ar';
  const [rawJson, setRawJson] = useState('');
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [defaultPassword, setDefaultPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [exporting, setExporting] = useState(false);

  const preview = useMemo(() => {
    if (!rawJson.trim()) return { ok: false as const, error: '', counts: null };
    try {
      const parsed = JSON.parse(rawJson) as Record<string, unknown>;
      const arrLen = (k: string) => (Array.isArray(parsed[k]) ? (parsed[k] as unknown[]).length : 0);
      return {
        ok: true as const,
        error: '',
        parsed,
        counts: {
          classes: arrLen('classes'),
          subjects: arrLen('subjects'),
          teachers: arrLen('teachers'),
          students: arrLen('students'),
          lessons: arrLen('lessons'),
        },
      };
    } catch {
      return {
        ok: false as const,
        error: ar ? 'صيغة JSON غير مكتملة أو تحتوي خطأ نحوياً.' : 'Invalid JSON syntax.',
        counts: null,
      };
    }
  }, [rawJson, ar]);

  const downloadEndpoint = async (endpoint: string, filename: string) => {
    setExporting(true);
    setLocalError('');
    try {
      const res = await fetch(apiUrl(endpoint), {
        credentials: isCapacitorNative() ? 'omit' : 'include',
        headers: authHeaders(),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Export failed');
      const text = JSON.stringify(payload, null, 2);
      const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setLocalError((e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLocalError('');
    const content = await file.text();
    setRawJson(content);
    e.target.value = '';
  };

  const handleInject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preview.ok || !preview.parsed) return;
    setLocalError('');
    const payload = {
      ...preview.parsed,
      mode,
      ...(defaultPassword.trim() ? { defaultPassword: defaultPassword.trim() } : {}),
    };
    const ok = await mutate(
      '/admin/database/import',
      payload,
      mode === 'replace'
        ? ar ? 'تم استبدال وحقن قاعدة بيانات المدرسة بنجاح' : 'School database replaced cleanly'
        : ar ? 'تم حقن ودمج البيانات في المدرسة بنجاح' : 'School database injected & merged',
    );
    if (ok) {
      setRawJson('');
      setDefaultPassword('');
    }
  };

  return (
    <div className="canvas-board-stack" data-reveal>
      <section className="canvas-section-block">
        <header className="canvas-block-head">
          <div>
            <span className="eyebrow">{ar ? 'نسخ احتياطي واستيراد فوري' : 'PORTABLE EXPORT & INJECTOR'}</span>
            <h2>{ar ? 'تصدير وحقن قاعدة البيانات' : 'Export & Inject School Database'}</h2>
          </div>
          <span className="canvas-count-badge">
            {ar
              ? `${data.classes.length} شعب · ${data.teachers.length} معلم · ${data.students.length} طالب`
              : `${data.classes.length} classes · ${data.students.length} students`}
          </span>
        </header>

        <div className="surface-card form-stack">
          <p className="sp-att-hint" style={{ marginTop: 0 }}>
            {ar
              ? 'صدّر نسخة JSON كاملة من مدرستك أو حمّل القالب القياسي لتجهيز بياناتك وحقنها دفعة واحدة دون إدخال يدوي.'
              : 'Export a portable JSON backup or download the schema template to populate and inject bulk school data at once.'}
          </p>
          <div className="staff-hero-actions">
            <WinButton
              variant="accent"
              disabled={exporting}
              onClick={() =>
                void downloadEndpoint(
                  '/admin/database/export',
                  `schoolsync-export-${new Date().toISOString().slice(0, 10)}.json`,
                )
              }
            >
              <Download size={15} />
              {ar ? 'تصدير قاعدة المدرسة (JSON)' : 'Export School JSON'}
            </WinButton>
            <WinButton
              variant="standard"
              disabled={exporting}
              onClick={() => void downloadEndpoint('/admin/database/template', 'schoolsync-template.json')}
            >
              <FileJson size={15} />
              {ar ? 'تحميل قالب فارغ' : 'Download Template'}
            </WinButton>
          </div>
        </div>

        <form className="surface-card form-stack" onSubmit={handleInject} style={{ marginTop: 12 }}>
          <div className="row-between">
            <h3>{ar ? 'حقن ملف بيانات (JSON Injector)' : 'Inject Dataset (JSON)'}</h3>
            <label className="sp-nav-btn" style={{ cursor: 'pointer' }}>
              <FileUp size={15} />
              <span>{ar ? 'اختيار ملف JSON' : 'Choose JSON file'}</span>
              <input type="file" accept=".json,application/json" hidden onChange={(e) => void handleFile(e)} />
            </label>
          </div>

          <div className="chip-row">
            <button
              type="button"
              className={`chip-pill ${mode === 'merge' ? 'selected' : ''}`}
              onClick={() => setMode('merge')}
            >
              {ar ? 'دمج وتحديث (يُبقي البيانات الحالية)' : 'Merge & Upsert'}
            </button>
            <button
              type="button"
              className={`chip-pill ${mode === 'replace' ? 'selected' : ''}`}
              onClick={() => setMode('replace')}
            >
              {ar ? 'استبدال كامل بيانات المدرسة' : 'Replace School Data'}
            </button>
          </div>

          {mode === 'replace' && (
            <WinInfoBar
              tone="warn"
              title={ar ? 'تنبيه: وضع الاستبدال الكامل' : 'Warning: Replace Mode'}
              message={
                ar
                  ? 'سيتم مسح الشعب والطلاب والمعلمين والجدول الحاليين واستبدالهم بالملف المحقون (مع إبقاء حسابك الإداري مسجلاً).'
                  : 'Existing classes, staff, students, and lessons for this school will be replaced cleanly while keeping admin accounts.'
              }
            />
          )}

          {preview.counts && (
            <WinInfoBar
              tone="info"
              title={ar ? 'معاينة البيانات قبل الحقن' : 'Pre-flight Dataset Preview'}
              message={
                ar
                  ? `${preview.counts.classes} شعب · ${preview.counts.subjects} مواد · ${preview.counts.teachers} معلمين · ${preview.counts.students} طلاب · ${preview.counts.lessons} حصص`
                  : `${preview.counts.classes} classes · ${preview.counts.teachers} teachers · ${preview.counts.students} students · ${preview.counts.lessons} lessons`
              }
            />
          )}

          {(localError || preview.error) && (
            <WinInfoBar tone="danger" title={ar ? 'تعذّر القراءة' : 'Error'} message={localError || preview.error} />
          )}

          <label>
            {ar ? 'كلمة مرور افتراضية للحسابات الجديدة (اختياري · ١٢+ حرفاً)' : 'Default password for newly created users (optional, 12+ chars)'}
            <input
              type="password"
              minLength={12}
              dir="ltr"
              value={defaultPassword}
              onChange={(e) => setDefaultPassword(e.target.value)}
              placeholder="SchoolSync!2026"
            />
          </label>

          <label>
            {ar ? 'محتوى ملف JSON (أو الصق البيانات هنا مباشرة)' : 'JSON Payload'}
            <textarea
              dir="ltr"
              rows={6}
              value={rawJson}
              onChange={(e) => setRawJson(e.target.value)}
              placeholder='{"classes": [...], "teachers": [...], "students": [...], "lessons": [...]}'
            />
          </label>

          <button className="primary" disabled={busy || !preview.ok}>
            {mode === 'replace' ? <ShieldAlert size={16} /> : <Upload size={16} />}
            {ar ? 'حقن البيانات في المدرسة' : 'Inject Into Database'}
          </button>
        </form>
      </section>
    </div>
  );
}
