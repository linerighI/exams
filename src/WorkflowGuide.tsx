import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Route } from 'lucide-react';
import { api } from './api';
import './workflow.css';
export const orbTools = [
  { id: 'blueprint', title: 'جدول مواصفات الامتحان' },
  { id: 'writer', title: 'مختبر كتابة الأسئلة' },
  { id: 'geometry', title: 'GeoGebra · الرسم والهندسة' },
  { id: 'calculator', title: 'الآلة الحاسبة العلمية' },
  { id: 'equations', title: 'محرر الصيغ والمعادلات' },
  { id: 'units', title: 'محوّل الوحدات' },
  { id: 'statistics', title: 'الإحصاء السريع' },
  { id: 'rubric', title: 'سُلّم تقدير الأداء' },
];
const destinations = [
  ['students', 'الطلاب'],
  ['books', 'بنك الأسئلة'],
  ['tools', 'الأدوات'],
  ['exams', 'الامتحانات'],
  ['monitor', 'المتابعة والنتائج'],
];
export default function WorkflowGuide({
  page,
  navigate,
  teacherId,
}: {
  page: string;
  navigate: (page: string) => void;
  teacherId: string;
}) {
  const [summary, setSummary] = useState<any>(),
    [error, setError] = useState(false);
  useEffect(() => {
    let live = true;
    const refresh = () =>
      void api('/api/workspace/summary')
        .then((v) => {
          if (live) {
            setSummary(v);
            setError(false);
          }
        })
        .catch(() => {
          if (live) setError(true);
        });
    refresh();
    const timer = setInterval(refresh, 10000);
    window.addEventListener('workspace-updated', refresh);
    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener('workspace-updated', refresh);
    };
  }, [teacherId]);
  const message =
    page === 'students'
      ? 'قائمتك جاهزة؟ انتقل إلى إعداد الأسئلة.'
      : page === 'books'
        ? summary?.questions
          ? 'اختر الأسئلة المعتمدة وجهّز امتحانك.'
          : 'أضف كتابًا أو استورد بنك أسئلتك.'
        : page === 'exams'
          ? 'راجع الامتحانات ثم تابع الطلاب أثناء الحل.'
          : page === 'editor'
            ? 'راجع الأسئلة والإعدادات قبل النشر.'
            : page === 'tools'
              ? 'اجمع أدواتك في مسار يناسب طريقة عملك.'
              : 'اختر ما تريد إنجازه اليوم.';
  const next =
    page === 'students'
      ? ['books', 'فتح بنك الأسئلة']
      : page === 'books'
        ? ['exams', 'فتح الامتحانات']
        : page === 'exams'
          ? ['monitor', 'فتح المتابعة']
          : ['tools', 'فتح الأدوات'];
  return (
    <div className="orb-context-guide" aria-label="اقتراحات هذه الصفحة">
      <small>
        <Route size={14} /> لهذه الصفحة
      </small>
      <h3>{message}</h3>
      <button className="orb-context-next" onClick={() => navigate(next[0])}>
        {next[1]}
        <ArrowLeft size={15} />
      </button>
      {summary && !error && (
        <div className="orb-context-stats">
          <span>
            <b>{summary.students}</b> طالب
          </span>
          <span>
            <b>{summary.ready}</b> سؤال معتمد
          </span>
          <span>
            <b>{summary.active}</b> محاولة جارية
          </span>
        </div>
      )}
      {error && <p role="status">تعذر تحديث بيانات المدرسة.</p>}
      <details className="orb-quick-pages">
        <summary>انتقال سريع</summary>
        <div>
          {destinations.map(([id, label]) => (
            <button key={id} onClick={() => navigate(id)}>
              {label}
              <ArrowLeft size={13} />
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}
export function ToolsWorkflow({
  tools,
  subject,
  layout,
  onChange,
  onTool,
  saving,
}: {
  tools: { id: string; title: string }[];
  subject: string;
  layout: { order: string[]; workflow: string[] };
  onChange: (layout: { order: string[]; workflow: string[] }) => void;
  onTool: (id: string) => void;
  saving: boolean;
}) {
  const add = (value: string, at = layout.workflow.length) => {
    if (!tools.some((t) => t.id === value) || saving) return;
    const list = layout.workflow.filter((id) => id !== value);
    list.splice(Math.min(at, list.length), 0, value);
    onChange({ ...layout, workflow: list });
  };
  const drop = (e: React.DragEvent, at?: number) => {
    e.preventDefault();
    e.stopPropagation();
    add(e.dataTransfer.getData('application/x-school-tool'), at);
  };
  return (
    <section
      className="orb-workflow"
      aria-label="مسار الأدوات"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => drop(e)}
    >
      <div className="orb-workflow-heading">
        <h3>أدواتك، بالترتيب الذي يناسبك</h3>
        <button
          disabled={saving}
          onClick={() =>
            onChange({
              ...layout,
              workflow:
                subject && /رياضيات|فيزياء/.test(subject)
                  ? ['blueprint', 'geometry', 'writer']
                  : ['blueprint', 'writer', 'rubric'],
            })
          }
        >
          مسار مقترح
        </button>
      </div>
      <div className="workflow-tool-sequence">
        {layout.workflow.map((id, i) => {
          const tool = tools.find((t) => t.id === id);
          if (!tool) return null;
          return (
            <motion.div
              layout
              className="workflow-tool-step"
              key={id}
              draggable={!saving}
              onDragStartCapture={(e) => {
                e.dataTransfer.setData('application/x-school-tool', id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => drop(e, i)}
            >
              <button className="workflow-tool-open" onClick={() => onTool(id)}>
                <span>{i + 1}</span>
                {tool.title}
              </button>
              <div className="workflow-step-controls">
                <button
                  aria-label={`تقديم ${tool.title}`}
                  disabled={saving || i === 0}
                  onClick={() => add(id, i - 1)}
                >
                  ↑
                </button>
                <button
                  aria-label={`تأخير ${tool.title}`}
                  disabled={saving || i === layout.workflow.length - 1}
                  onClick={() => add(id, i + 1)}
                >
                  ↓
                </button>
                <button
                  aria-label={`إزالة ${tool.title} من المسار`}
                  disabled={saving}
                  onClick={() =>
                    onChange({ ...layout, workflow: layout.workflow.filter((x) => x !== id) })
                  }
                >
                  ×
                </button>
              </div>
            </motion.div>
          );
        })}
        <label className="orb-add-tool">
          <select
            aria-label="إضافة أداة إلى المسار"
            disabled={saving}
            value=""
            onChange={(e) => add(e.target.value)}
          >
            <option value="">+ أضف أداة</option>
            {tools
              .filter((t) => !layout.workflow.includes(t.id))
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
          </select>
        </label>
        <span className="workflow-tool-drop">أو اسحب أداة إلى هنا</span>
      </div>
    </section>
  );
}
