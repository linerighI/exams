/**
 * Explicit read-only Family Preview sheet for teachers and school administrators.
 */
import { useState } from 'react';
import { ArrowRight, Eye, ShieldCheck } from 'lucide-react';
import { AttendanceScreen, GradesScreen } from './Progress';
import { TodayScreen } from './family/TodayScreen';
import { ScheduleScreen } from './family/ScheduleScreen';
import { HomeworkScreen } from './family/HomeworkScreen';
import type { Language } from './i18n';
import type { State } from './types';
import { Motion } from './ui';

export function FamilyPreview({ data, lang }: { data: State; lang: Language }) {
  const [view, setView] = useState('today');
  const [homeworkId, setHomeworkId] = useState('');
  const ar = lang === 'ar';

  const props = {
    data,
    lang,
    preview: true,
    go: setView,
    openWork: (work: State['homework'][number]) => {
      setHomeworkId(work.id);
      setView('work');
    },
    openLesson: () => setView('schedule'),
    openFocus: () => {},
    openNotice: () => setView('notices'),
    openCompanion: () => setView('schedule'),
  };

  const work = data.homework.find((h) => h.id === homeworkId);

  return (
    <section className="staff-family-preview">
      <div className="preview-mode-banner">
        <Eye size={18} />
        <span>
          <strong>{ar ? 'معاينة للقراءة فقط' : 'Read-only family preview'}</strong>
          <small>
            {ar
              ? 'أنت داخل حساب المدرسة. هذه المعاينة لا تغيّر دورك أو صلاحياتك.'
              : 'You are still in your staff account. Previewing is read-only.'}
          </small>
        </span>
      </div>
      {view !== 'today' && (
        <button className="text-button preview-home-link" onClick={() => setView('today')}>
          <ArrowRight size={15} />
          {ar ? 'العودة لمعاينة اليوم' : 'Back to day preview'}
        </button>
      )}
      <Motion identity={`preview-${view}-${data.student?.id}`}>
        {view === 'today' && <TodayScreen {...props} />}
        {view === 'schedule' && <ScheduleScreen data={data} lang={lang} openLesson={() => {}} />}
        {view === 'homework' && <HomeworkScreen {...props} />}
        {view === 'grades' && <GradesScreen data={data} lang={lang} />}
        {view === 'attendance' && <AttendanceScreen data={data} lang={lang} />}
        {view === 'work' && work && (
          <article className="work-detail blue">
            <h2>{work.title}</h2>
            <p>{work.description}</p>
            <strong>{ar ? 'ما تم تسليمه' : 'Submitted work'}</strong>
            <p className="pre-wrap">{work.submission || (ar ? 'لم يسلّم الطالب إجابته بعد.' : 'No submission yet.')}</p>
          </article>
        )}
        {(view === 'notices' || view === 'alerts') &&
          data.announcements.map((n) => (
            <article className="journal-note" key={n.id}>
              <h3>{n.title}</h3>
              <p>{n.content}</p>
            </article>
          ))}
        {view === 'notes' &&
          data.notes.map((n) => (
            <article className="journal-note" key={n.id}>
              <p>{n.content}</p>
              <strong>{n.author}</strong>
            </article>
          ))}
      </Motion>
      <p className="preview-footer">
        <ShieldCheck size={13} />
        {ar ? 'معاينة قراءة فقط لبيانات الطالب.' : 'Read-only preview of authorized student records.'}
      </p>
    </section>
  );
}
