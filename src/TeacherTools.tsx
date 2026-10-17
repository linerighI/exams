import { useEffect, useState } from 'react';
import {
  Atom,
  BookOpen,
  Calculator,
  ChartColumn,
  CheckCircle2,
  ClipboardList,
  Compass,
  ExternalLink,
  FilePenLine,
  Globe2,
  GraduationCap,
  Languages,
  Monitor,
  Ruler,
  Search,
  Sigma,
  Star,
  WifiOff,
  Wrench,
} from 'lucide-react';
import type { Exam } from './types';
import {
  grades,
  schoolSubjects,
  teacherResources,
  trustedTeacherResource,
} from './teacherResources';
import {
  BlueprintTool,
  EquationWorkshop,
  QuestionWorkshop,
  RubricTool,
  StatisticsTool,
  TeacherCalculator,
  TeacherDrawing,
  UnitConverter,
} from './TeacherToolPanels';
import './teacherTools.css';
import FocusWindow from './FocusWindow';
import { api } from './api';
import { motion } from 'motion/react';

const tools = [
  {
    id: 'writer',
    title: 'مختبر كتابة الأسئلة',
    description: 'صغ السؤال والبدائل، عاينه، ثم اجمع أسئلتك في مسودة امتحان.',
    icon: FilePenLine,
    tag: 'كتابة ومراجعة',
    subjects: [],
  },
  {
    id: 'calculator',
    title: 'الآلة الحاسبة العلمية',
    description: 'تحقق من العمليات والكسور والجذور والمثلثات دون اتصال.',
    icon: Calculator,
    tag: 'حساب وتحقق',
    subjects: [
      'الرياضيات',
      'العلوم',
      'الفيزياء',
      'الكيمياء',
      'الثقافة المالية',
      'المباحث المهنية والتقنية',
    ],
  },
  {
    id: 'geometry',
    title: 'GeoGebra · الرسم والهندسة',
    description: 'ارسم الدوال والأشكال والتقط صورة لإرفاقها بالسؤال.',
    icon: Compass,
    tag: 'رسم واستكشاف',
    subjects: ['الرياضيات', 'الفيزياء', 'التربية المهنية', 'المباحث المهنية والتقنية'],
  },
  {
    id: 'equations',
    title: 'محرر الصيغ والمعادلات',
    description: 'اكتب الكسور والتكامل والرموز والصيغ العلمية بمعاينة مباشرة.',
    icon: Sigma,
    tag: 'صياغة علمية',
    subjects: ['الرياضيات', 'العلوم', 'الفيزياء', 'الكيمياء', 'المباحث المهنية والتقنية'],
  },
  {
    id: 'units',
    title: 'محوّل الوحدات',
    description: 'الطول والكتلة والزمن والمساحة والحجم ودرجات الحرارة.',
    icon: Ruler,
    tag: 'قياس وتحويل',
    subjects: [
      'الرياضيات',
      'العلوم',
      'الفيزياء',
      'الكيمياء',
      'التربية المهنية',
      'المباحث المهنية والتقنية',
    ],
  },
  {
    id: 'statistics',
    title: 'الإحصاء السريع',
    description: 'المتوسط والوسيط والمدى والانحراف المعياري لقائمة أعداد.',
    icon: ChartColumn,
    tag: 'تحليل بيانات',
    subjects: [],
  },
  {
    id: 'blueprint',
    title: 'جدول مواصفات الامتحان',
    description: 'وزّع عدد الأسئلة على الوحدات وفق أوزان تختارها.',
    icon: ClipboardList,
    tag: 'تخطيط عادل',
    subjects: [],
  },
  {
    id: 'rubric',
    title: 'سُلّم تقدير الأداء',
    description: 'خطط لمعايير تقييم المقال والمشروع والمهارات العملية.',
    icon: CheckCircle2,
    tag: 'تقييم وتغذية راجعة',
    subjects: [],
  },
];
const resourceIcons = {
  jordan: BookOpen,
  science: Atom,
  languages: Languages,
  digital: Monitor,
  general: Globe2,
};
const resourceCategories = [
  ['all', 'كل المصادر'],
  ['jordan', 'المنهاج الأردني'],
  ['science', 'العلوم والرياضيات'],
  ['languages', 'اللغات'],
  ['digital', 'المهارات الرقمية'],
  ['general', 'بحث ووسائط'],
];
export default function TeacherTools({
  teacherId,
  notify,
  openExam,
}: {
  teacherId: string;
  notify: (message: string) => void;
  openExam: (exam: Exam) => void;
}) {
  const storageKey = `teacher-tools-preferences:${teacherId}`;
  const [transfer, setTransfer] = useState<{ id: string; text: string }>();
  const [layout, setLayout] = useState<{ order: string[]; workflow: string[] }>({
      order: [],
      workflow: ['blueprint', 'writer', 'geometry'],
    }),
    [savingLayout, setSavingLayout] = useState(true),
    [arranging, setArranging] = useState(false);
  useEffect(() => {
    let live = true;
    const load = () =>
      void api('/api/workspace')
        .then((v) => {
          if (live) setLayout(v);
        })
        .catch((e) => {
          if (live) notify(e.message);
        })
        .finally(() => {
          if (live) setSavingLayout(false);
        });
    load();
    window.addEventListener('workspace-updated', load);
    return () => {
      live = false;
      window.removeEventListener('workspace-updated', load);
    };
  }, [teacherId]);
  const saveLayout = async (next: typeof layout) => {
    if (savingLayout) return;
    setSavingLayout(true);
    try {
      setLayout(await api('/api/workspace', 'PUT', next));
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setSavingLayout(false);
    }
  };
  const reorder = (value: string, before: string) => {
    const order = [
      ...layout.order,
      ...tools.map((t) => t.id).filter((id) => !layout.order.includes(id)),
    ].filter((id) => id !== value);
    const at = order.indexOf(before);
    if (at < 0 || !tools.some((t) => t.id === value)) return;
    order.splice(at, 0, value);
    void saveLayout({ ...layout, order });
  };
  const [saved] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || '{}');
    } catch {
      return {};
    }
  });
  const [grade, setGrade] = useState<string>(
      /^([1-9]|1[0-2])$/.test(saved?.grade) ? saved.grade : '',
    ),
    [subject, setSubject] = useState<string>(
      schoolSubjects.includes(saved?.subject) ? saved.subject : '',
    ),
    [term, setTerm] = useState<'الأول' | 'الثاني'>(saved?.term === 'الثاني' ? 'الثاني' : 'الأول');
  const [favorites, setFavorites] = useState<string[]>(
    Array.isArray(saved?.favorites)
      ? saved.favorites.filter((id: unknown) => typeof id === 'string').slice(0, 50)
      : [],
  );
  const [tab, setTab] = useState('workspace'),
    [category, setCategory] = useState('all'),
    [search, setSearch] = useState(''),
    [active, setActive] = useState(''),
    [image, setImage] = useState(''),
    [query, setQuery] = useState(''),
    [launching, setLaunching] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ grade, subject, term, favorites }));
    } catch {}
  }, [grade, subject, term, favorites, storageKey]);
  useEffect(() => {
    const openRequested = (event?: Event) => {
      const requested =
        (event as CustomEvent)?.detail || sessionStorage.getItem('assistant-open-tool');
      if (tools.some((tool) => tool.id === requested)) {
        setActive(requested);
        setTab('workspace');
        sessionStorage.removeItem('assistant-open-tool');
      }
    };
    openRequested();
    window.addEventListener('assistant-open-tool', openRequested);
    return () => window.removeEventListener('assistant-open-tool', openRequested);
  }, []);
  const favorite = (id: string) =>
    setFavorites((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  const open = async (value: string) => {
    if (launching) return;
    setLaunching(true);
    try {
      const url = trustedTeacherResource(value);
      if (window.desktop) await window.desktop.openTeacherResource(url);
      else {
        const win = window.open(url, '_blank', 'noopener,noreferrer');
        if (win) win.opener = null;
      }
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setLaunching(false);
    }
  };
  const choose = (id: string) => {
    setActive(id);
  };
  const matches = (title: string, description: string, subjects: string[]) =>
    `${title} ${description}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()) &&
    (!subject || !subjects.length || subjects.includes(subject));
  const local = [...tools]
    .sort((a, b) => {
      const order = [
        ...layout.order,
        ...tools.map((t) => t.id).filter((id) => !layout.order.includes(id)),
      ];
      return order.indexOf(a.id) - order.indexOf(b.id);
    })
    .filter(
      (t) =>
        matches(t.title, t.description, t.subjects) &&
        (tab !== 'favorites' || favorites.includes(t.id)),
    );
  const resources = teacherResources.filter(
    (t) =>
      matches(t.title, t.description, t.subjects) &&
      (category === 'all' || category === t.category) &&
      (tab !== 'favorites' || favorites.includes(t.id)),
  );
  const selected = tools.find((t) => t.id === active);
  const context = { grade, subject, term, teacherId, notify, openExam };
  const star = (id: string, title: string) => (
    <button
      className={`tool-favorite ${favorites.includes(id) ? 'is-saved' : ''}`}
      aria-label={`${favorites.includes(id) ? 'إزالة' : 'إضافة'} ${title} ${favorites.includes(id) ? 'من' : 'إلى'} المفضلة`}
      aria-pressed={favorites.includes(id)}
      onClick={() => favorite(id)}
    >
      <Star size={17} />
    </button>
  );
  return (
    <div className="teacher-tools-page">
      <header className="teacher-tools-heading">
        <div>
          <h1>
            الأدوات <Wrench size={23} />
          </h1>
          <p>اختر أداة لفتحها في نافذة عمل.</p>
        </div>
        <span className="tools-count">
          <GraduationCap size={17} />
          الصفوف ١–١٢ · جميع المباحث
        </span>
      </header>
      <div className="teacher-tools-context" aria-label="سياق إعداد الأسئلة">
        <label>
          الصف
          <select aria-label="صف الأدوات" value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="">كل الصفوف</option>
            {grades.map((label, i) => (
              <option key={label} value={String(i + 1)}>
                الصف {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          المبحث
          <select
            aria-label="مبحث الأدوات"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          >
            <option value="">كل المباحث</option>
            {schoolSubjects.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          الفصل
          <select
            aria-label="فصل الأدوات"
            value={term}
            onChange={(e) => setTerm(e.target.value as typeof term)}
          >
            <option>الأول</option>
            <option>الثاني</option>
          </select>
        </label>
      </div>
      {selected && (
        <FocusWindow
          title={selected.title}
          onClose={() => setActive('')}
          closeLabel="العودة إلى الأدوات"
          wide={['writer', 'geometry'].includes(active)}
        >
          <div className="tool-window-info">
            <details>
              <summary>عن الأداة</summary>
              <p>{selected.description}</p>
            </details>
            {star(selected.id, selected.title)}
          </div>
          <section className={`teacher-tool-workbench tool-${selected.id}`}>
            <div className="teacher-tool-workbench-body">
              {active === 'writer' ? (
                <QuestionWorkshop
                  context={context}
                  image={image}
                  clearImage={() => setImage('')}
                  transfer={transfer}
                  consumeTransfer={() => setTransfer(undefined)}
                />
              ) : active === 'calculator' ? (
                <TeacherCalculator />
              ) : active === 'geometry' ? (
                <TeacherDrawing
                  notify={notify}
                  insert={(value) => {
                    setImage(value);
                    choose('writer');
                    notify('أُضيف الرسم إلى السؤال الجاري؛ أكمل النص والبدائل.');
                  }}
                />
              ) : active === 'equations' ? (
                <EquationWorkshop
                  notify={notify}
                  insert={(text) => {
                    setTransfer({ id: crypto.randomUUID(), text });
                    choose('writer');
                    notify('أُضيف النص إلى مسودة السؤال.');
                  }}
                />
              ) : active === 'units' ? (
                <UnitConverter />
              ) : active === 'statistics' ? (
                <StatisticsTool notify={notify} />
              ) : active === 'blueprint' ? (
                <BlueprintTool context={context} />
              ) : (
                <RubricTool notify={notify} />
              )}
            </div>
          </section>
        </FocusWindow>
      )}
      <>
        <div className="tools-catalog-bar">
          <nav aria-label="أقسام الأدوات">
            {[
              ['workspace', 'أدوات العمل'],
              ['resources', 'مصادر ومراجع'],
              ['favorites', 'المفضلة'],
            ].map(([id, label]) => (
              <button
                key={id}
                className={tab === id ? 'active' : ''}
                aria-pressed={tab === id}
                onClick={() => setTab(id)}
              >
                {id === 'favorites' && <Star size={15} />} {label}
              </button>
            ))}
          </nav>
          <label className="tools-search">
            <Search size={17} />
            <input
              aria-label="البحث في الأدوات"
              placeholder="ابحث عن أداة أو مصدر…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        {tab !== 'resources' && (
          <section className="tools-catalog-section">
            <header>
              <div>
                <h2>{tab === 'favorites' ? 'أدواتك المفضلة' : 'أدوات العمل'}</h2>
              </div>
              <span>
                <button
                  className="text-button"
                  aria-pressed={arranging}
                  onClick={() => setArranging((v) => !v)}
                >
                  {arranging ? 'تم الترتيب' : 'تخصيص الترتيب'}
                </button>
                <WifiOff size={14} />
                {local.length} أدوات
              </span>
            </header>
            {local.length ? (
              <div className="teacher-tool-grid">
                {local.map((t) => (
                  <motion.article
                    layout
                    className="teacher-tool-card"
                    key={t.id}
                    draggable={!savingLayout}
                    onDragStartCapture={(e) => {
                      e.dataTransfer.setData('application/x-school-tool', t.id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(e) => {
                      if (arranging) e.preventDefault();
                    }}
                    onDrop={(e) => {
                      if (arranging) {
                        e.preventDefault();
                        reorder(e.dataTransfer.getData('application/x-school-tool'), t.id);
                      }
                    }}
                  >
                    <button
                      className="tool-tile-open"
                      aria-label={`فتح الأداة: ${t.title}`}
                      onClick={() => choose(t.id)}
                    >
                      <span className={`teacher-tool-icon tone-${t.id}`}>
                        <t.icon size={27} />
                      </span>
                      <h3>{t.title}</h3>
                      <span>{t.tag}</span>
                    </button>
                    {star(t.id, t.title)}
                    {arranging && (
                      <div className="tool-arrange">
                        <button
                          disabled={savingLayout || local[0].id === t.id}
                          aria-label={`تقديم ${t.title} في الأدوات`}
                          onClick={() =>
                            reorder(t.id, local[local.findIndex((v) => v.id === t.id) - 1].id)
                          }
                        >
                          تقديم
                        </button>
                        <button
                          disabled={savingLayout || layout.workflow.includes(t.id)}
                          onClick={() =>
                            void saveLayout({ ...layout, workflow: [...layout.workflow, t.id] })
                          }
                        >
                          إضافة للمسار
                        </button>
                      </div>
                    )}
                  </motion.article>
                ))}
              </div>
            ) : (
              <div className="tools-empty">
                <Wrench size={27} />
                <h3>
                  {tab === 'favorites' ? 'لم تضف أدوات مفضلة بعد' : 'لا توجد أدوات تطابق البحث'}
                </h3>
                <p>جرّب تغيير المبحث أو البحث. اضغط النجمة للاحتفاظ بأداتك هنا.</p>
              </div>
            )}
          </section>
        )}
        {tab !== 'workspace' && (
          <section className="tools-catalog-section">
            <header>
              <div>
                <h2>مصادر ومراجع للمعلّم</h2>
                <p>تُفتح في متصفحك وتتطلب الإنترنت. اختر الصف والطبعة داخل المصدر قبل الاستخدام.</p>
              </div>
              <span>
                <Globe2 size={15} />
                {resources.length} مصادر
              </span>
            </header>
            <form
              className="teacher-google-search"
              onSubmit={(e) => {
                e.preventDefault();
                const q = [
                  query,
                  subject,
                  grade ? `الصف ${grades[Number(grade) - 1]}` : '',
                  'المنهاج الأردني',
                  `الفصل ${term}`,
                ]
                  .filter(Boolean)
                  .join(' ');
                void open(`https://www.google.com/search?q=${encodeURIComponent(q)}`);
              }}
            >
              <span className="google-mark" aria-hidden="true">
                G
              </span>
              <label>
                <span>ابحث في Google بسياق صفك ومبحثك</span>
                <input
                  aria-label="موضوع البحث في Google"
                  placeholder="مثال: أسئلة على قوانين الحركة"
                  value={query}
                  maxLength={300}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <button className="primary small" disabled={launching || !query.trim()}>
                <Search size={16} />
                بحث
              </button>
            </form>
            <div className="tools-resource-filters" aria-label="نوع المصدر">
              {resourceCategories.map(([id, label]) => (
                <button
                  className={category === id ? 'active' : ''}
                  aria-pressed={category === id}
                  key={id}
                  onClick={() => setCategory(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            {resources.length ? (
              <div className="teacher-resource-grid">
                {resources.map((r) => {
                  const ResourceIcon = resourceIcons[r.category];
                  return (
                    <article className="teacher-resource-card" key={r.id}>
                      <header>
                        <span className="teacher-tool-icon">
                          <ResourceIcon size={23} />
                        </span>
                        {star(r.id, r.title)}
                      </header>
                      <h3>{r.title}</h3>

                      <details>
                        <summary>عن المصدر</summary>
                        <p>{r.description}</p>
                        <small>{r.note || new URL(r.url).hostname}</small>
                      </details>
                      <button
                        className="text-button"
                        disabled={launching}
                        onClick={() => void open(r.url)}
                      >
                        فتح المصدر
                        <ExternalLink size={14} />
                      </button>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="tools-empty">
                <Search size={26} />
                <h3>لا توجد مصادر مطابقة</h3>
                <p>امسح البحث أو اختر كل المصادر والمباحث.</p>
              </div>
            )}
            <p className="tools-source-note">
              المراجع العامة معينات للإعداد، وليست اعتمادًا تلقائيًا لمواءمة المنهج. راجع الطبعة،
              وحقوق الصور، وصحة المعلومة قبل النشر.
            </p>
          </section>
        )}
      </>
    </div>
  );
}
