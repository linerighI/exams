import { ArrowRight, BookOpen, CalendarDays, Clock, MessageCircle, Sparkles } from 'lucide-react';
import type { State, Homework } from './types';
import type { Language } from './i18n';
import { Orb } from './Orb';
import { dailyLessons, minutes, schoolNow } from './screens';
import { Empty, Section } from './ui';
export function Companion({
  data,
  lang,
  go,
  openWork,
  focus,
}: {
  data: State;
  lang: Language;
  go: (t: string) => void;
  openWork: (h: Homework) => void;
  focus: () => void;
}) {
  const pending = data.homework.filter((h) => !h.submission);
  const lessons = dailyLessons(data);
  const now = schoolNow(data);
  const next = lessons.find((l) => minutes(l.start) > now);
  const current = lessons.find((l) => minutes(l.start) <= now && minutes(l.end) > now);
  const ar = lang === 'ar';
  const suggestions = [
    {
      icon: CalendarDays,
      title: ar ? 'جدولك الدراسي' : 'Find your rhythm',
      detail: current
        ? `${current.subject} · ${minutes(current.end) - now} min remaining`
        : next
          ? `${next.subject} at ${next.start}`
          : ar
            ? 'عرض الجدول الأسبوعي'
            : 'Take a look at your week',
      action: () => go('schedule'),
    },
    {
      icon: BookOpen,
      title: ar ? 'متابعة واجبات الطالب' : 'Follow homework',
      detail: ar
        ? 'المواعيد والتعليمات وما سلّمه الطالب.'
        : 'Deadlines, instructions, and submitted work.',
      action: () => go('homework'),
    },
    {
      icon: MessageCircle,
      title: ar ? 'تواصل مع مدرستك' : 'A conversation away',
      detail: ar ? 'اسأل معلمك وابقَ على تواصل' : 'Ask your teacher. Share an update.',
      action: () => go('inbox'),
    },
  ];
  return (
    <div className="companion">
      <div className="companion-intro">
        <Orb size={88} />
        <div>
          <span className="eyebrow">
            {ar ? 'مساحة هادئة، ليوم أفضل' : 'YOUR DAY, A LITTLE CLEARER'}
          </span>
          <h2>
            {ar
              ? `أهلاً، ${data.user.name.split(' ')[0]}`
              : `Here for you, ${data.user.name.split(' ')[0]}.`}
          </h2>
          <p>{ar ? 'كل ما تحتاجه لخطوتك التالية.' : 'A calm place to find your next step.'}</p>
        </div>
      </div>
      <div className="companion-stats">
        <span>
          <strong>{pending.length}</strong>
          {ar ? 'واجبات للمتابعة' : 'assignments to follow'}
        </span>
        <span>
          <strong>{lessons.length}</strong>
          {ar ? 'حصص اليوم' : 'lessons today'}
        </span>
        <span>
          <strong>{data.notifications.filter((n) => !n.read).length}</strong>
          {ar ? 'تحديثات جديدة' : 'unread updates'}
        </span>
      </div>
      {suggestions.map((s, i) => (
        <button className="companion-action" key={s.title} onClick={s.action}>
          <span className="subject-icon blue">
            <s.icon size={20} />
          </span>
          <span className="row-copy">
            <strong>{s.title}</strong>
            <small>{s.detail}</small>
          </span>
          <ArrowRight size={17} />
        </button>
      ))}
      <Section title={ar?'متابعة سريعة':'A quick follow-up'} />
      {pending.length ? (
        pending.slice(0, 3).map((h) => (
          <button className="homework-row" key={h.id} onClick={() => openWork(h)}>
            <BookOpen size={19} />
            <span className="row-copy">
              <small>
                {h.subject} · {ar ? 'الموعد' : 'Due'} {h.due}
              </small>
              <strong>{h.title}</strong>
            </span>
            <ArrowRight size={17} />
          </button>
        ))
      ) : (
        <Empty
          title={ar ? 'الواجبات مسلّمة' : 'Assignments are submitted'}
          detail={
            ar
              ? 'لا توجد واجبات بانتظار تسليم الطالب حالياً.'
              : 'No outstanding student submissions.'
          }
        />
      )}
      <p className="companion-foot">
        <Sparkles size={13} />
        {ar
          ? 'من بيانات مدرستك، دون تخمينات.'
          : 'From your school records. Always grounded in your day.'}
      </p>
    </div>
  );
}
