/**
 * Visual Canvas Board for Classes (`الشعب الدراسية`) & Curriculum Subjects
 * (`المواد الدراسية`) inside School Administration.
 */
import { useState, type FormEvent } from 'react';
import { BookOpen, Layers, Plus, Sparkles, Trash2, Users } from 'lucide-react';
import type { Language } from '../i18n';
import { WinButton, WinCommandBar, WinInfoBar, WinSideDrawer } from '../schoolsync-ui';
import type { State } from '../types';
import { initials } from '../ui';
import { ClassSortBar } from './ClassSortBar';

const CLASS_PRESETS = ['الصف السابع - أ', 'الصف الثامن - أ', 'الصف التاسع - أ', 'الصف التاسع - ب', 'الصف العاشر - أ'];
const SUBJECT_PRESETS = [
  { name: 'اللغة العربية', desc: 'المنهاج الأساسي للغة العربية', color: 'blue' },
  { name: 'الرياضيات', desc: 'الجبر والهندسة والتحليل', color: 'yellow' },
  { name: 'اللغة الإنجليزية', desc: 'مهارات اللغة الثانية', color: 'lilac' },
  { name: 'العلوم', desc: 'الفيزياء، الكيمياء، الأحياء', color: 'mint' },
  { name: 'التربية الإسلامية', desc: 'الدراسات الإسلامية والقرآن', color: 'peach' },
  { name: 'علوم الأرض', desc: 'الجيولوجيا والبيئة', color: 'mint' },
];

