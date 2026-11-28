/**
 * Principal Office -> Subjects & School Hours tab: school identity & Jordanian bell timings,
 * full registered subjects list, and color-tagged subject creator.
 */
import { useState, type FormEvent } from 'react';
import { Check, Plus } from 'lucide-react';
import type { Language } from '../../i18n';
import type { State } from '../../types';
import { GlassSelect } from '../GlassSelect';

interface PrincipalSchoolTabProps {
  data: State;
  lang: Language;
  busy: boolean;
  mutate: (url: string, body: unknown, success?: string) => Promise<boolean>;
}

const SUBJ_COLOR_HEX: Record<string, string> = {
  blue: '#007aff',
  peach: '#f97316',
  mint: '#10b981',
  lilac: '#a855f7',
  pink: '#ec4899',
  yellow: '#eab308',
};

/** School bell schedule settings and subject catalog management tab. */
export function PrincipalSchoolTab({ data, lang, busy, mutate }: PrincipalSchoolTabProps) {
  const ar = lang === 'ar';
  const [newSub, setNewSub] = useState('');
  const [subColor, setSubColor] = useState('blue');
  const [schoolForm, setSchoolForm] = useState({
    name: data.school.name,
    timezone: data.school.timezone,
    start: data.school.start_time,
    end: data.school.end_time,
    periodMinutes: Number(data.school.period_minutes || 45),
    breakMinutes: Number(data.school.break_minutes || 5),
    periodCount: Number(data.school.period_count || 7),
  });

  const saveSchool = async (e: FormEvent) => {
    e.preventDefault();
    await mutate('/school', schoolForm, ar ? 'تم حفظ إعدادات المدرسة والجرس' : 'School settings saved');
  };

  const addSubject = async (e: FormEvent) => {
    e.preventDefault();
    if (!newSub.trim()) return;
    const ok = await mutate('/subjects', { name: newSub.trim(), color: subColor }, ar ? 'تمت إضافة المادة' : 'Subject added');
    if (ok) setNewSub('');
  };

  return (
    <div className="sp-tab-pane">
      <div className="sp-inline-box">
        <div className="sp-po-card-head">
          <strong>{ar ? `المواد الدراسية المعتمدة (${data.subjects.length})` : `Subjects (${data.subjects.length})`}</strong>
        </div>
        <div className="sp-po-subject-grid">
          {data.subjects.map((s) => (
            <span key={s.id} className="sp-po-subj-pill">
              <i className="sp-po-subj-dot" style={{ background: SUBJ_COLOR_HEX[s.color] || SUBJ_COLOR_HEX.blue }} />
              <span>{s.name}</span>
            </span>
          ))}
        </div>
        <form className="sp-row-actions" onSubmit={(e) => void addSubject(e)}>
          <input
            required
            placeholder={ar ? 'اسم المادة الجديدة (مثل: الفيزياء)…' : 'New subject name…'}
            value={newSub}
            onChange={(e) => setNewSub(e.target.value)}
          />
          <div style={{ minWidth: 112 }}>
            <GlassSelect
              ariaLabel={ar ? 'لون المادة' : 'Color'}
              value={subColor}
              options={[
                { value: 'blue', label: ar ? 'أزرق' : 'Blue' },
                { value: 'mint', label: ar ? 'أخضر' : 'Green' },
                { value: 'peach', label: ar ? 'برتقالي' : 'Orange' },
                { value: 'lilac', label: ar ? 'بنفسجي' : 'Purple' },
                { value: 'pink', label: ar ? 'وردي' : 'Pink' },
              ]}
              onChange={setSubColor}
            />
          </div>
          <button type="submit" className="sp-btn-soft" disabled={busy}>
            <Plus size={14} />
            <span>{ar ? 'إضافة' : 'Add'}</span>
          </button>
        </form>
      </div>

      <form className="sp-inline-box" onSubmit={(e) => void saveSchool(e)}>
        <div className="sp-po-card-head">
          <strong>{ar ? 'هوية المدرسة وتوقيت الجرس الرسمي' : 'School Identity & Bell Schedule'}</strong>
        </div>
        <label className="sp-field">
          <span>{ar ? 'اسم المدرسة' : 'School Name'}</span>
          <input required value={schoolForm.name} onChange={(e) => setSchoolForm({ ...schoolForm, name: e.target.value })} />
        </label>
        <div className="sp-row-2">
          <label className="sp-field">
            <span>{ar ? 'بداية الدوام' : 'Start Time'}</span>
            <input type="time" required value={schoolForm.start} onChange={(e) => setSchoolForm({ ...schoolForm, start: e.target.value })} />
          </label>
          <label className="sp-field">
            <span>{ar ? 'نهاية الدوام' : 'End Time'}</span>
            <input type="time" required value={schoolForm.end} onChange={(e) => setSchoolForm({ ...schoolForm, end: e.target.value })} />
          </label>
        </div>
        <div className="sp-row-3">
          <label className="sp-field">
            <span>{ar ? 'مدة الحصة (د)' : 'Period (m)'}</span>
            <input type="number" min={20} max={90} value={schoolForm.periodMinutes} onChange={(e) => setSchoolForm({ ...schoolForm, periodMinutes: Number(e.target.value) })} />
          </label>
          <label className="sp-field">
            <span>{ar ? 'الاستراحة (د)' : 'Break (m)'}</span>
            <input type="number" min={0} max={30} value={schoolForm.breakMinutes} onChange={(e) => setSchoolForm({ ...schoolForm, breakMinutes: Number(e.target.value) })} />
          </label>
          <label className="sp-field">
            <span>{ar ? 'عدد الحصص' : 'Periods'}</span>
            <input type="number" min={1} max={10} value={schoolForm.periodCount} onChange={(e) => setSchoolForm({ ...schoolForm, periodCount: Number(e.target.value) })} />
          </label>
        </div>
        <button type="submit" className="sp-btn-primary" disabled={busy}>
          <Check size={15} />
          <span>{ar ? 'حفظ إعدادات المدرسة' : 'Save School Settings'}</span>
        </button>
      </form>
    </div>
  );
}
