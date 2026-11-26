/**
 * Floating Student Profile window launched alongside a Classroom or Search result
 * without ever leaving the 3D campus: shows attendance, grades, notes, and guardian info.
 */
import { useRef, useState, type FormEvent } from 'react';
import { Award, MessageSquarePlus, Phone, Send } from 'lucide-react';
import type { Language } from '../i18n';
import { gsapPop, useGsapStagger } from '../spatial/editor/editorMotion';
import { tr } from '../translations';
import type { State } from '../types';
import { FloatingWindow } from './FloatingWindow';
import { SegmentedTabs } from './SegmentedTabs';

interface StudentProfileWindowProps {
  studentId: string;
  data: State;
  lang: Language;
  busy: boolean;
  switching: boolean;
  zIndex: number;
  onFocus: () => void;
  onClose: () => void;
  mutate: (url: string, body: unknown, success?: string) => Promise<boolean>;
}

/** Floating student inspector window supporting instant attendance, grades, and notes. */
export function StudentProfileWindow({
  studentId,
  data,
  lang,
  busy,
  switching,
  zIndex,
  onFocus,
  onClose,
  mutate,
}: StudentProfileWindowProps) {
  const [tab, setTab] = useState<'attendance' | 'grades' | 'notes'>('attendance');
  const [noteText, setNoteText] = useState('');
  const [noteCat, setNoteCat] = useState<'behavior' | 'academic' | 'general'>('behavior');
  const [gradeForm, setGradeForm] = useState({ subject: '', title: '', score: '90', max: '100', published: true });
  const paneRef = useRef<HTMLDivElement>(null);

  const listEntry = data.students.find((s) => s.id === studentId);
  const st = data.student?.id === studentId ? data.student : listEntry;
  const loadedMatches = data.student?.id === studentId && !switching;

  useGsapStagger(paneRef, '.sp-info-row, .sp-note-card, .sp-inline-box', [tab, loadedMatches, st?.id], {
    y: 8,
    stagger: 0.025,
    duration: 0.24,
  });

  if (!st) return null;

  const handleAddNote = async (e: FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    const ok = await mutate(
      '/notes',
      { studentId: st.id, content: noteText.trim(), category: noteCat },
      lang === 'ar' ? 'تمت إضافة الملاحظة' : 'Note saved',
    );
    if (ok) setNoteText('');
  };

  const handleAddGrade = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await mutate(
      '/grades',
      {
        studentId: st.id,
        subject: gradeForm.subject || data.subjects[0]?.name || 'الرياضيات',
        title: gradeForm.title,
        score: Number(gradeForm.score),
        max: Number(gradeForm.max),
        published: gradeForm.published,
      },
      lang === 'ar' ? 'تم حفظ العلامة' : 'Grade recorded',
    );
    if (ok) setGradeForm({ ...gradeForm, title: '' });
  };

  return (
    <FloatingWindow
      id={`student-${st.id}`}
      title={st.name}
      subtitle={`${st.section}${st.national_id ? ` · ${st.national_id}` : ''}`}
      badge={st.today_status ? tr(st.today_status) : undefined}
      dock="left"
      width={400}
      zIndex={zIndex}
      onFocus={onFocus}
      onClose={onClose}
    >
      <div className="sp-profile-top">
        <div className="sp-profile-meta">
          {st.guardian_phone && (
            <span className="sp-chip-info">
              <Phone size={12} />
              {st.guardian_phone}
            </span>
          )}
          <span className="sp-chip-info">
            {st.has_account
              ? lang === 'ar'
                ? 'حساب العائلة مفعّل'
                : 'Family account active'
              : lang === 'ar'
                ? 'بدون حساب عائلة'
                : 'No family account'}
          </span>
        </div>

        <div className="sp-att-group">
          {(['present', 'absent', 'late', 'excused'] as const).map((status) => (
            <button
              key={status}
              type="button"
              className={`sp-att-btn is-${status} ${st.today_status === status ? 'is-active' : ''}`}
              onClick={(e) => {
                gsapPop(e.currentTarget);
                void mutate('/attendance/quick', { studentId: st.id, status }, 'Attendance recorded');
              }}
            >
              {tr(status)}
            </button>
          ))}
        </div>
      </div>

      <SegmentedTabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'attendance', label: lang === 'ar' ? 'سجل الحضور' : 'Attendance' },
          { id: 'grades', label: lang === 'ar' ? 'العلامات' : 'Grades' },
          { id: 'notes', label: lang === 'ar' ? 'الملاحظات' : 'Notes' },
        ]}
      />

      {!loadedMatches ? (
        <p className="sp-empty-note">{lang === 'ar' ? 'جارٍ تحميل سجل الطالب…' : 'Loading records…'}</p>
      ) : (
        <div ref={paneRef} className="sp-tab-pane">
          {tab === 'attendance' && (
            <div className="sp-list-stack">
              {data.attendance.length === 0 ? (
                <p className="sp-empty-note">{lang === 'ar' ? 'لا يوجد سجل حضور سابق' : 'No attendance records yet'}</p>
              ) : (
                data.attendance.slice(0, 20).map((a) => (
                  <div key={a.id} className="sp-info-row">
                    <div>
                      <strong>{a.subject}</strong>
                      <small>{a.date} · {a.start}</small>
                    </div>
                    <span className={`sp-status-tag is-${a.status}`}>{tr(a.status)}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'grades' && (
            <div className="sp-tab-pane">
              <form className="sp-inline-box" onSubmit={(e) => void handleAddGrade(e)}>
                <div className="sp-row-2">
                  <input
                    required
                    placeholder={data.subjects[0]?.name || (lang === 'ar' ? 'المادة' : 'Subject')}
                    value={gradeForm.subject}
                    onChange={(e) => setGradeForm({ ...gradeForm, subject: e.target.value })}
                  />
                  <input
                    required
                    placeholder={lang === 'ar' ? 'الاختبار / النشاط' : 'Assessment'}
                    value={gradeForm.title}
                    onChange={(e) => setGradeForm({ ...gradeForm, title: e.target.value })}
                  />
                </div>
                <div className="sp-row-actions">
                  <div className="sp-row-2">
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      required
                      value={gradeForm.score}
                      onChange={(e) => setGradeForm({ ...gradeForm, score: e.target.value })}
                    />
                    <input
                      type="number"
                      min="1"
                      step="1"
                      required
                      value={gradeForm.max}
                      onChange={(e) => setGradeForm({ ...gradeForm, max: e.target.value })}
                    />
                  </div>
                  <button type="submit" className="sp-btn-primary" disabled={busy}>
                    <Award size={14} />
                    <span>{lang === 'ar' ? 'حفظ' : 'Add'}</span>
                  </button>
                </div>
              </form>

              <div className="sp-list-stack">
                {data.grades.map((g) => (
                  <div key={g.id} className="sp-info-row">
                    <div>
                      <strong>{g.title}</strong>
                      <small>{g.subject} · {g.date}</small>
                    </div>
                    <div className="sp-grade-end">
                      <b>{g.score}/{g.max}</b>
                      {!g.published && (
                        <button
                          type="button"
                          className="sp-btn-soft"
                          onClick={() => void mutate(`/grades/${g.id}/publish`, {}, 'Saved successfully')}
                        >
                          {lang === 'ar' ? 'نشر' : 'Publish'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'notes' && (
            <div className="sp-tab-pane">
              <form className="sp-inline-box" onSubmit={(e) => void handleAddNote(e)}>
                <div className="sp-row-2">
                  <select value={noteCat} onChange={(e) => setNoteCat(e.target.value as typeof noteCat)}>
                    <option value="behavior">{lang === 'ar' ? 'ملاحظة سلوكية' : 'Behavior'}</option>
                    <option value="academic">{lang === 'ar' ? 'ملاحظة تعليمية' : 'Academic'}</option>
                    <option value="general">{lang === 'ar' ? 'ملاحظة عامة' : 'General'}</option>
                  </select>
                  <button type="submit" className="sp-btn-primary" disabled={busy}>
                    <Send size={13} />
                    <span>{lang === 'ar' ? 'إرسال' : 'Send'}</span>
                  </button>
                </div>
                <input
                  required
                  placeholder={lang === 'ar' ? 'اكتب ملاحظة تصل لولي الأمر…' : 'Write a parent-visible note…'}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                />
              </form>

              <div className="sp-list-stack">
                {data.notes.map((n) => (
                  <div key={n.id} className="sp-note-card">
                    <div className="sp-note-head">
                      <MessageSquarePlus size={13} />
                      <strong>{n.author}</strong>
                      <small>{n.created.slice(0, 10)}</small>
                    </div>
                    <p>{n.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </FloatingWindow>
  );
}