export function ClassesSubjectsPanel({
  data,
  lang,
  busy,
  submitSimple,
  mutate,
}: {
  data: State;
  lang: Language;
  busy: boolean;
  submitSimple: (url: string, msg: string) => (e: FormEvent<HTMLFormElement>) => Promise<void>;
  mutate: (url: string, body: unknown, success?: string) => Promise<boolean>;
}) {
  const ar = lang === 'ar';
  const [presetsOpen, setPresetsOpen] = useState(false);

  const quickAddClass = (name: string) =>
    void mutate(
      '/classes',
      { name, location: ar ? 'المبنى الرئيسي، الطابق الثاني' : 'Main Building', room: ar ? 'قاعة ١٠١' : 'Room 101' },
      ar ? 'تمت إضافة الشعبة' : 'Class added',
    );

  const quickAddSubject = (s: { name: string; desc: string; color: string }) =>
    void mutate('/subjects', { name: s.name, description: s.desc, color: s.color }, ar ? 'تمت إضافة المادة الدراسية' : 'Subject saved');

  const availableClassPresets = CLASS_PRESETS.filter((p) => !data.classes.some((c) => c.name === p));
  const availableSubjectPresets = SUBJECT_PRESETS.filter((p) => !data.subjects.some((s) => s.name === p.name));
  const presetCount = availableClassPresets.length + availableSubjectPresets.length;

  return (
    <div className="canvas-board-stack">
      <WinCommandBar
        title={ar ? 'هيكل المدرسة والمنهاج' : 'Classes & Curriculum'}
        subtitle={ar ? `${data.classes.length} شعب · ${data.subjects.length} مواد مسجلة` : `${data.classes.length} classes · ${data.subjects.length} subjects`}
        actions={
          presetCount > 0 ? (
            <WinButton variant="standard" badge={presetCount} onClick={() => setPresetsOpen(true)}>
              <Sparkles size={15} />
              {ar ? 'قوالب الإضافة السريعة' : 'Quick Presets'}
            </WinButton>
          ) : null
        }
      />

      <WinSideDrawer
        open={presetsOpen}
        onClose={() => setPresetsOpen(false)}
        title={ar ? 'قوالب المنهاج والشعب السريعة' : 'Quick Presets Library'}
        subtitle={ar ? 'أضف الشعب والمواد الأردنية الأساسية بنقرة واحدة' : '1-tap Jordanian classes & core subjects'}
      >
        <WinInfoBar
          tone="info"
          title={ar ? 'اختصار ذكي للإدارة' : '1-Tap Provisioning'}
          message={ar ? 'اضغط على أي عنصر لإضافته مباشرة دون إعادة الكتابة.' : 'Click any preset chip to add immediately.'}
        />
        {availableClassPresets.length > 0 && (
          <div className="wui-drawer-section">
            <span className="wui-drawer-section-title">{ar ? 'شعب جاهزة' : 'Class presets'}</span>
            <div className="chip-row">
              {availableClassPresets.map((preset) => (
                <button key={preset} type="button" className="chip-pill" disabled={busy} onClick={() => quickAddClass(preset)}>
                  <Plus size={13} /> {preset}
                </button>
              ))}
            </div>
          </div>
        )}
        {availableSubjectPresets.length > 0 && (
          <div className="wui-drawer-section">
            <span className="wui-drawer-section-title">{ar ? 'مواد المنهاج الأساسي' : 'Core subjects'}</span>
            <div className="chip-row">
              {availableSubjectPresets.map((preset) => (
                <button key={preset.name} type="button" className="chip-pill" disabled={busy} onClick={() => quickAddSubject(preset)}>
                  <Sparkles size={13} /> {preset.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </WinSideDrawer>

      <section className="canvas-section-block" data-reveal>
        <header className="canvas-block-head">
          <div>
            <span className="eyebrow">{ar ? 'الهيكل المدرسي · الشعب والقاعات' : 'SCHOOL STRUCTURE'}</span>
            <h2>
              <Layers size={19} />
              {ar ? 'الشعب والصفوف الدراسية' : 'Classes & Sections'}
            </h2>
          </div>
          <span className="canvas-count-badge">{ar ? `${data.classes.length} شعب` : `${data.classes.length} classes`}</span>
        </header>

        <ClassSortBar classes={data.classes} lang={lang} busy={busy} mutate={mutate} />

        <div className="canvas-cards-grid">
          {data.classes.map((c) => {
            const studentCount = data.students.filter((s) => s.section === c.name).length;
            const assignedTeachers = data.teachers.filter((t) => t.classes.includes(c.name));
            return (
              <article className="canvas-entity-card t-surface" data-stagger key={c.id}>
                <div className="row-between">
                  <span className="entity-monogram blue">{c.name.slice(0, 2)}</span>
                  <button
                    type="button"
                    className="mini-icon-btn muted"
                    aria-label={ar ? `حذف ${c.name}` : `Delete ${c.name}`}
                    disabled={busy}
                    onClick={() => void mutate(`/classes/${c.id}/delete`, {}, ar ? 'تم حذف الشعبة' : 'Class deleted')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <h3>{c.name}</h3>
                <p>{[c.location, c.room].filter(Boolean).join(' · ') || (ar ? 'المبنى الرئيسي' : 'Main Building')}</p>
                <div className="entity-card-foot">
                  <span>
                    <Users size={13} /> {ar ? `${studentCount} طالب` : `${studentCount} students`}
                  </span>
                  <span>
                    {assignedTeachers.length
                      ? assignedTeachers.map((t) => t.name.split(' ')[0]).join('، ')
                      : ar
                        ? 'بدون معلم'
                        : 'Unassigned'}
                  </span>
                </div>
              </article>
            );
          })}

          <form
            className="canvas-create-tile"
            onSubmit={submitSimple('/classes', ar ? 'تمت إضافة الشعبة' : 'Class saved')}
          >
            <div className="create-tile-head">
              <Plus size={16} />
              <strong>{ar ? 'إضافة شعبة / صف جديد' : 'Add New Class'}</strong>
            </div>
            <input name="name" required placeholder={ar ? 'اسم الصف (مثال: الصف التاسع - أ)' : 'Class name (e.g. Grade 9 - A)'} />
            <div className="split-fields">
              <input name="location" placeholder={ar ? 'المبنى / الطابق' : 'Building / Floor'} />
              <input name="room" placeholder={ar ? 'رقم القاعة' : 'Room'} />
            </div>
            <button className="primary" disabled={busy}>
              {ar ? 'حفظ الشعبة' : 'Save class'}
            </button>
          </form>
        </div>
      </section>

      <section className="canvas-section-block" data-reveal>
        <header className="canvas-block-head">
          <div>
            <span className="eyebrow">{ar ? 'المنهاج الأردني · المواد' : 'JORDANIAN CURRICULUM'}</span>
            <h2>
              <BookOpen size={19} />
              {ar ? 'المواد الدراسية' : 'Curriculum Subjects'}
            </h2>
          </div>
          <span className="canvas-count-badge">{ar ? `${data.subjects.length} مواد` : `${data.subjects.length} subjects`}</span>
        </header>

        <div className="canvas-cards-grid">
          {data.subjects.map((sub) => {
            const subTeachers = data.teachers.filter((t) => t.subjects.includes(sub.name));
            return (
              <article className="canvas-entity-card subject-canvas-card t-surface" data-stagger key={sub.id}>
                <div className="subject-card-top">
                  <div>
                    <h3>{sub.name}</h3>
                    <p>{sub.description || (ar ? 'المنهاج الأساسي المعتمد' : 'Core curriculum')}</p>
                  </div>
                  <span className={`entity-monogram ${sub.color}`}>{sub.name.slice(0, 2)}</span>
                </div>
                <div className="entity-card-foot">
                  {subTeachers.length ? (
                    <div className="teacher-Avatars-row">
                      {subTeachers.map((t) => (
                        <span className="tile-teacher" key={t.id}>
                          <span className="tile-avatar">{initials(t.name)}</span>
                          <span>{t.name}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <small className="muted-note">{ar ? 'لم يتم تعيين معلم بعد' : 'No teacher assigned yet'}</small>
                  )}
                </div>
              </article>
            );
          })}

          <form
            className="canvas-create-tile"
            onSubmit={submitSimple('/subjects', ar ? 'تمت إضافة المادة الدراسية' : 'Subject saved')}
          >
            <div className="create-tile-head">
              <Plus size={16} />
              <strong>{ar ? 'إضافة مادة دراسية' : 'Add Subject'}</strong>
            </div>
            <input name="name" required placeholder={ar ? 'اسم المادة (مثال: اللغة العربية)' : 'Subject name'} />
            <div className="split-fields">
              <input name="description" placeholder={ar ? 'وصف مختصر للمنهاج' : 'Short description'} />
              <select name="color" defaultValue="blue" aria-label={ar ? 'اللون' : 'Color'}>
                <option value="blue">{ar ? 'أزرق' : 'Blue'}</option>
                <option value="mint">{ar ? 'أخضر' : 'Green'}</option>
                <option value="peach">{ar ? 'برتقالي' : 'Peach'}</option>
                <option value="lilac">{ar ? 'بنفسجي' : 'Lilac'}</option>
                <option value="yellow">{ar ? 'ذهبي' : 'Gold'}</option>
              </select>
            </div>
            <button className="primary" disabled={busy}>
              {ar ? 'إضافة مادة جديدة' : 'Add subject'}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
