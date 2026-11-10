import { useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  ShieldCheck,
} from 'lucide-react';
import type { State } from './types';
import type { Language } from './i18n';
import { gsap, quietMotion } from './animation';
import { Portrait } from './Portrait';
import { tr } from './translations';
export function FamilyChooser({
  data,
  lang,
  onSelect,
  busy = false,
  compact = false,
}: {
  data: State;
  lang: Language;
  onSelect: (id: string) => void;
  busy?: boolean;
  compact?: boolean;
}) {
  const [index, setIndex] = useState(
    Math.max(
      0,
      data.students.findIndex((s) => s.id === data.student?.id),
    ),
  );
  const root = useRef<HTMLDivElement>(null);
  const start = useRef<number | null>(null);
  const dragged = useRef(false);
  const ar = lang === 'ar';
  const selected = data.students[index];
  const count = data.students.length;
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      root.current?.querySelectorAll<HTMLElement>('.student-pass').forEach((card, i) => {
        const depth = (i - index + count) % count;
        const dir = ar ? -1 : 1;
        gsap.to(card, {
          x: dir * Math.min(depth, 3) * 15,
          y: Math.min(depth, 3) * -13,
          rotation: dir * Math.min(depth, 3) * 4,
          scale: 1 - Math.min(depth, 3) * 0.045,
          opacity: depth < 3 ? 1 : 0,
          zIndex: count - depth,
          duration: quietMotion() ? 0 : 0.65,
          ease: 'power3.inOut',
          overwrite: 'auto',
        });
      });
    }, root);
    return () => {
      root.current?.querySelectorAll('.student-pass').forEach((card) => gsap.killTweensOf(card));
    };
  }, [index, count, ar]);
  if (!selected)
    return (
      <p className="empty">
        {ar
          ? 'لم تُربط حسابات طلاب بعد. تواصل مع المدرسة.'
          : 'No students are linked yet. Please contact your school.'}
      </p>
    );
  const next = (delta: number) => setIndex((i) => (i + delta + count) % count);
  return (
    <div className={`family-chooser ${compact ? 'compact' : ''}`} ref={root}>
      <div className="family-intro">
        <span className="eyebrow">
          {data.user.role === 'parent'
            ? ar
              ? 'عائلة واحدة. حكايات مختلفة.'
              : 'ONE FAMILY. DIFFERENT LITTLE WORLDS.'
            : ar
              ? 'منظور العائلة، ضمن صلاحياتك'
              : 'THE FAMILY VIEW, WITHIN YOUR ACCESS'}
        </span>
        <h1>
          {ar ? (
            <>
              أيّ يومٍ
              <br />
              نقترب منه<span>؟</span>
            </>
          ) : (
            <>
              Whose day
              <br />
              shall we explore<span>?</span>
            </>
          )}
        </h1>
        <p>
          {ar
            ? 'اختر الطالب لتجد تفاصيل يومه في مكان واحد.'
            : 'Choose a child. Their whole school day is waiting.'}
        </p>
      </div>
      <div className="student-stack" aria-label={ar ? 'بطاقات الطلاب' : 'Student cards'}>
        {data.students.map((student, i) => {
          const active = i === index;
          return (
            <button
              key={student.id}
              className={`student-pass pass-${i % 3}`}
              aria-label={`${ar ? 'بطاقة' : 'Student card'} ${student.name}`}
              aria-hidden={!active}
              tabIndex={active ? 0 : -1}
              disabled={busy}
              onPointerDown={(e) => {
                if (!active || busy) return;
                start.current = e.clientX;
                dragged.current = false;
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (start.current === null || !active || quietMotion()) return;
                const dx = e.clientX - start.current;
                if (Math.abs(dx) > 8) dragged.current = true;
                if (dragged.current)
                  gsap.to(e.currentTarget, {
                    x: dx * 0.7,
                    rotation: dx * 0.025,
                    duration: 0.12,
                    overwrite: 'auto',
                  });
              }}
              onPointerUp={(e) => {
                if (start.current === null) return;
                const dx = e.clientX - start.current;
                start.current = null;
                if (Math.abs(dx) > 45) next(dx > 0 ? -1 : 1);
                else {
                  gsap.to(e.currentTarget, {
                    x: 0,
                    rotation: 0,
                    duration: 0.45,
                    ease: 'power3.out',
                  });
                }
              }}
              onPointerCancel={(e) => {
                start.current = null;
                gsap.to(e.currentTarget, { x: 0, rotation: 0, duration: 0.35 });
              }}
              onClick={() => {
                if (dragged.current) {
                  dragged.current = false;
                  return;
                }
                if (active) onSelect(student.id);
                else setIndex(i);
              }}
            >
              <div className="pass-top">
                <span>
                  <GraduationCap size={14} />
                  {data.school.name}
                </span>
                <span className="pass-check">
                  <Check size={14} />
                </span>
              </div>
              <div className="pass-copy">
                <small>{ar ? 'مساحة طالبك' : 'YOUR CHILD’S SPACE'}</small>
                <h2>{student.name}</h2>
                <span className="pass-class">
                  {tr('Class')} {tr(student.section)}
                </span>
                <p>
                  {ar ? 'يوم جديد، وخطوة تستحق المتابعة.' : 'A new day. A little more to discover.'}
                </p>
              </div>
              <Portrait variant={i} />
              <span className="pass-bottom">
                <span>{ar ? 'كل تفاصيل يومه' : 'Their day, together'}</span>
                <ArrowLeft size={20} />
              </span>
              <i className="pass-spark spark-one" />
              <i className="pass-spark spark-two" />
            </button>
          );
        })}
      </div>
      <div className="student-deck-controls">
        <button
          className="icon-button"
          aria-label={ar ? 'الطالب السابق' : 'Previous child'}
          disabled={count < 2 || busy}
          onClick={() => next(-1)}
        >
          <ChevronRight size={19} />
        </button>
        <span>
          {index + 1}
          <small> / {count}</small>
        </span>
        <button
          className="icon-button"
          aria-label={ar ? 'الطالب التالي' : 'Next child'}
          disabled={count < 2 || busy}
          onClick={() => next(1)}
        >
          <ChevronLeft size={19} />
        </button>
      </div>
      <div className="student-name-pills">
        {data.students.map((student, i) => (
          <button
            key={student.id}
            onClick={() => setIndex(i)}
            aria-pressed={i === index}
            disabled={busy}
          >
            {student.name.split(' ')[0]}
            {i === index && <span />}
          </button>
        ))}
      </div>
      <button
        className="primary family-continue"
        disabled={busy}
        onClick={() => onSelect(selected.id)}
      >
        {busy
          ? ar
            ? 'نجهّز يومه…'
            : 'Opening their day…'
          : ar
            ? `متابعة يوم ${selected.name.split(' ')[0]}`
            : `Open ${selected.name.split(' ')[0]}’s day`}
        <ArrowLeft size={18} />
      </button>
      <p className="family-private">
        <ShieldCheck size={12} />
        {ar
          ? 'تظهر فقط حسابات الطلاب المرتبطين بصلاحياتك.'
          : 'Only children authorized for this account are shown.'}
      </p>
    </div>
  );
}
